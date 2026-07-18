import { describe, it, expect } from 'vitest'
import {
  gestacionPorFUM, gestacionPorUltrasonido, hitosSegunEG,
  aspirinaPreeclampsia, bishop, conductaCervical, tamizajeRutina,
} from '@/lib/expediente/ginecologia'

describe('Calculadora gestacional por FUM', () => {
  it('Naegele: FUM 1-ene-2026 con ciclo de 28 días da FPP 8-oct-2026', () => {
    const g = gestacionPorFUM('2026-01-01', '2026-01-01')!
    expect(g.fpp).toBe('2026-10-08')     // 1-ene + 280 días
  })

  it('el día de la FUM la edad gestacional es 0.0', () => {
    const g = gestacionPorFUM('2026-01-01', '2026-01-01')!
    expect(g.texto).toBe('0.0')
    expect(g.trimestre).toBe(1)
  })

  it('a los 100 días son 14 semanas y 2 días → segundo trimestre', () => {
    const g = gestacionPorFUM('2026-01-01', '2026-04-11')!
    expect(g.semanas).toBe(14)
    expect(g.dias).toBe(2)
    expect(g.texto).toBe('14.2')
    expect(g.trimestre).toBe(2)
  })

  it('el tercer trimestre empieza en la semana 28', () => {
    expect(gestacionPorFUM('2026-01-01', '2026-07-16')!.semanas).toBe(28)
    expect(gestacionPorFUM('2026-01-01', '2026-07-16')!.trimestre).toBe(3)
  })

  it('un ciclo largo (35 días) recorre la FPP una semana', () => {
    const normal = gestacionPorFUM('2026-01-01', '2026-03-01', 28)!
    const largo = gestacionPorFUM('2026-01-01', '2026-03-01', 35)!
    expect(new Date(largo.fpp).getTime() - new Date(normal.fpp).getTime()).toBe(7 * 86400000)
    expect(largo.diasTotales).toBe(normal.diasTotales - 7)   // menos avanzada
  })

  it('no inventa datos con fechas inválidas o futuras', () => {
    expect(gestacionPorFUM('no-es-fecha', '2026-07-18')).toBeNull()
    expect(gestacionPorFUM('2026-12-01', '2026-07-18')).toBeNull()   // FUM posterior a hoy
  })
})

describe('Edad gestacional por ultrasonido', () => {
  it('avanza la EG reportada por el tiempo transcurrido', () => {
    // US el 1-mar con 12.0 semanas; 14 días después debe ser 14.0
    const g = gestacionPorUltrasonido('2026-03-01', 12, 0, '2026-03-15')!
    expect(g.texto).toBe('14.0')
  })

  it('deriva la FPP a partir de la EG del ultrasonido', () => {
    // El mismo día del US con 12.0 semanas: faltan 280-84 = 196 días
    const g = gestacionPorUltrasonido('2026-03-01', 12, 0, '2026-03-01')!
    expect(g.fpp).toBe('2026-09-13')
  })

  it('suma correctamente los días sueltos', () => {
    const g = gestacionPorUltrasonido('2026-03-01', 8, 5, '2026-03-04')!
    expect(g.semanas).toBe(9)
    expect(g.dias).toBe(1)
  })

  it('rechaza un ultrasonido con fecha futura', () => {
    expect(gestacionPorUltrasonido('2026-12-01', 12, 0, '2026-07-18')).toBeNull()
  })
})

describe('Hitos del control prenatal', () => {
  it('a las 26 semanas toca el tamizaje de diabetes gestacional', () => {
    const vigentes = hitosSegunEG(26).filter(h => h.estado === 'vigente').map(h => h.hito.titulo)
    expect(vigentes.join(' ')).toMatch(/diabetes gestacional/i)
  })

  it('a las 36 semanas el cultivo de estreptococo B está vigente y el US estructural ya venció', () => {
    const r = hitosSegunEG(36)
    expect(r.find(h => /estreptococo/i.test(h.hito.titulo))!.estado).toBe('vigente')
    expect(r.find(h => /estructural/i.test(h.hito.titulo))!.estado).toBe('vencido')
  })

  it('en la semana 8 el ultrasonido del primer trimestre aún es próximo', () => {
    expect(hitosSegunEG(8).find(h => /primer trimestre/i.test(h.hito.titulo))!.estado).toBe('proximo')
  })

  it('la anti-D de la semana 28 aparece como hito propio', () => {
    expect(hitosSegunEG(28).find(h => /anti-D/i.test(h.hito.titulo))!.estado).toBe('vigente')
  })
})

