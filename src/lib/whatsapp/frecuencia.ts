/**
 * Tope de frecuencia de mensajes proactivos por contacto — Iteración 9.
 *
 * Evita saturar a un paciente con demasiados mensajes iniciados por el consultorio
 * en un mismo día (varias citas, ofertas de lista de espera repetidas, etc.). No
 * afecta las respuestas REACTIVAS (que el paciente inició).
 *
 * Puro (sin red/DB) → testeable. El conteo diario vive en el doc de contacto.
 */

export const TOPE_DIARIO_DEFAULT = 3
const TOPE_MIN = 1
const TOPE_MAX = 20

export interface ConfigFrecuencia {
  /** clinic.whatsapp.topeDiarioProactivo */
  topeDiarioProactivo?: number
}

/** Tope diario efectivo de la clínica (acotado a [1,20], default 3). */
export function topeDiario(wa: ConfigFrecuencia | null | undefined): number {
  const t = wa?.topeDiarioProactivo
  if (typeof t !== 'number' || !Number.isFinite(t)) return TOPE_DIARIO_DEFAULT
  return Math.min(Math.max(Math.floor(t), TOPE_MIN), TOPE_MAX)
}

/** ¿Ya se alcanzó el tope? (enviadosHoy son los proactivos ya contados hoy). */
export function superaTope(enviadosHoy: number, tope: number): boolean {
  return enviadosHoy >= tope
}

/**
 * Conteo diario persistido en el doc de contacto (campo `proactivo`). Si la fecha
 * guardada no es la de hoy, el conteo cuenta como 0 (día nuevo). Puro.
 */
export function conteoDeHoy(
  proactivo: { fecha?: string; conteo?: number } | null | undefined,
  fechaHoy: string,
): number {
  if (!proactivo || proactivo.fecha !== fechaHoy) return 0
  return typeof proactivo.conteo === 'number' ? proactivo.conteo : 0
}

/** Estado a guardar tras un envío exitoso (reinicia en día nuevo, +1 en el mismo). */
export function siguienteConteo(
  proactivo: { fecha?: string; conteo?: number } | null | undefined,
  fechaHoy: string,
): { fecha: string; conteo: number } {
  return { fecha: fechaHoy, conteo: conteoDeHoy(proactivo, fechaHoy) + 1 }
}
