/**
 * REG-073 — el pase traía los datos y el panel no los veía.
 *
 * El Dr., viendo su propia nota: «la mayoría de los datos que pides vienen en la
 * nota, nomás que no los buscas bien». Y su Copilot lo decía dato por dato:
 *
 *   «PAM bloqueada en motor por falta de PAS/PAD aunque hay TA registrada en notas»
 *   «VExUS bloqueado por diámetro de VCI no cargado (hay VCI 24 mm en notas)»
 *   «Na/Cl cargados en motor para anion gap (hay valores en notas: Na 138, Cl 108)»
 *
 * Medido sobre ese bloque hemodinámico: **1 campo de 17**.
 *
 * Tres causas:
 *  1. La tensión se escribe en FRACCIÓN («TA invasiva: 78/46») y el extractor
 *     sólo sabía leer «presión sistólica 78». Sin PAS/PAD no hay PAM, y sin PAM
 *     se bloquea media hemodinámica y la presión de perfusión cerebral.
 *  2. Los electrolitos se escriben con su SÍMBOLO —Na, Cl, K, Cr, BT— y los
 *     alias sólo tenían la palabra completa.
 *  3. Faltaban campos enteros: PVC, PCP, gasto cardiaco, índice cardiaco, SvO₂,
 *     FEVI, PAM directa y peso.
 */
import { describe, it, expect } from 'vitest'
import { extraerValoresUCIConAvisos } from '@/lib/uci/extraccion'

const HEMO = `
* TA invasiva: 78/46 mmHg.
* PAM: 57 mmHg.
* PVC: 17 mmHg.
* PCP/PAOP: 24 mmHg.
* GC termodilución: 2.8 L/min.
* IC: 1.40 L/min/m².
* SvO₂: 46%.
* FEVI: 15%.
VCI
* 24 mm.
Na: 138. Cl: 108. K: 5.3.
* Plaquetas: 118,000/µL.
* BT: 2.1 mg/dL.
Peso: 82 kg.
`

describe('REG-073 · la tensión en fracción', () => {
  const { valores } = extraerValoresUCIConAvisos(HEMO)

  it('«TA invasiva: 78/46» da sistólica y diastólica', () => {
    expect(valores.pas).toBe('78')
    expect(valores.pad).toBe('46')
  })

  it('NO confunde una fracción cualquiera con una tensión', () => {
    // Volumen corriente por kilo, relación I:E y Glasgow no son tensiones.
    for (const t of ['VT 6/kg de peso predicho', 'Relación I:E 1:2', 'Glasgow 13/15']) {
      const v = extraerValoresUCIConAvisos(t).valores
      expect(v.pas, t).toBeUndefined()
    }
  })

  it('exige que la sistólica sea mayor que la diastólica', () => {
    expect(extraerValoresUCIConAvisos('TA 46/78').valores.pas).toBeUndefined()
  })
})

describe('REG-073 · los símbolos que el médico SÍ escribe', () => {
  const { valores } = extraerValoresUCIConAvisos(HEMO)
  it('Na, Cl, K, BT', () => {
    expect(valores.na).toBe('138')
    expect(valores.cl).toBe('108')
    expect(valores.k).toBe('5.3')
    expect(valores.bili).toBe('2.1')
  })
  it('«Cr» es creatinina', () => {
    expect(extraerValoresUCIConAvisos('Cr: 2.4 mg/dL').valores.creat).toBe('2.4')
  })
})

describe('REG-073 · las unidades escritas se convierten, no se adivinan', () => {
  const { valores, avisos } = extraerValoresUCIConAvisos(HEMO)

  it('«VCI 24 mm» entra como 2.4 cm, y ya no se descarta', () => {
    expect(valores.vci).toBe('2.4')
    expect(avisos.some(a => a.campo === 'vci')).toBe(false)
  })

  it('«Plaquetas 118,000/µL» entra como 118 ×10³', () => {
    expect(valores.plaquetas).toBe('118')
    expect(avisos.some(a => a.campo === 'plaquetas')).toBe(false)
  })

  it('SIN unidad escrita NO se convierte: se avisa', () => {
    // Elegir la unidad por el médico sería adivinar, y aquí un factor de diez o
    // de mil cambia la lectura clínica.
    const r = extraerValoresUCIConAvisos('VCI: 24.')
    expect(r.valores.vci).toBeUndefined()
    expect(r.avisos.some(a => a.campo === 'vci' && a.motivo === 'implausible')).toBe(true)
  })
})

describe('REG-073 · la hemodinámica invasiva completa', () => {
  const { valores, avisos } = extraerValoresUCIConAvisos(HEMO)

  it('capta los campos que no existían', () => {
    expect(valores).toMatchObject({
      pvc: '17', pcp: '24', gc: '2.8', ic: '1.40', svo2: '46', fevi: '15',
      pam: '57', peso: '82',
    })
  })

  it('el bloque entero pasa de 1 campo a 16, sin un solo aviso falso', () => {
    expect(Object.keys(valores).length).toBeGreaterThanOrEqual(16)
    expect(avisos).toEqual([])
  })
})
