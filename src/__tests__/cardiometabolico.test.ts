import { describe, it, expect } from 'vitest'
import {
  fib4, interpretarFib4, interpretarElastografia, interpretarELF,
  categoriaPorAlcohol, ESTADIOS_FIBROSIS, PERDIDA_PESO_MASLD,
  TRATAMIENTO_POR_ESTADIO, FARMACOS_MASLD, ESTILO_VIDA_MASLD,
} from '@/lib/expediente/cardiometabolico/masld'
import {
  imc, clasificarIMC, indiceCinturaTalla, cinturaElevadaMexico,
  estadificarABCD, evaluarRespuesta, METAS_POR_COMPLICACION,
  FARMACOS_OBESIDAD, PREFERIDO_POR_COMPLICACION, AJUSTES_POR_COMORBILIDAD,
  NUTRICION_OBESIDAD, EJERCICIO_OBESIDAD, RECUPERACION_PESO,
  ADVERTENCIA_EMBARAZO_OBESIDAD, CORTES_CINTURA,
} from '@/lib/expediente/cardiometabolico/obesidad'

// ═══════════════════════ MASLD ═══════════════════════

describe('FIB-4', () => {
  it('aplica la fórmula (edad × AST) / (plaquetas × √ALT)', () => {
    // 50 × 40 / (200 × √25) = 2000 / 1000 = 2.0
    expect(fib4(50, 40, 200, 25)).toBe(2)
  })
  it('rechaza valores inválidos en vez de devolver un número falso', () => {
    expect(fib4(0, 40, 200, 25)).toBeNull()
    expect(fib4(50, 40, 0, 25)).toBeNull()
    expect(fib4(50, 40, 200, 0)).toBeNull()
  })

  it('menor de 1.3 es zona baja: manejo en primer nivel, repetir en 1 a 2 años', () => {
    const r = interpretarFib4(0.9, 50)!
    expect(r.zona).toBe('bajo')
    expect(r.seguimiento).toMatch(/1 a 2 años/)
  })

  it('entre 1.3 y 2.67 obliga a prueba de segundo nivel y NO es zona benigna', () => {
    const r = interpretarFib4(1.8, 50)!
    expect(r.zona).toBe('indeterminado')
    expect(r.conducta).toMatch(/segundo nivel/i)
    expect(r.interpretacion).toMatch(/no es una zona benigna/i)
  })

  it('mayor de 2.67 va directo al especialista', () => {
    const r = interpretarFib4(3.5, 50)!
    expect(r.zona).toBe('alto')
    expect(r.conducta).toMatch(/DIRECTA/i)
  })

  it('los límites son exactos', () => {
    expect(interpretarFib4(1.29, 50)!.zona).toBe('bajo')
    expect(interpretarFib4(1.3, 50)!.zona).toBe('indeterminado')
    expect(interpretarFib4(2.67, 50)!.zona).toBe('indeterminado')
    expect(interpretarFib4(2.68, 50)!.zona).toBe('alto')
  })

  it('advierte que no está validado en menores de 35 años', () => {
    expect(interpretarFib4(1.0, 30)!.advertencias.join(' ')).toMatch(/no está validado/i)
    expect(interpretarFib4(1.0, 50)!.advertencias).toHaveLength(0)
  })

  it('en 65 años o más explica el debate del corte sin cambiarlo por su cuenta', () => {
    const r = interpretarFib4(1.5, 70)!
    expect(r.advertencias.join(' ')).toMatch(/1\.9 a 2\.0/)
    expect(r.zona).toBe('indeterminado')   // se mantiene el umbral de 1.3
  })

  it('entre 1.0 y 1.3 sugiere búsqueda de casos si hay factores cardiometabólicos', () => {
    expect(interpretarFib4(1.1, 50)!.conducta).toMatch(/1\.0 y 1\.3/)
    expect(interpretarFib4(0.7, 50)!.conducta).not.toMatch(/1\.0 y 1\.3/)
  })
})

