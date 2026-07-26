/**
 * nexusmed-icu-010 · ICU_SCORES (SOFA)
 * Cortes publicados (Vincent 1996). Marcado pendienteValidacion.
 */
import { describe, it, expect } from 'vitest'
import { calcularSOFA } from '@/lib/uci/scores'

describe('calcularSOFA', () => {
  it('caso completo suma los 6 aparatos', () => {
    const r = calcularSOFA({
      pafi: 200, soporteRespiratorio: true, // resp 2
      plaquetas: 80,                          // coag 2
      bilirrubina: 3,                         // hígado 2
      norepinefrina: 0.2,                     // cardio 4
      glasgow: 10,                            // neuro 2
      creatinina: 2.5,                        // renal 2
    })
    expect(r.parcial).toBe(false)
    expect(r.total).toBe(14)
    expect(r.pendienteValidacion).toBe(true)
  })

  it('marca PARCIAL y NO asume 0 cuando falta un aparato', () => {
    const r = calcularSOFA({ pafi: 350 }) // solo respiratorio (1)
    expect(r.total).toBe(1)
    expect(r.parcial).toBe(true)
    expect(r.faltantes).toContain('Coagulación')
    expect(r.interpretacion).toMatch(/PARCIAL/)
  })

  it('cardiovascular por vasopresor y por PAM', () => {
    expect(calcularSOFA({ norepinefrina: 0.05 }).subscores.find(s => s.sistema === 'Cardiovascular')?.puntos).toBe(3)
    expect(calcularSOFA({ dobutamina: 5 }).subscores.find(s => s.sistema === 'Cardiovascular')?.puntos).toBe(2)
    expect(calcularSOFA({ pam: 60 }).subscores.find(s => s.sistema === 'Cardiovascular')?.puntos).toBe(1)
    expect(calcularSOFA({ pam: 80 }).subscores.find(s => s.sistema === 'Cardiovascular')?.puntos).toBe(0)
  })

  it('respiratorio: <200 sin soporte NO da 3–4 (no se asume soporte)', () => {
    const r = calcularSOFA({ pafi: 150, soporteRespiratorio: false })
    expect(r.subscores.find(s => s.sistema === 'Respiratorio')?.puntos).toBe(2)
    const r2 = calcularSOFA({ pafi: 150, soporteRespiratorio: true })
    expect(r2.subscores.find(s => s.sistema === 'Respiratorio')?.puntos).toBe(3)
  })

  it('renal por uresis baja', () => {
    expect(calcularSOFA({ uresis24h: 150 }).subscores.find(s => s.sistema === 'Renal')?.puntos).toBe(4)
  })
})
