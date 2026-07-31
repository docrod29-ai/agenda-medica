import { describe, it, expect } from 'vitest'
import {
  metaLipidica, planTrigliceridos, interpretarLpa, recomendarEstatina,
  DIETA_LDL, SUPLEMENTOS_SIN_BENEFICIO, SEGUIMIENTO_LIPIDOS,
} from '@/lib/expediente/cardiometabolico/dislipidemia'

describe('Metas de lipoproteínas (Figura 1, ACC/AHA 2026)', () => {
  it('ASCVD clínica de muy alto riesgo: LDL <55, no-HDL <85, apoB <55', () => {
    const m = metaLipidica({ ascvdClinica: true, muyAltoRiesgo: true })
    expect(m.ldl).toBe(55)
    expect(m.noHDL).toBe(85)
    expect(m.apoB).toBe(55)
  })

  it('ASCVD clínica con enfermedad renal crónica también va a <55/<85', () => {
    const m = metaLipidica({ ascvdClinica: true, erc: true })
    expect(m.ldl).toBe(55)
    expect(m.poblacion).toMatch(/renal/i)
  })

  it('ASCVD clínica sin muy alto riesgo: <70/<100 con meta opcional más estricta', () => {
    const m = metaLipidica({ ascvdClinica: true })
    expect(m.ldl).toBe(70)
    expect(m.noHDL).toBe(100)
    expect(m.opcional).toMatch(/55/)
  })

  it('la condición más severa gana sobre la menos severa', () => {
    // Con ASCVD de muy alto riesgo Y diabetes, no se usa la meta de diabetes.
    const m = metaLipidica({ ascvdClinica: true, muyAltoRiesgo: true, diabetes: true })
    expect(m.ldl).toBe(55)
    expect(m.poblacion).not.toMatch(/diabetes/i)
  })

  it('hipercolesterolemia severa: sube de meta si hay FH, factores o subclínica', () => {
    expect(metaLipidica({ hipercolesterolemiaSevera: true }).ldl).toBe(100)
    expect(metaLipidica({ hipercolesterolemiaSevera: true, fh: true }).ldl).toBe(70)
    expect(metaLipidica({ hipercolesterolemiaSevera: true, aterosclerosisSubclinica: true }).ldl).toBe(70)
    expect(metaLipidica({ hipercolesterolemiaSevera: true, ascvdClinica: true }).ldl).toBe(55)
  })

  it('diabetes: <100/<130 con apoB <90; con factores de riesgo <70/<100 con apoB <70', () => {
    const sin = metaLipidica({ diabetes: true })
    expect([sin.ldl, sin.noHDL, sin.apoB]).toEqual([100, 130, 90])
    const con = metaLipidica({ diabetes: true, factoresRiesgo: true })
    expect([con.ldl, con.noHDL, con.apoB]).toEqual([70, 100, 70])
  })

  it('CAC: cada rango tiene su meta', () => {
    expect(metaLipidica({ cac: 50 }).ldl).toBe(100)          // 1-99 y <p75
    expect(metaLipidica({ cac: 150 }).ldl).toBe(70)          // 100-299
    expect(metaLipidica({ cac: 500 }).ldl).toBe(70)          // 300-999
    expect(metaLipidica({ cac: 500 }).opcional).toMatch(/55/)
    expect(metaLipidica({ cac: 1200 }).ldl).toBe(55)         // ≥1000
  })

  it('un CAC bajo pero en percentil ≥75 sube la meta', () => {
    expect(metaLipidica({ cac: 50, percentilCAC: 80 }).ldl).toBe(70)
    expect(metaLipidica({ cac: 50, percentilCAC: 40 }).ldl).toBe(100)
  })

  it('PREVENT ≥10% va a <70/<100; por debajo, <100/<130', () => {
    expect(metaLipidica({ preventPct: 12 }).ldl).toBe(70)
    expect(metaLipidica({ preventPct: 4 }).ldl).toBe(100)
  })

  it('con TG 150-499 en prevención primaria se agrega meta de apoB', () => {
    expect(metaLipidica({ preventPct: 4, tg: 200 }).apoB).toBe(90)
    expect(metaLipidica({ preventPct: 12, tg: 200 }).apoB).toBe(70)
    expect(metaLipidica({ preventPct: 4 }).apoB).toBeUndefined()
  })

  it('sin datos cae en la meta de prevención primaria de riesgo bajo', () => {
    const m = metaLipidica({})
    expect([m.ldl, m.noHDL]).toEqual([100, 130])
  })
})