describe('Elastografía y ELF', () => {
  it('los cortes de kPa corresponden a cada estadio', () => {
    expect(interpretarElastografia(6)!.referir).toBe(false)
    expect(interpretarElastografia(9)!.interpretacion).toMatch(/≥F2/)
    expect(interpretarElastografia(12)!.interpretacion).toMatch(/F3 o F4/)
    expect(interpretarElastografia(18)!.interpretacion).toMatch(/cirrosis/i)
  })

  it('detecta hipertensión portal por kPa o por kPa más plaquetas bajas', () => {
    expect(interpretarElastografia(28)!.interpretacion).toMatch(/hipertensión portal/i)
    expect(interpretarElastografia(22, 140)!.interpretacion).toMatch(/hipertensión portal/i)
    expect(interpretarElastografia(22, 300)!.interpretacion).not.toMatch(/hipertensión portal/i)
  })

  it('la cirrosis dispara vigilancia CADA 6 MESES', () => {
    expect(interpretarElastografia(18)!.conducta).toMatch(/6 MESES/)
  })

  it('ELF: 9.8 separa bajo de avanzado y reconoce la zona gris', () => {
    expect(interpretarELF(8.0)!.referir).toBe(false)
    expect(interpretarELF(9.5)!.interpretacion).toMatch(/zona gris/i)
    expect(interpretarELF(10.5)!.referir).toBe(true)
  })

  it('ELF de cirrosis transparenta la discrepancia del documento (11.2 vs 11.3)', () => {
    expect(interpretarELF(11.5)!.interpretacion).toMatch(/11\.2.*11\.3|11\.3.*11\.2/)
  })
})

describe('Clasificación por alcohol', () => {
  it('mujer con 10 g/día y criterios metabólicos es MASLD', () => {
    expect(categoriaPorAlcohol(10, true, 2).categoria).toBe('MASLD')
  })
  it('mujer con 30 g/día es MetALD; con 60 g/día es ALD', () => {
    expect(categoriaPorAlcohol(30, true, 2).categoria).toBe('MetALD')
    expect(categoriaPorAlcohol(60, true, 2).categoria).toBe('ALD')
  })
  it('los umbrales del hombre son más altos', () => {
    expect(categoriaPorAlcohol(25, false, 2).categoria).toBe('MASLD')
    expect(categoriaPorAlcohol(25, true, 2).categoria).toBe('MetALD')
  })
  it('sin criterios metabólicos y sin alcohol manda a buscar otras causas', () => {
    const r = categoriaPorAlcohol(0, false, 0)
    expect(r.categoria).toBe('otra')
    expect(r.explicacion).toMatch(/amiodarona|Wilson|celíaca/i)
  })
})

describe('Estadios de fibrosis y tratamiento', () => {
  it('F3 llega a cirrosis mucho antes que F0-F1', () => {
    expect(ESTADIOS_FIBROSIS.find(e => e.estadio === 'F3')!.tiempoACirrosis).toMatch(/5 a 7/)
    expect(ESTADIOS_FIBROSIS.find(e => e.estadio === 'F0')!.tiempoACirrosis).toMatch(/30 a 35/)
  })

  it('la fibrosis solo mejora con 10% o más de pérdida de peso', () => {
    const diez = PERDIDA_PESO_MASLD.find(p => p.porcentaje === '≥10%')!
    expect(diez.logra).toMatch(/FIBROSIS/i)
    expect(PERDIDA_PESO_MASLD.find(p => p.porcentaje === '≥5%')!.logra).toMatch(/esteatosis/i)
  })

  it('en F0-F1 NO se indica farmacoterapia dirigida al hígado', () => {
    const f01 = TRATAMIENTO_POR_ESTADIO.find(t => /F0-F1/.test(t.estadio))!
    expect(f01.mash).toMatch(/NO INDICADA/)
  })

  it('en cirrosis descompensada solo insulina y se evita todo lo demás', () => {
    const desc = TRATAMIENTO_POR_ESTADIO.find(t => /descompensada/.test(t.estadio))!
    expect(desc.diabetes).toMatch(/SOLO INSULINA/)
    expect(desc.mash).toMatch(/EVITAR/)
  })

  it('resmetirom exige función tiroidea basal y no requiere biopsia', () => {
    const r = FARMACOS_MASLD.find(f => /Resmetirom/.test(f.nombre))!
    expect(r.precauciones).toMatch(/TIROIDEA BASAL/i)
    expect(r.indicacion).toMatch(/NO requiere biopsia/i)
  })

  it('semaglutida trae las cifras reales de ESSENCE', () => {
    const s = FARMACOS_MASLD.find(f => /Semaglutida/.test(f.nombre))!
    expect(s.eficacia).toMatch(/62\.9%/)
    expect(s.eficacia).toMatch(/34\.3%/)
  })

  it('no se inventa la dosis de vitamina E que los documentos no dan', () => {
    const v = FARMACOS_MASLD.find(f => /Vitamina E/.test(f.nombre))!
    expect(v.dosis).toMatch(/NO se especifica/i)
  })

  it('deja claro qué NO traen los documentos en estilo de vida', () => {
    expect(ESTILO_VIDA_MASLD.sinDatos).toMatch(/café/i)
    expect(ESTILO_VIDA_MASLD.sinDatos).toMatch(/déficit calórico/i)
  })
})

