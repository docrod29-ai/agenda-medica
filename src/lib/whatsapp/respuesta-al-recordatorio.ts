/**
 * LO QUE EL PACIENTE CONTESTA AL RECORDATORIO — Panel de Lujo ASM-012.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * Había tres vocabularios para el paciente —las plantillas pedían
 * CONFIRMAR/CAMBIAR/CANCELAR, el texto libre pedía SÍ/NO, y los botones de
 * Meta mandan su título— y el bot sólo entendía uno: «confirmar»,
 * «confirmada», «cambiar», «reagendar» y «cita» caían a «no entendí». El
 * paciente hacía exactamente lo que el mensaje le pedía y su cita no cambiaba.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * Un solo módulo puro con las tres respuestas: SÍ, NO y CAMBIAR. Cambiar gana
 * («sí, pero quiero otra fecha» es cambiar), luego NO («no puedo ir») y al
 * final SÍ. Lo que no casa devuelve `null` y el bot sigue la conversación
 * normal sin perder el mensaje.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Audios, imágenes y stickers (ASM-013, se contestan aparte). Frases con
 * negación compleja («no es que no vaya») — se lee la primera intención. La
 * baja (BAJA/STOP) va por encima, en `consent.ts`.
 */

export type RespuestaRecordatorio = 'si' | 'no' | 'cambiar'

function norm(texto: string): string {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¡!¿?.,;:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CAMBIAR = /\b(cambiar|cambio|cambiarla|cambiarlo|cambien|cambiamos|reagendar|reagenda|reagendarla|reprogramar|mover|moverla|otra fecha|otro dia|otra hora|otro horario|otro dia|posponer|adelantar)\b|🔁|🔄/
const NO = /^(no|n|2|nel|nop|nope)\b|\b(cancelar|cancela|cancelo|cancelen|cancelarla|no puedo|no podre|no voy|no ire|no asistire|no asisto|no me es posible|ya no)\b|^❌|^👎/
const SI = /^(si|s|1|ok|okay|okey|oki|va|vale|sale|dale|claro|confirmo|confirmado|confirmada|confirmar|confirmamos|confirmacion|listo|perfecto|de acuerdo|asi es|ahi estare|ahi nos vemos|ahi estaremos|por supuesto|desde luego|correcto|afirmativo|yes|sip|simon)\b|^(✅|👍|👌|🙂|😊)/

export function respuestaAlRecordatorio(texto: string): RespuestaRecordatorio | null {
  const t = norm(texto)
  if (!t) return null
  if (CAMBIAR.test(t)) return 'cambiar'
  if (NO.test(t)) return 'no'
  if (SI.test(t)) return 'si'
  return null
}

/** Compatibilidad con los dos predicados que usaba el webhook. */
export const esRespuestaSi = (t: string) => respuestaAlRecordatorio(t) === 'si'
export const esRespuestaNo = (t: string) => respuestaAlRecordatorio(t) === 'no'
export const esRespuestaCambiar = (t: string) => respuestaAlRecordatorio(t) === 'cambiar'

/** El vocabulario que las plantillas le piden al paciente. Uno solo. */
export const VOCABULARIO_RECORDATORIO = 'Responde *SÍ* para confirmar, *NO* para cancelar o *CAMBIAR* si necesitas otra fecha.'
