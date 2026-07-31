/**
 * Motor neurocrítico (Brain ICU): PPC = PAM − PIC (meta 60–70), banderas de PIC,
 * pupilas, CO2, temperatura, Na, osmolaridad. Determinista; bloquea; cita BTF.
 */
import { describe, it, expect } from 'vitest'
import { presionPerfusionCerebral, analizarNeuro } from '@/lib/uci/neuro'

describe('PPC = PAM − PIC', () => {
  it('calcula y clasifica contra la meta 60–70', () => {
    expect(presionPerfusionCerebral(82, 19).valor).toBe(63)
    expect(presionPerfusionCerebral(82, 19).interpretacion).toMatch(/en meta/)
    expect(presionPerfusionCerebral(70, 25).interpretacion).toMatch(/hipoperfusión/)
    expect(presionPerfusionCerebral(100, 10).interpretacion).toMatch(/> 70/)
  })
  it('bloquea si falta PAM o PIC', () => {
    expect(presionPerfusionCerebral(undefined, 15).ok).toBe(false)
    expect(presionPerfusionCerebral(80, undefined).ok).toBe(false)
  })
})

describe('analizarNeuro — banderas', () => {
  it('PIC > 22 es crítica', () => {
    const r = analizarNeuro({ pic: 26, mapMmHg: 85 })
    expect(r.banderas.some(b => b.parametro === 'PIC' && b.nivel === 'critica')).toBe(true)
    expect(r.ppc.valor).toBe(59)
  })
  it('pupilas fijas = herniación (crítica)', () => {
    expect(analizarNeuro({ pupilas: 'fijas' }).banderas.some(b => b.nivel === 'critica' && /herniación/.test(b.mensaje))).toBe(true)
  })
  it('hiperventilación profunda (PaCO2 < 30) alerta', () => {
    expect(analizarNeuro({ paco2: 26 }).banderas.some(b => b.parametro === 'PaCO2')).toBe(true)
  })
  it('Glasgow ≤ 8 alerta vía aérea/monitoreo PIC', () => {
    expect(analizarNeuro({ glasgow: 7 }).banderas.some(b => b.parametro === 'Glasgow')).toBe(true)
  })
})
