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

// ── Curvas de crecimiento de la OMS (tabla oficial descargada de cdn.who.int) ──
import { evaluarCrecimiento, evaluarTodo } from '@/lib/expediente/pediatria'
import { PESO_EDAD_NINO, PESO_EDAD_NINA, TALLA_EDAD_NINO, PC_EDAD_NINO } from '@/lib/expediente/oms-crecimiento'

describe('Tabla de la OMS', () => {
  it('cubre 0 a 60 meses en los cuatro indicadores', () => {
    expect(PESO_EDAD_NINO).toHaveLength(61)
    expect(PESO_EDAD_NINA).toHaveLength(61)
    expect(TALLA_EDAD_NINO).toHaveLength(61)
    expect(PC_EDAD_NINO).toHaveLength(61)
  })

  it('las medianas al nacer coinciden con los valores publicados por la OMS', () => {
    expect(PESO_EDAD_NINO[0][1]).toBeCloseTo(3.3464, 3)   // 3.35 kg niños
    expect(PESO_EDAD_NINA[0][1]).toBeCloseTo(3.2322, 3)   // 3.23 kg niñas
    expect(TALLA_EDAD_NINO[0][1]).toBeCloseTo(49.8842, 3) // 49.9 cm
    expect(PC_EDAD_NINO[0][1]).toBeCloseTo(34.4618, 3)    // 34.5 cm
  })

  it('las medianas crecen de forma monótona con la edad', () => {
    for (let m = 1; m <= 60; m++) {
      expect(PESO_EDAD_NINO[m][1], `peso mes ${m}`).toBeGreaterThan(PESO_EDAD_NINO[m - 1][1])
      expect(TALLA_EDAD_NINO[m][1], `talla mes ${m}`).toBeGreaterThan(TALLA_EDAD_NINO[m - 1][1])
    }
  })

  it('en talla y perímetro cefálico la OMS usa L = 1 (distribución normal)', () => {
    for (let m = 0; m <= 60; m++) {
      expect(TALLA_EDAD_NINO[m][0]).toBe(1)
      expect(PC_EDAD_NINO[m][0]).toBe(1)
    }
  })
})

describe('Evaluación del crecimiento contra la OMS', () => {
  it('un niño en la mediana cae en el percentil 50', () => {
    const r = evaluarCrecimiento('peso', PESO_EDAD_NINO[24][1], 24, false)!
    expect(r.z).toBe(0)
    expect(r.percentil).toBe(50)
    expect(r.nivel).toBe('normal')
  })

  it('caso real: niño de 12 meses con 7.5 kg está por debajo de −2 z', () => {
    const r = evaluarCrecimiento('peso', 7.5, 12, false)!
    expect(r.z).toBeLessThan(-2)
    expect(r.nivel).toBe('bajo')
    expect(r.clasificacion).toMatch(/peso bajo para la edad|desnutrici[oó]n/i)
  })

  it('caso real: niña de 36 meses con 14 kg está en rango normal', () => {
    const r = evaluarCrecimiento('peso', 14, 36, true)!
    expect(r.z).toBeGreaterThan(-1)
    expect(r.z).toBeLessThan(1)
    expect(r.nivel).toBe('normal')
  })

  it('el mismo peso da distinto z en niño que en niña', () => {
    const nino = evaluarCrecimiento('peso', 12, 24, false)!
    const nina = evaluarCrecimiento('peso', 12, 24, true)!
    expect(nino.z).not.toBe(nina.z)
    expect(nina.z).toBeGreaterThan(nino.z)   // la mediana de las niñas es menor
  })

  it('la talla baja se llama talla baja, no desnutrición', () => {
    const r = evaluarCrecimiento('talla', 78, 36, false)!
    expect(r.clasificacion).toMatch(/talla baja/i)
    expect(r.clasificacion).not.toMatch(/desnutrición/i)
  })

  it('el perímetro cefálico distingue microcefalia y macrocefalia', () => {
    expect(evaluarCrecimiento('perimetro-cefalico', 40, 12, false)!.clasificacion).toMatch(/microcefalia/i)
    expect(evaluarCrecimiento('perimetro-cefalico', 52, 12, false)!.clasificacion).toMatch(/macrocefalia/i)
    expect(evaluarCrecimiento('perimetro-cefalico', 46, 12, false)!.nivel).toBe('normal')
  })

  it('NO extrapola más allá de los 60 meses: devuelve null en vez de inventar', () => {
    expect(evaluarCrecimiento('peso', 20, 61, false)).toBeNull()
    expect(evaluarCrecimiento('peso', 20, 120, false)).toBeNull()
  })

  it('rechaza valores inválidos', () => {
    expect(evaluarCrecimiento('peso', 0, 24, false)).toBeNull()
    expect(evaluarCrecimiento('peso', -3, 24, false)).toBeNull()
    expect(evaluarCrecimiento('peso', 12, -1, false)).toBeNull()
  })

  it('siempre devuelve la mediana esperada y cita la fuente', () => {
    const r = evaluarCrecimiento('peso', 12, 24, false)!
    expect(r.mediana).toBeCloseTo(12.1482, 3)
    expect(r.fuente).toMatch(/OMS/)
  })

  it('evaluarTodo calcula también el IMC cuando hay peso y talla', () => {
    const rs = evaluarTodo(24, false, { pesoKg: 12, tallaCm: 87, perimetroCm: 48 })
    const indicadores = rs.map(r => r.indicador)
    expect(indicadores).toContain('Peso para la edad')
    expect(indicadores).toContain('Talla para la edad')
    expect(indicadores).toContain('IMC para la edad')
    expect(indicadores).toContain('Perímetro cefálico para la edad')
  })

  it('evaluarTodo solo devuelve lo que puede calcular', () => {
    expect(evaluarTodo(24, false, { pesoKg: 12 })).toHaveLength(1)
    expect(evaluarTodo(24, false, {})).toHaveLength(0)
  })
})

