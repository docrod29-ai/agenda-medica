/**
 * CUÁNTO TARDA Y CUÁNTO FALLA — sobre datos que ya se estaban guardando.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * El libro de costos (`platform_cost_ledger`) anota, por cada llamada a un
 * modelo, su `latenciaMs` y si `fallo`. Se llevaba anotando desde que existe el
 * gateway y no lo miraba nadie: el tablero de costos suma dinero y tokens, que
 * es la mitad de la pregunta. La otra mitad —«¿va lento?», «¿está fallando?»—
 * estaba en el mismo documento, sin leer.
 *
 * ── POR QUÉ PERCENTILES Y NO PROMEDIO ────────────────────────────────────────
 *
 * El promedio de una latencia esconde justo lo que duele. Cien notas de 4 s y
 * cinco de 90 s dan un promedio de 8 s, que suena bien, mientras cinco médicos
 * miraron una pantalla parada minuto y medio delante de su paciente. El p95 los
 * ve; el promedio no.
 *
 * ── HAY OTRO PERCENTIL EN EL ÁRBOL, Y ES UNA DECISIÓN PENDIENTE — REG-417 ───
 *
 * Éste interpola. `src/lib/finanzas/cost-ledger.ts` calcula por rango más
 * cercano —siempre una muestra que ocurrió— sobre los MISMOS asientos. No dan lo
 * mismo: con veinte muestras de 100 a 290 ms, p50 195 aquí y 190 allí; p99 288,1
 * aquí y 290 allí.
 *
 * Ninguno de los dos está mal y los dos están probados. Lo que está mal es que
 * existan los dos sin decidirlo: dos tableros del mismo periodo enseñan cifras
 * distintas y las dos parecen ciertas.
 *
 * No se unifica por iniciativa de quien pasaba por aquí: la cifra sale en el
 * tablero que mira el dueño, y elegir método cambia números que él ya ha visto.
 * Está anotado en los dos archivos y en el censo (`WS-12.p99`).
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No define umbrales de «lento». No hay un número honesto que separe rápido de
 * lento para todas las funciones: transcribir una consulta de veinte minutos y
 * corregir una palabra no se miden con la misma vara. Se muestran las cifras.
 *
 * Módulo PURO.
 */

/** Lo que hace falta de un asiento del libro para medir. */
export interface MuestraLatencia {
  feature: string
  modelo?: string
  latenciaMs: number
  fallo?: boolean
}

/**
 * Percentil por interpolación lineal, sobre una lista YA ordenada.
 *
 * `p` en 0..1. Con un solo dato devuelve ese dato; con la lista vacía, `null` —
 * y `null` significa «no hay medición», que es distinto de cero y tiene que
 * poder distinguirse en la pantalla.
 */
export function percentil(ordenados: readonly number[], p: number): number | null {
  if (!ordenados.length) return null
  if (ordenados.length === 1) return ordenados[0]
  const pos = Math.min(Math.max(p, 0), 1) * (ordenados.length - 1)
  const bajo = Math.floor(pos), alto = Math.ceil(pos)
  if (bajo === alto) return ordenados[bajo]
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo)
}

export interface ResumenLatencia {
  clave: string
  /** Cuántas llamadas se midieron. */
  n: number
  p50: number | null
  p95: number | null
  p99: number | null
  /** La peor que se vio. Es la que el médico recuerda. */
  max: number | null
  /** Cuántas fallaron y qué fracción del total son (0..1). */
  fallos: number
  tasaFallo: number
}

function resumirMuestras(clave: string, muestras: readonly MuestraLatencia[]): ResumenLatencia {
  // Sólo entran las latencias medibles: un 0 o un NaN no es «instantáneo», es
  // «no se midió», y meterlo en la lista tira los percentiles hacia abajo.
  const ms = muestras
    .map(m => m.latenciaMs)
    .filter(v => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b)
  const fallos = muestras.filter(m => m.fallo).length
  return {
    clave,
    n: ms.length,
    p50: percentil(ms, 0.5),
    p95: percentil(ms, 0.95),
    p99: percentil(ms, 0.99),
    max: ms.length ? ms[ms.length - 1] : null,
    fallos,
    tasaFallo: muestras.length ? fallos / muestras.length : 0,
  }
}

/** Por función del producto (`nota`, `transcribir`, `consultor-evidencia`…). */
export function porFeature(muestras: readonly MuestraLatencia[]): ResumenLatencia[] {
  return agrupar(muestras, m => m.feature || 'sin-feature')
}

/** Por modelo, que es donde se ve si un proveedor se degradó. */
export function porModelo(muestras: readonly MuestraLatencia[]): ResumenLatencia[] {
  return agrupar(muestras, m => m.modelo || 'sin-modelo')
}

function agrupar(muestras: readonly MuestraLatencia[], clave: (m: MuestraLatencia) => string): ResumenLatencia[] {
  const mapa = new Map<string, MuestraLatencia[]>()
  for (const m of muestras) {
    const k = clave(m)
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k)!.push(m)
  }
  // Ordenado por p95 descendente: arriba lo que peor se está portando, que es
  // lo único accionable. Lo que no tiene medición va al final.
  return [...mapa.entries()]
    .map(([k, v]) => resumirMuestras(k, v))
    .sort((a, b) => (b.p95 ?? -1) - (a.p95 ?? -1))
}

/** Milisegundos en algo que se lee de un vistazo. */
export function msLegible(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const min = Math.floor(ms / 60_000)
  const seg = Math.round((ms % 60_000) / 1000)
  return `${min} min ${seg} s`
}

export const POR_QUE_PERCENTILES =
  'Porque el promedio esconde justo lo que duele: cien notas de 4 segundos y ' +
  'cinco de noventa dan un promedio de ocho, que suena bien, mientras cinco ' +
  'médicos miraron una pantalla parada minuto y medio delante de su paciente. ' +
  'El p95 los ve; el promedio no.'
