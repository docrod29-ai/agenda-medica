/**
 * nexusmed-icu-011 · TREND_ENGINE
 */
import { describe, it, expect } from 'vitest'
import { tendencia, tendenciasUCI, flechaTendencia } from '@/lib/uci/tendencias'

describe('tendencia', () => {
  it('detecta baja (norepinefrina que desciende) con resumen', () => {
    const t = tendencia([{ t: 1, v: 0.22 }, { t: 2, v: 0.15 }, { t: 3, v: 0.1 }])
    expect(t.direccion).toBe('baja')
    expect(t.primero).toBe(0.22)
    expect(t.ultimo).toBe(0.1)
    expect(t.resumen).toBe('0.22 → 0.15 → 0.1')
  })
  it('detecta subida (VTI 12 → 15)', () => {
    expect(tendencia([{ t: 1, v: 12 }, { t: 2, v: 15 }]).direccion).toBe('sube')
  })
  it('estable dentro del deadband', () => {
    expect(tendencia([{ t: 1, v: 100 }, { t: 2, v: 102 }]).direccion).toBe('estable') // 2% < 5%
  })
  it('ordena por tiempo aunque lleguen desordenados', () => {
    const t = tendencia([{ t: 3, v: 1.9 }, { t: 1, v: 4.8 }, { t: 2, v: 3.1 }]) // lactato baja
    expect(t.valores).toEqual([4.8, 3.1, 1.9])
    expect(t.direccion).toBe('baja')
  })
  it('insuficiente con < 2 puntos y filtra valores no numéricos', () => {
    expect(tendencia([{ t: 1, v: 5 }]).direccion).toBe('insuficiente')
    expect(tendencia([{ t: 1, v: 'nd' }, { t: 2, v: 3 }]).direccion).toBe('insuficiente')
  })
  it('acepta marcas ISO de tiempo', () => {
    const t = tendencia([{ t: '2026-07-01T08:00:00Z', v: 3 }, { t: '2026-07-01T12:00:00Z', v: 2 }])
    expect(t.direccion).toBe('baja')
  })
})

describe('flechaTendencia / tendenciasUCI', () => {
  it('flechas', () => {
    expect(flechaTendencia('sube')).toBe('↑')
    expect(flechaTendencia('baja')).toBe('↓')
    expect(flechaTendencia('estable')).toBe('→')
  })
  it('varios parámetros a la vez', () => {
    const r = tendenciasUCI({
      norepinefrina: [{ t: 1, v: 0.2 }, { t: 2, v: 0.1 }],
      lactato: [{ t: 1, v: 4 }, { t: 2, v: 2 }],
    })
    expect(r.norepinefrina.direccion).toBe('baja')
    expect(r.lactato.direccion).toBe('baja')
  })
})
