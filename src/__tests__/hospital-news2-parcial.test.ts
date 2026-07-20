import { describe, it, expect } from 'vitest'
import { calcularNews2 } from '@/lib/hospital/news2'

/**
 * Un parámetro ausente NO suma puntos, así que un NEWS2 incompleto da un total
 * bajo. Si además se presenta como completo, subestima el deterioro — que es
 * exactamente lo que el score existe para evitar.
 */
describe('NEWS2 — un score incompleto tiene que declararse incompleto', () => {
  it('REGRESIÓN: solo FC y conciencia se marca como PARCIAL', () => {
    // El formulario no exige ningún campo. Sin FR ni SpO₂ el paciente puede estar
    // en insuficiencia respiratoria y el score decía 0, riesgo bajo, parcial false.
    const r = calcularNews2({ fc: 88, conciencia: 'alerta' })!
    expect(r.parcial).toBe(true)
    expect(r.faltantes).toContain('FR')
    expect(r.faltantes).toContain('SpO₂')
  })

  it('el aviso de subestimación va en la recomendación, no escondido en un flag', () => {
    const r = calcularNews2({ fc: 88, conciencia: 'alerta' })!
    expect(r.recomendacion).toMatch(/INCOMPLETO/i)
    expect(r.recomendacion).toMatch(/SUBESTIMA/i)
  })

  it('un score COMPLETO no se marca parcial ni lleva el aviso', () => {
    const r = calcularNews2({
      fr: 18, spo2: 97, temp: 36.5, ta: '120/80', fc: 75,
      conciencia: 'alerta', oxigeno: false,
    })!
    expect(r.parcial).toBe(false)
    expect(r.faltantes).toHaveLength(0)
    expect(r.recomendacion).not.toMatch(/INCOMPLETO/i)
  })

  it('faltar UN solo parámetro ya lo marca parcial', () => {
    const r = calcularNews2({
      fr: 18, spo2: 97, temp: 36.5, ta: '120/80',
      conciencia: 'alerta', oxigeno: false,   // falta FC
    })!
    expect(r.parcial).toBe(true)
    expect(r.faltantes).toEqual(['FC'])
  })

  it('los cortes del score no cambiaron', () => {
    // FR ≤8 = 3 puntos; SpO₂ ≤91 = 3; ambos en rojo.
    const r = calcularNews2({
      fr: 7, spo2: 90, temp: 36.5, ta: '120/80', fc: 75,
      conciencia: 'alerta', oxigeno: false,
    })!
    expect(r.total).toBe(6)
    expect(r.parametroRojo).toBe(true)
  })
})
