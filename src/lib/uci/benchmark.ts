/**
 * BENCHMARK DE VALIDACIÓN — motores deterministas de UCI (iteración nexusmed-icu-014).
 *
 * Genera casos sintéticos DETERMINISTAS (sin azar → reproducible) por categoría,
 * corre los motores y verifica dos cosas que son el Quality Gate del loop:
 *   1) el cálculo COINCIDE con la fórmula (comparado con un cómputo independiente),
 *   2) un cálculo BLOQUEADO nunca devuelve un valor (cero datos inventados).
 *
 * No usa red, ni IA, ni base de datos, ni PHI. Es un arnés puro para el Dr y para
 * CI. Los umbrales/fórmulas vienen de los motores ya probados; aquí se estresan a
 * escala (cientos de casos) y se reporta la métrica agregada.
 */
import { drivingPressure, complianceEstatica, normalizarFiO2, indiceKirby } from './ventilacion'
import { analizarGasometria } from './gasometria'
import { presionArterialMedia } from './hemodinamia'
import { analizarSeguridadUCI } from './seguridad'

export const BENCHMARK_UCI_VERSION = '1.0.0'

export type Categoria =
  | 'ventilacion_normal'
  | 'datos_faltantes'
  | 'error_unidad_fio2'
  | 'gasometria_arterial'
  | 'gasometria_venosa_bloqueo'
  | 'hemodinamia'
  | 'seguridad_critica'

export interface ResultadoCaso {
  categoria: Categoria
  correcto: boolean
  datoInventado: boolean   // devolvió valor cuando debía bloquear
  detalle: string
}

const r1 = (x: number) => Math.round(x * 10) / 10

/** Evalúa un caso de una categoría con índice i (varía las entradas de forma determinista). */
function evaluarCaso(categoria: Categoria, i: number): ResultadoCaso {
  const ok = (correcto: boolean, datoInventado = false, detalle = ''): ResultadoCaso => ({ categoria, correcto, datoInventado, detalle })

  switch (categoria) {
    case 'ventilacion_normal': {
      const pplat = 20 + (i % 15)          // 20–34
      const peep = 5 + (i % 8)             // 5–12
      const vt = 380 + (i % 12) * 10       // 380–490
      const dp = drivingPressure(pplat, peep)
      const espDP = r1(pplat - peep)
      if (!dp.ok || dp.valor !== espDP) return ok(false, false, `DP ${dp.valor} ≠ ${espDP}`)
      const comp = complianceEstatica(vt, dp.valor)
      const espComp = Math.round(vt / espDP)
      if (!comp.ok || comp.valor !== espComp) return ok(false, false, `compliance ${comp.valor} ≠ ${espComp}`)
      return ok(true)
    }
    case 'datos_faltantes': {
      // Sin Pplat → driving pressure DEBE bloquear y NO dar valor.
      const dp = drivingPressure(undefined, 8)
      const inventado = dp.valor !== null
      return ok(dp.ok === false, inventado, dp.ok ? 'no bloqueó' : '')
    }
    case 'error_unidad_fio2': {
      const pct = 30 + (i % 60)            // 30–89 (%)
      const n = normalizarFiO2(pct)
      const esperado = Math.round((pct / 100) * 100) / 100
      if (n.fio2 !== esperado) return ok(false, false, `FiO2 ${n.fio2} ≠ ${esperado}`)
      return ok(true)
    }
    case 'gasometria_arterial': {
      const pao2 = 60 + (i % 120)          // 60–179
      const fio2 = 0.3 + (i % 5) * 0.1     // 0.3–0.7
      const k = indiceKirby(pao2, r1(fio2 * 100) / 100, 'arterial')
      const esperado = Math.round(pao2 / (Math.round(fio2 * 100) / 100))
      if (!k.ok || k.valor !== esperado) return ok(false, false, `P/F ${k.valor} ≠ ${esperado}`)
      return ok(true)
    }
    case 'gasometria_venosa_bloqueo': {
      // Muestra venosa → P/F DEBE bloquear (nunca oxigenación arterial con venosa).
      const k = indiceKirby(45, 0.4, 'venosa')
      const inventado = k.valor !== null
      return ok(k.ok === false, inventado, k.ok ? 'usó venosa' : '')
    }
    case 'hemodinamia': {
      const pas = 90 + (i % 60)            // 90–149
      const pad = 50 + (i % 30)            // 50–79
      const m = presionArterialMedia(pas, pad)
      if (pad >= pas) return ok(m.ok === false, m.valor !== null) // caso no fisiológico → bloquea
      const esperado = Math.round((pas + 2 * pad) / 3)
      if (!m.ok || m.valor !== esperado) return ok(false, false, `PAM ${m.valor} ≠ ${esperado}`)
      return ok(true)
    }
    case 'seguridad_critica': {
      // pH < 7.20 y K alto DEBEN salir como alerta crítica.
      const al = analizarSeguridadUCI({ ph: 7.0 + (i % 15) / 100, potasio: 6.6 })
      const hayCritica = al.some(a => a.nivel === 'critica')
      // solo pH<7.20 es crítica; con i%15, ph va 7.00–7.14 → todos < 7.20
      return ok(hayCritica, false, hayCritica ? '' : 'no marcó crítica')
    }
  }
}

export interface ReporteBenchmark {
  version: string
  total: number
  correctos: number
  datosInventados: number
  exactitud: number     // % correctos
  porCategoria: Record<string, { n: number; correctos: number; datosInventados: number }>
}

/** Corre el benchmark completo: `porCategoria` casos por cada categoría. */
export function correrBenchmark(porCategoria = 100): ReporteBenchmark {
  const categorias: Categoria[] = [
    'ventilacion_normal', 'datos_faltantes', 'error_unidad_fio2',
    'gasometria_arterial', 'gasometria_venosa_bloqueo', 'hemodinamia', 'seguridad_critica',
  ]
  const acc: ReporteBenchmark = { version: BENCHMARK_UCI_VERSION, total: 0, correctos: 0, datosInventados: 0, exactitud: 0, porCategoria: {} }
  for (const c of categorias) {
    let correctos = 0, inventados = 0
    for (let i = 0; i < porCategoria; i++) {
      const r = evaluarCaso(c, i)
      acc.total++
      if (r.correcto) { correctos++; acc.correctos++ }
      if (r.datoInventado) { inventados++; acc.datosInventados++ }
    }
    acc.porCategoria[c] = { n: porCategoria, correctos, datosInventados: inventados }
  }
  acc.exactitud = acc.total ? Math.round((acc.correctos / acc.total) * 1000) / 10 : 0
  return acc
}