describe('Aspirina para preeclampsia', () => {
  it('un solo factor de ALTO riesgo ya la indica', () => {
    const r = aspirinaPreeclampsia(1, 0)
    expect(r.indicada).toBe(true)
    expect(r.conducta).toMatch(/81-162 mg/)
    expect(r.conducta).toMatch(/16/)   // idealmente antes de la semana 16
  })

  it('dos factores MODERADOS la indican', () => {
    expect(aspirinaPreeclampsia(0, 2).indicada).toBe(true)
  })

  it('un solo factor moderado NO la indica', () => {
    const r = aspirinaPreeclampsia(0, 1)
    expect(r.indicada).toBe(false)
    expect(r.motivo).toMatch(/un factor/i)
  })

  it('sin factores no se indica profilaxis', () => {
    expect(aspirinaPreeclampsia(0, 0).indicada).toBe(false)
  })
})

describe('Índice de Bishop', () => {
  it('≥8 es cuello favorable para inducir', () => {
    const r = bishop({ dilatacion: 2, borramiento: 2, altura: 2, consistencia: 1, posicion: 1 })
    expect(r.puntaje).toBe(8)
    expect(r.categoria).toMatch(/favorable/i)
    expect(r.interpretacion).toMatch(/oxitocina/i)
  })

  it('bajo es desfavorable y pide maduración cervical', () => {
    const r = bishop({ dilatacion: 0, borramiento: 0, altura: 0, consistencia: 0, posicion: 0 })
    expect(r.puntaje).toBe(0)
    expect(r.interpretacion).toMatch(/maduraci[óo]n cervical/i)
    expect(r.interpretacion).toMatch(/ces[áa]rea/i)
  })

  it('campos ausentes cuentan como 0, no como NaN', () => {
    expect(bishop({ dilatacion: 3 }).puntaje).toBe(3)
  })
})

describe('Conducta ante citología cervical + VPH', () => {
  it('cáncer = referencia urgente a oncología', () => {
    const r = conductaCervical('CANCER', 'desconocido', 45)
    expect(r.urgencia).toBe('urgente')
    expect(r.conducta).toMatch(/oncolog[íi]a/i)
  })

  it('ASC-US con VPH negativo regresa a tamizaje de rutina (no colposcopía)', () => {
    const r = conductaCervical('ASC-US', 'negativo', 32)
    expect(r.urgencia).toBe('rutina')
    expect(r.conducta).not.toMatch(/colposcop/i)
  })

  it('ASC-US con VPH positivo va a colposcopía', () => {
    expect(conductaCervical('ASC-US', 'positivo-otro', 32).urgencia).toBe('colposcopia')
  })

  it('citología negativa pero VPH 16/18 va a colposcopía', () => {
    const r = conductaCervical('NILM', 'positivo-16-18', 35)
    expect(r.urgencia).toBe('colposcopia')
    expect(r.conducta).toMatch(/16 y 18/)
  })

  it('citología negativa con VPH positivo de otro genotipo se repite en 1 año', () => {
    const r = conductaCervical('NILM', 'positivo-otro', 35)
    expect(r.urgencia).toBe('seguimiento')
    expect(r.conducta).toMatch(/1 año/)
  })

  it('ASC-H va a colposcopía aunque el VPH sea negativo', () => {
    expect(conductaCervical('ASC-H', 'negativo', 30).urgencia).toBe('colposcopia')
  })

  it('HSIL en menor de 25 años NO permite tratamiento escisional inmediato', () => {
    const joven = conductaCervical('HSIL', 'positivo-otro', 22)
    expect(joven.conducta).toMatch(/NO el tratamiento escisional/i)
    const mayor = conductaCervical('HSIL', 'positivo-otro', 34)
    expect(mayor.conducta).toMatch(/ver y tratar/i)
  })

  it('AGC obliga a descartar patología endometrial en ≥35 años', () => {
    const r = conductaCervical('AGC', 'negativo', 40)
    expect(r.conducta).toMatch(/endometrial/i)
    expect(r.conducta).toMatch(/endocervical/i)
  })

  it('LSIL con VPH negativo permite seguimiento en vez de colposcopía', () => {
    expect(conductaCervical('LSIL', 'negativo', 30).urgencia).toBe('seguimiento')
    expect(conductaCervical('LSIL', 'positivo-otro', 30).urgencia).toBe('colposcopia')
  })
})

describe('Intervalos de tamizaje cervical', () => {
  it('no se tamiza antes de los 21 años', () => {
    expect(tamizajeRutina(19)).toMatch(/no se recomienda/i)
  })
  it('21-29 años: citología cada 3 años', () => {
    expect(tamizajeRutina(25)).toMatch(/3 años/)
  })
  it('30-65 años: co-prueba cada 5 años', () => {
    expect(tamizajeRutina(40)).toMatch(/5 años/)
  })
  it('después de los 65 se puede suspender con tamizaje previo adecuado', () => {
    expect(tamizajeRutina(70)).toMatch(/suspender/i)
  })
})
