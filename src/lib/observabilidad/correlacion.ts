/**
 * UNA TRAZA QUE CRUZA LA FRONTERA — navegador → API → trabajo → proveedor.
 *
 * ── QUÉ FALTABA (WS-13) ──────────────────────────────────────────────────────
 *
 * No existía. El tablero lo decía con precisión y era exacto: `requestId` **se
 * fabrica en cada ruta**, no llega del cliente, no viaja al proveedor, y el
 * gateway lo **muta** (`${requestId}-${proveedor}`). Es la clave del libro de
 * costos, no una traza.
 *
 * La consecuencia práctica: cuando un médico dice «se me quedó pensando y no
 * salió la nota», no hay forma de seguir esa petición desde su navegador hasta la
 * llamada al proveedor. Se busca por hora y por consultorio, a mano.
 *
 * ── POR QUÉ UN CAMPO NUEVO Y NO ARREGLAR `requestId` ────────────────────────
 *
 * Porque la causa raíz es que **un campo hacía dos trabajos**. `requestId` es la
 * clave con la que se cobra: el gateway le añade el proveedor a propósito, para
 * que dos intentos del mismo trabajo se cobren por separado. Una traza necesita
 * lo contrario — **el mismo identificador de punta a punta**.
 *
 * Arreglar uno rompería el otro. Van separados.
 *
 * ── LA FORMA ES LA DEFENSA CONTRA EL PHI ────────────────────────────────────
 *
 * El identificador es **opaco y de forma fija**: `c` y dieciséis hexadecimales.
 * No lleva uid, ni correo, ni nombre, ni consultorio.
 *
 * Y no es una recomendación: `correlacionDe()` **valida la forma** y acuña uno
 * nuevo si lo que llega no encaja. Un cliente —o alguien curioseando— que mande
 * `x-correlacion: juan-perez-diabetes` no consigue meter eso en los registros:
 * se descarta y se sustituye. La regla de privacidad de esta casa dice que la PHI
 * nunca va en un log ni en un parámetro; aquí la única forma de cumplirla es que
 * el campo **no pueda** contenerla.
 *
 * Nótese la diferencia con `requestId`, que hoy embebe el uid del médico
 * (`np-${acceso.uid}-${Date.now()}`). Eso identifica a una persona, y por eso la
 * traza no se construye encima de él.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * **No mide nada.** Es el hilo, no el instrumento: correlaciona registros que ya
 * existen. Las métricas de latencia y error por ruta siguen siendo trabajo aparte.
 *
 * Módulo PURO salvo `nuevaCorrelacion`, que necesita azar.
 */

/** La cabecera. Una sola definición: dos nombres serían dos trazas. */
export const CABECERA_CORRELACION = 'x-correlacion'

/**
 * `c` + 16 hexadecimales. Ni más largo ni más corto, y sin separadores.
 *
 * Lo estrecho es deliberado: cuanto menos quepa, menos puede colarse. Con 64 bits
 * de azar, dos peticiones del mismo día no chocan.
 */
export const FORMA_CORRELACION = /^c[0-9a-f]{16}$/

/** ¿Tiene la forma exacta? Lo que no la tenga no entra a un registro. */
export function esCorrelacionValida(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMA_CORRELACION.test(valor)
}

/**
 * Acuña una correlación nueva.
 *
 * Con `crypto.getRandomValues` donde exista —navegador y Node moderno— y con
 * `Math.random` sólo como último recurso: una traza repetida es un incordio, no
 * un problema de seguridad, así que no vale la pena romper el arranque por ello.
 */
export function nuevaCorrelacion(): string {
  const bytes = new Uint8Array(8)
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  return `c${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`
}

/** Lo mínimo que hace falta de una petición. No se importa `NextRequest` aquí. */
export interface ConCabeceras {
  readonly headers: { get(nombre: string): string | null }
}

/**
 * La correlación de esta petición: la que venga del cliente si es válida, o una
 * nueva.
 *
 * **Nunca devuelve lo que llegó sin validarlo.** Ésa es toda la defensa: el
 * servidor no confía en la forma de una cabecera que cualquiera puede escribir.
 */
export function correlacionDe(req: ConCabeceras): string {
  const cruda = req.headers.get(CABECERA_CORRELACION)
  return esCorrelacionValida(cruda) ? cruda : nuevaCorrelacion()
}

/**
 * LA TRAZA DE UN TRABAJO DE FONDO — REG-418.
 *
 * ── POR QUÉ NO VALE `correlacionDe(req)` AQUÍ ───────────────────────────────
 *
 * Un cron llega por HTTP, así que la tentación es reutilizar `correlacionDe`: no
 * traería cabecera y acuñaría una nueva igual. Pero el endpoint es una URL, y
 * quien tenga el secreto del cron **puede mandarle una cabecera**. Con
 * `correlacionDe`, quien llame elige la traza — y dos ejecuciones distintas
 * podrían compartirla, o una podría fijarse a la de otra cosa a propósito.
 *
 * Un trabajo de fondo no nace de un navegador: nace del reloj. Su traza se
 * acuña **al arrancar**, sin mirar lo que llegó, y por eso es una función
 * distinta y no un parámetro de la otra. Un `correlacionDe(req, { confiar: false })`
 * habría dejado la decisión en cada llamador, que es como se pierden.
 *
 * ── QUÉ ATA ─────────────────────────────────────────────────────────────────
 *
 * Una ejecución entera: el latido que deja, lo que mande y lo que falle. Sin
 * ella, «el recordatorio de las 8:00 no llegó» no se puede seguir hasta la
 * corrida que lo intentó — sólo hasta la colección donde acabó.
 */
export function correlacionDeTrabajo(): string {
  return nuevaCorrelacion()
}

export const POR_QUE_UN_TRABAJO_NO_ACEPTA_LA_QUE_LE_MANDEN =
  'Un cron llega por HTTP y quien tenga su secreto puede mandarle una cabecera. '
  + 'Si aceptara la que le llega, quien llama elegiría la traza: dos ejecuciones '
  + 'podrían compartirla, o una podría fijarse a la de otra cosa. Un trabajo de '
  + 'fondo no nace de un navegador, nace del reloj, y su traza se acuña al arrancar.'

export const POR_QUE_NO_SE_REUSA_REQUESTID =
  'Porque un campo hacía dos trabajos. `requestId` es la clave con la que se COBRA, ' +
  'y el gateway le añade el proveedor a propósito para que dos intentos del mismo ' +
  'trabajo se cobren aparte. Una traza necesita lo contrario: el mismo identificador ' +
  'de punta a punta. Arreglar uno rompería el otro.'

export const POR_QUE_LA_FORMA_ES_LA_DEFENSA =
  'El identificador es opaco y de forma fija, y `correlacionDe` la VALIDA: quien ' +
  'mande «x-correlacion: juan-perez-diabetes» no mete eso en los registros, se ' +
  'descarta y se acuña otro. La PHI no se evita pidiéndolo por favor, se evita ' +
  'haciendo que el campo no pueda contenerla. Por eso tampoco se construye sobre ' +
  '`requestId`, que hoy embebe el uid del médico.'
