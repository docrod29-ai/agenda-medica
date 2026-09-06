/**
 * MAYÚSCULA INICIAL EN ESPAÑOL — sólo la primera letra, no cada palabra.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `text-transform: capitalize` pone en mayúscula la primera letra de CADA
 * palabra. Es la regla del inglés, no la del español. En la pantalla donde el
 * paciente elige el día de su cita, `es-MX` devuelve «lun 31 de ago» y el CSS lo
 * pintaba:
 *
 *     Lun 31 De Ago        ← «De» en mayúscula, en las doce fichas del calendario
 *
 * En español las preposiciones no van en mayúscula dentro de una frase. Es la
 * primera pantalla en la que el paciente toma una decisión, y todas sus fichas
 * estaban mal escritas.
 *
 * ── POR QUÉ NO SE ARREGLA CON CSS ────────────────────────────────────────────
 *
 * Porque no existe un `text-transform` que haga esto: `capitalize` es por
 * palabra por definición. Tiene que hacerse sobre el texto, y por eso vive aquí
 * y no en una hoja de estilo.
 *
 * ── QUÉ **NO** HACE ──────────────────────────────────────────────────────────
 *
 * No corrige nombres propios ni siglas: si el texto trae «lunes, 1 de
 * septiembre», devuelve «Lunes, 1 de septiembre», que es lo correcto. Lo que no
 * puede saber es si «sep» era «Sep» por ser abreviatura de un nombre propio —
 * en español los meses van en minúscula, así que no lo son.
 */
export function conMayusculaInicial(texto: string): string {
  const s = String(texto ?? '')
  if (!s) return s
  // `charAt(0)` y no `[0]`: una cadena vacía no debe devolver `undefined`.
  return s.charAt(0).toLocaleUpperCase('es-MX') + s.slice(1)
}

/**
 * PLURAL DE VERDAD — «1 cobro», no «1 cobros» ni «1 cobro(s)».
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Panel de Lujo, hallazgo ZC-011 (y sus hermanos del §12): la aplicación
 * escribía el plural de tres maneras distintas y dos de ellas se leen como si
 * las hubiera escrito una máquina:
 *
 *     «1 cobros»                    ← la `s` puesta siempre
 *     «3 resultado(s)»              ← el paréntesis que delata al programador
 *     «1 episodio» / «2 episodios»  ← lo correcto, escrito a mano fila por fila
 *
 * La tercera forma es la buena y ya existía —`InternamientosDelPaciente`— pero
 * copiada en el JSX de cada componente, así que cada pantalla nueva volvía a
 * elegir. Esta función es esa forma, escrita una vez.
 *
 * ── QUÉ **NO** HACE ──────────────────────────────────────────────────────────
 *
 * No conjuga el verbo ni concuerda el artículo: «1 cobro registrado» / «2
 * cobros registrados» exige pasar la frase entera, y para eso están los dos
 * parámetros de texto. Tampoco conoce plurales irregulares: se le dan los dos.
 * Y no formatea el número (miles, decimales): eso es de `Intl`.
 */
export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * DE CÓDIGO DE MÁQUINA A FRASE DE PERSONA — Panel de Lujo C-020, C-021, C-022,
 * ZC-021 y ZC-024.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Lo que salía a la pantalla del médico —y en un caso a la del visitante de la
 * demo pública— era el texto interno del proveedor:
 *
 *     «Error al guardar: Missing or insufficient permissions»
 *     «Detalle técnico: permission-denied»
 *     «No se pudo entrar con Google: auth/network-request-failed»
 *     «TypeError: Failed to fetch»
 *
 * Nada de eso dice qué pasó, qué queda ni qué hacer. Y el detalle técnico que
 * sí sirve —para el reporte de error— no se pierde: sigue disponible para la
 * consola y el reporte, que es donde lo lee quien puede hacer algo con él.
 *
 * ── LA FÓRMULA ───────────────────────────────────────────────────────────────
 *
 * «qué NO pasó · qué hacer». Nunca empieza por «Error»: la palabra sola no
 * informa de nada, y es lo que el hallazgo C-020 encontró 45 veces.
 *
 * ── QUÉ **NO** HACE ──────────────────────────────────────────────────────────
 *
 * No adivina: un código que no está en la tabla devuelve la frase genérica, que
 * también es en español y también dice qué hacer. No inventa una causa que no
 * conoce. Y **no oculta el fallo**: quien llama sigue teniendo el error crudo
 * para registrarlo — esta función decide qué se LEE, no qué se guarda.
 *
 * Tampoco traduce mensajes clínicos: aquí sólo viven códigos de infraestructura
 * (Firebase Auth, Firestore, red).
 */