describe('Hipertrigliceridemia: estilo de vida por nivel (Figura 2)', () => {
  it('TG ≥1000: eliminar azúcares, grasa 10-15%, abstinencia y riesgo de pancreatitis', () => {
    const p = planTrigliceridos(1200)!
    expect(p.azucares).toMatch(/eliminar/i)
    expect(p.grasaTotal).toMatch(/10% a 15%/)
    expect(p.alcohol).toMatch(/abstinencia/i)
    expect(p.riesgoPancreatitis).toBe(true)
    expect(p.referencia).toMatch(/NECESARIA/)
  })

  it('TG 500-999: abstinencia completa de alcohol, no solo evitar', () => {
    const p = planTrigliceridos(700)!
    expect(p.alcohol).toMatch(/abstinencia completa/i)
    expect(p.grasaTotal).toMatch(/20% a 25%/)
    expect(p.riesgoPancreatitis).toBe(true)
  })

  it('TG 150-499: azúcares <6%, grasa 30-35%, evitar alcohol, sin riesgo de pancreatitis', () => {
    const p = planTrigliceridos(300)!
    expect(p.azucares).toMatch(/6%/)
    expect(p.grasaTotal).toMatch(/30% a 35%/)
    expect(p.riesgoPancreatitis).toBe(false)
  })

  it('TG normales no marcan riesgo de pancreatitis', () => {
    expect(planTrigliceridos(90)!.riesgoPancreatitis).toBe(false)
    expect(planTrigliceridos(90)!.categoria).toMatch(/normales/i)
  })

  it('todos los niveles traen la misma meta de actividad y de peso', () => {
    for (const tg of [100, 300, 700, 1200]) {
      const p = planTrigliceridos(tg)!
      expect(p.actividad).toMatch(/150 min/)
      expect(p.actividad).toMatch(/2 días/)
    }
    expect(planTrigliceridos(300)!.peso).toMatch(/5% a 10%/)
  })

  it('rechaza valores inválidos', () => {
    expect(planTrigliceridos(-5)).toBeNull()
    expect(planTrigliceridos(NaN)).toBeNull()
  })
})

describe('Lp(a)', () => {
  it('≥125 nmol/L es potenciador de riesgo (~1.4 veces)', () => {
    const r = interpretarLpa(150, 'nmol/L')!
    expect(r.nivel).toBe('elevado')
    expect(r.texto).toMatch(/1\.4 veces/)
  })
  it('≥250 nmol/L es muy elevada (al menos 2 veces)', () => {
    const r = interpretarLpa(300, 'nmol/L')!
    expect(r.nivel).toBe('muy-elevado')
    expect(r.texto).toMatch(/2 veces/)
  })
  it('los cortes en mg/dL son 50 y 100', () => {
    expect(interpretarLpa(60, 'mg/dL')!.nivel).toBe('elevado')
    expect(interpretarLpa(120, 'mg/dL')!.nivel).toBe('muy-elevado')
    expect(interpretarLpa(30, 'mg/dL')!.nivel).toBe('normal')
  })
  it('normal recuerda que basta medirla una vez', () => {
    expect(interpretarLpa(40, 'nmol/L')!.texto).toMatch(/una vez/i)
  })
})

