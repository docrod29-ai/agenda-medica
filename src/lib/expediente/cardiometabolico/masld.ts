/**
 * MASLD — enfermedad hepática esteatósica asociada a disfunción metabólica.
 *
 * Fuentes (leídas íntegras):
 *  · ADA. MASLD in People With Diabetes: The Need for Screening and Early
 *    Intervention. A Consensus Report. Diabetes Care 2025;48:1057-1082.
 *  · ADA. 4. Comprehensive Medical Evaluation and Assessment of Comorbidities:
 *    Standards of Care in Diabetes—2026. Diabetes Care 2026;49(Suppl 1):S61-S88.
 *  · Tilg H, Petta S, Stefan N, Targher G. MASLD in Adults: A Review.
 *    JAMA. Publicado en línea el 10 de noviembre de 2025.
 *
 * Por qué importa aquí: en México la prevalencia de MASLD es de las más altas
 * del mundo (América Latina 44.4% por ultrasonido) y en diabetes tipo 2 ronda
 * el 65%. Casi dos tercios de los pacientes, INCLUIDOS los que ya tienen
 * fibrosis avanzada o cirrosis, tienen transaminasas normales: por eso el
 * tamizaje es con FIB-4 y no esperando a que se eleven las enzimas.
 */

export const FUENTE_MASLD =
  'Consenso ADA 2025 (Diabetes Care 2025;48:1057-1082) · Standards of Care in Diabetes 2026 (Diabetes Care 2026;49(S1):S61-S88) · Revisión JAMA, 10 nov 2025'

// ═══════════════════════════════════════════════════════════════════════════
// 1. NOMENCLATURA Y CRITERIOS CARDIOMETABÓLICOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Criterios cardiometabólicos: basta UNO junto con esteatosis para MASLD.
 * Los cortes numéricos y el ajuste por etnia vienen de la revisión de JAMA
 * (los documentos de la ADA no traen el ajuste étnico).
 */
export const CRITERIOS_CARDIOMETABOLICOS = [
  'IMC ≥25 kg/m² (≥23 en personas asiáticas), o circunferencia de cintura >80 cm en mujeres y >94 cm en hombres (≥90 cm en hombres asiáticos)',
  'Glucosa en ayuno ≥100 mg/dL, glucosa 2 h poscarga ≥140 mg/dL, HbA1c ≥5.7%, diabetes tipo 2 establecida, o tratamiento hipoglucemiante',
  'Presión arterial ≥130/85 mmHg o tratamiento antihipertensivo',
  'Triglicéridos ≥150 mg/dL o tratamiento hipolipemiante',
  'HDL <40 mg/dL en hombres y <50 mg/dL en mujeres, o tratamiento para elevar HDL',
]

export type CategoriaSLD = 'MASLD' | 'MetALD' | 'ALD' | 'otra'

/**
 * Clasifica por consumo de alcohol en gramos por día.
 * Umbrales del consenso ADA 2025. Ojo: los tres documentos usan umbrales que no
 * son idénticos (la revisión de JAMA los expresa por semana y los Standards of
 * Care por tragos estándar por semana); aquí se usa el consenso ADA.
 */
