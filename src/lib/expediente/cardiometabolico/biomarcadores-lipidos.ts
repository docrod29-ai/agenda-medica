/**
 * BIOMARCADORES LIPÍDICOS MÁS ALLÁ DEL LDL-C
 *
 * apoB, Lp(a), no-HDL-C y colesterol remanente: qué significan, por qué importan
 * cuando discrepan del LDL-C, y qué hacer con el resultado.
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 *
 * El LDL-C se CALCULA (Friedewald/Martin-Hopkins) y estima el colesterol que
 * llevan las partículas, no cuántas partículas hay. La apoB se MIDE, y como cada
 * partícula aterogénica —LDL, VLDL, IDL, remanentes, Lp(a)— lleva exactamente UNA
 * molécula de apoB, su concentración ES el número de partículas.
 *
 * Eso importa porque la discordancia es frecuente: un paciente con LDL-C "en meta"
 * pero apoB alta tiene muchas partículas pequeñas y densas, y su riesgo sigue el
 * de la apoB, no el del LDL-C. El escenario típico en México —síndrome metabólico,
 * triglicéridos altos, diabetes— es precisamente donde el LDL-C engaña más.
 *
 * FUENTES
 *  · apoB: National Lipid Association, Expert Clinical Consensus 2024 sobre el
 *    papel de la apoB en el manejo del riesgo cardiovascular (umbrales de
 *    intensificación por categoría de riesgo y percentiles poblacionales NHANES
 *    2005-2016).
 *  · Lp(a): guía NLA 2024 de uso de Lp(a) en la práctica clínica y la guía
 *    ACC/AHA 2026 de dislipidemia, que recomienda medirla al menos una vez en
 *    todos los adultos.
 *
 * Todo aquí es PURO y determinista → testeable. No decide tratamiento: interpreta
 * el número, explica el porqué y propone la conducta. La decisión es del médico.
 */

/**
 * Categoría de riesgo a efectos de umbral de apoB. Se define aquí y no se importa
 * de `dislipidemia.ts` a propósito: allí el riesgo se deriva de un conjunto de
 * banderas clínicas (ASCVD, ERC, FH…), mientras que aquí solo hace falta el
 * escalón para elegir el umbral. Acoplarlos obligaría a este módulo a conocer
 * toda la lógica de estratificación, que no necesita.
 */
export type CategoriaRiesgo = 'limitrofe' | 'intermedio' | 'alto' | 'muy-alto'

export type NivelRiesgoBiomarcador = 'optimo' | 'limitrofe' | 'alto' | 'muy-alto'

export interface LecturaBiomarcador {
  nombre: string
  valor: number
  unidad: string
  nivel: NivelRiesgoBiomarcador
  /** Una línea: qué significa este número en este paciente. */
  interpretacion: string
  /** Por qué se mide y por qué ese umbral. Es lo que sustenta la conducta. */
  fundamento: string
  /** Qué hacer. Vacío si no hay conducta que derivar del valor. */
  recomendaciones: string[]
  referencia: string
}

const REF_APOB = 'National Lipid Association, Expert Clinical Consensus 2024 — apoB en el manejo del riesgo cardiovascular'
const REF_LPA = 'National Lipid Association 2024 — uso de Lp(a) en la práctica clínica; ACC/AHA 2026 de dislipidemia'
const REF_NOHDL = 'ACC/AHA 2026 — Guía de manejo de la dislipidemia'

/**
 * Umbral de apoB para intensificar tratamiento, por categoría de riesgo.
 * NLA 2024: muy alto 60, alto 70, límite-intermedio 90 mg/dL.
 */
export function metaApoB(categoria: CategoriaRiesgo): number {
  if (categoria === 'muy-alto') return 60
  if (categoria === 'alto') return 70
  return 90
}

/**
 * apoB — número de partículas aterogénicas.
 *
 * Los percentiles poblacionales (NHANES 2005-2016, adultos sin tratamiento) sitúan
 * la mediana en 90 mg/dL y el percentil 90 en 125 mg/dL. Se usan para describir
 * dónde cae el paciente, no como meta.
 */