const FRASE_POR_CODIGO: Record<string, string> = {
  /* Firestore / Firebase, en el orden en que se ven en producción. */
  'permission-denied': 'Tu sesión no tiene permiso para esto. Vuelve a entrar y, si sigue igual, pídele a quien administra el consultorio que revise tu rol.',
  'unavailable': 'No hay conexión con el servidor. Revisa tu internet: lo que escribiste sigue aquí.',
  'deadline-exceeded': 'El servidor tardó demasiado en contestar. Vuelve a intentarlo.',
  'unauthenticated': 'Tu sesión caducó. Vuelve a entrar.',
  'not-found': 'Eso ya no existe. Puede que se haya borrado desde otro dispositivo.',
  'already-exists': 'Ya existe algo con esos datos.',
  'resource-exhausted': 'Se alcanzó el límite del servicio por ahora. Vuelve a intentarlo en unos minutos.',
  'failed-precondition': 'Falta un paso antes de poder hacer esto.',
  'cancelled': 'La operación se canceló antes de terminar.',

  /* Firebase Auth — los códigos que sí pueden llegarle a alguien. */
  'auth/network-request-failed': 'No hay conexión con el servidor de acceso. Revisa tu internet y vuelve a intentarlo.',
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar. Vuelve a intentarlo.',
  'auth/cancelled-popup-request': 'Se canceló el acceso con Google. Vuelve a intentarlo.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.',
  'auth/account-exists-with-different-credential': 'Ese correo ya tiene cuenta aquí, creada con otro método. Entra con tu contraseña.',
  'auth/user-disabled': 'Esa cuenta está deshabilitada. Escríbele a soporte.',
  'auth/too-many-requests': 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  'auth/unauthorized-domain': 'Este sitio todavía no está autorizado para entrar con Google. Avísale a soporte.',
  'auth/invalid-credential': 'El correo o la contraseña no coinciden.',
  'auth/wrong-password': 'El correo o la contraseña no coinciden.',
  'auth/user-not-found': 'El correo o la contraseña no coinciden.',
  'auth/email-already-in-use': 'Ese correo ya tiene cuenta aquí. Entra en lugar de registrarte.',
  'auth/weak-password': 'Esa contraseña es demasiado corta. Usa al menos seis caracteres.',
  'auth/invalid-email': 'Ese correo no tiene forma de correo.',
}

/** Lo que se dice cuando no se sabe más. También en español, también accionable. */
export const FRASE_GENERICA =
  'No se pudo completar. Revisa tu conexión y vuelve a intentarlo; si sigue igual, repórtalo desde Ayuda.'

/** Frase para cuando el navegador se quedó sin red (`Failed to fetch` y parientes). */
export const FRASE_SIN_RED =
  'No hay conexión ahora mismo. Revisa tu internet y vuelve a intentarlo.'

/** El código de máquina que venía dentro del error, si lo hubiera. Para el reporte, no para la pantalla. */
export function codigoDeError(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const code = (e as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return ''
}

export function enEspanolLlano(e: unknown): string {
  const code = codigoDeError(e)
  if (code && FRASE_POR_CODIGO[code]) return FRASE_POR_CODIGO[code]

  const mensaje = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  /* Un código puede venir dentro del mensaje («Firebase: Error (auth/…)»). */
  const dentro = /((?:auth|storage|functions)\/[a-z-]+)/.exec(mensaje)?.[1]
  if (dentro && FRASE_POR_CODIGO[dentro]) return FRASE_POR_CODIGO[dentro]

  /* Fallo de red del navegador: no trae código, siempre trae el mismo texto. */
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(mensaje)) return FRASE_SIN_RED
  if (/missing or insufficient permissions/i.test(mensaje)) return FRASE_POR_CODIGO['permission-denied']

  return FRASE_GENERICA
}

/**
 * Un aviso completo: qué no se pudo hacer, y en español llano por qué.
 *
 * `noSePudo('guardar los horarios', e)` → «No se pudo guardar los horarios. Tu
 * sesión no tiene permiso…». El primer parámetro es la ACCIÓN en infinitivo con
 * su objeto; quien llama sabe qué estaba intentando, y esta función no.
 */
export function noSePudo(accion: string, e?: unknown): string {
  const cabeza = `No se pudo ${accion}.`
  const cola = e === undefined ? FRASE_GENERICA : enEspanolLlano(e)
  return `${cabeza} ${cola}`
}
