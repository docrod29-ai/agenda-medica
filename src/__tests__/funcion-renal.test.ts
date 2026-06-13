import { describe, it, expect } from 'vitest'
import {
  ckdEpi2021, cockcroftGault, clasificarTFG, evaluarFuncionRenal, ajusteRenalFarmacos,
} from '@/lib/expediente/funcion-renal'

describe('CKD-EPI 2021', () => {
  it('adulto sano (Scr 1.0, 40a, hombre) ≈ TFG normal >90', () => {
    expect(ckdEpi2021(1.0, 40, 'Masculino')).toBeGreaterThanOrEqual(90)
  })
  it('mujer tiene TFG distinta a hombre con mismos valores', () => {
    const h = ckdEpi2021(1.0, 50, 'Masculino')
    const m = ckdEpi2021(1.0, 50, 'Femenino')
    expect(h).not.toBe(m)
  })
  it('creatinina alta (Scr 3.0, 70a) → TFG baja', () => {
    expect(ckdEpi2021(3.0, 70, 'Masculino')).toBeLessThan(30)
  })
})

describe('Cockcroft-Gault', () => {
  it('calcula CrCl con peso', () => {
    // (140-40)×70 / (72×1.0) = 97.2 → 97
    expect(cockcroftGault(1.0, 40, 'Masculino', 70)).toBe(97)
  })
  it('factor 0.85 en mujer', () => {
    const h = cockcroftGault(1.0, 40, 'Masculino', 70)
    const m = cockcroftGault(1.0, 40, 'Femenino', 70)
    expect(m).toBeLessThan(h)
  })
})

describe('clasificarTFG (KDIGO)', () => {
  it('estadios correctos', () => {
    expect(clasificarTFG(95).estadio).toBe('G1')
    expect(clasificarTFG(75).estadio).toBe('G2')
    expect(clasificarTFG(50).estadio).toBe('G3a')
    expect(clasificarTFG(35).estadio).toBe('G3b')
    expect(clasificarTFG(20).estadio).toBe('G4')
    expect(clasificarTFG(10).estadio).toBe('G5')
  })
})

describe('evaluarFuncionRenal', () => {
  it('usa Cockcroft para dosis si hay peso, CKD-EPI si no', () => {
    const conPeso = evaluarFuncionRenal(1.5, 60, 'Masculino', 80)
    expect(conPeso.crClCockcroft).not.toBeNull()
    expect(conPeso.depuracionParaDosis).toBe(conPeso.crClCockcroft)

    const sinPeso = evaluarFuncionRenal(1.5, 60, 'Masculino')
    expect(sinPeso.crClCockcroft).toBeNull()
    expect(sinPeso.depuracionParaDosis).toBe(sinPeso.egfrCkdEpi)
  })
})

describe('ajusteRenalFarmacos', () => {
  it('vancomicina con CrCl bajo → alerta de ajuste', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Vancomicina 1 g' }], 40)
    expect(r.length).toBe(1)
    expect(r[0].severidad).toBe('ajuste')
    expect(r[0].mensaje).toMatch(/vancocinemia|AUC/i)
  })
  it('nitrofurantoína con CrCl <30 → EVITAR', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Nitrofurantoína 100 mg' }], 25)
    expect(r[0].severidad).toBe('evitar')
  })
  it('metformina con CrCl <30 → evitar (acidosis láctica)', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Metformina 850 mg' }], 25)
    expect(r[0].severidad).toBe('evitar')
  })
  it('NO alerta si la depuración está por encima del umbral', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Vancomicina' }], 90)
    expect(r).toHaveLength(0)
  })
  it('TMP-SMX por marca (Bactrim) con CrCl bajo', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Bactrim F' }], 20)
    expect(r.length).toBe(1)
  })
  it('fármaco sin ajuste renal no alerta (paracetamol)', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Paracetamol 500 mg' }], 20)
    expect(r).toHaveLength(0)
  })
})