export function interpretarApoB(
  apoB: number,
  opts?: { categoria?: CategoriaRiesgo; ldl?: number },
): LecturaBiomarcador | null {
  if (!(apoB > 0)) return null
  const meta = metaApoB(opts?.categoria ?? 'intermedio')

  const nivel: NivelRiesgoBiomarcador =
    apoB >= 125 ? 'muy-alto' : apoB >= 100 ? 'alto' : apoB > meta ? 'limitrofe' : 'optimo'

  const percentil =
    apoB >= 125 ? 'por encima del percentil 90 de la población' :
    apoB >= 113 ? 'alrededor del percentil 80' :
    apoB >= 104 ? 'alrededor del percentil 70' :
    apoB >= 90 ? 'alrededor de la mediana poblacional' :
    'por debajo de la mediana poblacional'

  const recomendaciones: string[] = []
  if (apoB > meta) {
    recomendaciones.push(`Por encima del umbral de intensificación para este riesgo (apoB <${meta} mg/dL): intensificar el tratamiento hipolipemiante aunque el LDL-C parezca aceptable.`)
    recomendaciones.push('Repetir a las 4-12 semanas del cambio de tratamiento para confirmar que bajó del umbral.')
  } else {
    recomendaciones.push(`En meta para este riesgo (apoB <${meta} mg/dL). Mantener y vigilar.`)
  }

  /**
   * DISCORDANCIA. Es el motivo principal de medir apoB, así que se señala de forma
   * explícita: un LDL-C "en meta" con apoB alta significa muchas partículas
   * pequeñas y densas, y el riesgo sigue a la apoB.
   */
  if (opts?.ldl != null && opts.ldl > 0 && opts.ldl < 100 && apoB >= 100) {
    recomendaciones.push(`DISCORDANCIA: LDL-C ${opts.ldl} mg/dL parece aceptable pero la apoB está alta. Con discordancia, la apoB predice mejor el riesgo que el LDL-C — tratar guiándose por la apoB.`)
  }

  return {
    nombre: 'Apolipoproteína B (apoB)',
    valor: apoB,
    unidad: 'mg/dL',
    nivel,
    interpretacion: `apoB ${apoB} mg/dL — ${percentil}. Umbral de intensificación para este riesgo: <${meta} mg/dL.`,
    fundamento: 'Cada partícula aterogénica (LDL, VLDL, IDL, remanentes, Lp(a)) lleva UNA molécula de apoB, así que su concentración equivale al número de partículas. El LDL-C se calcula y estima el colesterol transportado, no cuántas partículas lo transportan. La apoB se mide directamente, no depende del ayuno y sigue siendo fiable donde la estimación del LDL falla (triglicéridos altos, diabetes, síndrome metabólico).',
    recomendaciones,
    referencia: REF_APOB,
  }
}

/**
 * Lp(a) — riesgo genético, se mide UNA vez en la vida.
 *
 * Umbrales NLA: <75 nmol/L (<30 mg/dL) bajo riesgo; ≥125 nmol/L (≥50 mg/dL) alto;
 * en medio, intermedio. Se acepta la unidad en que venga el reporte.
 */
export function interpretarLpA(valor: number, unidad: 'nmol/L' | 'mg/dL'): LecturaBiomarcador | null {
  if (!(valor > 0)) return null

  const alto = unidad === 'nmol/L' ? valor >= 125 : valor >= 50
  const bajo = unidad === 'nmol/L' ? valor < 75 : valor < 30
  const nivel: NivelRiesgoBiomarcador = alto ? 'alto' : bajo ? 'optimo' : 'limitrofe'

  const recomendaciones: string[] = [
    'Basta medirla UNA vez en la vida: está determinada genéticamente y apenas cambia con dieta, ejercicio o estatinas.',
  ]
  if (alto) {
    recomendaciones.push('Lp(a) elevada: es un potenciador de riesgo. Reforzar el control del resto de los factores modificables y considerar metas de LDL-C y apoB más estrictas.')
    recomendaciones.push('Tamizar en cascada a los familiares de primer grado: es hereditaria.')
    recomendaciones.push('No se ajusta el LDL-C calculado restando el colesterol de la Lp(a): los factores de conversión han demostrado ser inexactos y llevan a INFRATRATAR.')
  } else if (!bajo) {
    recomendaciones.push('Valor intermedio: úsalo para afinar la decisión cuando el riesgo calculado quede en zona de duda.')
  }

  return {
    nombre: 'Lipoproteína(a) — Lp(a)',
    valor,
    unidad,
    nivel,
    interpretacion: alto
      ? `Lp(a) ${valor} ${unidad} — ELEVADA (alto riesgo: ≥125 nmol/L o ≥50 mg/dL).`
      : bajo
        ? `Lp(a) ${valor} ${unidad} — en rango de bajo riesgo (<75 nmol/L o <30 mg/dL).`
        : `Lp(a) ${valor} ${unidad} — riesgo intermedio (entre 75 y 125 nmol/L, o entre 30 y 50 mg/dL).`,
    fundamento: 'La Lp(a) es una partícula tipo LDL con apolipoproteína(a) unida. Su concentración es hereditaria en más del 90 % y se mantiene estable toda la vida, por eso se mide una sola vez. Aporta riesgo aterotrombótico independiente del LDL-C, y por eso la guía recomienda medirla al menos una vez en todos los adultos.',
    recomendaciones,
    referencia: REF_LPA,
  }
}

