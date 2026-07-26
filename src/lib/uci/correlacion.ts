import { num } from './num'
/**
 * MOTOR DE CAMBIO Y CORRELACIÓN TEMPORAL — ICU OS.
 *
 * La tesis del ICU OS: no basta con decir QUÉ tiene el paciente; hay que mostrar
 * QUÉ CAMBIÓ. Este motor toma LECTURAS seriadas (cada una es un aplanado de los
 * valores del panel + los cálculos deterministas) y produce:
 *   1) compararLecturas: qué se movió entre dos lecturas (con dirección y delta).
 *   2) correlacionTemporal: la CRONOLOGÍA de cambios y ASOCIACIONES temporales
 *      (p.ej. ↑presión intratorácica junto con deterioro hemodinámico). NUNCA
 *      afirma causalidad — solo secuencia; el intensivista la interpreta.
 *
 * Puro y testeable. Reutiliza la lógica de dirección de tendencias.ts.
 */

export const CORRELACION_VERSION = '1.0.0'

const r1 = (x: number) => Math.round(x * 10) / 10

/** Catálogo de métricas seguidas (clave → etiqueta + delta mínimo relevante). */
export const METRICAS_UCI: { key: string; label: string; unidad?: string; minDelta: number }[] = [
  { key: 'pafi', label: 'PaO₂/FiO₂', minDelta: 20 },
  { key: 'fio2', label: 'FiO₂', unidad: '%', minDelta: 5 },
  { key: 'peep', label: 'PEEP', unidad: 'cmH₂O', minDelta: 2 },
  { key: 'pplat', label: 'Pplateau', unidad: 'cmH₂O', minDelta: 2 },
  { key: 'driving', label: 'Driving pressure', unidad: 'cmH₂O', minDelta: 2 },
  { key: 'pam', label: 'PAM', unidad: 'mmHg', minDelta: 5 },
  { key: 'norepi', label: 'Norepinefrina', unidad: 'µg/kg/min', minDelta: 0.02 },
  { key: 'lactato', label: 'Lactato', unidad: 'mmol/L', minDelta: 0.5 },
  { key: 'sofa', label: 'SOFA', minDelta: 1 },
  { key: 'vexus', label: 'VExUS', minDelta: 1 },
  { key: 'creat', label: 'Creatinina', unidad: 'mg/dL', minDelta: 0.3 },
  { key: 'ppc', label: 'PPC', unidad: 'mmHg', minDelta: 5 },
  { key: 'pic', label: 'PIC', unidad: 'mmHg', minDelta: 3 },
  { key: 'glasgow', label: 'Glasgow', minDelta: 1 },
]
const META = Object.fromEntries(METRICAS_UCI.map(m => [m.key, m]))

export interface Lectura { t: number; m: Record<string, number> }
export type Direccion = 'sube' | 'baja' | 'estable'
export interface Cambio { key: string; label: string; de: number; a: number; delta: number; direccion: Direccion; relevante: boolean; unidad?: string }

/** Aplana los valores crudos del panel + algunos cálculos a un mapa numérico. */
export function aplanarLectura(campos: Record<string, string>, computados?: Partial<Record<string, number | null>>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of ['fio2', 'peep', 'pplat', 'norepi', 'lactato', 'creat', 'pic', 'glasgow']) {
    const x = num(campos[k]); if (x !== null) out[k] = x
  }
  for (const [k, v] of Object.entries(computados ?? {})) { const x = num(v); if (x !== null) out[k] = x }
  return out
}

/** Compara dos lecturas y devuelve lo que se movió (relevante primero). */
export function compararLecturas(previa: Record<string, number>, actual: Record<string, number>): Cambio[] {
  const cambios: Cambio[] = []
  for (const key of Object.keys(actual)) {
    if (!(key in previa)) continue
    const de = previa[key], a = actual[key]
    // El descarte y la relevancia se juzgan sobre el delta CRUDO; el redondeo es
    // SOLO para mostrar. Antes se redondeaba antes, y un cambio de norepi de 0.03
    // (relevante, minDelta 0.02) se volvía 0 y se descartaba (rompía la titulación
    // fina de vasopresor y la asociación corazón-pulmón).
    const rawDelta = a - de
    if (rawDelta === 0) continue
    const meta = META[key]
    cambios.push({
      key, label: meta?.label ?? key, de, a, delta: r1(rawDelta),
      direccion: rawDelta > 0 ? 'sube' : 'baja',
      relevante: meta ? Math.abs(rawDelta) >= meta.minDelta : true,
      unidad: meta?.unidad,
    })
  }
  // Relevantes primero, luego por magnitud de cambio.
  return cambios.sort((x, y) => (Number(y.relevante) - Number(x.relevante)) || (Math.abs(y.delta) - Math.abs(x.delta)))
}

export interface Correlacion {
  version: string
  cronologia: { t: number; cambios: Cambio[] }[]
  asociaciones: string[]
}

/**
 * Toma la serie de lecturas (ordenada por tiempo) y arma la cronología de cambios
 * relevantes entre lecturas consecutivas + detecta ASOCIACIONES temporales
 * (interacción corazón-pulmón). No implica causalidad.
 */
export function correlacionTemporal(lecturas: Lectura[]): Correlacion {
  const orden = [...(lecturas ?? [])].sort((a, b) => a.t - b.t)
  const cronologia: { t: number; cambios: Cambio[] }[] = []
  const asociaciones: string[] = []
  for (let i = 1; i < orden.length; i++) {
    const cambios = compararLecturas(orden[i - 1].m, orden[i].m).filter(c => c.relevante)
    if (cambios.length) cronologia.push({ t: orden[i].t, cambios })
    // Asociación corazón-pulmón: ↑presión intratorácica (PEEP/Pplat/driving) junto
    // con deterioro hemodinámico (↓PAM o ↑norepinefrina) en el MISMO intervalo.
    const subePresion = cambios.some(c => ['peep', 'pplat', 'driving'].includes(c.key) && c.direccion === 'sube')
    const deterioroHemo = cambios.some(c => (c.key === 'pam' && c.direccion === 'baja') || (c.key === 'norepi' && c.direccion === 'sube'))
    if (subePresion && deterioroHemo) {
      asociaciones.push('Asociación temporal: ↑ presión intratorácica junto con deterioro hemodinámico en el mismo intervalo (revisar interacción corazón-pulmón; no implica causalidad).')
    }
  }
  return { version: CORRELACION_VERSION, cronologia, asociaciones }
}

/** Texto compacto de "qué cambió" para el Copilot (params.tendencias). */
export function resumenCambios(cambios: Cambio[]): string {
  if (!cambios.length) return ''
  const flecha = (d: Direccion) => (d === 'sube' ? '↑' : '↓')
  return cambios.slice(0, 10).map(c => `${c.label} ${c.de}→${c.a} ${flecha(c.direccion)}${c.unidad ? ' ' + c.unidad : ''}`).join(' · ')
}
