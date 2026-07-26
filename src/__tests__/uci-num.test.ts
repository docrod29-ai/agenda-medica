/**
 * L4 auditoría maestra — coerción numérica clínica robusta (fuente única).
 * Fija los dos fixes: (1) vacío/espacios ≠ 0 (un campo en blanco NO inyecta 0
 * clínico); (2) coma decimal mexicana '7,35' se interpreta, no se pierde.
 */
import { describe, it, expect } from 'vitest'
import { num } from '@/lib/uci/num'

describe('num() clínico', () => {
  it('vacío y solo-espacios → null (NO 0)', () => {
    expect(num('')).toBeNull()
    expect(num('   ')).toBeNull()
    expect(num(null)).toBeNull()
    expect(num(undefined)).toBeNull()
  })
  it('coma decimal mexicana → número', () => {
    expect(num('7,35')).toBe(7.35)
    expect(num('12,5')).toBe(12.5)
  })
  it('formato con miles MX (coma miles + punto decimal) → número', () => {
    expect(num('1,234.5')).toBe(1234.5)
  })
  it('números y strings simples se respetan', () => {
    expect(num(170)).toBe(170)
    expect(num('420')).toBe(420)
    expect(num('0.4')).toBe(0.4)
    expect(num(0)).toBe(0)          // 0 EXPLÍCITO sí es válido (distinto de vacío)
  })
  it('no numérico / no finito → null (nunca inventa 0)', () => {
    expect(num('abc')).toBeNull()
    expect(num(NaN)).toBeNull()
    expect(num(Infinity)).toBeNull()
  })
})
