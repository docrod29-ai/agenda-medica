/**
 * nexusmed-icu-008 · HEMODYNAMIC_ENGINE
 * PAM, shock index y equivalente de norepinefrina (con bloqueo por falta de peso).
 */
import { describe, it, expect } from 'vitest'
import { presionArterialMedia, shockIndex, equivalenteNorepinefrina } from '@/lib/uci/hemodinamia'

describe('presionArterialMedia', () => {
  it('calcula y alerta si < 65', () => {
    expect(presionArterialMedia(120, 80).valor).toBe(93)
    const baja = presionArterialMedia(90, 50) // (90+100)/3 = 63
    expect(baja.valor).toBe(63)
    expect(baja.advertencias[0]).toMatch(/meta habitual/)
  })
  it('BLOQUEA sin PAS/PAD o valores no fisiológicos', () => {
    expect(presionArterialMedia(120, undefined).ok).toBe(false)
    expect(presionArterialMedia(80, 90).ok).toBe(false) // PAD ≥ PAS
  })
})

describe('shockIndex', () => {
  it('calcula y alerta si > 0.9', () => {
    expect(shockIndex(80, 120).valor).toBe(0.67)
    const alto = shockIndex(120, 90) // 1.33
    expect(alto.valor).toBe(1.33)
    expect(alto.advertencias[0]).toMatch(/elevado/)
  })
})

describe('equivalenteNorepinefrina', () => {
  it('suma norepinefrina + vasopresina', () => {
    const r = equivalenteNorepinefrina([
      { farmaco: 'Norepinefrina', dosis: 0.12, unidad: 'mcg_kg_min' },
      { farmaco: 'Vasopresina', dosis: 0.04, unidad: 'units_min' },
    ])
    expect(r.ok).toBe(true)
    expect(r.valorTotal).toBe(0.22) // 0.12 + 0.04·2.5 = 0.12 + 0.1
  })
  it('BLOQUEA el componente en mcg/min si no hay PESO (no asume)', () => {
    const r = equivalenteNorepinefrina([{ farmaco: 'Norepinefrina', dosis: 8, unidad: 'mcg_min' }])
    expect(r.ok).toBe(false)
    expect(r.componentes[0].bloqueado).toBe(true)
    expect(r.componentes[0].motivo).toMatch(/sin PESO/)
  })
  it('convierte mcg/min a mcg/kg/min con peso válido', () => {
    const r = equivalenteNorepinefrina([{ farmaco: 'Norepinefrina', dosis: 8, unidad: 'mcg_min' }], 80)
    expect(r.ok).toBe(true)
    expect(r.valorTotal).toBe(0.1) // 8/80
  })
  it('los inotrópicos NO cuentan al equivalente', () => {
    const r = equivalenteNorepinefrina([{ farmaco: 'Dobutamina', dosis: 5, unidad: 'mcg_kg_min' }])
    expect(r.valorTotal).toBe(0)
    expect(r.advertencias.some(a => /inotrópico/.test(a))).toBe(true)
  })
})
