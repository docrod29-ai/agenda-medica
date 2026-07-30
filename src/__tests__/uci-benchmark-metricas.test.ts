import { describe, it, expect } from 'vitest'
import {
  numerosADigitos, unidadesASimbolo, canonizar,
  esAcronimo, tieneNumero, tieneUnidad, terminoPresente,
  evaluarAudio, metricas, porCorte, rankingRiesgo,
  EQUIVALENCIAS, NO_SUSTITUIBLES,
} from '@/lib/uci/benchmark-metricas'

/**
 * Métricas del corpus de 498 audios del Dr. (2026-07-30).
 *
 * El problema central que estos casos protegen: el manifiesto escribe el gold de
 * dos formas a la vez — `canonical_text` dice «ciento cincuenta mililitros por
 * minuto» y `key_terms` dice «150 mL/min». Comparar literal daría 0 % en TODOS
 * los números y unidades: un informe catastrófico y falso.
 *
 * Datos: los del propio corpus, que son sintéticos por diseño.
 */

const fila = (e: Partial<Parameters<typeof evaluarAudio>[0]> = {}) => ({
  id: '001__CKRT__MARIN_CLARA', category: 'CKRT', voice: 'marin', style: 'MARIN_CLARA',
  canonical_text: 'CKRT en modo CVVHDF, flujo de sangre ciento cincuenta mililitros por minuto.',
  key_terms: 'CKRT|CVVHDF|flujo de sangre|150 mL/min',
  ...e,
})

