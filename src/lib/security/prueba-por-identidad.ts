/**
 * LA PRUEBA DE 14 DÍAS SE ESTRENA UNA VEZ POR IDENTIDAD (Panel de Lujo N-007).
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `/api/clinic/crear` concedía la prueba a toda cuenta sin `clinic_members`.
 * La defensa contra el reciclado vivía en Stripe (`decidirPrueba`) y es POR
 * CLIENTE DE STRIPE, que se crea por consultorio: un correo nuevo produce un
 * uid nuevo, un consultorio nuevo, un cliente nuevo y una prueba nueva.
 * Decisión N-1 del dueño, abierta; su recomendación anotada («una por cuenta,
 * comprobada contra Stripe») no cierra este camino.
 *
 * ── LO QUE SE HACE, Y LO QUE NO ──────────────────────────────────────────────
 *
 * Una marca a nivel de plataforma, `pruebas_estrenadas/{huella}`, escrita con
 * Admin SDK al conceder la prueba. La huella es SHA-256 del correo NORMALIZADO
 * (minúsculas, sin espacios, sin `+etiqueta` y sin puntos en Gmail): así
 * `Doctor+2@gmail.com` y `doc.tor@gmail.com` son la misma identidad. El correo
 * no se guarda: sólo la huella y la fecha.
 *
 * NO impide registrarse ni crear el consultorio. Sólo decide si la prueba se
 * concede: si la identidad ya la estrenó, el consultorio nace con la prueba
 * YA VENCIDA —`trialEndsAtMs = ahora`—, que es lo que el paywall ya sabe
 * tratar (lectura siempre; escritura tras el día de gracia). Valor seguro:
 * bloquear en vez de permitir. El dueño puede reabrir la prueba a mano desde
 * /superadmin, como ya hace hoy con cualquier consultorio.
 *
 * Módulo PURO.
 */
import { createHash } from 'node:crypto'

/** Correo canónico para comparar identidades. Vacío si no parece correo. */
export function normalizarCorreo(correo: string): string {
  const limpio = String(correo ?? '').trim().toLowerCase()
  const arroba = limpio.lastIndexOf('@')
  if (arroba <= 0 || arroba === limpio.length - 1) return ''
  let usuario = limpio.slice(0, arroba)
  const dominio = limpio.slice(arroba + 1)
  // `+etiqueta` es un alias en casi todos los proveedores.
  const mas = usuario.indexOf('+')
  if (mas > 0) usuario = usuario.slice(0, mas)
  // Gmail ignora los puntos del usuario.
  if (dominio === 'gmail.com' || dominio === 'googlemail.com') usuario = usuario.replace(/\./g, '')
  return `${usuario}@${dominio === 'googlemail.com' ? 'gmail.com' : dominio}`
}

/** Id del documento en `pruebas_estrenadas`. Nunca contiene el correo. */
export function huellaDeIdentidad(correo: string): string | null {
  const canon = normalizarCorreo(correo)
  if (!canon) return null
  return createHash('sha256').update(canon, 'utf8').digest('hex')
}

export const DURACION_PRUEBA_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Cuándo termina la prueba de un consultorio nuevo.
 *  · identidad nueva → 14 días desde ahora, y se marca como estrenada;
 *  · identidad que ya estrenó → termina AHORA (paywall tras la gracia);
 *  · sin correo verificable → se concede (no se castiga a quien no se puede
 *    identificar, pero tampoco se marca nada).
 */
export function decidirFinDePrueba(p: { yaEstrenada: boolean; ahoraMs: number }): { finMs: number; concedida: boolean } {
  if (p.yaEstrenada) return { finMs: p.ahoraMs, concedida: false }
  return { finMs: p.ahoraMs + DURACION_PRUEBA_MS, concedida: true }
}

export const POR_QUE_NO_SE_BLOQUEA_EL_ALTA =
  'Porque el dueño decidió que nunca se bloquea la app entera por falta de tarjeta. ' +
  'Reciclar la prueba no impide entrar: sólo hace que el consultorio nazca con la ' +
  'prueba ya vencida, y desde ahí rige el mismo paywall que para cualquier otro.'
