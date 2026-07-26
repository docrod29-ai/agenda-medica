import { num } from './num'
/**
 * MOTOR DE TENDENCIAS — ICU (iteración nexusmed-icu-011).
 *
 * "La principal ventaja de NexusMED debe ser comparar, no solo documentar."
 * Función PURA que toma una serie temporal de un parámetro y devuelve la
 * dirección de la tendencia + los valores que la respaldan. NO interpreta si
 * "mejora" o "empeora" (eso depende del parámetro y lo hace la capa clínica):
 * solo dice sube/baja/estable y muestra los números. Así una frase como
 * "tendencia hemodinámica favorable" SIEMPRE puede mostrar qué la respalda.
 */

export const TREND_ENGINE_VERSION = '1.0.0'

export type Direccion = 'sube' | 'baja' | 'estable' | 'insuficiente'

export interface PuntoSerie {
  t: number | string   // marca temporal (ms epoch o ISO); se ordena por esto
  v: number | string
}

export interface Tendencia {
  direccion: Direccion
  n: number
  primero: number | null
  ultimo: number | null
  delta: number | null       // ultimo − primero
  deltaPct: number | null    // % de cambio respecto al primero
  valores: number[]          // en orden temporal
  resumen: string            // "0.22 → 0.15 → 0.10"
}

const tms = (t: number | string): number => {
  const n = Number(t)
  if (Number.isFinite(n)) return n
  const d = Date.parse(String(t))
  return Number.isFinite(d) ? d : 0
}
const r2 = (x: number) => Math.round(x * 100) / 100

/**
 * Calcula la tendencia de una serie. `deadbandPct` = umbral de cambio para
 * considerar "estable" (default 5%). Ordena por tiempo antes de comparar.
 */
export function tendencia(serie: PuntoSerie[], deadbandPct = 5): Tendencia {
  const pts = (serie ?? [])
    .map(p => ({ t: tms(p.t), v: num(p.v) }))
    .filter((p): p is { t: number; v: number } => p.v !== null)
    .sort((a, b) => a.t - b.t)

  const valores = pts.map(p => p.v)
  const vacia: Tendencia = { direccion: 'insuficiente', n: valores.length, primero: null, ultimo: null, delta: null, deltaPct: null, valores, resumen: valores.join(' → ') }
  if (valores.length < 2) return vacia

  const primero = valores[0], ultimo = valores[valores.length - 1]
  const delta = r2(ultimo - primero)
  const deltaPct = primero !== 0 ? r2(((ultimo - primero) / Math.abs(primero)) * 100) : null
  const direccion: Direccion =
    deltaPct !== null && Math.abs(deltaPct) < deadbandPct ? 'estable'
    : delta > 0 ? 'sube'
    : delta < 0 ? 'baja'
    : 'estable'

  return { direccion, n: valores.length, primero, ultimo, delta, deltaPct, valores, resumen: valores.join(' → ') }
}

/** Flecha visual para la dirección. */
export function flechaTendencia(d: Direccion): string {
  return d === 'sube' ? '↑' : d === 'baja' ? '↓' : d === 'estable' ? '→' : '·'
}

/**
 * Tendencias de varios parámetros de UCI a la vez. `series` = { parametro: puntos[] }.
 * Devuelve un mapa parametro → Tendencia para el panel de tendencias.
 */
export function tendenciasUCI(series: Record<string, PuntoSerie[]>): Record<string, Tendencia> {
  const out: Record<string, Tendencia> = {}
  for (const [k, v] of Object.entries(series ?? {})) out[k] = tendencia(v)
  return out
}
