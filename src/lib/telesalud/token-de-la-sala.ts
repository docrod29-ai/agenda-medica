/**
 * EL TOKEN QUE HACE QUE EL ENLACE DE LA VIDEOCONSULTA SIRVA.
 *
 * ── DE DÓNDE VIENE ESTO ─────────────────────────────────────────────────────
 *
 * REG-265 cerró el camino del portal: el botón «Entrar a la videoconsulta» no
 * llevaba token y `/api/telesalud/sala` responde **404 «Cita no encontrada»** a
 * quien no lo trae. El paciente veía que su cita no existía, en su propio
 * portal, a la hora de su consulta.
 *
 * El camino de WhatsApp quedó a medias, y a propósito: `dondeEsLaCita` dejó de
 * emitir enlace sin token y pasó a decir «recibirás el enlace por este medio».
 * Honesto — un 404 es peor que un aviso—, pero **el paciente seguía sin
 * enlace**, y el recordatorio de WhatsApp es donde de verdad lo necesita.
 *
 * Este módulo es la pieza que faltaba: acuña el token **en el servidor**, donde
 * vive el secreto de firma.
 *
 * ── POR QUÉ NO ESTÁ EN `lib/whatsapp.ts` ────────────────────────────────────
 *
 * Porque ese módulo se importa **también desde el navegador**. Firmar ahí
 * mandaría el secreto HMAC al cliente, y el secreto que firma los enlaces del
 * paciente da acceso al expediente de cualquiera. Este archivo sólo lo importan
 * rutas de servidor.
 *
 * ── EL PLAZO NO ES UNA CONSTANTE ────────────────────────────────────────────
 *
 * Un token de 1 día caducaría antes de una cita agendada para la semana que
 * viene, y el paciente volvería a encontrarse el 404. Un token de 30 días es
 * una credencial larga viajando por WhatsApp, que es exactamente lo que se
 * reenvía a un grupo familiar sin pensarlo.
 *
 * Así que el plazo **se deriva de la cita**: lo justo para llegar a ella, con un
 * día de margen, y con un techo. Si la cita cae fuera del techo, no se emite —
 * el mensaje dice que el enlace llega aparte, y el recordatorio de 24 h, que sí
 * cae dentro, lo trae.
 */
import { crearTokenPaciente } from '@/lib/patient-token'

/** Margen tras la cita: la sala sigue sirviendo si la consulta se alarga. */
export const DIAS_DE_MARGEN = 1

/**
 * Techo del plazo. Una cita más lejana no lleva enlace en ese mensaje: lo
 * llevará su recordatorio. Preferimos un mensaje sin enlace a una credencial
 * larga en un chat que se reenvía.
 */
export const DIAS_TECHO = 3

/** Lee `portalTokenVersion` del expediente. Se inyecta para poder probar esto. */
export type LeerVersion = (clinicId: string, patientId: string) => Promise<number>

export interface DatosDelToken {
  clinicId?: string
  patientId?: string
  /** `fechaHora` de la cita, tal como se guarda: `'YYYY-MM-DD HH:mm'`. */
  fechaHora?: string
  /** Instante de referencia. Explícito para que la prueba no dependa del reloj. */
  ahora: Date
}

/**
 * Días entre `ahora` y la cita, redondeando **hacia arriba**: media jornada de
 * diferencia tiene que contar como un día entero o el token muere antes.
 * Devuelve 0 para una cita ya pasada.
 */
export function diasHastaLaCita(fechaHora: string, ahora: Date): number {
  // `'YYYY-MM-DD HH:mm'` → ISO local. No se usa la zona de la clínica a
  // propósito: aquí sólo se decide un PLAZO, y una hora de desfase la absorbe
  // el margen. Meter zonas horarias en el cálculo de una caducidad es añadir
  // una forma de equivocarse sin ganar nada.
  const t = Date.parse(fechaHora.replace(' ', 'T'))
  if (!Number.isFinite(t)) return NaN
  const dias = (t - ahora.getTime()) / 86_400_000
  return dias <= 0 ? 0 : Math.ceil(dias)
}

/**
 * Token del paciente para el enlace de SU sala, o `undefined` si no procede.
 *
 * `undefined` no es un fallo: es la respuesta correcta cuando falta el dato o
 * la cita queda fuera del techo. Quien llama pasa ese `undefined` tal cual a
 * `dondeEsLaCita`, que entonces escribe `SIN_ENLACE` en vez de un enlace roto.
 * **Nunca se devuelve un token que vaya a caducar antes de la cita.**
 */
export async function tokenParaLaSala(
  d: DatosDelToken,
  leerVersion: LeerVersion,
): Promise<string | undefined> {
  if (!d.clinicId || !d.patientId || !d.fechaHora) return undefined

  const dias = diasHastaLaCita(d.fechaHora, d.ahora)
  if (!Number.isFinite(dias) || dias > DIAS_TECHO) return undefined

  const ttl = Math.max(1, dias + DIAS_DE_MARGEN)

  /**
   * La versión de revocación. Si no se puede leer se emite la 0: el enlace
   * sirve, y una revocación posterior lo corta igual porque el contador del
   * expediente subirá por encima. Fallar aquí dejaría al paciente sin enlace
   * por un problema nuestro, que es el defecto que estamos reparando.
   */
  let version = 0
  try { version = await leerVersion(d.clinicId, d.patientId) } catch { /* ver arriba */ }

  /**
   * Alcance `agenda`, el mínimo. `/api/telesalud/sala` no mira el alcance:
   * comprueba que el token sea DE ESE paciente y DE ESA clínica. Pedir alcance
   * `clinico` para entrar a una videollamada sería mandar por WhatsApp una
   * credencial que abre el expediente.
   */
  return crearTokenPaciente(d.clinicId, d.patientId, ttl, 'agenda', version)
}

export const POR_QUE_EL_PLAZO_SE_DERIVA =
  'Porque un plazo fijo se equivoca en los dos sentidos: corto caduca antes de ' +
  'la cita y devuelve el 404 que veníamos a evitar; largo deja una credencial ' +
  'del paciente viva en un chat que se reenvía. El plazo justo lo dice la cita.'