// ── Regresión: hallazgos de la revisión adversarial ──
describe('Regresión: el tope diario debe recortar también la dosis POR TOMA', () => {
  it('CRÍTICO: ceftriaxona en 50 kg no puede recetar 3750 mg por toma con tope de 2 g/día', () => {
    const d = calcularDosisPediatrica(f('Ceftriaxona'), 50)!
    expect(d.porToma.max).toBe(2000)     // antes daba 3750 y eso era lo que iba a la receta
    expect(d.porDia.max).toBe(2000)
  })

  it('amoxicilina en 50 kg reparte el tope entre las dos tomas', () => {
    const d = calcularDosisPediatrica(f('Amoxicilina'), 50)!
    expect(d.porToma.max).toBe(1500)     // 3000 mg/día ÷ 2 tomas
    expect(d.porDia.max).toBe(3000)
  })

  it('INVARIANTE: en todo el catálogo, dosis por toma × tomas al día nunca rebasa el tope diario', () => {
    const tomas = (i: string) => {
      const min = i.match(/c\/(\d+)\s*min/i)
      if (min) return Math.max(1, Math.round(1440 / Number(min[1])))
      const h = i.match(/c\/(\d+)/)
      return h ? Math.max(1, Math.round(24 / Number(h[1]))) : 1
    }
    for (const x of FARMACOS_PED) {
      if (x.topeDia == null) continue
      for (const kg of [5, 15, 30, 50, 80, 120]) {
        const d = calcularDosisPediatrica(x, kg)!
        const n = x.mgKgDosis ? tomas(x.intervalo) : (x.tomas ?? 1)
        expect(d.porToma.max * n, `${x.nombre} @ ${kg} kg`).toBeLessThanOrEqual(x.topeDia + 0.5)
      }
    }
  })

  it('salbutamol respeta el piso de 2.5 mg que dice su propia nota', () => {
    const d = calcularDosisPediatrica(f('Salbutamol nebulizado'), 10)!
    expect(d.porToma.min).toBe(2.5)      // antes daba 1.5: infradosis en crisis asmática
    expect(f('Salbutamol nebulizado').nota).toMatch(/2\.5/)
  })

  it('"c/20 min" se lee como minutos, no como 20 horas', () => {
    const d = calcularDosisPediatrica(f('Salbutamol nebulizado'), 10)!
    expect(d.porDia.max).toBeGreaterThan(d.porToma.max)   // antes eran iguales
  })

  it('"dosis única" cuenta como una sola toma al día', () => {
    const d = calcularDosisPediatrica(f('Dexametasona (croup)'), 10)!
    expect(d.porDia.max).toBe(d.porToma.max)
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P0), validado por el Dr:
 *  - gentamicina/amikacina eran los únicos SIN tope → con peso erróneo, miles de mg.
 *  - el panel ofrecía fármacos contraindicados por edad a un clic.
 */
describe('Aminoglucósidos con tope + reja de edad (Dr-validado)', () => {
  const buscar = (n: string) => FARMACOS_PED.find(f => f.nombre === n)!

  it('NINGÚN fármaco del catálogo queda sin algún tope', () => {
    const sinTope = FARMACOS_PED.filter(f =>
      f.topeDosis == null && f.topeDia == null && f.topeMgKgDia == null)
    expect(sinTope.map(f => f.nombre)).toEqual([])
  })

  it('amikacina: tope absoluto 1500 mg/día aunque el peso sea enorme', () => {
    const d = calcularDosisPediatrica(buscar('Amikacina'), 200)!  // peso erróneo (200 kg)
    expect(d.porDia.max).toBeLessThanOrEqual(1500)
    expect(d.topeAplicado).toBe(true)
  })

  it('gentamicina: el tope por kg (7.5 mg/kg/día) recorta el rango', () => {
    const d = calcularDosisPediatrica(buscar('Gentamicina'), 10)!
    expect(d.porDia.max).toBeLessThanOrEqual(7.5 * 10)
  })

  it('existe pauta neonatal de gentamicina (≤7 días, 5 mg/kg/día)', () => {
    const neo = buscar('Gentamicina neonatal (≤7 días)')
    expect(neo.topeMgKgDia).toBe(5)
    const d = calcularDosisPediatrica(neo, 3)!
    expect(d.porDia.max).toBeLessThanOrEqual(5 * 3)
  })

  it('ibuprofeno a los 3 meses → CONTRAINDICADO por edad (no dosis)', () => {
    const d = calcularDosisPediatrica(buscar('Ibuprofeno'), 6, 3)!
    expect(d.contraindicadoPorEdad).toBe(true)
    expect(d.porToma.max).toBe(0)
    expect(d.motivoEdad).toMatch(/6 meses/i)
  })

  it('ibuprofeno a los 8 meses → SÍ se calcula normal', () => {
    const d = calcularDosisPediatrica(buscar('Ibuprofeno'), 8, 8)!
    expect(d.contraindicadoPorEdad).toBeFalsy()
    expect(d.porToma.max).toBeGreaterThan(0)
  })

  it('TMP-SMX < 2 meses y nitrofurantoína < 1 mes quedan bloqueados', () => {
    expect(calcularDosisPediatrica(buscar('Trimetoprim-sulfametoxazol'), 5, 1)!.contraindicadoPorEdad).toBe(true)
    expect(calcularDosisPediatrica(buscar('Nitrofurantoína'), 4, 0)!.contraindicadoPorEdad).toBe(true)
  })

  it('sin edad capturada NO bloquea (no inventa contraindicación)', () => {
    expect(calcularDosisPediatrica(buscar('Ibuprofeno'), 6)!.contraindicadoPorEdad).toBeFalsy()
  })
})

/** Peso-para-edad OMS (Dr 2026-07): sin categorías de sobrepeso/obesidad. */
describe('Peso para la edad no usa cortes de IMC', () => {
  const pesoAlto = evaluarCrecimiento('peso', 20, 24, false)  // niño 2a, 20 kg (z muy alto)
  it('un peso muy alto se etiqueta "peso alto para la edad", NO "obesidad"', () => {
    expect(pesoAlto).toBeTruthy()
    expect(pesoAlto!.clasificacion).toMatch(/peso alto para la edad/i)
    expect(pesoAlto!.clasificacion).not.toMatch(/^.*: (sobrepeso|obesidad)/i)
    expect(pesoAlto!.nivel).toBe('alto')
  })
  it('el IMC-para-edad SÍ conserva sobrepeso/obesidad', () => {
    const r = evaluarCrecimiento('imc', 30, 24, false)
    if (r && r.nivel === 'alto') expect(r.clasificacion).toMatch(/sobrepeso|obesidad|riesgo/i)
  })
})

/** Salbutamol nebulizado = rescate: sin total diario absurdo (Dr 2026-07). */
describe('Salbutamol nebulizado es de rescate', () => {
  it('la dosis calculada trae esRescate y no se usa un total diario fijo', () => {
    const f = FARMACOS_PED.find(x => x.nombre === 'Salbutamol nebulizado')!
    expect(f.esRescate).toBe(true)
    const d = calcularDosisPediatrica(f, 15)!
    expect(d.esRescate).toBe(true)
  })
})
