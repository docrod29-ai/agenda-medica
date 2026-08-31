/**
 * EL TOKEN DEL PORTAL DEL PACIENTE — acuñado en UN solo sitio.
 *
 * El portal (`/mi/[token]`) no entra con la sesión del equipo: entra con un
 * token HMAC. Cada arnés que quiera medirlo tiene que acuñar uno con el mismo
 * secreto que el servidor (`PORTAL_PACIENTE_SECRET`) y el mismo cálculo que
 * `src/lib/patient-token.ts`.
 *
 * POR QUÉ VIVE AQUÍ Y NO COPIADO EN CADA ARNÉS
 * ─────────────────────────────────────────────
 * Esto empezó copiado dentro de `trinquete-de-interfaz.mjs`. En cuanto un
 * segundo arnés necesitó medir el portal, la opción fácil era copiarlo otra vez
 * — y dos copias de un cálculo de firma divergen en cuanto una de las dos se
 * ajusta. El día que el `payload` cambie (una versión, un alcance, otro campo),
 * la copia que nadie tocó seguiría acuñando un token que el servidor rechaza, y
 * el arnés mediría la pantalla de «enlace no válido» **creyendo que mide el
 * portal**. Eso no falla: da un cero tranquilizador.
 *
 * Es la misma regla que el resto del repositorio: una entidad, una fuente de
 * verdad, muchas vistas.
 *
 * SIN EL SECRETO NO SE MIDE, Y SE DICE
 * ─────────────────────────────────────
 * `tokenDelPortal()` devuelve `null` si falta la variable. Quien lo use tiene
 * que **anunciarlo** — el hueco de cobertura silencioso ya pasó una vez en este
 * carril: el trinquete llevaba midiendo 66 combinaciones en vez de 69 y lo
 * avisaba en una línea que nadie leía.
 */
import { createHmac } from 'node:crypto'

/** Paciente y consultorio sembrados por el arnés. Datos sintéticos. */
const CLINICA = 'consultorio-demo-v10'
const PACIENTE = 'pac-001'

/**
 * La clave con la que se guarda el portal en los techos.
 *
 * El token lleva caducidad, así que la URL **cambia en cada corrida**. Guardar
 * la ruta literal dejaría un techo nuevo cada vez y ninguno comparable.
 */
export const CLAVE_PORTAL = '/mi/[token]'

/** ¿Es ésta la ruta del portal? Se pregunta por prefijo, no por igualdad. */
export function esPortal(ruta) {
  return String(ruta).startsWith('/mi/')
}

/** La clave de techo de una ruta: la del portal se normaliza, el resto es ella misma. */
export function claveDeRuta(ruta) {
  return esPortal(ruta) ? CLAVE_PORTAL : ruta
}

/**
 * Acuña un token de alcance `agenda` — el enlace de mostrador, el que de verdad
 * recibe un paciente. El alcance `clinico` abre secreto médico y lo emite un
 * médico; medir con él sería medir una pantalla que casi nadie ve.
 *
 * Devuelve `null` si no hay secreto utilizable.
 */
export function tokenDelPortal() {
  const sec = process.env.PORTAL_PACIENTE_SECRET
  if (!sec || sec.length < 16) return null
  const payload = {
    c: CLINICA, p: PACIENTE,
    e: Math.floor(Date.now() / 1000) + 30 * 86400, a: 'agenda', v: 0,
  }
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${b64}.${createHmac('sha256', sec).update(b64).digest('base64url')}`
}

/**
 * Añade el portal a una lista de rutas, o la devuelve intacta avisando por qué
 * no se midió. El aviso se imprime aquí para que ningún arnés pueda olvidarlo.
 */
export function conPortal(rutas, { avisar = true } = {}) {
  const t = tokenDelPortal()
  if (!t) {
    if (avisar) {
      console.log('  · portal del paciente (/mi/[token]): SIN MEDIR — falta PORTAL_PACIENTE_SECRET.')
    }
    return rutas
  }
  return [...rutas, `/mi/${t}`]
}
