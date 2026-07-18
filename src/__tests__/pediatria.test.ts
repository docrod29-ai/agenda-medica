import { describe, it, expect } from 'vitest'
import {
  FARMACOS_PED, calcularDosisPediatrica,
  vacunasSegunEdad, edadEnMeses, ESQUEMA_MX,
  zScoreLMS, percentilDeZ, clasificarZ, imc,
} from '@/lib/expediente/pediatria'

const f = (nombre: string) => FARMACOS_PED.find(x => x.nombre === nombre)!

describe('Dosificación por peso', () => {
  it('paracetamol en niño de 10 kg = 100-150 mg por toma', () => {
    const d = calcularDosisPediatrica(f('Paracetamol'), 10)!
    expect(d.porToma.min).toBe(100)
    expect(d.porToma.max).toBe(150)
    expect(d.topeAplicado).toBe(false)
  })

  it('APLICA el tope de adulto: paracetamol en adolescente de 80 kg no rebasa 1 g/toma', () => {
    const d = calcularDosisPediatrica(f('Paracetamol'), 80)!
    expect(d.porToma.max).toBe(1000)      // 15 × 80 = 1200 → recortado
    expect(d.porDia.max).toBe(4000)
    expect(d.topeAplicado).toBe(true)
  })

  it('amoxicilina 20 kg a dosis alta = 90 mg/kg/día ÷ 2 = 900 mg c/12 h', () => {
    const d = calcularDosisPediatrica(f('Amoxicilina'), 20)!
    expect(d.porToma.max).toBe(900)
    expect(d.porDia.max).toBe(1800)
    expect(d.intervalo).toBe('c/12 h')
  })

  it('ceftriaxona respeta el tope de 2 g/día en un paciente pesado', () => {
    const d = calcularDosisPediatrica(f('Ceftriaxona'), 50)!   // 75 × 50 = 3750
    expect(d.porDia.max).toBe(2000)
    expect(d.topeAplicado).toBe(true)
  })

  it('TMP-SMX se expresa en trimetoprim', () => {
    expect(f('Trimetoprim-sulfametoxazol').unidad).toMatch(/TMP/)
  })

  it('rechaza pesos inválidos', () => {
    expect(calcularDosisPediatrica(f('Paracetamol'), 0)).toBeNull()
    expect(calcularDosisPediatrica(f('Paracetamol'), -3)).toBeNull()
  })

  it('todos los fármacos del catálogo calculan sin romperse', () => {
    for (const x of FARMACOS_PED) {
      const d = calcularDosisPediatrica(x, 15)
      expect(d, x.nombre).not.toBeNull()
      expect(Number.isFinite(d!.porToma.max), x.nombre).toBe(true)
      expect(d!.porToma.max, x.nombre).toBeGreaterThan(0)
    }
  })
})

describe('Esquema de vacunación (México)', () => {
  it('a los 3 meses, la pentavalente de los 2 meses está ATRASADA', () => {
    const r = vacunasSegunEdad(3.5)
    const penta2 = r.find(v => v.vacuna.mes === 2 && /Hexavalente/.test(v.vacuna.nombre))!
    expect(penta2.estado).toBe('atrasada')
  })

  it('lo que aún no toca queda PENDIENTE, no atrasado', () => {
    const r = vacunasSegunEdad(3.5)
    const srp = r.find(v => v.vacuna.mes === 12)!
    expect(srp.estado).toBe('pendiente')
  })

  it('lo ya aplicado no se marca como atrasado', () => {
    const r = vacunasSegunEdad(24, ['BCG@0', 'Hepatitis B@0'])
    expect(r.find(v => v.vacuna.nombre === 'BCG')!.estado).toBe('aplicada')
  })

  it('hay margen de 1 mes antes de considerarla atrasada', () => {
    const r = vacunasSegunEdad(3)   // 2 meses + 1 de margen
    expect(r.find(v => v.vacuna.mes === 2 && /Rotavirus/.test(v.vacuna.nombre))!.estado).toBe('pendiente')
  })

  it('el esquema incluye los hitos clave', () => {
    const nombres = ESQUEMA_MX.map(v => v.nombre)
    expect(nombres).toContain('BCG')
    expect(nombres).toContain('SRP (triple viral)')
    expect(nombres).toContain('VPH')
    expect(nombres).toContain('Neumocócica conjugada')
  })
})

describe('Edad en meses', () => {
  it('calcula meses completos', () => {
    expect(edadEnMeses('2025-01-15', '2026-07-18')).toBe(18)
  })
  it('no cuenta el mes si aún no llega el día', () => {
    expect(edadEnMeses('2026-01-20', '2026-07-18')).toBe(5)
  })
  it('fechas inválidas devuelven 0 en vez de NaN', () => {
    expect(edadEnMeses('no-es-fecha', '2026-07-18')).toBe(0)
  })
})

describe('Percentiles / z-score (LMS)', () => {
  it('un valor igual a la mediana da z = 0 y percentil 50', () => {
    expect(zScoreLMS(10, -0.3, 10, 0.12)).toBe(0)
    expect(percentilDeZ(0)).toBe(50)
  })
  it('z = 0 con L = 0 (rama logarítmica) también da la mediana', () => {
    expect(zScoreLMS(10, 0, 10, 0.12)).toBe(0)
  })
  it('por debajo de la mediana el z es negativo y el percentil < 50', () => {
    const z = zScoreLMS(8, -0.3, 10, 0.12)
    expect(z).toBeLessThan(0)
    expect(percentilDeZ(z)).toBeLessThan(50)
  })
  it('los percentiles clásicos caen donde deben', () => {
    expect(percentilDeZ(-2)).toBeCloseTo(2.3, 0)
    expect(percentilDeZ(2)).toBeCloseTo(97.7, 0)
    expect(percentilDeZ(1.96)).toBeCloseTo(97.5, 0)
  })
  it('valores inválidos no producen números falsos', () => {
    expect(zScoreLMS(0, -0.3, 10, 0.12)).toBeNaN()
    expect(zScoreLMS(10, -0.3, 0, 0.12)).toBeNaN()
  })
})

describe('Clasificación nutricional OMS', () => {
  it('z < −3 es desnutrición severa', () => {
    expect(clasificarZ(-3.5).etiqueta).toMatch(/severa/i)
    expect(clasificarZ(-3.5).nivel).toBe('bajo')
  })
  it('z entre −1 y +1 es normal', () => {
    expect(clasificarZ(0).nivel).toBe('normal')
    expect(clasificarZ(0.9).nivel).toBe('normal')
  })
  it('z > +3 es obesidad', () => {
    expect(clasificarZ(3.4).etiqueta).toMatch(/obesidad/i)
    expect(clasificarZ(3.4).nivel).toBe('alto')
  })
  it('sin dato válido no inventa clasificación', () => {
    expect(clasificarZ(NaN).etiqueta).toMatch(/sin datos/i)
  })
})

describe('IMC pediátrico', () => {
  it('20 kg y 110 cm = 16.5', () => {
    expect(imc(20, 110)).toBe(16.5)
  })
  it('rechaza datos incompletos', () => {
    expect(imc(0, 110)).toBeNaN()
    expect(imc(20, 0)).toBeNaN()
  })
})
