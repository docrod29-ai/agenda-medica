/**
 * Rate limiting propio, respaldado en Firestore (funciona en serverless/Vercel,
 * donde la memoria del proceso no se comparte entre lambdas).
 *
 * Ventana fija por clave. Pensado para endpoints que CUESTAN dinero por llamada
 * (IA, transcripción, bot) o que se pueden spamear (soporte). Protege contra
 * cost-bombing y abuso, ADEMÁS del sistema de créditos.
 *
 * Diseño defensivo:
 *  - fail-open: si Firestore falla, NO bloquea al usuario (no romper la app por
 *    el limitador). El límite es una malla de seguridad, no el gate principal.
 *  - una transacción por request: correcto bajo concurrencia.
 *  - doc con `exp` para poder purgar con TTL de Firestore si algún día se activa.
 */
import { adminDb } from '@/lib/firebase-admin'
import { NextResponse } from 'next/server'

export interface LimiteResultado {
  ok: boolean
  restante: number
  resetEnSeg: number
  /**
   * EL LIMITADOR NO PUDO CONTAR — PATIENT-PORTAL-001 (P1).
   *
   * `ok` sigue viniendo en `true` cuando Firestore falla: el fail-open de arriba
   * es la política por defecto y NO cambia, porque veinte rutas dependen de ella
   * y romper la app por el limitador sigue siendo peor que no frenar.
   *
   * Lo que faltaba era poder SABERLO. Sin este campo, «hay cupo» y «no tengo
   * freno» llegaban al llamador como la misma respuesta, así que ninguna ruta
   * podía decidir distinto para lo que sí es peligroso sin freno. Quien necesite
   * fallar cerrado mira ESTE campo, no `ok`.
   */
  fallo: boolean
}

/**
 * Cuenta una petición contra el cupo `max` en una ventana de `ventanaSeg`.
 * `clave` debe identificar al sujeto + la acción, ej. `bot:${uid}`.
 */
export async function limitar(clave: string, max: number, ventanaSeg: number): Promise<LimiteResultado> {
  const ventanaMs = ventanaSeg * 1000
  const id = clave.replace(/[/#?]/g, '_').slice(0, 400)
  const ref = adminDb.collection('rate_limits').doc(id)
  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const now = Date.now()
      const d = snap.exists ? snap.data() : undefined
      let inicio = typeof d?.inicio === 'number' ? d.inicio : now
      let conteo = typeof d?.conteo === 'number' ? d.conteo : 0
      if (now - inicio >= ventanaMs) { inicio = now; conteo = 0 }  // ventana expiró → reset
      conteo += 1
      tx.set(ref, { inicio, conteo, exp: new Date(inicio + ventanaMs) })
      const resetEnSeg = Math.max(1, Math.ceil((inicio + ventanaMs - now) / 1000))
      return { ok: conteo <= max, restante: Math.max(0, max - conteo), resetEnSeg, fallo: false }
    })
  } catch {
    return { ok: true, restante: max, resetEnSeg: ventanaSeg, fallo: true }  // fail-open, pero DICHO
  }
}

/** Respuesta 429 estándar con Retry-After. */
export function respuesta429(resetEnSeg: number, mensaje = 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.') {
  return NextResponse.json(
    { ok: false, error: mensaje },
    { status: 429, headers: { 'Retry-After': String(resetEnSeg) } },
  )
}

/**
 * Atajo: verifica el límite y, si se excede, devuelve la respuesta 429 lista.
 * Devuelve `null` si hay cupo (sigue el flujo normal).
 */
export async function limitarOResponder(clave: string, max: number, ventanaSeg: number, mensaje?: string) {
  const r = await limitar(clave, max, ventanaSeg)
  return r.ok ? null : respuesta429(r.resetEnSeg, mensaje)
}

/** Segundos que se le piden al cliente antes de reintentar cuando no hay freno. */
const REINTENTO_SIN_FRENO_SEG = 30

export const MOTIVO_SIN_FRENO =
  'No podemos procesar esta acción en este momento. Vuelve a intentarlo en un minuto.'

/**
 * COMO `limitarOResponder`, PERO SIN FRENO NO SE PASA — PATIENT-PORTAL-001 (P1).
 *
 * Mismo contador, misma colección, misma ventana: NO es otro sistema de límite,
 * es el mismo con otra política de fallo. Lo único que cambia es qué se hace
 * cuando el limitador no pudo contar.
 *
 * `limitarOResponder` deja pasar (fail-open). Correcto para lo que sólo cuesta
 * dinero —una transcripción de más—, y equivocado para lo que un token filtrado
 * puede MOVER: una agenda, un cobro, un intento de adivinar un token. Ahí, un
 * limitador caído durante una incidencia es exactamente la ventana que el
 * atacante espera, y la acción no es urgente: puede esperar treinta segundos.
 *
 * Devuelve `null` si hay cupo; 429 si se agotó; 503 + `Retry-After` si el freno
 * no pudo contar. El 503 es RETRYABLE a propósito: nada queda quemado.
 */
export async function limitarEstricto(
  clave: string, max: number, ventanaSeg: number, mensaje?: string,
): Promise<NextResponse | null> {
  const r = await limitar(clave, max, ventanaSeg)
  if (r.fallo) {
    return NextResponse.json(
      { ok: false, error: MOTIVO_SIN_FRENO },
      { status: 503, headers: { 'Retry-After': String(REINTENTO_SIN_FRENO_SEG) } },
    )
  }
  return r.ok ? null : respuesta429(r.resetEnSeg, mensaje)
}
