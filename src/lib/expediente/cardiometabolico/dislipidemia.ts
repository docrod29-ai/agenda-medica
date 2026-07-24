/**
 * DISLIPIDEMIA — Guía ACC/AHA 2026.
 *
 * Fuente: 2026 ACC/AHA/AACVPR/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on
 * the Management of Dyslipidemia. Blumenthal RS, Morris PB, Gaudino M, et al.
 * J Am Coll Cardiol. 2026;87(19):2624-2757. doi:10.1016/j.jacc.2025.11.016
 *
 * Esta guía RETIRA Y REEMPLAZA la de colesterol de 2018. Cambios de fondo:
 *  · Las ecuaciones PREVENT sustituyen a las Pooled Cohort Equations (30-79 años).
 *  · Regresan las METAS numéricas de LDL-C y no-HDL-C (2018 se centraba en el
 *    porcentaje de reducción; ahora se usan las dos cosas).
 *  · Lp(a) se mide al menos una vez en TODOS los adultos (COR 1).
 *  · Los suplementos NO se recomiendan para bajar lípidos (COR 3: sin beneficio).
 *
 * Todo lo que hay aquí está tomado del documento. Nada inventado.
 */

export const FUENTE_DISLIPIDEMIA =
  'Guía ACC/AHA 2026 de manejo de dislipidemia (J Am Coll Cardiol. 2026;87(19):2624-2757)'

// ═══════════════════════════════════════════════════════════════════════════
// 1. METAS DE LIPOPROTEÍNAS (Figura 1 de la guía, pág. 2643)
// ═══════════════════════════════════════════════════════════════════════════

export interface EntradaMetas {
  /** Enfermedad cardiovascular aterosclerótica establecida. */
  ascvdClinica?: boolean
  /** Muy alto riesgo: evento mayor reciente/múltiple + condiciones de alto riesgo. */
  muyAltoRiesgo?: boolean
  /** Enfermedad renal crónica. */
  erc?: boolean
  /** LDL-C ≥190 mg/dL. */
  hipercolesterolemiaSevera?: boolean
  /** Hipercolesterolemia familiar (clínica o genética). */
  fh?: boolean
  /** Otros factores de riesgo de ASCVD presentes. */
  factoresRiesgo?: boolean
  /** Aterosclerosis subclínica documentada. */
  aterosclerosisSubclinica?: boolean
  diabetes?: boolean
  /** Modificadores de riesgo específicos de diabetes. */
  modificadoresDiabetes?: boolean
  /** Calcio arterial coronario en unidades Agatston. */
  cac?: number
  /** Percentil del CAC para edad, sexo y raza. */
  percentilCAC?: number
  /** Riesgo a 10 años por las ecuaciones PREVENT-ASCVD, en porcentaje. */
  preventPct?: number
  /** Triglicéridos en ayuno (mg/dL). */
  tg?: number
  edad?: number
}

export interface MetaLipidica {
  ldl: number
  noHDL: number
  /** Meta de apoB cuando la guía la especifica para ese escenario. */
  apoB?: number
  /** Qué renglón de la tabla aplicó. */
  poblacion: string
  /** Meta opcional más estricta que la guía menciona para ese escenario. */
  opcional?: string
  nota?: string
}

/**
 * Devuelve la meta según la Figura 1 de la guía. Las reglas están ordenadas de
 * la condición MÁS severa a la menos severa: gana la primera que aplique, que es
 * como se lee la tabla (un paciente con ASCVD de muy alto riesgo no se trata con
 * la meta de prevención primaria aunque también tenga diabetes).
 */
