/**
 * Motor de infusiones: dosis ↔ velocidad (mL/h) con diluciones estándar por fármaco.
 * Determinista; bloquea si falta peso (por kg) o concentración.
 */
import { describe, it, expect } from 'vitest'
import { dosisARate, rateADosis, farmacoPorKey, CATALOGO_INFUSIONES } from '@/lib/uci/infusiones'

describe('catálogo', () => {
  it('trae vasopresores/inotrópicos con diluciones estándar', () => {
    const keys = CATALOGO_INFUSIONES.map(f => f.key)
    for (const k of ['norepinefrina', 'epinefrina', 'dopamina', 'dobutamina', 'vasopresina', 'levosimendan', 'milrinona']) {
      expect(keys).toContain(k)
    }
    // norepi 4 mg / 250 mL = 16 µg/mL
    expect(farmacoPorKey('norepinefrina')!.diluciones[0].concentracion).toBe(16)
    // vasopresina 20 U / 100 mL = 0.2 U/mL
    expect(farmacoPorKey('vasopresina')!.diluciones[0].concentracion).toBe(0.2)
  })
})

describe('dosis → mL/h (por kg)', () => {
  it('norepinefrina 0.1 µg/kg/min, 70 kg, 4 mg/250 mL → 26.3 mL/h', () => {
    const r = dosisARate({ farmacoKey: 'norepinefrina', dosis: 0.1, pesoKg: 70 })
    expect(r.rateMlH).toBe(26.3)   // 420/16 = 26.25 → 26.3 (bomba a 0.1 mL/h)
    expect(r.concentracion).toBe(16)
  })
  it('dobutamina 5 µg/kg/min, 70 kg, 500 mg/250 mL → 10.5 mL/h', () => {
    expect(dosisARate({ farmacoKey: 'dobutamina', dosis: 5, pesoKg: 70 }).rateMlH).toBe(10.5)
  })
})

describe('mL/h → dosis (round-trip)', () => {
  it('norepinefrina 26.25 mL/h, 70 kg → 0.1 µg/kg/min', () => {
    const r = rateADosis({ farmacoKey: 'norepinefrina', rateMlH: 26.25, pesoKg: 70 })
    expect(r.dosis).toBe(0.1)
  })
})

describe('fármacos NO por kg', () => {
  it('vasopresina 0.03 U/min, 20 U/100 mL → 9 mL/h (sin peso)', () => {
    expect(dosisARate({ farmacoKey: 'vasopresina', dosis: 0.03 }).rateMlH).toBe(9)
  })
  it('nitroglicerina 50 µg/min, 50 mg/250 mL → 15 mL/h', () => {
    expect(dosisARate({ farmacoKey: 'nitroglicerina', dosis: 50 }).rateMlH).toBe(15)
  })
})

describe('bloqueos y advertencias', () => {
  it('bloquea si falta el peso en fármaco por kg', () => {
    expect(dosisARate({ farmacoKey: 'norepinefrina', dosis: 0.1 }).bloqueado).toBe(true)
  })
  it('advierte dosis fuera de rango', () => {
    const r = dosisARate({ farmacoKey: 'norepinefrina', dosis: 5, pesoKg: 70 }) // > 3
    expect(r.advertencias.join(' ')).toMatch(/ENCIMA del rango/)
  })
})
