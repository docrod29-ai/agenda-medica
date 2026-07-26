/**
 * nexusmed-icu-010 (cont.) · RASS + CAM-ICU + APACHE II
 */
import { describe, it, expect } from 'vitest'
import { descripcionRASS, esSedacionLigera, rassValido, camIcu, calcularAPACHE2 } from '@/lib/uci/scores'

describe('RASS', () => {
  it('describe y valida', () => {
    expect(descripcionRASS(-2)).toBe('Sedación ligera')
    expect(descripcionRASS(0)).toBe('Alerta y tranquilo')
    expect(rassValido(-5)).toBe(true)
    expect(rassValido(-6)).toBe(false)
  })
  it('meta de sedación ligera −2 a +1 (PADIS)', () => {
    expect(esSedacionLigera(-2)).toBe(true)
    expect(esSedacionLigera(1)).toBe(true)
    expect(esSedacionLigera(-4)).toBe(false)
    expect(esSedacionLigera(2)).toBe(false)
  })
})

describe('CAM-ICU', () => {
  it('positivo con 1+2+(3 ó 4)', () => {
    expect(camIcu({ inicioAgudoOFluctuante: true, inatencion: true, nivelConcienciaAlterado: true }).positivo).toBe(true)
    expect(camIcu({ inicioAgudoOFluctuante: true, inatencion: true, pensamientoDesorganizado: true, nivelConcienciaAlterado: false }).positivo).toBe(true)
  })
  it('negativo si falta rasgo 1 o 2', () => {
    expect(camIcu({ inicioAgudoOFluctuante: false, inatencion: true }).positivo).toBe(false)
    expect(camIcu({ inicioAgudoOFluctuante: true, inatencion: true, nivelConcienciaAlterado: false, pensamientoDesorganizado: false }).positivo).toBe(false)
  })
  it('no evaluable si faltan rasgos base', () => {
    expect(camIcu({}).evaluable).toBe(false)
  })
})

describe('APACHE II', () => {
  it('caso conocido = 30 (fisiología 22 + edad 3 + crónica 5)', () => {
    const r = calcularAPACHE2({
      temperatura: 39.0, pam: 60, fc: 120, fr: 30,
      fio2: 0.4, pao2: 65, ph: 7.30, sodio: 150, potasio: 5.6,
      creatinina: 2.0, fallaRenalAguda: true, hematocrito: 30, leucocitos: 16,
      glasgow: 13, edad: 60, saludCronica: 'no_operatorio_o_urgencia',
    })
    expect(r.parcial).toBe(false)
    expect(r.fisiologia).toBe(22)
    expect(r.edadPuntos).toBe(3)
    expect(r.cronicaPuntos).toBe(5)
    expect(r.total).toBe(30)
  })
  it('marca PARCIAL si falta una variable (no asume 0)', () => {
    const r = calcularAPACHE2({ temperatura: 37, edad: 50 })
    expect(r.parcial).toBe(true)
    expect(r.faltantes.length).toBeGreaterThan(0)
  })
  it('duplica los puntos de creatinina en falla renal aguda', () => {
    const sinFRA = calcularAPACHE2({ creatinina: 2.0, edad: 40 }).fisiologia
    const conFRA = calcularAPACHE2({ creatinina: 2.0, fallaRenalAguda: true, edad: 40 }).fisiologia
    // ambos parciales, pero el aporte de creatinina se duplica (3 → 6)
    expect((conFRA ?? 0) - (sinFRA ?? 0)).toBe(3)
  })
})
