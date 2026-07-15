/**
 * Horas de silencio para mensajes proactivos — Iteración 8 · RELIABILITY.
 *
 * Un recordatorio automático NO debe salir de madrugada (mala experiencia y roza
 * las políticas de mensajería). Este guardián decide si AHORA (hora de pared MX)
 * es momento permitido para un mensaje PROACTIVO. Los mensajes REACTIVOS (que el
 * paciente inició) no se ven afectados.
 *
 * Todo PURO (minutos del día) → testeable. El cron pasa `ahoraMinutosDelDia()`.
 */

export interface VentanaSilencio {
  /** minuto del día en que empieza el silencio (0..1439). */
  inicioMin: number
  /** minuto del día en que termina el silencio (0..1439). */
  finMin: number
}

/** Por defecto: 21:00 → 08:00 (cruza la medianoche). */
export const SILENCIO_DEFAULT: VentanaSilencio = { inicioMin: 21 * 60, finMin: 8 * 60 }

function hhmmAMin(hhmm: string | undefined, fallback: number): number {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return fallback
  const [h, m] = hhmm.split(':').map(Number)
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback
  return h * 60 + m
}

/** Config por clínica: clinic.whatsapp.silencio = { activo, inicio:'HH:MM', fin:'HH:MM' }. */
export interface ConfigSilencio {
  silencio?: { activo?: boolean; inicio?: string; fin?: string }
}

/** Resuelve la ventana de silencio de una clínica (o null si está desactivada). */
export function resolverSilencio(wa: ConfigSilencio | null | undefined): VentanaSilencio | null {
  const s = wa?.silencio
  if (s && s.activo === false) return null // el Dr. desactivó explícitamente
  return {
    inicioMin: hhmmAMin(s?.inicio, SILENCIO_DEFAULT.inicioMin),
    finMin: hhmmAMin(s?.fin, SILENCIO_DEFAULT.finMin),
  }
}

/** ¿El minuto del día cae dentro de la ventana de silencio? Maneja cruce de medianoche. */
export function enSilencio(minutosDelDia: number, v: VentanaSilencio): boolean {
  if (v.inicioMin === v.finMin) return false // ventana vacía
  if (v.inicioMin < v.finMin) {
    // Ventana en el mismo día: [inicio, fin)
    return minutosDelDia >= v.inicioMin && minutosDelDia < v.finMin
  }
  // Cruza medianoche: [inicio, 24h) ∪ [0, fin)
  return minutosDelDia >= v.inicioMin || minutosDelDia < v.finMin
}

/**
 * ¿Se permite enviar un mensaje proactivo AHORA?
 * @param minutosDelDia  ahoraMinutosDelDia() en zona MX (0..1439)
 * @param silencio       ventana resuelta, o null = sin restricción (siempre permitido)
 */
export function enHorarioPermitido(minutosDelDia: number, silencio: VentanaSilencio | null): boolean {
  if (!silencio) return true
  return !enSilencio(minutosDelDia, silencio)
}
