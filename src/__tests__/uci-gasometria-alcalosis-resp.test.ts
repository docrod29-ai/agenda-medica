/**
 * NEXUS-QUALITY-002 — P0: inversión de signo en la compensación de la ALCALOSIS
 * respiratoria. El HCO3 esperado debe MOVERSE en la MISMA dirección que la PaCO2
 * (baja PaCO2 → baja HCO3). Antes usaba factor negativo → HCO3 esperado SUBÍA y
 * marcaba MIXTO inventando una acidosis metabólica inexistente.
 */
import { describe, it, expect } from 'vitest'
import { analizarGasometria } from '@/lib/uci/gasometria'

describe('alcalosis respiratoria — compensación (signo)', () => {
  it('(a) alcalosis resp AGUDA bien compensada NO es MIXTA', () => {
    // pH 7.50 · PaCO2 30 · HCO3 22 (cae 2 por 10 mmHg → compensación aguda correcta)
    const r = analizarGasometria({ ph: 7.50, paco2: 30, hco3: 22, cronicidadRespiratoria: 'aguda' })
    expect(r.trastornoPrimario).toBe('alcalosis_respiratoria')
    expect(r.compensacion.adecuada).toBe(true)
    expect(r.mixto).toBe(false)
  })
  it('(b) espejo: acidosis resp aguda bien compensada sigue correcta (no regresión)', () => {
    // pH 7.32 · PaCO2 50 · HCO3 26 (sube 1 por 10 mmHg)
    const r = analizarGasometria({ ph: 7.32, paco2: 50, hco3: 26, cronicidadRespiratoria: 'aguda' })
    expect(r.trastornoPrimario).toBe('acidosis_respiratoria')
    expect(r.compensacion.adecuada).toBe(true)
    expect(r.mixto).toBe(false)
  })
  it('(c) alcalosis resp + acidosis metabólica REAL sobrepuesta SÍ es MIXTA', () => {
    // pH 7.46 · PaCO2 30 · HCO3 15 (mucho más bajo que el esperado ~22) → mixto real
    const r = analizarGasometria({ ph: 7.46, paco2: 30, hco3: 15, cronicidadRespiratoria: 'aguda' })
    expect(r.trastornoPrimario).toBe('alcalosis_respiratoria')
    expect(r.compensacion.adecuada).toBe(false)
    expect(r.mixto).toBe(true)
  })
  it('(d) cronicidad no especificada: alcalosis resp compensada no se marca componente metabólico', () => {
    const r = analizarGasometria({ ph: 7.50, paco2: 30, hco3: 22 })
    expect(r.compensacion.adecuada).toBe(true)
  })
})
