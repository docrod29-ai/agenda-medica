/**
 * LA INVITACIÓN QUE SE QUEDA A MEDIAS — y el consultorio fantasma que creaba.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El alta por invitación cruzaba tres pantallas (`/unirse/CODE` → `/registro` →
 * `/unirse/CODE`) y el código de invitación sólo vivía en la barra de
 * direcciones. Cualquier interrupción lo tiraba: cerrar la pestaña, volver
 * desde el correo, o el ida y vuelta de `signInWithRedirect` con Google.
 *
 * Y el siguiente arranque no era inofensivo. Al entrar sin membresía, el layout
 * del panel manda a `/setup`, que es el asistente de **crear un consultorio
 * nuevo**. La asistente lo rellenaba —no tenía otra puerta— y acababa siendo
 * ADMINISTRADORA DE SU PROPIO CONSULTORIO VACÍO: su agenda no era la del
 * médico, y nada de lo que él configuraba (horarios, duraciones, sucursales,
 * membrete) le aparecía nunca, porque estaba mirando otro `clinicId`. La
 * invitación seguía pendiente en el panel del médico, sin usar.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Si hay una invitación a medio aceptar, el destino de quien no tiene
 * consultorio **no es** crear uno: es terminar de aceptarla. Crear consultorio
 * es lo que se hace cuando no hay invitación pendiente.
 *
 * El código se recuerda en `localStorage` (no en la sesión de la pestaña) para
 * que sobreviva al redirect de Google y a cerrar el navegador. No es dato de
 * paciente ni credencial reutilizable: es el mismo código que ya viaja por
 * WhatsApp, caduca en 7 días y muere al primer uso.
 */

export interface AlmacenSimple {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
  removeItem(clave: string): void
}

export const CLAVE_INVITACION_PENDIENTE = 'ausculta.invitacion-pendiente'

/** El alfabeto de `generarCodigo` (sin I/O/0/1) y su longitud. */
const FORMA_CODIGO = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/

/** ¿Tiene forma de código de invitación? Lo que no la tenga no se recuerda ni se obedece. */
export function esCodigoDeInvitacion(v: unknown): v is string {
  return typeof v === 'string' && FORMA_CODIGO.test(v.trim().toUpperCase())
}

function almacenPorOmision(): AlmacenSimple | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}

export function recordarInvitacion(code: unknown, almacen: AlmacenSimple | null = almacenPorOmision()): void {
  if (!almacen || !esCodigoDeInvitacion(code)) return
  try { almacen.setItem(CLAVE_INVITACION_PENDIENTE, String(code).trim().toUpperCase()) } catch { /* modo privado */ }
}

export function invitacionPendiente(almacen: AlmacenSimple | null = almacenPorOmision()): string | null {
  if (!almacen) return null
  let guardado: string | null = null
  try { guardado = almacen.getItem(CLAVE_INVITACION_PENDIENTE) } catch { return null }
  return esCodigoDeInvitacion(guardado) ? guardado!.trim().toUpperCase() : null
}

export function olvidarInvitacion(almacen: AlmacenSimple | null = almacenPorOmision()): void {
  if (!almacen) return
  try { almacen.removeItem(CLAVE_INVITACION_PENDIENTE) } catch { /* modo privado */ }
}

/**
 * A dónde mandar a quien ha iniciado sesión y NO tiene consultorio.
 *
 * Con invitación pendiente: a terminarla. Sin ella: a crear el suyo, como
 * siempre. Puro para que la prueba lo fije sin navegador.
 */
export function destinoSinConsultorio(pendiente: string | null): string {
  return esCodigoDeInvitacion(pendiente) ? `/unirse/${String(pendiente).trim().toUpperCase()}` : '/setup'
}