describe('Dieta y suplementos', () => {
  it('la dieta de portafolio es la de mayor efecto (26 mg/dL)', () => {
    const p = DIETA_LDL.find(d => /portafolio/i.test(d.intervencion))!
    expect(p.efecto).toMatch(/26 mg\/dL/)
  })
  it('las intervenciones cuantificadas traen su cifra; las que no, se marcan como tales', () => {
    for (const d of DIETA_LDL) {
      if (d.cuantificado) expect(d.efecto, d.intervencion).toMatch(/\d/)
      else expect(d.efecto, d.intervencion).toMatch(/sin dar una cifra/i)
    }
    // No inventar cifras: la guía no cuantifica el cambio de grasa saturada por insaturada.
    expect(DIETA_LDL.find(d => /saturada/i.test(d.intervencion))!.cuantificado).toBe(false)
  })
  it('los suplementos están en COR 3 y se nombra el ensayo que lo sostiene', () => {
    expect(SUPLEMENTOS_SIN_BENEFICIO.recomendacion).toMatch(/COR 3/)
    expect(SUPLEMENTOS_SIN_BENEFICIO.evidencia).toMatch(/SPORT/)
    expect(SUPLEMENTOS_SIN_BENEFICIO.evaluados).toHaveLength(6)
  })
  it('advierte del aceite de pescado de venta libre', () => {
    expect(SUPLEMENTOS_SIN_BENEFICIO.advertencia).toMatch(/fibrilación auricular/i)
  })
})

describe('Seguimiento', () => {
  it('primer control a las 4-12 semanas, luego cada 6-12 meses (COR 1, nivel A)', () => {
    expect(SEGUIMIENTO_LIPIDOS.inicio).toMatch(/4 a 12 semanas/)
    expect(SEGUIMIENTO_LIPIDOS.despues).toMatch(/6 a 12 meses/)
  })
})

// ── Añadido tras cruzar la versión Circulation y el resumen oficial ──
import {
  INTENSIDAD_ESTATINAS, ADVERTENCIA_SIMVASTATINA, categorizarPrevent,
  esMuyAltoRiesgo, EVENTOS_ASCVD_MAYORES, CONDICIONES_ALTO_RIESGO,
  POTENCIADORES_RIESGO, NO_ESTATINAS_LDL, NO_ESTATINAS_TG, SAMS,
} from '@/lib/expediente/cardiometabolico/dislipidemia'

describe('Intensidad de estatinas', () => {
  it('alta intensidad es ≥50% y solo atorvastatina y rosuvastatina son preferidas', () => {
    const alta = INTENSIDAD_ESTATINAS.find(i => i.intensidad === 'alta')!
    expect(alta.reduccionLDL).toMatch(/≥50%/)
    expect(alta.preferidas.map(e => e.nombre)).toEqual(['Atorvastatina', 'Rosuvastatina'])
  })
  it('moderada es 30-49% y baja es menos de 30%', () => {
    expect(INTENSIDAD_ESTATINAS.find(i => i.intensidad === 'moderada')!.reduccionLDL).toMatch(/30% a 49%/)
    expect(INTENSIDAD_ESTATINAS.find(i => i.intensidad === 'baja')!.reduccionLDL).toMatch(/menor de 30%/)
  })
  it('la baja intensidad no tiene estatinas preferidas (la celda va vacía en la guía)', () => {
    expect(INTENSIDAD_ESTATINAS.find(i => i.intensidad === 'baja')!.preferidas).toHaveLength(0)
  })
  it('advierte de la simvastatina 80 mg', () => {
    expect(ADVERTENCIA_SIMVASTATINA).toMatch(/80 mg/)
    expect(ADVERTENCIA_SIMVASTATINA).toMatch(/rabdomiólisis/i)
  })
})

