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
export const CLAVE_PORTAL_CLINICO = '/mi/[token:clinico]'

/** ¿Es ésta la ruta del portal? Se pregunta por prefijo, no por igualdad. */
export function esPortal(ruta) {
  return String(ruta).startsWith('/mi/')
}

/**
 * La clave de techo de una ruta. La del portal se normaliza —el token lleva
 * caducidad y cambia en cada corrida— y ADEMÁS se separa por alcance: con el
 * enlace de mostrador el portal enseña un muro donde el clínico enseña las
 * recetas, así que son dos pantallas distintas con dos cuentas distintas.
 *
 * El alcance se lee del propio token en vez de pasarlo aparte: así no puede
 * desincronizarse de lo que de verdad se midió.
 */
export function claveDeRuta(ruta) {
  if (!esPortal(ruta)) return ruta
  return alcanceDelToken(String(ruta).slice('/mi/'.length)) === 'clinico'
    ? CLAVE_PORTAL_CLINICO
    : CLAVE_PORTAL
}

/** Lee el alcance del payload sin verificar la firma: sólo sirve para etiquetar. */
export function alcanceDelToken(token) {
  try {
    const p = JSON.parse(Buffer.from(String(token).split('.')[0], 'base64url').toString('utf8'))
    return p.a === 'clinico' ? 'clinico' : 'agenda'
  } catch {
    return 'agenda'
  }
}

/**
 * Acuña un token del portal. Por defecto, alcance `agenda`: el enlace de
 * mostrador, el que de verdad recibe la mayoría de los pacientes.
 *
 * `clinico` es el que emite un médico y **abre secreto médico**: detrás de él
 * viven `documentos` y `paquetes`, o sea las recetas y lo que el médico liberó
 * de cada consulta. Con un token de mostrador esas dos peticiones devuelven
 * 403, así que esa mitad del portal NO SE HABÍA MEDIDO NUNCA — el arnés veía la
 * pantalla con el muro puesto y contaba sus controles como si fueran todos.
 *
 * Se mide contra el consultorio SEMBRADO, con paciente sintético. Aquí no hay
 * secreto de nadie: lo que se vigila es que los controles de esa mitad se
 * comporten, no lo que dicen.
 *
 * Devuelve `null` si no hay secreto utilizable.
 *
 * @param {'agenda'|'clinico'} [alcance]
 */
export function tokenDelPortal(alcance = 'agenda') {
  const sec = process.env.PORTAL_PACIENTE_SECRET
  if (!sec || sec.length < 16) return null
  const payload = {
    c: CLINICA, p: PACIENTE,
    e: Math.floor(Date.now() / 1000) + 30 * 86400, a: alcance, v: 0,
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
  const c = tokenDelPortal('clinico')
  if (!t || !c) {
    if (avisar) {
      console.log('  · portal del paciente (/mi/[token]): SIN MEDIR — falta PORTAL_PACIENTE_SECRET.')
    }
    return rutas
  }
  // Las DOS caras: con el enlace de mostrador el portal enseña un muro donde el
  // clínico enseña recetas y paquetes. Medir sólo una deja la otra sin vigilar.
  return [...rutas, `/mi/${t}`, `/mi/${c}`]
}