describe('el gold está escrito de dos formas: hay que reconciliarlas', () => {
  it('«ciento cincuenta» es 150', () => {
    expect(numerosADigitos('ciento cincuenta mililitros')).toBe('150 mililitros')
  })

  it('«uno punto ocho» es 1.8', () => {
    expect(numerosADigitos('lactato de uno punto ocho')).toBe('lactato de 1.8')
  })

  it('«veinticuatro» y «treinta y siete» también', () => {
    expect(numerosADigitos('veinticuatro horas')).toBe('24 horas')
    expect(numerosADigitos('treinta y siete grados')).toBe('37 grados')
  })

  it('«mililitros por minuto» es mL/min', () => {
    expect(unidadesASimbolo('ciento cincuenta mililitros por minuto')).toContain('ml/min')
  })

  it('la forma LARGA gana sobre la corta', () => {
    // «mililitros por kilo por hora» no puede resolverse como «mililitros por kilo».
    expect(unidadesASimbolo('cero punto ocho mililitros por kilo por hora')).toContain('ml/kg/h')
  })

  it('canonizar deja el texto comparable contra key_terms', () => {
    const c = canonizar('flujo de sangre ciento cincuenta mililitros por minuto')
    expect(c).toContain('150 ml/min')
  })

  it('lo que NO es un número no se convierte en uno', () => {
    // Inventar un número donde no lo había sería peor que no convertir ninguno.
    expect(numerosADigitos('paciente estable sin cambios')).toBe('paciente estable sin cambios')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('un acierto con otra forma de escribirlo SIGUE siendo acierto', () => {
  it('el transcriptor escribe dígitos y el gold letras: acierta', () => {
    const r = terminoPresente('150 mL/min', 'flujo de sangre 150 ml/min')
    expect(r.ok).toBe(true)
    expect(r.porEquivalencia).toBe(false)
  })

  it('el transcriptor escribe letras y el gold dígitos: también', () => {
    expect(terminoPresente('150 mL/min', 'flujo de sangre ciento cincuenta mililitros por minuto').ok).toBe(true)
  })

  it('un término compuesto cuenta sólo si aparece entero', () => {
    expect(terminoPresente('flujo de sangre', 'el flujo de sangre va bien').ok).toBe(true)
    expect(terminoPresente('flujo de sangre', 'el flujo va bien').ok).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('las equivalencias salen del DOCUMENTO, no de mí', () => {
  it('CKRT ≡ «terapia de reemplazo renal continua», como dice PARA_CLAUDE.md', () => {
    const r = terminoPresente('CKRT', 'terapia de reemplazo renal continua en modo CVVHDF')
    expect(r.ok).toBe(true)
    expect(r.porEquivalencia).toBe(true)   // se marca: no fue literal
  })

  it('CVVHDF NO es sustituible — regla explícita del documento', () => {
    expect(NO_SUSTITUIBLES).toContain('cvvhdf')
    expect(terminoPresente('CVVHDF', 'terapia de reemplazo renal continua').ok).toBe(false)
  })

  it('no hay más equivalencias que la única que el documento permite', () => {
    // Si el transcriptor cambia un término por otro que a mí me parezca sinónimo,
    // cuenta como fallo. Yo no decido qué es equivalente en clínica.
    expect(Object.keys(EQUIVALENCIAS)).toEqual(['ckrt'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('qué es un ERROR CRÍTICO', () => {
  it('perder una cifra con unidad lo es', () => {
    const r = evaluarAudio(fila(), 'CKRT en modo CVVHDF, flujo de sangre.')
    expect(r.erroresCriticos).toContain('150 mL/min')
  })

  it('perder CVVHDF lo es, aunque no lleve número', () => {
    const r = evaluarAudio(fila(), 'CKRT, flujo de sangre 150 ml/min')
    expect(r.erroresCriticos).toContain('CVVHDF')
  })

  it('perder un término SIN cifra ni unidad ni regla NO es crítico', () => {
    // Cuenta en el recall clínico, pero no dispara la alarma roja.
    const r = evaluarAudio(fila(), 'CKRT en modo CVVHDF, 150 ml/min')
    expect(r.terminos.find(t => t.termino === 'flujo de sangre')?.acertado).toBe(false)
    expect(r.erroresCriticos).not.toContain('flujo de sangre')
  })

  it('una transcripción perfecta no tiene errores críticos', () => {
    const r = evaluarAudio(fila(), fila().canonical_text)
    expect(r.erroresCriticos).toEqual([])
    expect(r.wer).toBe(0)
  })

  it('clasifica bien qué término es acrónimo, cifra o unidad', () => {
    expect(esAcronimo('CVVHDF')).toBe(true)
    expect(esAcronimo('flujo de sangre')).toBe(false)
    expect(tieneNumero('150 mL/min')).toBe(true)
    expect(tieneUnidad('150 mL/min')).toBe(true)
    expect(tieneUnidad('flujo de sangre')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('un WER bonito puede esconder un desastre clínico', () => {
  const rs = [
    // Casi perfecto de palabras, pero perdió la cifra.
    evaluarAudio(fila({ id: 'a' }), 'CKRT en modo CVVHDF, flujo de sangre ciento cincuenta mililitros por segundo.'),
    evaluarAudio(fila({ id: 'b' }), fila().canonical_text),
  ]
  const m = metricas(rs)

  it('el WER sale bajo', () => {
    expect(m.wer).toBeLessThan(0.15)
  })

  it('y la tasa de error crítico lo delata', () => {
    // Ésta es toda la utilidad del informe: «mililitros por segundo» en vez de
    // «por minuto» es un WER de una palabra y una dosis equivocada.
    expect(m.criticalSemanticErrorRate).toBe(0.5)
  })

  it('las seis métricas se calculan sobre lo que corresponde', () => {
    expect(m.audios).toBe(2)
    expect(m.acronymRecall).toBe(1)          // CKRT y CVVHDF salieron bien
    expect(m.numberAccuracy).toBe(0.5)       // la cifra falló en uno
    expect(m.unitAccuracy).toBe(0.5)
    expect(m.clinicalTermRecall).toBeCloseTo(7 / 8, 5)
  })

  it('sin términos de un tipo, esa métrica es null y NO 100 %', () => {
    // El fixture tiene que ser coherente: si el término no está en su propio
    // canonical, no es evaluable y la métrica sale null por otra razón.
    const sinNada = metricas([evaluarAudio(
      fila({ key_terms: 'paciente estable', canonical_text: 'El paciente estable sin cambios.' }),
      'El paciente estable sin cambios.')])
    expect(sinNada.acronymRecall).toBeNull()
    expect(sinNada.numberAccuracy).toBeNull()
    expect(sinNada.clinicalTermRecall).toBe(1)
  })

  it('sin audios: todo en cero, sin inventar', () => {
    expect(metricas([]).audios).toBe(0)
    expect(metricas([]).clinicalTermRecall).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('el informe señala DÓNDE está el problema', () => {
  const rs = [
    evaluarAudio(fila({ id: '1', voice: 'marin', style: 'MARIN_CLARA' }), fila().canonical_text),
    evaluarAudio(fila({ id: '2', voice: 'coral', style: 'CORAL_CONVERSACIONAL' }), 'CKRT en modo, flujo de sangre.'),
  ]

  it('por voz, del peor al mejor', () => {
    const cortes = porCorte(rs, 'voice')
    expect(cortes[0].corte).toBe('coral')
  })

  it('el ranking pone PRIMERO lo crítico que más se pierde', () => {
    const r = rankingRiesgo(rs)
    expect(r[0].critico).toBe(true)
    expect(['CVVHDF', '150 mL/min']).toContain(r[0].termino)
  })

  it('lo que nunca falló no aparece en el ranking', () => {
    expect(rankingRiesgo(rs).map(x => x.termino)).not.toContain('CKRT')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('el key_term suele ser el CONCEPTO, no lo que se pronuncia', () => {
  it('«HCO3» se dice «bicarbonato», y cuenta', () => {
    // Nadie pronuncia la fórmula. Exigir la sigla literal habría contado como
    // fallo del transcriptor algo que nunca se dijo.
    expect(terminoPresente('HCO3', 'Bicarbonato de dieciocho milimoles por litro.').ok).toBe(true)
  })

  it('«PAM» se dice «presión arterial media»', () => {
    expect(terminoPresente('PAM', 'Presión arterial media de sesenta y cinco milímetros de mercurio.').ok).toBe(true)
  })

  it('«MRSA» se dice con el nombre completo del germen', () => {
    expect(terminoPresente('MRSA', 'Hemocultivos positivos para Staphylococcus aureus resistente a meticilina.').ok).toBe(true)
  })

  it('se marca que fue por equivalencia, no literal', () => {
    expect(terminoPresente('HCO3', 'Bicarbonato de dieciocho.').porEquivalencia).toBe(true)
  })

  it('los femeninos y los millares del corpus se resuelven', () => {
    expect(canonizar('tres mil doscientas revoluciones por minuto')).toContain('3200 rpm')
    expect(canonizar('cuarenta y ocho mil por microlitro')).toContain('48000/ul')
  })

  it('«cero punto treinta» es 0.30, no un número perdido', () => {
    expect(numerosADigitos('cero punto treinta milimoles')).toContain('0.30')
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('el evaluador NO culpa al transcriptor de sus propios huecos', () => {
  it('un término que no aparece ni en su PROPIO canonical no se evalúa', () => {
    // Si mi capa de equivalencia no sabe expresarlo, el fallo es mío. Contarlo
    // como error de reconocimiento sería mentir sobre el resultado.
    const r = evaluarAudio(
      fila({ key_terms: 'TERMINO_QUE_NADIE_DICE', canonical_text: 'el paciente está estable' }),
      'el paciente está estable')
    expect(r.terminos[0].evaluable).toBe(false)
    expect(metricas([r]).terminosNoEvaluables).toEqual(['TERMINO_QUE_NADIE_DICE'])
    expect(metricas([r]).clinicalTermRecall).toBeNull()
  })

  it('lo no evaluable tampoco cuenta como error crítico', () => {
    const r = evaluarAudio(
      fila({ key_terms: '999 zz/qq', canonical_text: 'el paciente está estable' }),
      'el paciente está estable')
    expect(r.erroresCriticos).toEqual([])
  })
})