describe('Categorías PREVENT', () => {
  it('usa los cortes 3, 5 y 10', () => {
    expect(categorizarPrevent(2)!.categoria).toBe('bajo')
    expect(categorizarPrevent(3)!.categoria).toBe('limitrofe')
    expect(categorizarPrevent(5)!.categoria).toBe('intermedio')
    expect(categorizarPrevent(10)!.categoria).toBe('alto')
  })
  it('trae la equivalencia con las Pooled Cohort Equations', () => {
    expect(categorizarPrevent(12)!.equivalentePCE).toMatch(/20%/)
  })
})

describe('Muy alto riesgo', () => {
  it('dos eventos mayores bastan', () => {
    expect(esMuyAltoRiesgo(2, 0)).toBe(true)
  })
  it('un evento mayor necesita dos condiciones de alto riesgo', () => {
    expect(esMuyAltoRiesgo(1, 2)).toBe(true)
    expect(esMuyAltoRiesgo(1, 1)).toBe(false)
  })
  it('sin eventos mayores no califica aunque haya muchas condiciones', () => {
    expect(esMuyAltoRiesgo(0, 5)).toBe(false)
  })
  it('las listas tienen los elementos exactos de la guía', () => {
    expect(EVENTOS_ASCVD_MAYORES).toHaveLength(4)
    expect(CONDICIONES_ALTO_RIESGO).toHaveLength(7)
    expect(CONDICIONES_ALTO_RIESGO.join(' ')).toMatch(/100 mg\/dL/)
  })
})

describe('Potenciadores de riesgo y no estatinas', () => {
  it('los potenciadores incluyen Lp(a), hsCRP y marcadores reproductivos', () => {
    const t = POTENCIADORES_RIESGO.join(' ')
    expect(t).toMatch(/125 nmol\/L/)
    expect(t).toMatch(/2 mg\/L/)
    expect(t).toMatch(/preeclampsia/i)
  })
  it('gemfibrozilo advierte que NO se combina con estatina', () => {
    const g = NO_ESTATINAS_TG.find(f => /Gemfibrozilo/.test(f.nombre))!
    expect(g.nota).toMatch(/NO debe combinarse/)
  })
  it('el icosapento aclara que solo trae EPA y no es aceite de pescado de mostrador', () => {
    const i = NO_ESTATINAS_TG.find(f => /Icosapento/.test(f.nombre))!
    expect(i.nota).toMatch(/SOLO EPA/)
    expect(i.nota).toMatch(/venta libre/)
  })
  it('la niacina queda marcada como última línea', () => {
    expect(NO_ESTATINAS_TG.find(f => /Niacina/.test(f.nombre))!.nota).toMatch(/ÚLTIMA línea/i)
  })
  it('cada no estatina de LDL trae su porcentaje de reducción', () => {
    for (const f of NO_ESTATINAS_LDL) expect(f.efecto, f.nombre).toMatch(/\d+%/)
  })
})

describe('Síntomas musculares por estatina', () => {
  it('exige haber fallado con dos estatinas antes de etiquetarlo', () => {
    expect(SAMS.definicion).toMatch(/DOS O MÁS/)
  })
  it('la creatincinasa NO se mide de rutina', () => {
    expect(SAMS.creatincinasa).toMatch(/COR 3/)
    expect(SAMS.creatincinasa).toMatch(/NO se recomienda medirla de rutina/i)
  })
  it('el umbral para suspender es 10 veces el límite superior', () => {
    expect(SAMS.umbralSuspender).toMatch(/10 veces/)
  })
  it('el reintento contempla dosis menos que diarias', () => {
    expect(SAMS.reintento).toMatch(/MENOS QUE DIARIAS/)
  })
  it('la coenzima Q10 no se recomienda', () => {
    expect(SAMS.coenzimaQ10).toMatch(/NO se recomienda/)
  })
})

/**
 * Guía ACC/AHA 2026 validada por el Dr (imágenes de la guía).
 * Metas de LDL por PREVENT y decisión "¿a quién indicar estatina?".
 */
