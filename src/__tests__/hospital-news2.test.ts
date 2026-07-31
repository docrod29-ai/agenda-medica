import { describe, it, expect } from 'vitest'
import { calcularNews2 , puntosSpo2Escala2 } from '@/lib/hospital/news2'
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

/**
 * Escala 2 de SpO₂ (objetivo 88–92%) — validado por el Dr, auditoría 2026-07.
 * SOLO se usa por indicación explícita, no por diagnóstico de EPOC.
 */
describe('NEWS2 Escala 2 de SpO₂', () => {
  it('SpO₂ 90% en escala 2 = 0 puntos (era 3 en escala 1)', () => {
    expect(puntosSpo2Escala2(90, false)).toBe(0)
    // en la escala 1 ese 90% daba 2
    const e1 = calcularNews2({ spo2: 90 })!
    expect(e1.detalle.find(d => d.param.startsWith('SpO₂'))!.puntos).toBe(3)
    const e2 = calcularNews2({ spo2: 90, escalaSpo2: 2 })!
    expect(e2.detalle.find(d => d.param.startsWith('SpO₂'))!.puntos).toBe(0)
  })
  it('el hipercápnico SOBRE-oxigenado puntúa (≥97% con O₂ = 3)', () => {
    expect(puntosSpo2Escala2(98, true)).toBe(3)
  })
  it('≥93% en aire ambiente sigue siendo 0', () => {
    expect(puntosSpo2Escala2(95, false)).toBe(0)
  })
  it('93–94% con O₂ = 1; 95–96% con O₂ = 2', () => {
    expect(puntosSpo2Escala2(94, true)).toBe(1)
    expect(puntosSpo2Escala2(96, true)).toBe(2)
  })
  it('hipoxemia franca puntúa igual: ≤83 = 3', () => {
    expect(puntosSpo2Escala2(82, false)).toBe(3)
    expect(puntosSpo2Escala2(85, false)).toBe(2)
    expect(puntosSpo2Escala2(87, false)).toBe(1)
  })
})
