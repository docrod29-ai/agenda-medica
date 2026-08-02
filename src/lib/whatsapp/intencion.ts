/**
 * QUÉ QUIERE EL PACIENTE — la intención manda sobre la pregunta frecuente.
 *
 * ── EL FALLO: «QUIERO AGENDAR UNA CONSULTA» NO AGENDABA ──────────────────────
 *
 * El bot detecta las preguntas frecuentes ANTES que cualquier otra cosa
 * («Always detect FAQ first»), y el patrón de la pregunta de PRECIO es:
 *
 *     /costo|precio|cobr|cuanto|pag|consulta/
 *
 * Es decir, la palabra **«consulta»** dispara la respuesta de precios. Y la
 * frase más natural que escribe un paciente para pedir cita es exactamente
 * «quiero agendar una consulta»: el bot le contesta cuánto cuesta, le enseña el
 * menú, y la cita no se agenda nunca. Lo mismo con «necesito una consulta»,
 * «me gustaría agendar consulta», «para agendar consulta».
 *
 * El paciente cree que preguntó mal y lo intenta otra vez —o se va—. Y desde
 * fuera parece que el bot funciona: contesta rápido y con información correcta.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Un verbo de ACCIÓN gana a una palabra de tema. Si alguien dice «agendar»,
 * «reservar», «apartar» o «cancelar», eso es lo que quiere, aunque la frase
 * mencione la consulta, el precio o el horario.
 *
 * Sin verbo de acción, manda la pregunta frecuente, como hasta ahora — «¿cuánto
 * cuesta la consulta?» sigue siendo una pregunta de precio.
 *
 * Módulo PURO.
 */

/** Verbos con los que alguien pide cita. Ganan a cualquier tema. */
const ACCION_AGENDAR = /\b(agendar|agenda|agende|agendo|reservar|reserv[ae]|apartar|apart[ae]|programar|sacar cita|hacer(me)? (una )?cita|quiero (una )?cita|necesito (una )?cita|dar cita)\b/

/** Verbos con los que alguien cancela. También ganan. */
const ACCION_CANCELAR = /\b(cancelar|cancele|cancelo|anular|dar de baja mi cita)\b/

/** Verbos con los que alguien mueve su cita. */
const ACCION_REAGENDAR = /\b(reagendar|reagend[ae]|cambiar (mi )?cita|mover (mi )?cita|posponer)\b/

export type Intencion =
  | { tipo: 'agendar' }
  | { tipo: 'cancelar' }
  | { tipo: 'reagendar' }
  | { tipo: 'faq'; clave: string }
  | { tipo: 'ninguna' }

/** Normaliza igual que el bot: minúsculas y sin acentos. */
export function normalizar(texto: string): string {
  return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Qué quiere el paciente.
 *
 * @param detectarFaq el detector de preguntas frecuentes del bot, tal cual.
 *   Entra como parámetro para no duplicarlo aquí: una segunda copia de esos
 *   patrones sería otro sitio donde olvidar la próxima regla.
 */
export function intencionDelMensaje(
  texto: string,
  detectarFaq: (t: string) => string | null,
): Intencion {
  const t = normalizar(texto)

  // 1. La acción manda. Es lo que el paciente PIDE, no lo que menciona.
  if (ACCION_CANCELAR.test(t)) return { tipo: 'cancelar' }
  if (ACCION_REAGENDAR.test(t)) return { tipo: 'reagendar' }
  if (ACCION_AGENDAR.test(t)) return { tipo: 'agendar' }

  // 2. Sin acción, la pregunta frecuente, como siempre.
  const clave = detectarFaq(texto)
  if (clave) return { tipo: 'faq', clave }

  return { tipo: 'ninguna' }
}

export const POR_QUE_GANA_LA_ACCION =
  'Porque «quiero agendar una consulta» contiene la palabra «consulta», que ' +
  'dispara la respuesta de precios: el bot contestaba cuánto cuesta y la cita ' +
  'no se agendaba nunca. Y desde fuera parecía que funcionaba, porque contestó ' +
  'rápido y con información correcta.'