describe('Meta LDL por PREVENT (AHA/ACC 2026)', () => {
  it('PREVENT <3% → LDL <130, no-HDL <160 (escalón que faltaba)', () => {
    const m = metaLipidica({ preventPct: 2 })
    expect(m.ldl).toBe(130)
    expect(m.noHDL).toBe(160)
  })
  it('PREVENT 3–<10% → LDL <100', () => {
    expect(metaLipidica({ preventPct: 6 }).ldl).toBe(100)
  })
  it('PREVENT ≥10% → LDL <70', () => {
    expect(metaLipidica({ preventPct: 12 }).ldl).toBe(70)
  })
  it('ASCVD clínica → LDL <70 (o <55 si muy alto riesgo)', () => {
    expect(metaLipidica({ ascvdClinica: true }).ldl).toBe(70)
    expect(metaLipidica({ ascvdClinica: true, muyAltoRiesgo: true }).ldl).toBe(55)
  })
  it('sin PREVENT NO se relaja a 130 (se mantiene conservador)', () => {
    expect(metaLipidica({}).ldl).toBe(100)
  })
})

describe('¿A quién indicar estatina? (AHA/ACC 2026)', () => {
  it('LDL ≥190 → alta intensidad, sin importar el PREVENT', () => {
    expect(recomendarEstatina({ ldl: 200, preventPct: 1 }).indicar).toBe('alta')
  })
  it('ASCVD clínica → alta', () => {
    expect(recomendarEstatina({ ascvdClinica: true }).indicar).toBe('alta')
  })
  it('diabetes 40–75 → moderada; con múltiples FR → alta', () => {
    expect(recomendarEstatina({ diabetes: true, edad: 55 }).indicar).toBe('moderada')
    expect(recomendarEstatina({ diabetes: true, edad: 55, diabetesMultiplesFR: true }).indicar).toBe('alta')
  })
  it('ERC 3–4 → moderada (alta si ASCVD)', () => {
    expect(recomendarEstatina({ ercEstadio3o4: true }).indicar).toBe('moderada')
    expect(recomendarEstatina({ ercEstadio3o4: true, ascvdClinica: true }).indicar).toBe('alta')
  })
  it('VIH 40–75 → estatina recomendada (moderada)', () => {
    expect(recomendarEstatina({ vih: true, edad: 50 }).indicar).toBe('moderada')
  })
  it('CAC ≥100 → considerar estatina (moderada)', () => {
    expect(recomendarEstatina({ cac: 120 }).indicar).toBe('moderada')
  })
  it('PREVENT ≥10% → alta; 5–<10% → moderada', () => {
    expect(recomendarEstatina({ preventPct: 11 }).indicar).toBe('alta')
    expect(recomendarEstatina({ preventPct: 6 }).indicar).toBe('moderada')
  })
  it('PREVENT 3–<5%: considerar moderada solo con potenciadores', () => {
    expect(recomendarEstatina({ preventPct: 4, potenciadores: true }).indicar).toBe('considerar-moderada')
    expect(recomendarEstatina({ preventPct: 4 }).sugerirCAC).toBe(true)
  })
  it('PREVENT <3% → no de rutina; excepción si LDL 160-189 o riesgo 30a ≥10%', () => {
    expect(recomendarEstatina({ preventPct: 2, ldl: 140 }).indicar).toBe('no-de-rutina')
    expect(recomendarEstatina({ preventPct: 2, ldl: 170 }).indicar).toBe('considerar-moderada')
    expect(recomendarEstatina({ preventPct: 2, prevent30Pct: 12 }).indicar).toBe('considerar-moderada')
  })
  it('sin PREVENT → individualizar y sugerir CAC', () => {
    const r = recomendarEstatina({})
    expect(r.indicar).toBe('individualizar')
    expect(r.sugerirCAC).toBe(true)
  })
})
