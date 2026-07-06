import { describe, it, expect } from 'vitest'
import { calcularNews2 } from '@/lib/hospital/news2'
import { buscarMed } from '@/lib/hospital/medicamentos-catalogo'

describe('NEWS2 — early warning score', () => {
  it('signos normales → riesgo bajo (0)', () => {
    const r = calcularNews2({ fr: 16, spo2: 98, temp: 36.8, ta: '120/80', fc: 72 })!
    expect(r.total).toBe(0)
    expect(r.riesgo).toBe('bajo')
  })

  it('paciente deteriorado → riesgo alto', () => {
    const r = calcularNews2({ fr: 26, spo2: 90, temp: 39.2, ta: '88/50', fc: 132 })!
    expect(r.total).toBeGreaterThanOrEqual(7)
    expect(r.riesgo).toBe('alto')
  })

  it('un solo parámetro en 3 → al menos riesgo medio', () => {
    const r = calcularNews2({ fr: 16, spo2: 98, temp: 36.8, ta: '120/80', fc: 135 })!
    expect(r.riesgo).not.toBe('bajo')
  })

  it('sin signos → null', () => {
    expect(calcularNews2({})).toBeNull()
  })
})

describe('Catálogo de medicamentos — búsqueda', () => {
  it('encuentra por genérico', () => {
    expect(buscarMed('ceftri').some(m => /ceftriaxona/i.test(m.nombre))).toBe(true)
  })
  it('encuentra por marca', () => {
    expect(buscarMed('tazocin').some(m => /piperacilina/i.test(m.nombre))).toBe(true)
  })
  it('query vacío → sin resultados', () => {
    expect(buscarMed('')).toHaveLength(0)
  })
})