/** No-HDL-C = colesterol total − HDL. Incluye TODAS las fracciones aterogénicas. */
export function calcularNoHDL(colesterolTotal: number, hdl: number): number | null {
  if (!(colesterolTotal > 0) || !(hdl > 0) || hdl >= colesterolTotal) return null
  return Math.round(colesterolTotal - hdl)
}

/**
 * Colesterol remanente = colesterol total − HDL − LDL.
 *
 * Es el colesterol que viaja en lipoproteínas ricas en triglicéridos. Se calcula a
 * partir de valores que el laboratorio ya reporta, así que no cuesta nada pedirlo:
 * sale del mismo perfil.
 */
export function calcularRemanente(colesterolTotal: number, hdl: number, ldl: number): number | null {
  if (!(colesterolTotal > 0) || !(hdl > 0) || !(ldl > 0)) return null
  const r = Math.round(colesterolTotal - hdl - ldl)
  return r >= 0 ? r : null
}

export function interpretarNoHDL(noHDL: number, metaNoHDL?: number): LecturaBiomarcador | null {
  if (!(noHDL > 0)) return null
  const meta = metaNoHDL ?? 130
  const nivel: NivelRiesgoBiomarcador =
    noHDL >= meta + 60 ? 'muy-alto' : noHDL >= meta + 30 ? 'alto' : noHDL > meta ? 'limitrofe' : 'optimo'
  return {
    nombre: 'Colesterol no-HDL',
    valor: noHDL,
    unidad: 'mg/dL',
    nivel,
    interpretacion: `No-HDL-C ${noHDL} mg/dL (meta para este riesgo: <${meta} mg/dL).`,
    fundamento: 'Colesterol total menos HDL: recoge TODAS las fracciones aterogénicas, incluidos los remanentes que el LDL-C calculado deja fuera. No requiere ayuno y se obtiene del perfil de lípidos habitual, sin costo adicional.',
    recomendaciones: noHDL > meta
      ? [`Por encima de la meta (<${meta} mg/dL): intensificar tratamiento.`, 'Si además los triglicéridos están altos, revisar el colesterol remanente y considerar medir apoB.']
      : [`En meta (<${meta} mg/dL).`],
    referencia: REF_NOHDL,
  }
}

export function interpretarRemanente(remanente: number): LecturaBiomarcador | null {
  if (!(remanente >= 0)) return null
  const nivel: NivelRiesgoBiomarcador =
    remanente >= 45 ? 'muy-alto' : remanente >= 30 ? 'alto' : remanente >= 24 ? 'limitrofe' : 'optimo'
  return {
    nombre: 'Colesterol remanente',
    valor: remanente,
    unidad: 'mg/dL',
    nivel,
    interpretacion: `Colesterol remanente ${remanente} mg/dL (calculado: colesterol total − HDL − LDL).`,
    fundamento: 'Es el colesterol que transportan las lipoproteínas ricas en triglicéridos (VLDL e IDL y sus remanentes). Se calcula del perfil habitual, sin estudio adicional. Sube en resistencia a la insulina, diabetes y síndrome metabólico — el perfil más frecuente en la consulta mexicana— y ahí es donde el LDL-C calculado subestima el riesgo.',
    recomendaciones: remanente >= 30
      ? [
          'Remanente elevado: apunta a resistencia a la insulina o síndrome metabólico como motor del perfil.',
          'La conducta principal es metabólica: peso, actividad física y control glucémico, además del hipolipemiante.',
          'Considerar medir apoB: en este perfil el LDL-C calculado suele quedarse corto.',
        ]
      : ['En rango aceptable.'],
    referencia: REF_NOHDL,
  }
}

