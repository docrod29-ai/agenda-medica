/**
 * nexusmed-icu-014 · VALIDATION — Quality Gate del loop de UCI.
 * Corre cientos de casos sintéticos contra los motores deterministas.
 */
import { describe, it, expect } from 'vitest'
import { correrBenchmark } from '@/lib/uci/benchmark'

describe('Benchmark de motores de UCI (Quality Gate)', () => {
  const rep = correrBenchmark(160) // 160 × 7 categorías = 1120 casos (> 1100)

  it('corre más de 1100 casos sintéticos', () => {
    expect(rep.total).toBeGreaterThan(1100)
  })

  it('EXACTITUD 100% (cada cálculo coincide con la fórmula / bloquea cuando debe)', () => {
    expect(rep.exactitud).toBe(100)
    expect(rep.correctos).toBe(rep.total)
  })

  it('CERO datos inventados (un cálculo bloqueado nunca devuelve valor)', () => {
    expect(rep.datosInventados).toBe(0)
  })

  it('cada categoría pasó al 100%', () => {
    for (const [cat, m] of Object.entries(rep.porCategoria)) {
      expect(m.correctos, cat).toBe(m.n)
      expect(m.datosInventados, cat).toBe(0)
    }
  })
})
