/**
 * IDEMPOTENCIA DEL RECORDATORIO — Panel de Lujo ASM-019 (con ASM-007 y ASM-005).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * El cron mandaba el recordatorio y DESPUÉS escribía `recordatorio24hEnviado`.
 * Si esa escritura fallaba (un hipo de Firestore, un timeout de la función),
 * la hora siguiente lo mandaba otra vez. Y un recordatorio que fallaba o se
 * omitía no dejaba huella POR CITA: sólo subía un contador agregado que la
 * asistente no puede convertir en «a quién le llamo».
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * Reservar ANTES de enviar (`recordatorio24hIntentoAt`) y confirmar después.
 * Si la confirmación falla, la reserva reciente impide reenviar durante
 * `RESERVA_VIGENTE_MS`; pasado ese tiempo, un intento viejo sin confirmación se
 * vuelve a intentar (porque lo más probable es que no salió).
 *
 * Todo intento que NO termina en «enviado» deja en la cita un `…Fallo` con la
 * hora y el motivo, para que `/citas` lo enseñe y ofrezca «Llamar».
 *
 * Módulo PURO.
 */
import type { ResultadoProactivo } from '@/lib/whatsapp/proactivo'

/** Cuánto vale una reserva sin confirmación antes de volver a intentar. */
export const RESERVA_VIGENTE_MS = 2 * 60 * 60 * 1000

export type ClaveRecordatorio = 'recordatorio24h' | 'recordatorioMismoDia'

/** Los campos de la cita que cada recordatorio usa: reserva, confirmación y fallo. */
export const CAMPOS_RECORDATORIO: Record<ClaveRecordatorio, { intentoAt: string; enviado: string; fallo: string }> = {
  recordatorio24h: { intentoAt: 'recordatorio24hIntentoAt', enviado: 'recordatorio24hEnviado', fallo: 'recordatorio24hFallo' },
  recordatorioMismoDia: { intentoAt: 'recordatorioMismoDiaIntentoAt', enviado: 'recordatorioMismoDiaEnviado', fallo: 'recordatorioMismoDiaFallo' },
}

/**
 * ¿Hay una reserva reciente sin confirmación? Entonces NO se reenvía: puede
 * que el mensaje sí saliera y sólo fallara la marca.
 */
export function reservaReciente(intentoAt: string | undefined | null, ahoraMs: number): boolean {
  if (!intentoAt) return false
  const t = Date.parse(String(intentoAt))
  if (!Number.isFinite(t)) return false
  return ahoraMs - t < RESERVA_VIGENTE_MS
}

export type MotivoNoEnviado =
  | 'telefono-invalido'
  | 'sin-consentimiento'
  | 'baja'
  | 'sin-plantilla-fuera-de-ventana'
  | 'proveedor'
  | 'silencio'
  | 'tope-diario'

/** Traduce el resultado de `enviarProactivo` a un motivo que la pantalla puede decir. */
export function motivoDeResultado(r: ResultadoProactivo): MotivoNoEnviado | null {
  switch (r) {
    case 'enviado': return null
    case 'fallo': return 'proveedor'
    case 'omitido': return 'sin-plantilla-fuera-de-ventana'
    case 'optout': return 'baja'
    case 'silencio': return 'silencio'
    case 'tope': return 'tope-diario'
  }
}

/**
 * Silencio y tope NO son fallos: se reintentan en el siguiente ciclo del cron y
 * por eso ni se anotan como fallo ni consumen la reserva.
 */
export function esTransitorio(m: MotivoNoEnviado | null): boolean {
  return m === 'silencio' || m === 'tope-diario'
}

export const ETIQUETA_MOTIVO: Record<MotivoNoEnviado, string> = {
  'telefono-invalido': 'el teléfono no se entiende',
  'sin-consentimiento': 'sin consentimiento para mensajes',
  baja: 'el paciente pidió no recibir mensajes',
  'sin-plantilla-fuera-de-ventana': 'no escribió en 24 h y no hay plantilla aprobada',
  proveedor: 'WhatsApp no aceptó el envío',
  silencio: 'horas de silencio',
  'tope-diario': 'tope diario de mensajes',
}

export interface FalloRecordatorio {
  at: string
  motivo: MotivoNoEnviado
}

/** Lo que queda escrito en la cita cuando el recordatorio no salió. */
export function falloParaLaCita(clave: ClaveRecordatorio, motivo: MotivoNoEnviado, ahoraIso: string): Record<string, FalloRecordatorio> {
  return { [CAMPOS_RECORDATORIO[clave].fallo]: { at: ahoraIso, motivo } }
}