export function metaLipidica(e: EntradaMetas): MetaLipidica {
  const tgEnRango = e.tg != null && e.tg >= 150 && e.tg <= 499

  // ── Columna <55/<85 ──
  if (e.ascvdClinica && (e.muyAltoRiesgo || e.erc)) return {
    ldl: 55, noHDL: 85, apoB: 55,
    poblacion: e.erc && !e.muyAltoRiesgo
      ? 'ASCVD clínica con enfermedad renal crónica'
      : 'ASCVD clínica de muy alto riesgo',
  }
  if (e.hipercolesterolemiaSevera && e.ascvdClinica) return {
    ldl: 55, noHDL: 85,
    poblacion: 'Hipercolesterolemia severa o HF heterocigota con ASCVD clínica',
  }
  if (e.cac != null && e.cac >= 1000) return {
    ldl: 55, noHDL: 85,
    poblacion: 'Aterosclerosis subclínica con CAC ≥1000 UA',
  }
  if (e.tg != null && e.tg >= 150 && e.ascvdClinica && e.muyAltoRiesgo) return {
    ldl: 55, noHDL: 85, apoB: 55,
    poblacion: 'Hipertrigliceridemia con ASCVD clínica de muy alto riesgo',
  }

  // ── Columna <70/<100 ──
  if (e.ascvdClinica) return {
    ldl: 70, noHDL: 100,
    poblacion: 'ASCVD clínica que no es de muy alto riesgo',
    opcional: 'Meta opcional LDL-C <55 mg/dL y no-HDL-C <85 mg/dL; considerar apoB <55 mg/dL.',
  }
  if (e.hipercolesterolemiaSevera && (e.fh || e.factoresRiesgo || e.aterosclerosisSubclinica)) return {
    ldl: 70, noHDL: 100,
    poblacion: 'Hipercolesterolemia severa CON hipercolesterolemia familiar, factores de riesgo o aterosclerosis subclínica',
  }
  if (e.cac != null && e.cac >= 300 && e.cac <= 999) return {
    ldl: 70, noHDL: 100,
    poblacion: 'Aterosclerosis subclínica con CAC 300-999 UA',
    opcional: 'Meta opcional LDL-C <55 mg/dL y no-HDL-C <85 mg/dL; considerar apoB <55 mg/dL.',
  }
  if (e.cac != null && e.cac >= 100 && e.cac <= 299) return {
    ldl: 70, noHDL: 100,
    poblacion: 'Aterosclerosis subclínica con CAC 100-299 UA',
  }
  if (e.cac != null && e.cac >= 1 && e.percentilCAC != null && e.percentilCAC >= 75) return {
    ldl: 70, noHDL: 100,
    poblacion: 'Aterosclerosis subclínica con CAC en percentil 75 o mayor para edad, sexo y raza',
  }
  if (e.diabetes && (e.factoresRiesgo || e.modificadoresDiabetes)) return {
    ldl: 70, noHDL: 100, apoB: 70,
    poblacion: 'Diabetes CON factores de riesgo de ASCVD o modificadores específicos de diabetes',
  }
  if (e.preventPct != null && e.preventPct >= 10) return {
    ldl: 70, noHDL: 100, apoB: tgEnRango ? 70 : undefined,
    poblacion: 'Prevención primaria con riesgo PREVENT-ASCVD ≥10%',
  }
  if (e.tg != null && e.tg >= 150 && e.edad != null && e.edad >= 40 && e.edad <= 75 && e.factoresRiesgo) return {
    ldl: 70, noHDL: 100, apoB: 70,
    poblacion: 'Hipertrigliceridemia, 40 a 75 años con al menos un factor de riesgo de ASCVD',
  }

  // ── Columna <100/<130 ──
  if (e.hipercolesterolemiaSevera) return {
    ldl: 100, noHDL: 130,
    poblacion: 'Hipercolesterolemia severa SIN hipercolesterolemia familiar, sin factores de riesgo y sin aterosclerosis subclínica',
  }
  if (e.cac != null && e.cac >= 1 && e.cac <= 99) return {
    ldl: 100, noHDL: 130,
    poblacion: 'Aterosclerosis subclínica con CAC 1-99 UA y percentil menor de 75',
  }
  if (e.diabetes) return {
    ldl: 100, noHDL: 130, apoB: 90,
    poblacion: 'Diabetes SIN factores de riesgo de ASCVD ni modificadores específicos de diabetes',
  }
  if (e.tg != null && e.tg >= 150 && e.edad != null && e.edad < 50) return {
    ldl: 100, noHDL: 130,
    poblacion: 'Hipertrigliceridemia en menor de 50 años sin potenciadores de riesgo adicionales',
  }

  /**
   * BAJO RIESGO — escalón que faltaba (validado por el Dr contra la guía ACC/AHA
   * 2026): con PREVENT-ASCVD a 10 años <3% la meta es LDL-C <130 y no-HDL-C <160.
   * SOLO se relaja a <130 cuando el PREVENT bajo está REALMENTE calculado; sin ese
   * dato se mantiene la meta más estricta (<100), porque no se debe aflojar la meta
   * sin haber demostrado el bajo riesgo.
   */
  if (e.preventPct != null && e.preventPct < 3) return {
    ldl: 130, noHDL: 160,
    poblacion: 'Prevención primaria con riesgo PREVENT-ASCVD a 10 años menor de 3%',
  }

  return {
    ldl: 100, noHDL: 130, apoB: tgEnRango ? 90 : undefined,
    poblacion: e.preventPct != null
      ? 'Prevención primaria con riesgo PREVENT-ASCVD a 10 años de 3% a menos de 10%'
      : 'Prevención primaria (PREVENT-ASCVD no calculado): meta conservadora',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. HIPERTRIGLICERIDEMIA: estilo de vida por nivel (Figura 2, pág. 2646)
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanTG {
  categoria: string
  /** Azúcares añadidos como porcentaje de las calorías. */
  azucares: string
  /** Grasa total como porcentaje de las calorías. */
  grasaTotal: string
  alcohol: string
  actividad: string
  peso: string
  /** Referencia a nutrición: la guía la gradúa por nivel de TG. */
  referencia: string
  riesgoPancreatitis: boolean
}

/** Intervenciones de conducta según los triglicéridos en ayuno (mg/dL). */
export function planTrigliceridos(tg: number): PlanTG | null {
  if (!(tg >= 0)) return null
  const actividad = 'Al menos 150 min/semana de actividad aeróbica de intensidad moderada o 75 min/semana de intensidad vigorosa (o una combinación equivalente), más 2 días/semana de ejercicio de resistencia de tren superior e inferior.'
  const peso = 'Meta de pérdida de peso de 5% a 10% en quien tiene sobrepeso u obesidad con triglicéridos elevados.'

  if (tg >= 1000) return {
    categoria: 'Triglicéridos ≥1000 mg/dL',
    azucares: 'Eliminar los azúcares añadidos',
    grasaTotal: '10% a 15% de las calorías totales',
    alcohol: 'Abstinencia completa',
    actividad, peso,
    referencia: 'Referencia a nutriólogo NECESARIA (COR 1): plan individualizado para reducir triglicéridos y el riesgo de pancreatitis. Puede requerir suplementar vitaminas liposolubles, minerales y triglicéridos de cadena media.',
    riesgoPancreatitis: true,
  }
  if (tg >= 500) return {
    categoria: 'Triglicéridos 500 a 999 mg/dL',
    azucares: 'Menos del 5% de las calorías',
    grasaTotal: '20% a 25% de las calorías (algunos pacientes a 10%-15%, por ejemplo con antecedente de pancreatitis)',
    alcohol: 'Abstinencia completa',
    actividad, peso,
    referencia: 'Referencia a nutriólogo y a especialista en lípidos aconsejable.',
    riesgoPancreatitis: true,
  }
  if (tg >= 150) return {
    categoria: 'Triglicéridos 150 a 499 mg/dL',
    azucares: 'Menos del 6% de las calorías',
    grasaTotal: '30% a 35% de las calorías',
    alcohol: 'Evitar',
    actividad, peso,
    referencia: 'Con características del síndrome cardiovascular-renal-metabólico, la referencia a nutriólogo es razonable (COR 2a).',
    riesgoPancreatitis: false,
  }
  return {
    categoria: 'Triglicéridos normales (menos de 150 mg/dL)',
    azucares: 'Menos del 6% de las calorías como meta general de salud cardiovascular',
    grasaTotal: 'Patrón alimentario cardiosaludable',
    alcohol: 'Moderación',
    actividad, peso: 'Mantener un peso saludable.',
    referencia: 'Sin indicación específica de referencia por triglicéridos.',
    riesgoPancreatitis: false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. INTERVENCIONES DIETÉTICAS CON SU EFECTO MEDIDO (págs. 2644-2647)
// ═══════════════════════════════════════════════════════════════════════════

export interface IntervencionDieta {
  intervencion: string
  efecto: string
  detalle: string
  /**
   * true = la guía da una magnitud numérica del efecto.
   * false = la guía describe el efecto pero NO lo cuantifica; no se le inventa cifra.
   */
  cuantificado: boolean
}

/**
 * Cada intervención con la magnitud del efecto que reporta la guía. Sirve para
 * decirle al paciente cuánto baja realmente cada cambio, en vez de "coma sano".
 */
export const DIETA_LDL: IntervencionDieta[] = [
  {
    intervencion: 'Dieta de portafolio',
    efecto: 'Baja el LDL-C 26 mg/dL en promedio',
    cuantificado: true,
    detalle: 'Combina esteroles vegetales, proteína de soya, fibra viscosa y margarina enriquecida con esteroles. Es la intervención dietética con mayor efecto en la guía.',
  },
  {
    intervencion: 'Dieta vegetariana o vegana',
    efecto: 'Baja el LDL-C 11.6 mg/dL en promedio',
    cuantificado: true,
    detalle: 'La reducción de LDL-C es más consistente cuando se limita la grasa saturada y se aumenta la insaturada que cuando solo se restringe el colesterol de la dieta.',
  },
  {
    intervencion: 'Sustituir proteína animal por proteína vegetal',
    efecto: 'Baja el LDL-C 7.7 mg/dL',
    cuantificado: true,
    detalle: 'Comparado con carne, en meta-análisis de ensayos aleatorizados.',
  },
  {
    intervencion: 'Una porción de nueces al día',
    efecto: 'Baja el LDL-C 4.8 mg/dL',
    cuantificado: true,
    detalle: 'Nueces, almendras y semillas aportan además grasa mono y poliinsaturada.',
  },
  {
    intervencion: 'Tres porciones de avena al día (28 g cada una)',
    efecto: 'Baja el LDL-C menos de 5 mg/dL',
    cuantificado: true,
    detalle: 'El efecto de la fibra sobre el LDL-C es pequeño pero real.',
  },
  {
    intervencion: 'Reemplazar grasa saturada por insaturada',
    efecto: 'Reducción sostenida del LDL-C (la guía describe una asociación graduada, sin dar una cifra única)',
    cuantificado: false,
    detalle: 'Saturada: carne roja, mantequilla, leche entera, aceite de coco, palma y almendra de palma. Poliinsaturada: pescado, nueces, linaza, chía, aceites de maíz, girasol y soya. Monoinsaturada: aceite de oliva, aguacate, nueces.',
  },
  {
    intervencion: 'Actividad física regular',
    efecto: 'Sube el HDL-C 2.11 mg/dL, baja el LDL-C 7.22 mg/dL y los triglicéridos 8.01 mg/dL',
    cuantificado: true,
    detalle: 'Al menos 150 min/semana de intensidad moderada, o 75 a 150 min de intensidad vigorosa, más ejercicio de resistencia 2 días por semana (COR 1).',
  },
  {
    intervencion: 'Pérdida de peso',
    efecto: 'Por cada kilogramo perdido: triglicéridos 4.0 mg/dL menos y LDL-C 0.3 a 1.7 mg/dL menos',
    cuantificado: true,
    detalle: 'Se recomienda una pérdida de al menos 5% del peso en toda persona con dislipidemia y sobrepeso u obesidad (COR 1).',
  },
]

/**
 * Suplementos: la guía los coloca en COR 3 (sin beneficio). En el ensayo SPORT,
 * la rosuvastatina 5 mg bajó el LDL-C 37.9% y NINGUNO de los seis suplementos
 * estudiados fue mejor que el placebo.
 */
export const SUPLEMENTOS_SIN_BENEFICIO = {
  recomendacion: 'COR 3 (sin beneficio): en personas con dislipidemia NO se recomienda usar suplementos para bajar el LDL-C ni los triglicéridos.',
  evaluados: ['Aceite de pescado', 'Canela', 'Ajo', 'Cúrcuma', 'Esteroles vegetales', 'Levadura roja de arroz'],
  evidencia: 'En el ensayo SPORT, la rosuvastatina 5 mg redujo el LDL-C 37.9% (IC 95%: -42.1 a -33.6) mientras que ninguno de los seis suplementos mostró una reducción significativa frente a placebo.',
  advertencia: 'El aceite de pescado de venta libre no ha demostrado beneficio clínico en hipertrigliceridemia ni en ASCVD, y se ha asociado a aumento del LDL-C y mayor riesgo de fibrilación auricular.',
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SEGUIMIENTO (pág. 2642-2643)
// ═══════════════════════════════════════════════════════════════════════════

export const SEGUIMIENTO_LIPIDOS = {
  inicio: 'Repetir el perfil de lípidos 4 a 12 semanas después de iniciar o intensificar el tratamiento.',
  despues: 'Después, cada 6 a 12 meses (COR 1, nivel A). La frecuencia se individualiza según el riesgo de ASCVD, la reducción de LDL-C que falta, el medicamento, el tiempo al estado estacionario, la adherencia y la estabilidad de los niveles.',
  estable: 'Si no requiere cambios de tratamiento, la respuesta es estable y no hubo modificaciones, un perfil de lípidos cada 12 meses es apropiado.',
  porQue: 'Medir el perfil se asocia a mejor adherencia y reduce la inercia terapéutica, que es no iniciar ni intensificar cuando está indicado.',
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. MEDICIÓN: cálculo del LDL, Lp(a) y apoB
// ═══════════════════════════════════════════════════════════════════════════

export const MEDICION_LIPIDOS = {
  calculoLDL: 'COR 1: en adultos y niños con perfil de lípidos estándar se prefiere la ecuación de Martin/Hopkins o la de Sampson/NIH sobre la de Friedewald, porque son más exactas (sobre todo con LDL-C bajo o triglicéridos altos).',
  lpa: 'COR 1: medir la concentración de Lp(a) al menos UNA VEZ en todos los adultos para evaluar el riesgo de ASCVD. Es un potenciador de riesgo desde 125 nmol/L (50 mg/dL), nivel asociado a un riesgo de ASCVD alrededor de 1.4 veces mayor; desde 250 nmol/L (100 mg/dL) el riesgo estimado es al menos 2 veces mayor. Si está elevada, se justifica bajar el LDL-C de forma más intensa y controlar mejor los demás factores de riesgo.',
  apoB: 'COR 2a: medir apoB es razonable en quien recibe tratamiento hipolipemiante, sobre todo con ASCVD, síndrome cardiovascular-renal-metabólico, diabetes tipo 2 o triglicéridos elevados, para decidir si hace falta intensificar una vez alcanzadas las metas de LDL-C y no-HDL-C. Ayuda a detectar riesgo residual que el perfil estándar subestima.',
}

/** Lp(a): interpretación por nivel. Acepta nmol/L o mg/dL. */
export function interpretarLpa(valor: number, unidad: 'nmol/L' | 'mg/dL'): {
  nivel: 'normal' | 'elevado' | 'muy-elevado'
  texto: string
} | null {
  if (!(valor >= 0)) return null
  const corte1 = unidad === 'nmol/L' ? 125 : 50
  const corte2 = unidad === 'nmol/L' ? 250 : 100
  if (valor >= corte2) return {
    nivel: 'muy-elevado',
    texto: `Lp(a) ${valor} ${unidad}: muy elevada (≥${corte2} ${unidad}). Se asocia a un riesgo de ASCVD estimado al menos 2 veces mayor. Indica bajar el LDL-C de forma más intensa y optimizar de forma temprana todos los factores de riesgo modificables.`,
  }
  if (valor >= corte1) return {
    nivel: 'elevado',
    texto: `Lp(a) ${valor} ${unidad}: elevada (≥${corte1} ${unidad}). Potenciador de riesgo, asociado a un riesgo de ASCVD alrededor de 1.4 veces mayor. Indica control temprano y óptimo de los factores de riesgo modificables.`,
  }
  return {
    nivel: 'normal',
    texto: `Lp(a) ${valor} ${unidad}: por debajo del umbral de potenciador de riesgo (${corte1} ${unidad}). Al ser determinada genéticamente, basta medirla una vez en la vida salvo que cambie el contexto clínico.`,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. INTENSIDAD DE ESTATINAS (Tabla 6 de la guía)
// ═══════════════════════════════════════════════════════════════════════════

export interface Estatina { nombre: string; dosis: string; evaluadaEnECA: boolean }

export interface NivelIntensidad {
  intensidad: 'alta' | 'moderada' | 'baja'
  reduccionLDL: string
  preferidas: Estatina[]
  otras: Estatina[]
}

/**
 * Las que van marcadas como evaluadas en ensayo son las estatinas y dosis
 * probadas en ensayos controlados con placebo que demostraron reducción de
 * eventos, y en el metaanálisis del Cholesterol Treatment Trialists.
 */
export const INTENSIDAD_ESTATINAS: NivelIntensidad[] = [
  {
    intensidad: 'alta', reduccionLDL: 'Reducción esperada de LDL-C ≥50%',
    preferidas: [
      { nombre: 'Atorvastatina', dosis: '80 mg (también 40 mg)', evaluadaEnECA: true },
      { nombre: 'Rosuvastatina', dosis: '20 mg (también 40 mg)', evaluadaEnECA: true },
    ],
    otras: [],
  },
  {
    intensidad: 'moderada', reduccionLDL: 'Reducción esperada de LDL-C 30% a 49%',
    preferidas: [
      { nombre: 'Atorvastatina', dosis: '10 mg (también 20 mg)', evaluadaEnECA: false },
      { nombre: 'Rosuvastatina', dosis: '10 mg (también 5 mg)', evaluadaEnECA: false },
    ],
    otras: [
      { nombre: 'Simvastatina', dosis: '20 a 40 mg', evaluadaEnECA: true },
      { nombre: 'Pravastatina', dosis: '40 mg (también 80 mg)', evaluadaEnECA: true },
      { nombre: 'Lovastatina', dosis: '40 mg (también 80 mg)', evaluadaEnECA: true },
      { nombre: 'Pitavastatina', dosis: '1, 2 o 4 mg', evaluadaEnECA: true },
      { nombre: 'Fluvastatina', dosis: '40 mg dos veces al día', evaluadaEnECA: true },
      { nombre: 'Fluvastatina XL', dosis: '80 mg', evaluadaEnECA: false },
    ],
  },
  {
    intensidad: 'baja', reduccionLDL: 'Reducción esperada de LDL-C menor de 30%',
    preferidas: [],
    otras: [
      { nombre: 'Simvastatina', dosis: '10 mg', evaluadaEnECA: false },
      { nombre: 'Pravastatina', dosis: '10 a 20 mg', evaluadaEnECA: false },
      { nombre: 'Lovastatina', dosis: '20 mg', evaluadaEnECA: true },
      { nombre: 'Fluvastatina', dosis: '20 a 40 mg', evaluadaEnECA: false },
    ],
  },
]

export const ADVERTENCIA_SIMVASTATINA =
  'La FDA NO recomienda iniciar simvastatina 80 mg ni titular hasta 80 mg, por el aumento del riesgo de miopatía incluida rabdomiólisis.'

// ═══════════════════════════════════════════════════════════════════════════
// 6b. ¿A QUIÉN INDICAR ESTATINA? — decisión por escenario (guía ACC/AHA 2026)
//     Validado por el Dr. contra la guía. Los escenarios "otros" ganan sobre el
//     PREVENT: LDL≥190, ASCVD y diabetes NO dependen del score.
// ═══════════════════════════════════════════════════════════════════════════

export interface EntradaEstatina {
  edad?: number
  ldl?: number
  preventPct?: number
  /** Riesgo PREVENT a 30 años (%). */
  prevent30Pct?: number
  ascvdClinica?: boolean
  diabetes?: boolean
  /** Diabético con múltiples factores de riesgo → alta intensidad. */
  diabetesMultiplesFR?: boolean
  ercEstadio3o4?: boolean
  vih?: boolean
  cac?: number
  /** Potenciadores de riesgo presentes (para el rango 3–<5%). */
  potenciadores?: boolean
}

export interface RecomendacionEstatina {
  indicar: 'alta' | 'moderada' | 'considerar-moderada' | 'no-de-rutina' | 'individualizar'
  motivo: string
  /** Para prevención primaria dudosa: apoyar la decisión con CAC. */
  sugerirCAC?: boolean
}

/**
 * Decide la intensidad de estatina por escenario (imagen "¿A quién indicar una
 * estatina?" de la guía 2026). Orden: primero los escenarios que NO dependen del
 * PREVENT (más deterministas y de mayor peso), luego el score.
 */
export function recomendarEstatina(e: EntradaEstatina): RecomendacionEstatina {
  // ── Escenarios independientes del PREVENT ──
  if (e.ldl != null && e.ldl >= 190) return {
    indicar: 'alta', motivo: 'LDL-C ≥190 mg/dL: estatina de alta intensidad, independiente del PREVENT.',
  }
  if (e.ascvdClinica) return {
    indicar: 'alta', motivo: 'ASCVD clínica establecida: estatina de alta intensidad.',
  }
  const enRango4075 = e.edad != null && e.edad >= 40 && e.edad <= 75
  if (e.diabetes && enRango4075) return e.diabetesMultiplesFR
    ? { indicar: 'alta', motivo: 'Diabetes (40–75 años) con múltiples factores de riesgo: estatina de alta intensidad.' }
    : { indicar: 'moderada', motivo: 'Diabetes (40–75 años): estatina de intensidad moderada.' }
  if (e.ercEstadio3o4) return e.ascvdClinica
    ? { indicar: 'alta', motivo: 'ERC estadio 3–4 con ASCVD: terapia hipolipemiante de alta intensidad.' }
    : { indicar: 'moderada', motivo: 'ERC estadio 3–4: terapia hipolipemiante para prevención primaria (alta intensidad si hay ASCVD).' }
  if (e.vih && enRango4075) return {
    indicar: 'moderada', motivo: 'Persona con VIH (40–75 años): estatina recomendada.',
  }
  if (e.cac != null && e.cac >= 100) return {
    indicar: 'moderada', motivo: 'CAC ≥100 UA: considerar estatina como primera línea.',
  }

  // ── Según PREVENT a 10 años ──
  const p = e.preventPct
  if (p == null) return {
    indicar: 'individualizar',
    motivo: 'Calcula el PREVENT (10 y 30 años) para decidir la indicación; complementa con potenciadores y, si hay incertidumbre, con calcio coronario.',
    sugerirCAC: true,
  }
  if (p >= 10) return { indicar: 'alta', motivo: `PREVENT ${p}% (≥10%): estatina de alta intensidad.` }
  if (p >= 5) return {
    indicar: 'moderada',
    motivo: `PREVENT ${p}% (5–<10%): estatina de intensidad moderada${p >= 7.5 ? ' (subir a alta si el riesgo es cercano al 10%)' : ''}.`,
  }
  if (p >= 3) return {
    indicar: e.potenciadores ? 'considerar-moderada' : 'individualizar',
    motivo: `PREVENT ${p}% (3–<5%): considerar estatina moderada SI existen potenciadores de riesgo.`,
    sugerirCAC: !e.potenciadores,
  }
  // p < 3
  const excepcion = (e.ldl != null && e.ldl >= 160 && e.ldl <= 189) || (e.prevent30Pct != null && e.prevent30Pct >= 10)
  return excepcion
    ? { indicar: 'considerar-moderada', motivo: `PREVENT ${p}% (<3%) pero con excepción (LDL 160–189 mg/dL o riesgo a 30 años ≥10%): es razonable una estatina moderada para limitar la exposición acumulada.` }
    : { indicar: 'no-de-rutina', motivo: `PREVENT ${p}% (<3%): estatina no de rutina; consejería de hábitos. Reevaluar el riesgo a 30 años.` }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. PREVENT: categorías de riesgo
// ═══════════════════════════════════════════════════════════════════════════

export interface CategoriaPrevent {
  categoria: 'bajo' | 'limitrofe' | 'intermedio' | 'alto'
  etiqueta: string
  equivalentePCE: string
}

/** Categoriza el riesgo a 10 años por PREVENT-ASCVD (30 a 79 años). */
export function categorizarPrevent(pct: number): CategoriaPrevent | null {
  if (!(pct >= 0)) return null
  if (pct >= 10) return { categoria: 'alto', etiqueta: 'Riesgo alto (≥10%)', equivalentePCE: 'Equivale a ≥20% por las Pooled Cohort Equations' }
  if (pct >= 5) return { categoria: 'intermedio', etiqueta: 'Riesgo intermedio (5% a <10%)', equivalentePCE: 'Equivale a 7.5% a <20% por las Pooled Cohort Equations' }
  if (pct >= 3) return { categoria: 'limitrofe', etiqueta: 'Riesgo limítrofe (3% a <5%)', equivalentePCE: 'Equivale a 5% a <7.5% por las Pooled Cohort Equations' }
  return { categoria: 'bajo', etiqueta: 'Riesgo bajo (<3%)', equivalentePCE: 'Equivale a <5% por las Pooled Cohort Equations' }
}

export const NOTA_PREVENT =
  'Las ecuaciones PREVENT reemplazan a las Pooled Cohort Equations. Se derivaron de cerca de 3.3 millones de adultos contemporáneos (las PCE, de unos 25 000 de cohortes más antiguas), aplican desde los 30 años, NO usan raza como variable, incorporan función renal e IMC, y predicen a 10 y a 30 años. Sus estimaciones a 10 años tienden a ser 40% a 50% MÁS BAJAS que las de las PCE para el mismo perfil, y por eso los umbrales de tratamiento también son más bajos.'

// ═══════════════════════════════════════════════════════════════════════════
// 8. MUY ALTO RIESGO (Figura 10 de la guía)
// ═══════════════════════════════════════════════════════════════════════════

export const EVENTOS_ASCVD_MAYORES = [
  'Síndrome coronario agudo en los últimos 12 meses',
  'Antecedente de infarto de miocardio (distinto del síndrome coronario agudo anterior)',
  'Antecedente de evento vascular cerebral isquémico',
  'Enfermedad arterial periférica sintomática',
]

export const CONDICIONES_ALTO_RIESGO = [
  'Edad 65 años o más',
  'Bypass coronario o intervención coronaria percutánea',
  'Fumador actual',
  'Diabetes',
  'Antecedente de insuficiencia cardiaca congestiva',
  'Hipertensión arterial',
  'LDL-C ≥100 mg/dL a pesar de estatina máxima tolerada más ezetimiba',
]

/** Muy alto riesgo: 2 o más eventos mayores, o 1 evento mayor más 2 condiciones. */
export function esMuyAltoRiesgo(eventosMayores: number, condiciones: number): boolean {
  return eventosMayores >= 2 || (eventosMayores >= 1 && condiciones >= 2)
}

export const NOTA_MUY_ALTO_RIESGO =
  'La guía señala que la MAYORÍA de los pacientes con ASCVD clínica probablemente esté en muy alto riesgo, y por tanto califique para la meta de LDL-C <55 mg/dL.'

// ═══════════════════════════════════════════════════════════════════════════
// 9. POTENCIADORES DE RIESGO (Tabla 13 de la guía)
// ═══════════════════════════════════════════════════════════════════════════

export const POTENCIADORES_RIESGO = [
  'Antecedente de ASCVD prematura en padre o hermano (antes de los 55 años en hombres, antes de los 65 en mujeres)',
  'Ascendencia de mayor riesgo (por ejemplo, del sur de Asia o filipina)',
  'Riesgo poligénico alto, si se mide',
  'Enfermedad inflamatoria crónica (lupus, artritis reumatoide, psoriasis avanzada, artritis inflamatoria)',
  'Lp(a) ≥125 nmol/L o ≥50 mg/dL',
  'Proteína C reactiva de alta sensibilidad ≥2 mg/L en más de una ocasión, si se mide',
  'Triglicéridos persistentemente ≥175 mg/dL sin ayuno, o ≥150 mg/dL en ayuno',
  'Síndrome cardiovascular-renal-metabólico',
  'LDL-C persistentemente 160 a 189 mg/dL, no-HDL-C ≥190 a 219 mg/dL, o apoB ≥120 mg/dL',
  'Marcadores de riesgo reproductivo: menopausia prematura, preeclampsia, hipertensión gestacional, diabetes gestacional o parto pretérmino',
]

/** Potenciadores específicos de diabetes (Tabla 17 de la guía). */
export const POTENCIADORES_DIABETES = [
  'Larga duración: 10 años o más en diabetes tipo 2, o 20 años o más en tipo 1',
  'Albuminuria ≥30 µg de albúmina por mg de creatinina',
  'Tasa de filtrado glomerular estimada menor de 60 mL/min/1.73 m²',
  'Retinopatía',
  'Neuropatía',
  'Índice tobillo-brazo menor de 0.9',
]

// ═══════════════════════════════════════════════════════════════════════════
// 10. FÁRMACOS NO ESTATINA (Tabla 5 de la guía)
// ═══════════════════════════════════════════════════════════════════════════

export interface NoEstatina {
  nombre: string
  dosis: string
  via: string
  efecto: string
  nota: string
}

export const NO_ESTATINAS_LDL: NoEstatina[] = [
  { nombre: 'Ezetimiba', dosis: '10 mg una vez al día', via: 'Oral', efecto: 'Baja el LDL-C 18% en monoterapia; 25% adicional al agregarse a estatina.', nota: 'Es el fármaco de elección en sitosterolemia. Vigilar transaminasas al combinarla con estatina.' },
  { nombre: 'Evolocumab', dosis: '140 mg cada 2 semanas', via: 'Subcutánea', efecto: 'Baja el LDL-C 45% a 64%.', nota: 'En hipercolesterolemia familiar homocigota la reducción es menor (21% a 31%).' },
  { nombre: 'Alirocumab', dosis: '75 a 150 mg cada 2 semanas, o 300 mg cada 4 semanas', via: 'Subcutánea', efecto: 'Baja el LDL-C 45% a 64%.', nota: 'Con reducción de eventos demostrada en prevención secundaria de muy alto riesgo.' },
  { nombre: 'Ácido bempedoico', dosis: '180 mg una vez al día', via: 'Oral', efecto: 'Baja el LDL-C 21% a 24% en monoterapia en quien tiene síntomas musculares por estatina; 17% a 18% combinado con estatina.', nota: 'Es un profármaco que se activa solo en el hígado, lo que explica su tolerancia muscular. Vigilar ácido úrico si hay hiperuricemia.' },
  { nombre: 'Inclisirán', dosis: '284 mg: dosis inicial, segunda a los 3 meses, luego cada 6 meses', via: 'Subcutánea, aplicada por personal de salud', efecto: 'Baja el LDL-C 48% a 52%.', nota: 'El ensayo de desenlaces cardiovasculares sigue en curso.' },
  { nombre: 'Evinacumab', dosis: '15 mg/kg cada 4 semanas', via: 'Intravenosa', efecto: 'Baja el LDL-C cerca de 49%.', nota: 'Solo en hipercolesterolemia familiar homocigota. Actúa por una vía independiente del receptor de LDL.' },
]

export const NO_ESTATINAS_TG: NoEstatina[] = [
  { nombre: 'Icosapento de etilo', dosis: '2 g dos veces al día con alimentos (4 g/día en total)', via: 'Oral', efecto: 'Reduce triglicéridos; en REDUCE-IT redujo 25% el desenlace primario.', nota: 'Contiene SOLO EPA. Dosis de la etiqueta/REDUCE-IT = 2 g c/12 h (4 g/día). Vigilar fibrilación auricular (3.1% frente a 2.1%) y sangrado. No confundir con los aceites de pescado de venta libre.' },
  { nombre: 'Fenofibrato', dosis: '40 a 200 mg una vez al día', via: 'Oral', efecto: 'Baja los triglicéridos 30% a 50%.', nota: 'Primera línea en hipertrigliceridemia severa. Los ensayos NO muestran reducción de eventos al agregarlo a estatina.' },
  { nombre: 'Gemfibrozilo', dosis: '600 mg dos veces al día', via: 'Oral', efecto: 'Baja los triglicéridos 30% a 50%.', nota: 'NO debe combinarse con estatina: la interacción es seria.' },
  { nombre: 'Olezarsén', dosis: '80 mg una vez al mes', via: 'Subcutánea', efecto: 'Bajó los triglicéridos 43.5% a 6 meses y redujo los episodios de pancreatitis.', nota: 'Aprobado ÚNICAMENTE para síndrome de quilomicronemia familiar. Vigilar trombocitopenia.' },
  { nombre: 'Niacina', dosis: '500 a 2000 mg al día en liberación extendida', via: 'Oral', efecto: 'Baja los triglicéridos 10% a 30%.', nota: 'Agente de ÚLTIMA línea: los ensayos no muestran reducción de eventos al agregarla a estatina, aumenta la resistencia a la insulina y tiene alta tasa de rubor y hepatotoxicidad.' },
]

// ═══════════════════════════════════════════════════════════════════════════
// 11. SÍNTOMAS MUSCULARES ATRIBUIDOS A ESTATINA
// ═══════════════════════════════════════════════════════════════════════════

export const FACTORES_RIESGO_SAMS = [
  'Edad 65 años o más', 'Índice de masa corporal bajo', 'Sexo femenino', 'Obesidad',
  'Hipotiroidismo', 'Diabetes', 'Enfermedad hepática crónica', 'Enfermedad renal crónica',
  'Consumo de alcohol', 'Ejercicio vigoroso', 'Estatina a dosis alta',
  'Enfermedades que cursan con mialgia o debilidad (fibromialgia, polimialgia reumática, polimiositis, miopatías primarias)',
  'Fármacos que afectan el metabolismo de la estatina',
  'Variantes génicas que afectan el metabolismo de la estatina (por ejemplo SLCO1B1)',
]

export const SAMS = {
  definicion: 'Se consideran síntomas musculares atribuidos a estatina cuando aparecen con DOS O MÁS estatinas, al menos una de ellas a la dosis más baja aprobada.',
  primerPaso: 'Buscar causas secundarias y evaluar la fuerza muscular de forma objetiva. Reconocer la preocupación del paciente y explicarle que suspender la estatina aumenta el riesgo de eventos cardiovasculares.',
  creatincinasa: 'Medir creatincinasa SOLO si hay mialgia severa o debilidad. NO se recomienda medirla de rutina (COR 3, sin beneficio): la mayoría de quienes tienen síntomas tiene creatincinasa normal, y puede estar elevada en personas asintomáticas o después de ejercicio.',
  umbralSuspender: 'Con mialgia severa o debilidad y creatincinasa 10 veces o más por arriba del límite superior normal, se aconseja SUSPENDER la estatina; si persiste, valoración por neurología.',
  reintento: 'Explorar la disposición del paciente a: reiniciar una estatina distinta, tomar una estatina de acción prolongada en dosis MENOS QUE DIARIAS, o agregar terapias no estatina. La reintroducción de tratamiento cardioprotector es esencial.',
  noEstatinas: 'Con ASCVD clínica: estatina a dosis reducida si se tolera, más ácido bempedoico, ezetimiba o inhibidor de PCSK9, solos o combinados. El ácido bempedoico es útil aquí porque se activa solo en el hígado.',
  coenzimaQ10: 'La coenzima Q10 NO se recomienda para tratar ni prevenir los síntomas musculares (COR 3, sin beneficio).',
  hepatico: 'No se recomienda medir pruebas de función hepática de rutina en quien no tiene síntomas de hepatotoxicidad (COR 3). El monitoreo rutinario de transaminasas lo descontinuó la FDA en 2012.',
  cac: 'Un calcio coronario de 0 unidades Agatston, sin diabetes ni tabaquismo activo, puede apoyar diferir la farmacoterapia y hacer solo estilo de vida los siguientes 5 años. Un calcio de 100 unidades o más, o en percentil 75 o mayor, apoya reiniciar el tratamiento.',
}
