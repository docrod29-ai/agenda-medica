/**
 * nexusmed-icu-007 · GASOMETRY_ENGINE
 * Motor determinista de ácido-base. Casos clínicos clásicos + bloqueo.
 */
import { describe, it, expect } from 'vitest'
import { analizarGasometria } from '@/lib/uci/gasometria'
// E0-05: la gasometría recibe cantidades CON unidad. Migración MECÁNICA: ni un
// solo valor esperado de estos casos cambió (mEq/L y mmol/L son numéricamente
// idénticos en Na/Cl/HCO3 por ser iones monovalentes; sólo se unifica la etiqueta).
import { mmHg, cantidad } from '@/types/clinical-quantity'
const mEqL = (v: number) => cantidad(v, 'mEq/L', 'concentracion_equivalente')
const gDl = (v: number) => cantidad(v, 'g/dL', 'concentracion_masa')


describe('analizarGasometria', () => {
  it('BLOQUEA si faltan pH/PaCO2/HCO3 (no inventa)', () => {
    const r = analizarGasometria({ ph: 7.32, hco3: mEqL(23) }) // falta PaCO2
    expect(r.ok).toBe(false)
    expect(r.faltantes).toContain('PaCO2')
  })

  it('caso del prompt: pH 7.32 · PaCO2 48 · HCO3 23 → acidosis respiratoria compensada', () => {
    const r = analizarGasometria({ ph: 7.32, paco2: mmHg(48), hco3: mEqL(23) })
    expect(r.acidemia).toBe('acidemia')
    expect(r.trastornoPrimario).toBe('acidosis_respiratoria')
    expect(r.compensacion.adecuada).toBe(true)   // aguda: HCO3 esperado ≈ 24.8
    expect(r.mixto).toBe(false)
  })

  it('acidosis metabólica con AG elevado y Winters adecuado', () => {
    const r = analizarGasometria({ ph: 7.20, paco2: mmHg(25), hco3: mEqL(10), na: mEqL(140), cl: mEqL(100) })
    expect(r.trastornoPrimario).toBe('acidosis_metabolica')
    expect(r.compensacion.esperadoPaCO2).toBe(23)  // 1.5·10+8
    expect(r.compensacion.adecuada).toBe(true)      // |25−23| ≤ 2
    expect(r.anionGap.valor).toBe(30)               // 140−(100+10)
    expect(r.anionGap.elevado).toBe(true)
    expect(r.deltaDelta.valor).toBeCloseTo(1.3, 1)  // (30−12)/(24−10)
  })

  it('detecta trastorno MIXTO cuando la compensación no cuadra', () => {
    // Acidosis metabólica (HCO3 19) con PaCO2 40 (mayor al Winters esperado 36.5)
    const r = analizarGasometria({ ph: 7.30, paco2: mmHg(40), hco3: mEqL(19) })
    expect(r.trastornoPrimario).toBe('acidosis_metabolica')
    expect(r.mixto).toBe(true)
    expect(r.compensacion.comentario).toMatch(/respiratoria concomitante/)
  })

  it('alcalosis respiratoria', () => {
    const r = analizarGasometria({ ph: 7.50, paco2: mmHg(28), hco3: mEqL(22) })
    expect(r.acidemia).toBe('alcalemia')
    expect(r.trastornoPrimario).toBe('alcalosis_respiratoria')
  })

  it('corrige el anion gap por albúmina', () => {
    const r = analizarGasometria({ ph: 7.30, paco2: mmHg(30), hco3: mEqL(16), na: mEqL(140), cl: mEqL(110), albumina: gDl(2) })
    // AG = 140−(110+16)=14 ; corregido = 14 + 2.5·(4−2)=19
    expect(r.anionGap.valor).toBe(14)
    expect(r.anionGap.corregidoAlbumina).toBe(19)
    expect(r.anionGap.elevado).toBe(true)
  })
})