export function categoriaPorAlcohol(
  gramosDia: number, esMujer: boolean, criteriosMetabolicos: number,
): { categoria: CategoriaSLD; explicacion: string } {
  const [limMASLD, limALD] = esMujer ? [20, 50] : [30, 60]

  // Sin criterio cardiometabólico NO puede haber MASLD, y por tanto tampoco
  // MetALD (que es MASLD más alcohol aumentado). Antes, 30 g/día sin ningún
  // criterio se etiquetaba MetALD y desviaba el manejo hacia lo metabólico
  // cuando el caso es puramente alcohólico.
  if (criteriosMetabolicos < 1) {
    if (gramosDia >= limMASLD) return {
      categoria: 'ALD',
      explicacion: `Consumo de alcohol de ${gramosDia} g/día sin ningún criterio cardiometabólico: corresponde a enfermedad hepática por alcohol, no a MASLD ni a MetALD. La intervención central es sobre el consumo.`,
    }
    return {
      categoria: 'otra',
      explicacion: 'Esteatosis sin criterios cardiometabólicos y sin consumo significativo de alcohol: buscar otras causas (fármacos como corticosteroides, metotrexato, tamoxifeno o amiodarona; hepatitis C genotipo 3; sobrecarga de hierro; enfermedad celíaca; VIH; enfermedad de Wilson; hipobetalipoproteinemia).',
    }
  }
  if (gramosDia > limALD) return {
    categoria: 'ALD',
    explicacion: `Consumo de alcohol por arriba de ${limALD} g/día: se clasifica como enfermedad hepática por alcohol, no como MASLD.`,
  }
  if (gramosDia >= limMASLD) return {
    categoria: 'MetALD',
    explicacion: `MASLD con consumo aumentado de alcohol (${limMASLD} a ${limALD} g/día): categoría MetALD, con contribución de ambos mecanismos.`,
  }
  return {
    categoria: 'MASLD',
    explicacion: 'Esteatosis con al menos un criterio cardiometabólico y consumo de alcohol por debajo del umbral.',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. FIB-4
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normaliza plaquetas a ×10⁹/L SIN importar en qué unidad lleguen. Las plaquetas
 * se reportan como ×10⁹/L (p. ej. 135) o como CONTEO ABSOLUTO /µL (135 000) según
 * la fuente (panel manual vs parser de laboratorio). Se detecta por MAGNITUD:
 * fisiológicamente las plaquetas en ×10⁹/L van ~5–1000; un valor > 2000 solo puede
 * ser conteo absoluto → se divide entre 1000. Es una guarda de UNIDAD (software),
 * no un umbral clínico. Blinda a TODOS los llamadores de fib4 (auditoría maestra:
 * un fix previo dividía /1000 en un sitio y rompía la fuente que ya venía en 10⁹/L
 * → FIB-4 salía 1000× — p. ej. 68/42/135/48 daba 3053.54 en vez de 3.05).
 */
export function plaquetasEn10a9(plaquetas: number): number {
  return plaquetas > 2000 ? plaquetas / 1000 : plaquetas
}

/**
 * FIB-4 = (edad × AST) / (plaquetas × √ALT). Plaquetas en 10⁹/L; si llegan en
 * conteo absoluto (>2000) se normalizan solas (ver plaquetasEn10a9).
 */
export function fib4(edad: number, ast: number, plaquetas: number, alt: number): number | null {
  if (!(edad > 0) || !(ast > 0) || !(plaquetas > 0) || !(alt > 0)) return null
  const plaq = plaquetasEn10a9(plaquetas)
  const v = (edad * ast) / (plaq * Math.sqrt(alt))
  return Math.round(v * 100) / 100
}

export interface RiesgoFib4 {
  valor: number
  zona: 'bajo' | 'indeterminado' | 'alto'
  interpretacion: string
  conducta: string
  /** Cuándo repetir la evaluación. */
  seguimiento: string
  /** Advertencias de validez del puntaje para ese paciente. */
  advertencias: string[]
}

export function interpretarFib4(valor: number, edad: number): RiesgoFib4 | null {
  if (!(valor >= 0)) return null
  const advertencias: string[] = []

  if (edad < 35) advertencias.push(
    'El FIB-4 NO está validado en menores de 35 años ni en población pediátrica: interpretar con cautela.',
  )
  if (edad >= 65) advertencias.push(
    'En personas de 65 años o más se han propuesto cortes más altos (1.9 a 2.0 en lugar de 1.3) porque la edad entra en la fórmula. El consenso ADA reconoce que los datos que respaldan el corte de 2.0 son limitados y sugiere mantener el umbral de 1.3 para pasar a la prueba de segundo nivel.',
  )

  if (valor > 2.67) return {
    valor, zona: 'alto',
    interpretacion: 'Alta probabilidad de fibrosis avanzada. El valor predictivo positivo para fibrosis clínicamente significativa es de 60% a 80%. Corresponde a un 5% o menos de las personas con diabetes tipo 2 en contextos no hepatológicos.',
    conducta: 'Referencia DIRECTA a gastroenterología o hepatología, sin necesidad de estratificación adicional en el primer nivel.',
    seguimiento: 'El seguimiento lo define el especialista.',
    advertencias,
  }
  if (valor >= 1.3) return {
    valor, zona: 'indeterminado',
    interpretacion: 'Riesgo indeterminado de fibrosis avanzada. No es una zona benigna: las tasas de muerte, desenlaces hepáticos y enfermedad cardiovascular son más altas aquí que con FIB-4 menor de 1.3.',
    conducta: 'Prueba de SEGUNDO NIVEL obligada: elastografía transitoria para medir rigidez hepática o, si no está disponible, panel ELF. Si la rigidez es <8.0 kPa, intensificar el manejo metabólico y reevaluar. Si es ≥8.0 kPa, referir al especialista.',
    seguimiento: 'Si la rigidez resultó menor de 8.0 kPa, reevaluar el FIB-4 en un año o antes.',
    advertencias,
  }
  const bajo: RiesgoFib4 = {
    valor, zona: 'bajo',
    interpretacion: 'Descarta fibrosis avanzada de forma fiable: el valor predictivo negativo es de 85% a 90% o más. Poco probable que tenga desenlaces hepáticos o mortalidad aumentada en una ventana de 5 años.',
    conducta: 'Manejo en el primer nivel: optimizar peso, control glucémico, lípidos y presión arterial, y evitar el alcohol.',
    seguimiento: 'Repetir el FIB-4 cada 1 a 2 años.',
    advertencias,
  }
  if (valor >= 1.0) {
    bajo.conducta += ' Con obesidad u otros factores cardiometabólicos, un FIB-4 entre 1.0 y 1.3 puede justificar búsqueda de casos con elastografía o ELF, sobre todo si el valor viene subiendo desde menos de 1.0.'
  }
  return bajo
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SEGUNDO NIVEL: ELASTOGRAFÍA Y ELF
// ═══════════════════════════════════════════════════════════════════════════

export interface ResultadoSegundoNivel {
  interpretacion: string
  conducta: string
  referir: boolean
}

/** Rigidez hepática por elastografía transitoria (VCTE), en kPa. */
export function interpretarElastografia(kPa: number, plaquetas?: number): ResultadoSegundoNivel | null {
  if (!(kPa >= 0)) return null
  if (kPa > 25 || (kPa > 20 && plaquetas != null && plaquetas <= 150)) return {
    interpretacion: `Rigidez de ${kPa} kPa: marcador de hipertensión portal clínicamente significativa (>25 kPa, o >20 kPa con plaquetas ≤150 000/mm³).`,
    conducta: 'Manejo por hepatología. Requiere tamizaje y profilaxis primaria de varices esofágicas, vigilancia de carcinoma hepatocelular y evaluación de trasplante.',
    referir: true,
  }
  if (kPa > 15) return {
    interpretacion: `Rigidez de ${kPa} kPa: compatible con cirrosis (F4).`,
    conducta: 'Referencia a hepatología. Vigilancia de carcinoma hepatocelular, MELD y complicaciones de hipertensión portal CADA 6 MESES.',
    referir: true,
  }
  if (kPa > 10) return {
    interpretacion: `Rigidez de ${kPa} kPa: fibrosis avanzada (F3 o F4).`,
    conducta: 'Referencia a hepatología para estratificación adicional y tratamiento.',
    referir: true,
  }
  if (kPa >= 8) return {
    interpretacion: `Rigidez de ${kPa} kPa: fibrosis clínicamente significativa (≥F2). Es el rango donde el tratamiento dirigido a MASH está indicado.`,
    conducta: 'Referencia a gastroenterología o hepatología.',
    referir: true,
  }
  return {
    interpretacion: `Rigidez de ${kPa} kPa: por debajo de 8.0 kPa, buen valor predictivo negativo para excluir fibrosis avanzada.`,
    conducta: 'Puede seguirse en primer nivel o endocrinología, intensificando el manejo metabólico.',
    referir: false,
  }
}

/** Panel ELF (ácido hialurónico, PIIINP y TIMP-1). */
export function interpretarELF(valor: number): ResultadoSegundoNivel | null {
  if (!(valor >= 0)) return null
  // El documento tiene una discrepancia interna: la tabla dice >11.2 y el texto >11.3.
  if (valor > 11.2) return {
    interpretacion: `ELF ${valor}: compatible con cirrosis (F4) y con el mayor riesgo de eventos de descompensación hepática. Nota: el consenso ADA da 11.2 en su tabla y 11.3 en el texto para este umbral.`,
    conducta: 'Manejo por hepatología.',
    referir: true,
  }
  if (valor >= 9.8) return {
    interpretacion: `ELF ${valor}: fibrosis avanzada (F3 o F4), con mayor riesgo de progresión a cirrosis y eventos hepáticos.`,
    conducta: 'Referencia a especialista hepático.',
    referir: true,
  }
  if (valor >= 9.2) return {
    interpretacion: `ELF ${valor}: zona gris (9.2 a 9.7). El corte óptimo para uso en clínicas no hepatológicas todavía está evolucionando.`,
    conducta: 'Individualizar según el riesgo clínico; puede requerir repetirse con más frecuencia que cada 2 años.',
    referir: false,
  }
  if (valor < 7.7) return {
    interpretacion: `ELF ${valor}: riesgo muy bajo de fibrosis.`,
    conducta: 'Seguimiento en primer nivel.',
    referir: false,
  }
  return {
    interpretacion: `ELF ${valor}: bajo riesgo de fibrosis avanzada.`,
    conducta: 'Seguimiento en primer nivel o endocrinología, repitiendo cada 2 años o más.',
    referir: false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ESTADIOS DE FIBROSIS Y PRONÓSTICO
// ═══════════════════════════════════════════════════════════════════════════

export interface EstadioFibrosis {
  estadio: string
  histologia: string
  /** Tiempo estimado hasta cirrosis o descompensación (revisión JAMA). */
  tiempoACirrosis: string
  riesgo5Anios: string
}

export const ESTADIOS_FIBROSIS: EstadioFibrosis[] = [
  { estadio: 'F0', histologia: 'Sin fibrosis.', tiempoACirrosis: '30 a 35 años', riesgo5Anios: '0.2% de eventos hepáticos y 3.0% de eventos extrahepáticos a 5 años.' },
  { estadio: 'F1', histologia: 'Fibrosis leve, perisinusoidal o portal.', tiempoACirrosis: '30 a 35 años', riesgo5Anios: '0.2% de eventos hepáticos y 3.0% de eventos extrahepáticos a 5 años.' },
  { estadio: 'F2', histologia: 'Fibrosis moderada, perisinusoidal y portal o periportal. Es el umbral de fibrosis clínicamente significativa.', tiempoACirrosis: '15 a 20 años', riesgo5Anios: '2.0% de eventos hepáticos y 3.8% de eventos extrahepáticos a 5 años.' },
  { estadio: 'F3', histologia: 'Fibrosis avanzada, septal y en puentes.', tiempoACirrosis: '5 a 7 años', riesgo5Anios: '9.7% de eventos hepáticos y 6.4% de eventos extrahepáticos a 5 años.' },
  { estadio: 'F4', histologia: 'Cirrosis: disrupción extensa de la arquitectura hepática con nódulos regenerativos rodeados por bandas fibróticas.', tiempoACirrosis: 'Ya establecida', riesgo5Anios: 'Descompensación cerca de 10% anual; carcinoma hepatocelular 0.5% a 2.5% anual.' },
]

/**
 * MASH de riesgo = esteatohepatitis con MAS ≥4 Y fibrosis ≥F2. Es la población
 * en la que el tratamiento dirigido al hígado está indicado.
 */
export const MASH_DE_RIESGO =
  'MASH de riesgo: esteatohepatitis con puntaje de actividad MASLD (MAS) ≥4 y fibrosis ≥F2. Es el grupo con mayor riesgo de progresar a cirrosis y en el que se indica tratamiento dirigido al hígado. Entre 12% y 20% de las personas con diabetes tipo 2 lo tienen.'

// ═══════════════════════════════════════════════════════════════════════════
// 5. TRATAMIENTO
// ═══════════════════════════════════════════════════════════════════════════

export interface MetaPesoMASLD { porcentaje: string; logra: string }

/** Qué consigue cada porcentaje de pérdida de peso sobre la histología. */
export const PERDIDA_PESO_MASLD: MetaPesoMASLD[] = [
  { porcentaje: '≥5%', logra: 'Disminuye la esteatosis hepática.' },
  { porcentaje: '>5%', logra: 'Suele ser lo necesario para revertir la esteatohepatitis.' },
  { porcentaje: '7% a 10%', logra: 'Mejora la esteatohepatitis y la fibrosis. En el estudio con biopsias pareadas, 76% tuvo mejoría mayor del 30% en esteatosis, frente a 35% de quienes perdieron menos del 5%.' },
  { porcentaje: '≥10%', logra: 'Es lo que se requiere para mejorar la FIBROSIS. Resolución de MASH en 64% a 90%, frente a 10% en quienes perdieron menos del 5%; reducción de fibrosis a 52 semanas en 45% frente a 16%.' },
]

export interface TratamientoPorEstadio {
  estadio: string
  obesidad: string
  diabetes: string
  mash: string
  advertencia?: string
}

/** Figura 4 del consenso ADA 2025 (idéntica a la Figura 4.3 de los Standards 2026). */
export const TRATAMIENTO_POR_ESTADIO: TratamientoPorEstadio[] = [
  {
    estadio: 'MASLD con F0-F1',
    obesidad: 'Preferir agonista del receptor de GLP-1, o agonista dual de GIP y GLP-1.',
    diabetes: 'Preferir agonista de GLP-1, agonista dual GIP/GLP-1, pioglitazona o inhibidor de SGLT2.',
    mash: 'NO INDICADA farmacoterapia dirigida al hígado en este estadio.',
  },
  {
    estadio: 'MASLD con F2-F3 (MASH de riesgo)',
    obesidad: 'Preferir agonista de GLP-1, o agonista dual de GIP y GLP-1.',
    diabetes: 'Preferir agonista de GLP-1, agonista dual GIP/GLP-1 o pioglitazona.',
    mash: 'Resmetirom, o semaglutida (el único agonista de GLP-1 aprobado para MASH).',
  },
  {
    estadio: 'Cirrosis compensada',
    obesidad: 'Igual que en F2-F3 pero CON PRECAUCIÓN: datos de seguridad limitados.',
    diabetes: 'Igual que en F2-F3 pero CON PRECAUCIÓN y monitoreo estrecho.',
    mash: 'EVITAR la farmacoterapia dirigida al hígado.',
    advertencia: 'La cirugía metabólica se usa con precaución en este estadio.',
  },
  {
    estadio: 'Cirrosis descompensada',
    obesidad: 'EVITAR farmacoterapia de obesidad.',
    diabetes: 'SOLO INSULINA para el manejo de la hiperglucemia.',
    mash: 'EVITAR.',
    advertencia: 'La cirugía metabólica NO se recomienda. Las estatinas se usan con precaución. Evitar sulfonilureas y metformina si hay daño renal.',
  },
]

export interface FarmacoMASLD {
  nombre: string
  dosis: string
  indicacion: string
  eficacia: string
  precauciones: string
}

export const FARMACOS_MASLD: FarmacoMASLD[] = [
  {
    nombre: 'Semaglutida',
    dosis: '2.4 mg por semana, subcutánea',
    indicacion: 'MASH no cirrótica con fibrosis moderada a avanzada (F2-F3). Aprobación condicional de la FDA el 15 de agosto de 2025. Es el único hipoglucemiante o antiobesidad aprobado para MASH.',
    eficacia: 'Ensayo ESSENCE a 72 semanas: resolución de la esteatohepatitis sin empeoramiento de fibrosis en 62.9% frente a 34.3% con placebo. Mejoría de fibrosis de al menos un estadio sin empeoramiento de MASH en 36.8% frente a 22.4%. Peso −10.5%, ALT −52%.',
    precauciones: 'Náusea 36%, diarrea 27%, estreñimiento 22%, vómito 18%. No se asoció a eventos adversos serios ni a toxicidad hepática.',
  },
  {
    nombre: 'Resmetirom',
    dosis: '80 mg o 100 mg al día, vía oral',
    indicacion: 'MASH con fibrosis F2 o F3, confirmada por histología O por una prueba validada de imagen o de sangre: NO requiere biopsia. Aprobado por la FDA el 14 de marzo de 2024 y por la EMA el 19 de agosto de 2025.',
    eficacia: 'Ensayo MAESTRO-NASH a 52 semanas: resolución de MASH sin empeoramiento de fibrosis en 25.9% (80 mg) y 29.9% (100 mg) frente a 9.7% con placebo. Mejoría de fibrosis de al menos un estadio en 24.2% y 25.9% frente a 14.2%. También baja LDL 16%, triglicéridos 19% y Lp(a) 35%.',
    precauciones: 'Requiere PRUEBA DE FUNCIÓN TIROIDEA BASAL antes de iniciar. Baja la T4 libre cerca de 20% y sube la SHBG dos a tres veces. Excluido en cirrosis, hepatitis autoinmune, colangitis biliar primaria, tiroidopatía mal controlada, y consumo de alcohol mayor de 20 g/día en mujeres o 30 g/día en hombres. Diarrea 27%, estreñimiento 22%. NO produce pérdida de peso relevante: su efecto hepático es independiente del peso.',
  },
  {
    nombre: 'Pioglitazona',
    dosis: '15 mg/día (ganancia de peso media de 1% a 2%) hasta 45 mg/día (ganancia de 3% a 5%)',
    indicacion: 'Puede revertir la esteatohepatitis con o sin diabetes. Como es genérica, es una alternativa costo-efectiva para tratar a la vez la diabetes tipo 2 y la MASH.',
    eficacia: 'El efecto sobre la FIBROSIS es modesto: la diferencia frente a placebo va de 9% a 22% entre estudios, sin alcanzar significancia estadística en ninguno.',
    precauciones: 'NO recomendada en insuficiencia cardiaca estadio B, C o D. Aumento del riesgo de fracturas y, de forma controvertida, de cáncer de vejiga. Evitar en cirrosis descompensada. La ganancia de peso se atenúa al combinarla con un agonista de GLP-1 o un inhibidor de SGLT2.',
  },
  {
    nombre: 'Vitamina E',
    dosis: 'La dosis NO se especifica en los documentos consultados.',
    indicacion: 'Puede considerarse en MASH en personas seleccionadas SIN diabetes.',
    eficacia: 'En diabetes tipo 2 la monoterapia resultó inefectiva y no potenció a la pioglitazona: no hay evidencia suficiente para recomendarla en diabetes tipo 2.',
    precauciones: 'Persiste controversia sobre un posible aumento de ictus hemorrágico y cáncer de próstata.',
  },
]

/** Fármacos y estrategias que la evidencia NO respalda o que se deben evitar. */
export const NO_RECOMENDADO_MASLD = [
  'Farmacoterapia dirigida al hígado en F0-F1: no está indicada.',
  'Metformina: no mejora la MASH (efecto neutral sobre esteatohepatitis y fibrosis), aunque puede continuarse por su indicación en diabetes.',
  'Paneles no patentados de segundo nivel (como el NAFLD fibrosis score): no se recomiendan porque no superan al FIB-4.',
  'Tamizaje de carcinoma hepatocelular en diabetes con MASLD SIN cirrosis: no se recomienda.',
  'Cirugía metabólica en cirrosis descompensada: no se recomienda. En cirrosis compensada, con precaución.',
  'Alcohol: debe evitarse por completo en MASH de riesgo y en toda persona con diabetes y enfermedad hepática crónica.',
  'Estatinas en cirrosis descompensada: usar con precaución. En cirrosis COMPENSADA son seguras y deben iniciarse o continuarse por riesgo cardiovascular.',
]

// ═══════════════════════════════════════════════════════════════════════════
// 6. ESTILO DE VIDA
// ═══════════════════════════════════════════════════════════════════════════

export const ESTILO_VIDA_MASLD = {
  dieta: 'Patrón mediterráneo culturalmente adaptado: frutas, verduras, granos enteros, pescado y aceite de oliva. Es el que tiene la mejor evidencia a largo plazo para salud hepática y cardiometabólica. Limitar alimentos ultraprocesados, grasa saturada y azúcares refinados. Los distintos patrones (bajo en grasa, bajo en carbohidratos, mediterráneo, DASH) parecen comparables para mejorar la esteatosis.',
  macronutrientes: 'No puede recomendarse ampliamente un porcentaje ideal de carbohidratos, proteínas y grasas para todas las personas.',
  fructosa: 'El consumo elevado de fructosa (sobre todo de bebidas azucaradas, desde una ración al día) se asocia a la severidad de la fibrosis INDEPENDIENTEMENTE de las calorías totales.',
  alcohol: 'Evitar por completo en MASH de riesgo y en toda persona con diabetes y enfermedad hepática crónica. El consumo llamado moderado (más de 20 g/día) se asocia a menor probabilidad de resolución de la MASH y a mayor riesgo de cirrosis, carcinoma hepatocelular y cánceres extrahepáticos.',
  ejercicio: 'Al menos 150 minutos por semana de intensidad moderada o 75 minutos de intensidad vigorosa, más entrenamiento de resistencia dos a tres veces por semana. La actividad aeróbica parece ofrecer mayor beneficio hepático, y la de alta intensidad mejora la MASH y la fibrosis. Minimizar el tiempo sedentario; sirven sesiones breves de unos 10 minutos de caminata.',
  proteinaCirrosis: 'En cirrosis, ingesta alta de proteína de 1.2 a 1.5 g/kg/día más ejercicio regular para prevenir la sarcopenia.',
  /** Lo que los documentos NO especifican: no se inventa. */
  sinDatos: 'Los documentos consultados no especifican un déficit calórico numérico (kcal/día ni porcentaje de restricción); las metas se expresan como porcentaje de pérdida de peso. Tampoco mencionan el café.',
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. SEGUIMIENTO
// ═══════════════════════════════════════════════════════════════════════════

export const SEGUIMIENTO_MASLD = [
  { situacion: 'FIB-4 menor de 1.3 (bajo riesgo)', prueba: 'FIB-4', frecuencia: 'Cada 1 a 2 años' },
  { situacion: 'FIB-4 ≥1.3 con rigidez hepática menor de 8.0 kPa', prueba: 'FIB-4', frecuencia: 'Reevaluar en 1 año o antes' },
  { situacion: 'Rigidez hepática menor de 8.0 kPa', prueba: 'Elastografía', frecuencia: 'Cada 2 años o más (el intervalo preciso queda por establecerse)' },
  { situacion: 'ELF menor de 9.8', prueba: 'ELF', frecuencia: 'Cada 2 años o más' },
  { situacion: 'ELF entre 9.2 y 9.7', prueba: 'ELF', frecuencia: 'Puede necesitar repetirse con más frecuencia' },
  { situacion: 'MASLD con F2-F3', prueba: 'Elastografía o resonancia + biomarcadores', frecuencia: 'Considerar imagen anual; reevaluar el tratamiento cada 6 a 12 meses' },
  { situacion: 'Cirrosis', prueba: 'Carcinoma hepatocelular (ultrasonido y alfafetoproteína), MELD y complicaciones de hipertensión portal', frecuencia: 'CADA 6 MESES' },
  { situacion: 'Cirrosis', prueba: 'Elastografía y plaquetas', frecuencia: 'Anual' },
  { situacion: 'Diabetes en general', prueba: 'FIB-4', frecuencia: 'En la visita inicial y anualmente' },
]

/**
 * Advertencia importante sobre interpretar el seguimiento: el FIB-4 no es
 * sensible al cambio de fibrosis. Una mejoría a 6-12 meses probablemente
 * refleje cambios en la inflamación (transaminasas), no en la fibrosis.
 */
export const ADVERTENCIA_SEGUIMIENTO =
  'El FIB-4 no es sensible al cambio de fibrosis: sube o baja solo después de un cambio sustancial de estadio, y una mejoría a 6 a 12 meses probablemente refleje cambios en la inflamación más que en la fibrosis. La elastografía sí responde al tratamiento: una mejoría de 30% o más en la rigidez representa respuesta terapéutica y un aumento de 30% o más refleja progresión.'
