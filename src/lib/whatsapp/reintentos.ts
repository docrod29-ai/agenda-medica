/**
 * Política de reintentos con backoff — Iteración 10 · RELIABILITY (outbox/DLQ).
 *
 * Un mensaje proactivo de un solo disparo (aviso de lista de espera) que falla por
 * un error transitorio hoy se pierde. Esta política decide cuándo reintentar y
 * cuándo rendirse (dead-letter). Los fallos PERMANENTES/opt-out llegan por el
 * webhook de estado (Iter. 6) y no se reintentan.
 *
 * Todo PURO (sin red/DB) → testeable.
 */

export const MAX_INTENTOS = 5
export const BASE_MS = 5 * 60 * 1000        // 5 min
export const TOPE_MS = 6 * 60 * 60 * 1000   // 6 h

/** Retroceso exponencial acotado. `intento` es 1-based (1 = tras el 1er fallo). */
export function backoffMs(intento: number): number {
  const n = Math.max(1, Math.floor(intento))
  const ms = BASE_MS * Math.pow(2, n - 1)
  return Math.min(ms, TOPE_MS)
}

/** Instante ISO del próximo intento, dado el nº de intentos ya realizados. */
export function proximoIntentoISO(intentos: number, ahoraMs: number): string {
  return new Date(ahoraMs + backoffMs(intentos)).toISOString()
}

/** ¿Se agotaron los reintentos? (→ dead-letter). */
export function agotado(intentos: number, max = MAX_INTENTOS): boolean {
  return intentos >= max
}

/** ¿Ya venció el próximo intento programado? Sin fecha válida → sí (procesar ya). */
export function vencido(proximoIntentoISO: string | null | undefined, ahoraMs: number): boolean {
  if (!proximoIntentoISO) return true
  const t = Date.parse(proximoIntentoISO)
  return Number.isNaN(t) ? true : ahoraMs >= t
}
