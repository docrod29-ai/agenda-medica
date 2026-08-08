import { describe, it, expect } from 'vitest'
import {
  ckdEpi2021, cockcroftGault, clasificarTFG, evaluarFuncionRenal, ajusteRenalFarmacos,
  type DepuracionParaDosis,
} from '@/lib/expediente/funcion-renal'
import { mgPorDl, kg, cantidad, valorEn } from '@/types/clinical-quantity'

/**
 * E0-05: los motores renales dejaron de recibir `number` suelto. La migración es
 * MECÁNICA — ni un solo valor esperado de este archivo cambió: 1.0 pasó a ser
 * mgPorDl(1.0), 70 pasó a ser kg(70) y la lectura del resultado nombra su unidad.
 */
const tfg = (q: ReturnType<typeof ckdEpi2021>) => valorEn(q, 'mL/min/1.73m²')
/** Depuración por Cockcroft en mL/min, tal como la usaban estos tests. */
const crcl = (v: number): DepuracionParaDosis =>
  ({ base: 'cockcroft-gault', q: cantidad(v, 'mL/min', 'depuracion') })

describe('CKD-EPI 2021', () => {
  it('adulto sano (Scr 1.0, 40a, hombre) ≈ TFG normal >90', () => {
    expect(tfg(ckdEpi2021(mgPorDl(1.0), 40, 'Masculino'))).toBeGreaterThanOrEqual(90)
  })
  it('mujer tiene TFG distinta a hombre con mismos valores', () => {
    const h = tfg(ckdEpi2021(mgPorDl(1.0), 50, 'Masculino'))
    const m = tfg(ckdEpi2021(mgPorDl(1.0), 50, 'Femenino'))
    expect(h).not.toBe(m)
  })
  it('creatinina alta (Scr 3.0, 70a) → TFG baja', () => {
    expect(tfg(ckdEpi2021(mgPorDl(3.0), 70, 'Masculino'))).toBeLessThan(30)
  })
})

describe('Cockcroft-Gault', () => {
  it('calcula CrCl con peso', () => {
    // (140-40)×70 / (72×1.0) = 97.222…
    // REG-192: antes el motor redondeaba a 97 aquí dentro y ese 97 era el que se
    // comparaba contra los umbrales. Ahora sale completo; el 97 lo hace quien pinta.
    expect(valorEn(cockcroftGault(mgPorDl(1.0), 40, 'Masculino', kg(70)), 'mL/min')).toBeCloseTo(97.222, 2)
  })
  it('factor 0.85 en mujer', () => {
    const h = valorEn(cockcroftGault(mgPorDl(1.0), 40, 'Masculino', kg(70)), 'mL/min')
    const m = valorEn(cockcroftGault(mgPorDl(1.0), 40, 'Femenino', kg(70)), 'mL/min')
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
    const conPeso = evaluarFuncionRenal(mgPorDl(1.5), 60, 'Masculino', kg(80))
    expect(conPeso.crClCockcroft).not.toBeNull()
    expect(conPeso.depuracionParaDosis).toEqual({ base: 'cockcroft-gault', q: conPeso.crClCockcroft })

    const sinPeso = evaluarFuncionRenal(mgPorDl(1.5), 60, 'Masculino')
    expect(sinPeso.crClCockcroft).toBeNull()
    expect(sinPeso.depuracionParaDosis).toEqual({ base: 'ckd-epi', q: sinPeso.egfrCkdEpi })
  })
})

describe('ajusteRenalFarmacos', () => {
  it('vancomicina con CrCl bajo → alerta de ajuste', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Vancomicina 1 g' }], crcl(40))
    expect(r.length).toBe(1)
    expect(r[0].severidad).toBe('ajuste')
    expect(r[0].mensaje).toMatch(/vancocinemia|AUC/i)
  })
  it('nitrofurantoína con CrCl <30 → EVITAR', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Nitrofurantoína 100 mg' }], crcl(25))
    expect(r[0].severidad).toBe('evitar')
  })
  it('metformina con CrCl <30 → evitar (acidosis láctica)', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Metformina 850 mg' }], crcl(25))
    expect(r[0].severidad).toBe('evitar')
  })
  it('NO alerta si la depuración está por encima del umbral', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Vancomicina' }], crcl(90))
    expect(r).toHaveLength(0)
  })
  it('TMP-SMX por marca (Bactrim) con CrCl bajo', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Bactrim F' }], crcl(20))
    expect(r.length).toBe(1)
  })
  it('fármaco sin ajuste renal no alerta (paracetamol)', () => {
    const r = ajusteRenalFarmacos([{ nombre: 'Paracetamol 500 mg' }], crcl(20))
    expect(r).toHaveLength(0)
  })
  /**
   * E0-05: la unión discriminada no cambia los números. Con la TFG indexada como
   * base, los umbrales se evalúan igual que hoy (Q2 sigue abierta con el Dr.).
   */
  it('la base CKD-EPI produce las mismas alertas que el mismo número por Cockcroft', () => {
    const porIndexada = ajusteRenalFarmacos([{ nombre: 'Vancomicina 1 g' }], {
      base: 'ckd-epi', q: cantidad(40, 'mL/min/1.73m²', 'depuracion_indexada'),
    })
    expect(porIndexada).toEqual(ajusteRenalFarmacos([{ nombre: 'Vancomicina 1 g' }], crcl(40)))
  })
})

/** REGRESIÓN (P1): evaluarFuncionRenal no aplica en <18 años. */
describe('evaluarFuncionRenal: reja de edad', () => {
  it('en <18 años marca noAplicablePorEdad y NO devuelve un número usable', () => {
    const r = evaluarFuncionRenal(mgPorDl(0.5), 10, 'Masculino')
    expect(r.noAplicablePorEdad).toBe(true)
    // E0-05: el "no usable" pasó de NaN a null — más fuerte, porque un null no se
    // puede meter en una resta y salir con un número plausible.
    expect(r.depuracionParaDosis).toBeNull()
  })
  it('en adulto funciona normal', () => {
    const r = evaluarFuncionRenal(mgPorDl(1.0), 40, 'Masculino')
    expect(r.noAplicablePorEdad).toBeFalsy()
    expect(tfg(r.egfrCkdEpi!)).toBeGreaterThan(0)
  })
})
