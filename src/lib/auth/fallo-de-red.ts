/**
 * UN FALLO DE RED NO ES UNA CONTRASEÑA EQUIVOCADA.
 *
 * ── QUÉ FALLABA, MEDIDO EN NAVEGADOR ─────────────────────────────────────────
 *
 * Cortando la llamada de identidad —lo que hace una red de consultorio con mala
 * señal— y pulsando «Iniciar sesión», la pantalla contestaba:
 *
 *     «Error al iniciar sesión. Intenta de nuevo.»
 *
 * El mensaje culpa al inicio de sesión. Lo que pasó fue que no había red. Y lo
 * que hace el médico con ese mensaje es lo peor posible: vuelve a teclear su
 * contraseña, la cambia, pide recuperarla —otra llamada que tampoco va a
 * salir— y acaba llamando a soporte. En `/registro`, el mismo corte no enseñaba
 * **ningún** mensaje.
 *
 * Es la familia «el mensaje mentía sobre la causa» del ledger, en la puerta de
 * entrada del producto.
 *
 * ── POR QUÉ UN MÓDULO Y NO UN `if` EN CADA PANTALLA ──────────────────────────
 *
 * Porque son cinco sitios: entrar con correo, entrar con Google, el código de
 * dos factores, registrarse y registrarse con Google. Cinco copias de la misma
 * condición se desfasan; ya pasó con el sello de versión, con la tabla del tema
 * y con la mayúscula de las fechas.
 *
 * ── QUÉ **NO** HACE ──────────────────────────────────────────────────────────
 *
 * - **No reintenta.** Decir la verdad y dejar el botón listo es lo que el
 *   médico necesita; reintentar solo sobre una red caída añade espera sin
 *   añadir información.
 * - **No distingue** «no hay wifi» de «el proveedor de identidad no contesta».
 *   Desde el navegador no se puede, y prometer esa distinción sería el mismo
 *   error otra vez. El mensaje dice lo que se sabe: la petición no salió.
 */

/** Códigos de Firebase Auth que significan «la petición no salió de aquí». */
const CODIGOS_DE_RED = new Set([
  'auth/network-request-failed',
  'auth/timeout',
  'auth/web-storage-unsupported',
])

/**
 * ¿Este error es de red, y no de credenciales?
 *
 * Mira el código y, como respaldo, el propio navegador: si `navigator.onLine`
 * dice que no hay conexión, no hace falta ningún código para saberlo.
 */
export function esFalloDeRed(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? ''
  if (CODIGOS_DE_RED.has(code)) return true
  // `onLine` sólo es fiable en negativo: `false` significa sin red de verdad;
  // `true` no garantiza que haya internet. Se usa sólo para el caso negativo.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const mensaje = String((err as { message?: string })?.message ?? '')
  return /network|failed to fetch|networkerror/i.test(mensaje)
}

/**
 * Lo que se le dice al médico. Una sola redacción para las cinco puertas.
 *
 * Nombra la causa y dice qué hacer, sin culpar a sus datos y sin prometer que
 * el problema está en su casa: puede estar en cualquier punto del camino.
 */
export const MENSAJE_SIN_RED =
  'No se pudo conectar. Revisa tu conexión y vuelve a intentarlo — tus datos están bien.'
