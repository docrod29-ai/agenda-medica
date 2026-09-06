/**
 * CUÁNTO VIVE UNA SESIÓN DEL BOT — Panel de Lujo ASM-006 (REP-036).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * El webhook borraba cualquier sesión con más de 2 h sin mensajes y contestaba
 * el menú. Esa caducidad se diseñó para conversaciones que INICIA el paciente
 * (agendar, cancelar), pero los estados que esperan la respuesta a un mensaje
 * PROACTIVO del consultorio heredaron el mismo reloj sin que nadie lo decidiera:
 * el cron dejaba la sesión `confirmando_cita` 23-26 h antes de la cita, el
 * texto decía «Responde SÍ» sin plazo, y el «SÍ» de la tarde caía al menú de
 * bienvenida. La cita seguía sin confirmar y el paciente creía que ya avisó.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *  · `confirmando_cita` vive HASTA LA HORA DE LA CITA que espera (la sesión
 *    trae `datos.fecha` y `datos.hora`). Pasada la cita, caduca como cualquier
 *    otra. El recordatorio dice ese plazo con estas palabras.
 *  · `esperando_lista` vive hasta la hora del hueco ofrecido (`slotFecha`,
 *    `slotHora`), por la misma razón: la oferta es del consultorio.
 *  · `confirmando_cancelacion` NO se exime: la inició el paciente («¿la
 *    cancelo?») y un «sí» tres días después a una pregunta olvidada cancelaría
 *    una cita — ése es justo el defecto que separó los dos estados.
 *  · Todo lo demás: 2 h, como siempre.
 *
 * Módulo PURO: recibe el reloj y la zona, no los lee.
 */
import { instanteMX } from '@/lib/timezone'

/** Caducidad de una conversación que inició el paciente. */
export const CADUCIDAD_CONVERSACION_MS = 2 * 60 * 60 * 1000

export interface SesionParaVigencia {
  estado?: string
  datos?: Record<string, unknown>
  lastMessageAt?: string
}

/** ¿Hasta cuándo espera respuesta esta sesión? `null` = reloj normal de 2 h. */
export function hastaCuandoEspera(s: SesionParaVigencia, tz: string): number | null {
  const d = s.datos ?? {}
  if (s.estado === 'confirmando_cita') return instanteDe(d.fecha, d.hora, tz)
  if (s.estado === 'esperando_lista') return instanteDe(d.slotFecha, d.slotHora, tz)
  return null
}

function instanteDe(fecha: unknown, hora: unknown, tz: string): number | null {
  const f = String(fecha ?? ''), h = String(hora ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{2}:\d{2}$/.test(h)) return null
  const t = instanteMX(f, h, tz).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * ¿Hay que tirar esta sesión y empezar de cero?
 */
export function sesionCaducada(s: SesionParaVigencia | null | undefined, ahoraMs: number, tz: string): boolean {
  if (!s?.lastMessageAt) return false
  const last = Date.parse(s.lastMessageAt)
  if (!Number.isFinite(last)) return false
  const limite = hastaCuandoEspera(s, tz)
  if (limite != null) return ahoraMs > limite
  return ahoraMs - last > CADUCIDAD_CONVERSACION_MS
}

export const POR_QUE_LA_CANCELACION_NO_SE_EXIME =
  'Porque «¿la cancelo?» la inició el paciente, y un «sí» tres días después a ' +
  'una pregunta olvidada cancelaría una cita. Ése fue el defecto que obligó a ' +
  'separar confirmando_cita de confirmando_cancelacion.'
