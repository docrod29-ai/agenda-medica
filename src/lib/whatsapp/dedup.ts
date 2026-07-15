/**
 * Idempotencia del webhook de WhatsApp (Iteración 3 · WEBHOOK_FOUNDATION).
 *
 * Meta puede ENTREGAR el mismo evento varias veces (reintentos). Sin dedup, un
 * mensaje duplicado re-procesa (doble respuesta, o intento de doble acción). Se
 * deduplica por `wamid` (id del mensaje).
 *
 * Diseño FAIL-OPEN: si el store de dedup falla, se PROCESA el mensaje (nunca se
 * descarta un mensaje real por un fallo de dedup). El peor caso de un bug de
 * dedup es "procesar dos veces" (el comportamiento previo), no "perder un mensaje".
 * La creación de cita ya es atómica, así que un duplicado no genera doble cita.
 *
 * Las funciones de clave/validación son PURAS (testeables); el acceso a Firestore
 * está aislado en `marcarProcesado`.
 */
import { adminDb } from '@/lib/firebase-admin'

/** ¿Parece un id de mensaje de WhatsApp válido? */
export function esWamidValido(wamid: unknown): wamid is string {
  return typeof wamid === 'string' && wamid.length > 0 && wamid.length <= 256
}

/** Convierte un wamid en una clave de documento Firestore segura (sin '/'). */
export function claveDedup(wamid: string): string {
  // Firestore no permite '/' en un id de documento; el wamid es base64url-ish
  // pero puede traer caracteres problemáticos. Se sanea de forma determinista.
  return wamid.replace(/[/#?[\]*]/g, '_').slice(0, 256)
}

/** Días que se conserva la marca de dedup (para una política TTL de Firestore). */
export const DEDUP_TTL_DIAS = 3

/**
 * Marca el wamid como procesado. Devuelve `{ nuevo: true }` si es la PRIMERA vez
 * (hay que procesar) o `{ nuevo: false }` si ya se había visto (saltar).
 * Fail-open: ante wamid inválido o error del store → `{ nuevo: true }`.
 */
export async function marcarProcesado(
  wamid: unknown,
  ahoraMs: number = Date.now(),
): Promise<{ nuevo: boolean }> {
  if (!esWamidValido(wamid)) return { nuevo: true } // sin id fiable → procesar
  const ref = adminDb.collection('whatsapp_dedup').doc(claveDedup(wamid))
  try {
    // create() falla si el documento ya existe → duplicado.
    await ref.create({
      at: new Date(ahoraMs).toISOString(),
      // Campo para una política TTL de Firestore (borra marcas viejas solas).
      expira: new Date(ahoraMs + DEDUP_TTL_DIAS * 86400_000),
    })
    return { nuevo: true }
  } catch (e) {
    const code = (e as { code?: number | string })?.code
    // ALREADY_EXISTS (código 6 en gRPC / 'already-exists') → duplicado.
    if (code === 6 || code === 'already-exists') return { nuevo: false }
    // Cualquier otro error → fail-open: no perder el mensaje.
    return { nuevo: true }
  }
}

/** Redacta un teléfono para logs (evita PHI/PII): deja solo los últimos 4. */
export function telefonoRedactado(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '')
  return soloDigitos.length <= 4 ? '••••' : '••••' + soloDigitos.slice(-4)
}
