/**
 * P0 (auditoría verificada): guardas de UNIDAD en motores clínicos.
 */
import { describe, it, expect } from 'vitest'
import { creatininaPlausibleMgDl, clasificarTFG } from '@/lib/expediente/funcion-renal'
import { analizarGasometria } from '@/lib/uci/gasometria'
// E0-05: la gasometría recibe cantidades CON unidad. Migración MECÁNICA: ni un
// solo valor esperado de estos casos cambió (mEq/L y mmol/L son numéricamente
// idénticos en Na/Cl/HCO3 por ser iones monovalentes; sólo se unifica la etiqueta).
import { mmHg, cantidad } from '@/types/clinical-quantity'
const mEqL = (v: number) => cantidad(v, 'mEq/L', 'concentracion_equivalente')
const gDl = (v: number) => cantidad(v, 'g/dL', 'concentracion_masa')


describe('creatinina plausible mg/dL', () => {
  it('rechaza µmol/L (88) y typos; acepta mg/dL normales', () => {
    expect(creatininaPlausibleMgDl(88)).toBe(false)   // µmol/L
    expect(creatininaPlausibleMgDl(1.0)).toBe(true)
    expect(creatininaPlausibleMgDl(4.5)).toBe(true)
    expect(creatininaPlausibleMgDl(0)).toBe(false)
    expect(creatininaPlausibleMgDl(NaN)).toBe(false)
  })
})

describe('clasificarTFG finitud', () => {
  it('NaN/∞/negativo NO es G5', () => {
    expect(clasificarTFG(NaN).estadio).toBe('—')
    expect(clasificarTFG(Infinity).estadio).toBe('—')
    expect(clasificarTFG(-5).estadio).toBe('—')
    expect(clasificarTFG(10).estadio).toBe('G5')  // dato válido bajo sí es G5
  })
})

describe('gasometría · albúmina g/L no corrige el anion gap', () => {
  it('albúmina 40 (g/L) NO resta ~90 al AG', () => {
    // AG = 140 - (100 + 10) = 30 (elevado). Con alb 40 g/L NO debe corregirse a -60.
    const r = analizarGasometria({ ph: 7.3, paco2: mmHg(30), hco3: mEqL(10), na: mEqL(140), cl: mEqL(100), albumina: gDl(40) })
    expect(r.anionGap.corregidoAlbumina).toBeNull()   // no se corrige con unidad mala
    expect(r.anionGap.elevado).toBe(true)             // sigue detectando el AG alto
  })
  it('albúmina 4 (g/dL) sí corrige normal', () => {
    const r = analizarGasometria({ ph: 7.3, paco2: mmHg(30), hco3: mEqL(10), na: mEqL(140), cl: mEqL(100), albumina: gDl(4) })
    expect(r.anionGap.corregidoAlbumina).not.toBeNull()
  })
})