export interface PanelLipidicoAvanzado {
  lecturas: LecturaBiomarcador[]
  /** Discordancias detectadas entre marcadores. Vacío si todo concuerda. */
  discordancias: string[]
  /** Estudios que conviene pedir y no están. */
  faltantes: string[]
}

/**
 * Evalúa el panel completo: interpreta lo que hay, detecta discordancias y dice
 * qué falta por pedir.
 */
export function evaluarPanelLipidico(labs: {
  colesterolTotal?: number
  hdl?: number
  ldl?: number
  trigliceridos?: number
  apoB?: number
  lpa?: number
  lpaUnidad?: 'nmol/L' | 'mg/dL'
}, opts?: { categoria?: CategoriaRiesgo; metaNoHDL?: number }): PanelLipidicoAvanzado {
  const lecturas: LecturaBiomarcador[] = []
  const discordancias: string[] = []
  const faltantes: string[] = []

  const noHDL = labs.colesterolTotal != null && labs.hdl != null
    ? calcularNoHDL(labs.colesterolTotal, labs.hdl) : null
  if (noHDL != null) {
    const l = interpretarNoHDL(noHDL, opts?.metaNoHDL)
    if (l) lecturas.push(l)
  }

  const remanente = labs.colesterolTotal != null && labs.hdl != null && labs.ldl != null
    ? calcularRemanente(labs.colesterolTotal, labs.hdl, labs.ldl) : null
  if (remanente != null) {
    const l = interpretarRemanente(remanente)
    if (l) lecturas.push(l)
  }

  if (labs.apoB != null) {
    const l = interpretarApoB(labs.apoB, { categoria: opts?.categoria, ldl: labs.ldl })
    if (l) lecturas.push(l)
  } else {
    // Se pide apoB donde el LDL-C calculado es menos fiable.
    const tgAltos = (labs.trigliceridos ?? 0) >= 150
    if (tgAltos || (remanente != null && remanente >= 30)) {
      faltantes.push('apoB — con triglicéridos altos o remanente elevado, el LDL-C calculado subestima el número de partículas. Es el estudio que más cambia la conducta en este perfil.')
    } else {
      faltantes.push('apoB — útil en la evaluación inicial para detectar discordancia con el LDL-C.')
    }
  }

  if (labs.lpa != null) {
    const l = interpretarLpA(labs.lpa, labs.lpaUnidad ?? 'nmol/L')
    if (l) lecturas.push(l)
  } else {
    faltantes.push('Lp(a) — se mide UNA vez en la vida y la guía la recomienda en todos los adultos. Si nunca se ha medido, este es el momento.')
  }

  // Discordancias: el hallazgo que justifica pedir estos marcadores.
  if (labs.ldl != null && labs.ldl < 100 && labs.apoB != null && labs.apoB >= 100) {
    discordancias.push(`LDL-C ${labs.ldl} mg/dL aparentemente aceptable con apoB ${labs.apoB} mg/dL elevada: hay más partículas aterogénicas de las que sugiere el LDL-C. El riesgo sigue a la apoB.`)
  }
  if (labs.ldl != null && labs.ldl < 100 && noHDL != null && noHDL >= 130) {
    discordancias.push(`LDL-C ${labs.ldl} mg/dL con no-HDL-C ${noHDL} mg/dL elevado: hay colesterol aterogénico fuera del LDL (remanentes). Tratar guiándose por el no-HDL.`)
  }
  if (labs.ldl != null && labs.ldl < 70 && labs.lpa != null) {
    const alto = (labs.lpaUnidad ?? 'nmol/L') === 'nmol/L' ? labs.lpa >= 125 : labs.lpa >= 50
    if (alto) discordancias.push('LDL-C en meta estricta pero Lp(a) elevada: el riesgo residual es genético y no baja con estatina. Reforzar el resto de los factores.')
  }

  return { lecturas, discordancias, faltantes }
}
