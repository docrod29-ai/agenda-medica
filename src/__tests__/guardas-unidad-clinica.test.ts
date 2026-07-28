/**
 * P0 (auditoría verificada): guardas de UNIDAD en motores clínicos.
 */
import { describe, it, expect } from 'vitest'
import { creatininaPlausibleMgDl, clasificarTFG } from '@/lib/expediente/funcion-renal'
import { analizarGasometria } from '@/lib/uci/gasometria'

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
    const r = analizarGasometria({ ph: 7.3, paco2: 30, hco3: 10, na: 140, cl: 100, albumina: 40 })
    expect(r.anionGap.corregidoAlbumina).toBeNull()   // no se corrige con unidad mala
    expect(r.anionGap.elevado).toBe(true)             // sigue detectando el AG alto
  })
  it('albúmina 4 (g/dL) sí corrige normal', () => {
    const r = analizarGasometria({ ph: 7.3, paco2: 30, hco3: 10, na: 140, cl: 100, albumina: 4 })
    expect(r.anionGap.corregidoAlbumina).not.toBeNull()
  })
})
