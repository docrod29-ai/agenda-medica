/**
 * Motor de infusiones: dosis ↔ velocidad (mL/h) con diluciones estándar por fármaco.
 * Determinista; bloquea si falta peso (por kg) o concentración.
 */
import { describe, it, expect } from 'vitest'
import { dosisARate, rateADosis, farmacoPorKey, CATALOGO_INFUSIONES } from '@/lib/uci/infusiones'
import { cantidad, kg } from '@/types/clinical-quantity'

/**
 * E0-05: la dosis, el peso, la velocidad y la concentración viajan CON su unidad.
 * Migración MECÁNICA — ni un solo valor esperado cambió; sólo se lee `.valor`
 * donde antes el motor devolvía un número pelado.
 */
const ugKgMin = (v: number) => cantidad(v, 'µg/kg/min', 'tasa_dosis_peso')
const ugMin = (v: number) => cantidad(v, 'µg/min', 'tasa_dosis')
const uMin = (v: number) => cantidad(v, 'U/min', 'tasa_actividad')
const mlH = (v: number) => cantidad(v, 'mL/h', 'tasa_volumen')
const ugMl = (v: number) => cantidad(v, 'µg/mL', 'concentracion_masa')

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
    const r = dosisARate({ farmacoKey: 'norepinefrina', dosis: ugKgMin(0.1), pesoKg: kg(70) })
    expect(r.rateMlH!.valor).toBe(26.3)   // 420/16 = 26.25 → 26.3 (bomba a 0.1 mL/h)
    expect(r.concentracion!.valor).toBe(16)
    expect(r.concentracion!.unidad).toBe('µg/mL')
  })
  it('dobutamina 5 µg/kg/min, 70 kg, 500 mg/250 mL → 10.5 mL/h', () => {
    expect(dosisARate({ farmacoKey: 'dobutamina', dosis: ugKgMin(5), pesoKg: kg(70) }).rateMlH!.valor).toBe(10.5)
  })
})

describe('mL/h → dosis (round-trip)', () => {
  it('norepinefrina 26.25 mL/h, 70 kg → 0.1 µg/kg/min', () => {
    const r = rateADosis({ farmacoKey: 'norepinefrina', rateMlH: mlH(26.25), pesoKg: kg(70) })
    expect(r.dosis!.valor).toBe(0.1)
    expect(r.dosis!.unidad).toBe('µg/kg/min')
  })
})

describe('fármacos NO por kg', () => {
  it('vasopresina 0.03 U/min, 20 U/100 mL → 9 mL/h (sin peso)', () => {
    expect(dosisARate({ farmacoKey: 'vasopresina', dosis: uMin(0.03) }).rateMlH!.valor).toBe(9)
  })
  it('nitroglicerina 50 µg/min, 50 mg/250 mL → 15 mL/h', () => {
    expect(dosisARate({ farmacoKey: 'nitroglicerina', dosis: ugMin(50) }).rateMlH!.valor).toBe(15)
  })
})

describe('dilución PERSONALIZADA (la que preparó el médico)', () => {
  it('norepinefrina 8 mg/100 mL (80 µg/mL): 0.2 µg/kg/min, 70 kg → 10.5 mL/h', () => {
    expect(dosisARate({ farmacoKey: 'norepinefrina', dosis: ugKgMin(0.2), pesoKg: kg(70), concentracion: ugMl(80) }).rateMlH!.valor).toBe(10.5)
  })
  it('norepinefrina 16 mg/100 mL (160 µg/mL): misma dosis → ~la mitad (5.3 mL/h)', () => {
    expect(dosisARate({ farmacoKey: 'norepinefrina', dosis: ugKgMin(0.2), pesoKg: kg(70), concentracion: ugMl(160) }).rateMlH!.valor).toBe(5.3)
  })
  it('vice-versa: 10.5 mL/h con 80 µg/mL, 70 kg → 0.2 µg/kg/min', () => {
    expect(rateADosis({ farmacoKey: 'norepinefrina', rateMlH: mlH(10.5), pesoKg: kg(70), concentracion: ugMl(80) }).dosis!.valor).toBe(0.2)
  })
})

describe('bloqueos y advertencias', () => {
  it('bloquea si falta el peso en fármaco por kg', () => {
    expect(dosisARate({ farmacoKey: 'norepinefrina', dosis: ugKgMin(0.1) }).bloqueado).toBe(true)
  })
  it('advierte dosis fuera de rango', () => {
    const r = dosisARate({ farmacoKey: 'norepinefrina', dosis: ugKgMin(5), pesoKg: kg(70) }) // > 3
    expect(r.advertencias.join(' ')).toMatch(/ENCIMA del rango/)
  })
})

/**
 * E0-05 — casos que ANTES NO ERAN REPRESENTABLES (un número no tenía unidad) y
 * que ahora el motor rechaza en tiempo de ejecución además de en compilación.
 */
describe('E0-05 · la dimensión de la dosis debe ser la del fármaco', () => {
  it('vasopresina (U/min) con una dosis en µg/min BLOQUEA', () => {
    const r = dosisARate({ farmacoKey: 'vasopresina', dosis: ugMin(0.03) })
    expect(r.bloqueado).toBe(true)
    expect(r.motivoBloqueo).toMatch(/U\/min/)
  })
  it('norepinefrina (µg/kg/min) con una dosis en µg/min BLOQUEA', () => {
    expect(dosisARate({ farmacoKey: 'norepinefrina', dosis: ugMin(5), pesoKg: kg(70) }).bloqueado).toBe(true)
  })
  it('una concentración en U/mL para un fármaco en µg/mL BLOQUEA', () => {
    const r = dosisARate({
      farmacoKey: 'norepinefrina', dosis: ugKgMin(0.1), pesoKg: kg(70),
      concentracion: cantidad(0.2, 'U/mL', 'concentracion_actividad'),
    })
    expect(r.bloqueado).toBe(true)
  })
  it('vasopresina devuelve su concentración en U/mL (no en µg/mL)', () => {
    const r = dosisARate({ farmacoKey: 'vasopresina', dosis: uMin(0.03) })
    expect(r.concentracion!.unidad).toBe('U/mL')
    expect(r.dosis!.unidad).toBe('U/min')
  })
})
