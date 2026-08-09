/**
 * DÓNDE ES LA CITA — y por qué a una videoconsulta no se le manda la dirección.
 *
 * ── LO QUE DECÍAN LOS MENSAJES ───────────────────────────────────────────────
 *
 * La confirmación y los dos recordatorios se escribieron cuando todas las citas
 * eran presenciales, y nunca miraron el tipo. Para una TELECONSULTA el paciente
 * recibía, literalmente:
 *
 *   «Hoy tienes tu cita con el Dr. …  📍 Consultorio, Av. … »
 *   «Te esperamos. Favor de acudir puntualmente.»
 *
 * Es decir: al paciente de una videoconsulta se le decía que fuera al
 * consultorio, sin darle jamás el enlace de la sala. En el mejor de los casos
 * llama para preguntar; en el peor conduce hasta allá.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * El tipo de cita decide qué se dice:
 *
 *  · teleconsulta → se dice que es por video, se da el enlace, y NO se manda la
 *    dirección — mandar las dos cosas es dejar que el paciente elija mal;
 *  · cualquier otra → dirección y mapa, como siempre.
 *
 * Y si falta el enlace (no hay URL base configurada, o la cita no trae id), se
 * DICE que es videoconsulta y que el enlace llega aparte, en vez de callar: un
 * mensaje que no menciona el video es el que hace que el paciente se presente.
 *
 * Módulo PURO. No sabe de Firestore ni de WhatsApp.
 */
import { enlaceSalaPaciente } from '@/lib/telesalud/ventana-sala'

export interface DatosDeLugar {
  /** `tipo` de la cita, tal como se guarda. */
  tipo?: string
  citaId?: string
  clinicId?: string
  direccion?: string
  googleMapsUrl?: string
  /** Origen público de la aplicación (`NEXT_PUBLIC_APP_URL`). */
  baseUrl?: string
  /**
   * Token HMAC del paciente, si quien compone el mensaje puede emitirlo.
   *
   * SIN ÉL NO SE EMITE ENLACE. `/api/telesalud/sala` exige prueba de
   * titularidad y responde **404 «Cita no encontrada»** a quien no la trae:
   * mandarle al paciente un enlace sin token es mandarle un enlace que le dice
   * que su cita no existe, media hora antes de su consulta. Es peor que no
   * mandar enlace — el paciente que no recibe enlace llama al consultorio; el
   * que recibe un 404 cree que se quedó sin cita.
   *
   * Emitirlo exige el secreto de firma, que sólo vive en el servidor. Por eso
   * es un dato de entrada y no se calcula aquí: `lib/whatsapp.ts` se importa
   * también desde el navegador.
   */
  tokenPaciente?: string
}

export interface Lugar {
  esVideo: boolean
  /** Líneas a insertar en el mensaje, ya con sus iconos. */
  lineas: string[]
  /** Cierre coherente con el lugar («Te esperamos» no aplica a una videollamada). */
  cierre: string
}

export const ES_TELECONSULTA = 'teleconsulta'

export const SIN_ENLACE =
  'Recibirás el enlace de la videollamada por este medio antes de tu cita.'

/**
 * ¿Es una videoconsulta?
 *
 * Está fuera de `dondeEsLaCita` porque quien acuña el token necesita saberlo
 * **antes** de componer el mensaje: acuñar exige leer el expediente, y no se
 * hace una lectura por cada cita presencial del día.
 */
export function esTeleconsulta(tipo?: string | null): boolean {
  return String(tipo ?? '').trim().toLowerCase() === ES_TELECONSULTA
}

/** Qué decirle al paciente sobre dónde es su cita. */
export function dondeEsLaCita(d: DatosDeLugar): Lugar {
  const esVideo = esTeleconsulta(d.tipo)

  if (!esVideo) {
    const lineas: string[] = []
    if (d.direccion?.trim()) lineas.push(`📍 ${d.direccion.trim()}`)
    if (d.googleMapsUrl?.trim()) lineas.push(`🗺 ${d.googleMapsUrl.trim()}`)
    return { esVideo: false, lineas, cierre: 'Te esperamos.' }
  }

  const base = String(d.baseUrl ?? '').replace(/\/+$/, '')
  // Sin token no hay enlace: ver `tokenPaciente` en `DatosDeLugar`.
  const url = d.citaId && d.clinicId && base && d.tokenPaciente
    ? base + enlaceSalaPaciente(d.citaId, d.clinicId, d.tokenPaciente)
    : ''

  return {
    esVideo: true,
    lineas: [
      '💻 *Es una videoconsulta*: no necesitas acudir al consultorio.',
      url ? `🔗 ${url}` : SIN_ENLACE,
    ],
    // La sala se abre 30 min antes (ver `ventana-sala.ts`); el mensaje no repite
    // la cifra para que no puedan quedar diciendo cosas distintas.
    cierre: 'Entra desde el enlace unos minutos antes de la hora.',
  }
}

export const POR_QUE_NO_VA_LA_DIRECCION =
  'Porque mandar el enlace Y la dirección deja que el paciente elija mal, y el ' +
  'que se equivoca pierde la consulta. Una videoconsulta se atiende por video: ' +
  'eso es lo único que tiene que decir el mensaje.'
