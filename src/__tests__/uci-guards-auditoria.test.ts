/**
 * P1 (auditoría verificada): guards de unidad/finitud en motores UCI.
 */
import { describe, it, expect } from 'vitest'
import { num } from '@/lib/uci/num'
import { tendencia } from '@/lib/uci/tendencias'
import { calcularNews2 } from '@/lib/hospital/news2'

describe('num · coma de miles vs decimal', () => {
  it('"1,200" (3 dígitos) = 1200, NO 1.2', () => { expect(num('1,200')).toBe(1200) })
  it('"12,5" (decimal) = 12.5', () => { expect(num('12,5')).toBe(12.5) })
  it('"7,35" = 7.35', () => { expect(num('7,35')).toBe(7.35) })
  it('"1,234.5" (con punto) = 1234.5', () => { expect(num('1,234.5')).toBe(1234.5) })
})

describe('tendencia · dirección con delta crudo', () => {
  it('troponina 0.002→0.006 (+200%) = sube, no estable', () => {
    const t = tendencia([{ t: '2026-01-01T00:00Z', v: 0.002 }, { t: '2026-01-01T06:00Z', v: 0.006 }])
    expect(t.direccion).toBe('sube')
  })
})

describe('NEWS2 · NaN no corrompe el score', () => {
  it('FR NaN no suma 3 (rojo falso); cuenta como faltante', () => {
    const r = calcularNews2({ fr: NaN, fc: 80 })!
    expect(r.detalle.find(d => d.param === 'FR')).toBeUndefined()
    expect(r.faltantes).toContain('FR')
  })
})