// ═══════════════════════ OBESIDAD ═══════════════════════

describe('Antropometría', () => {
  it('clasifica el IMC por clases', () => {
    expect(clasificarIMC(22)).toBe('Peso normal')
    expect(clasificarIMC(27)).toBe('Sobrepeso')
    expect(clasificarIMC(32)).toBe('Obesidad clase I')
    expect(clasificarIMC(37)).toBe('Obesidad clase II')
    expect(clasificarIMC(45)).toBe('Obesidad clase III')
  })

  it('calcula el IMC y rechaza datos incompletos', () => {
    expect(imc(80, 170)).toBe(27.7)
    expect(imc(0, 170)).toBeNull()
  })

  it('usa los cortes de cintura de Latinoamérica para México (90 y 80 cm)', () => {
    expect(cinturaElevadaMexico(92, false)).toBe(true)
    expect(cinturaElevadaMexico(88, false)).toBe(false)
    expect(cinturaElevadaMexico(82, true)).toBe(true)
    const mx = CORTES_CINTURA.find(c => /Sudamérica/.test(c.region))!
    expect([mx.hombre, mx.mujer]).toEqual([90, 80])
  })

  it('el índice cintura-talla usa 0.5 y explica por qué es mejor', () => {
    const r = indiceCinturaTalla(90, 170)!
    expect(r.valor).toBe(0.53)
    expect(r.elevado).toBe(true)
    expect(r.nota).toMatch(/SUPERIOR/i)
    expect(indiceCinturaTalla(80, 175)!.elevado).toBe(false)
  })
})

describe('Estadificación ABCD', () => {
  it('sin complicaciones es estadio 1 pero SÍ amerita tratamiento', () => {
    const e = estadificarABCD(0, false)
    expect(e.estadio).toBe(1)
    expect(e.tratamiento).toMatch(/NO implica que el tratamiento no esté justificado/i)
    expect(e.equivalencia).toMatch(/preclínica/i)
  })
  it('una complicación leve es estadio 2', () => {
    expect(estadificarABCD(1, false).estadio).toBe(2)
  })
  it('una severa lleva a estadio 3 y prefiere segunda generación', () => {
    const e = estadificarABCD(1, true)
    expect(e.estadio).toBe(3)
    expect(e.tratamiento).toMatch(/segunda generación/i)
    expect(e.tratamiento).toMatch(/15%/)
  })
  it('múltiples complicaciones también llevan a estadio 3', () => {
    expect(estadificarABCD(3, false).estadio).toBe(3)
  })
})

describe('Metas de pérdida de peso y respuesta', () => {
  it('cada complicación tiene su meta propia', () => {
    const dm = METAS_POR_COMPLICACION.find(m => /Remisión de diabetes/.test(m.complicacion))!
    expect(dm.beneficio).toBe('10%')
    const mash = METAS_POR_COMPLICACION.find(m => m.complicacion === 'MASH')!
    expect(mash.beneficio).toMatch(/10%/)
  })

  it('no inventa meta donde el documento dice que falta investigación', () => {
    const cancer = METAS_POR_COMPLICACION.find(m => /cáncer/i.test(m.complicacion))!
    expect(cancer.beneficio).toMatch(/investigación adicional/i)
  })

  it('clasifica la respuesta en los tres rangos', () => {
    expect(evaluarRespuesta(3)!.categoria).toBe('incompleta')
    expect(evaluarRespuesta(5)!.categoria).toBe('incompleta')     // ≤5% es incompleta
    expect(evaluarRespuesta(8)!.categoria).toBe('buena')
    expect(evaluarRespuesta(20)!.categoria).toBe('excelente')
  })

  it('la respuesta incompleta obliga a cambiar el abordaje, no a insistir', () => {
    expect(evaluarRespuesta(2)!.conducta).toMatch(/cambiar el abordaje/i)
  })

  it('la respuesta excelente recuerda des-escalar los tratamientos de las complicaciones', () => {
    expect(evaluarRespuesta(18)!.conducta).toMatch(/des-escalar/i)
  })
})

