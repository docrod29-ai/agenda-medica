/**
 * L6.2 (decisión del Dr): seguridad de UNIDAD del peso pediátrico. Conversión lb→kg
 * explícita; plausibilidad y detección ×2.2046 = confirmación (hard-stop), nunca
 * corrección automática.
 */
import { describe, it, expect } from 'vitest'
import { libraAKg, revisarPesoPediatrico } from '@/lib/expediente/pediatria'

describe('conversión lb→kg', () => {
  it('70 lb → ~31.75 kg', () => {
    expect(libraAKg(70)).toBeCloseTo(31.75, 1)
  })
})

describe('revisión de plausibilidad y confusión de unidad', () => {
  it('peso pediátrico normal (25 kg) → ok', () => {
    expect(revisarPesoPediatrico(25).ok).toBe(true)
  })
  it('NO auto-convierte un peso alto: 130 kg → hard-stop de verificación (no lo divide)', () => {
    const r = revisarPesoPediatrico(130)
    expect(r.ok).toBe(false)
    expect(r.tipo).toBe('implausible')
  })
  it('detecta ≈×2.2 vs previo (12→26 kg, posible lb): confirmar', () => {
    const r = revisarPesoPediatrico(26, 12)
    expect(r.ok).toBe(false)
    expect(r.tipo).toBe('posible_lb_kg')
  })
  it('detecta ≈÷2.2 vs previo (26→12 kg): confirmar', () => {
    expect(revisarPesoPediatrico(12, 26).tipo).toBe('posible_lb_kg')
  })
  it('un cambio de peso normal (18→20 kg) NO se marca', () => {
    expect(revisarPesoPediatrico(20, 18).ok).toBe(true)
  })
  it('peso inválido → hard-stop', () => {
    expect(revisarPesoPediatrico(0).ok).toBe(false)
  })
})