describe('Farmacoterapia de obesidad', () => {
  it('tirzepatida y semaglutida son de segunda generación', () => {
    expect(FARMACOS_OBESIDAD.find(f => /Tirzepatida/.test(f.nombre))!.generacion).toBe(2)
    expect(FARMACOS_OBESIDAD.find(f => /^Semaglutida/.test(f.nombre))!.generacion).toBe(2)
    expect(FARMACOS_OBESIDAD.find(f => /Orlistat/.test(f.nombre))!.generacion).toBe(1)
  })

  it('trae el escalamiento completo, no solo la dosis máxima', () => {
    const t = FARMACOS_OBESIDAD.find(f => /Tirzepatida/.test(f.nombre))!
    expect(t.inicio).toMatch(/2\.5 mg/)
    expect(t.escalamiento).toMatch(/cada 4 semanas/)
    expect(t.maxima).toMatch(/15 mg/)
  })

  it('solo semaglutida tiene el dato de reducción de eventos cardiovasculares', () => {
    const s = FARMACOS_OBESIDAD.find(f => /^Semaglutida/.test(f.nombre))!
    expect(s.grade).toMatch(/SELECT/)
    expect(s.grade).toMatch(/ÚNICO/i)
  })

  it('todos los fármacos advierten del embarazo', () => {
    expect(ADVERTENCIA_EMBARAZO_OBESIDAD).toMatch(/TODOS/)
    expect(ADVERTENCIA_EMBARAZO_OBESIDAD).toMatch(/prueba de embarazo negativa/i)
    for (const f of FARMACOS_OBESIDAD) {
      expect(f.contraindicaciones, f.nombre).toMatch(/embarazo/i)
    }
  })

  it('orlistat y fentermina/topiramato están contraindicados en nefrolitiasis', () => {
    const n = AJUSTES_POR_COMORBILIDAD.find(a => /Nefrolitiasis/.test(a.condicion))!
    expect(n.ajuste).toMatch(/Orlistat CONTRAINDICADO/)
    expect(n.ajuste).toMatch(/Fentermina\/topiramato CONTRAINDICADO/)
  })

  it('la jerarquía por complicación nombra el preferido', () => {
    const mash = PREFERIDO_POR_COMPLICACION.find(p => p.complicacion === 'MASH')!
    expect(mash.primera).toMatch(/Semaglutida/)
    const osa = PREFERIDO_POR_COMPLICACION.find(p => /apnea/i.test(p.complicacion))!
    expect(osa.primera).toMatch(/Tirzepatida/)
  })
})

describe('Nutrición, ejercicio y recuperación de peso', () => {
  it('el déficit calórico viene con cifras', () => {
    expect(NUTRICION_OBESIDAD.deficit).toMatch(/500 a 750/)
  })
  it('reconoce que ningún patrón de macronutrientes es superior', () => {
    expect(NUTRICION_OBESIDAD.patron).toMatch(/NO hay una composición/i)
    expect(NUTRICION_OBESIDAD.patron).toMatch(/mediterránea/i)
  })
  it('la proteína sola no basta sin entrenamiento de fuerza', () => {
    expect(NUTRICION_OBESIDAD.proteinaAdvertencia).toMatch(/POR SÍ SOLA/)
    expect(NUTRICION_OBESIDAD.proteina).toMatch(/1\.2 g/)
  })
  it('el mantenimiento exige más volumen de ejercicio que la pérdida', () => {
    expect(EJERCICIO_OBESIDAD.mantenimiento).toMatch(/200 a 300/)
    expect(EJERCICIO_OBESIDAD.aerobico).toMatch(/150 minutos/)
  })
  it('advierte honestamente que el ejercicio solo baja poco peso', () => {
    expect(EJERCICIO_OBESIDAD.soloEjercicio).toMatch(/1% a 3%/)
  })
  it('dice cuánto peso se recupera al suspender', () => {
    expect(RECUPERACION_PESO.cuanto).toMatch(/DOS TERCIOS/i)
    expect(RECUPERACION_PESO.siSeContinua).toMatch(/16 kg/)
  })
  it('recuerda reiniciar a dosis baja si hubo pausa', () => {
    expect(RECUPERACION_PESO.siSeReinicia).toMatch(/REINICIAR a dosis baja/i)
  })
})
