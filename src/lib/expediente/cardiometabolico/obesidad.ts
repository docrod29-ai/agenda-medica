/**
 * OBESIDAD — enfermedad crónica basada en adiposidad (ABCD).
 *
 * Fuentes (leídas íntegras):
 *  · AACE Consensus Statement: Algorithm for the Evaluation and Treatment of
 *    Adults with Obesity/Adiposity-Based Chronic Disease — 2025 Update.
 *    Endocr Pract. 2025;31:1351-1394. (Columna vertebral clínica; sin
 *    financiamiento externo.)
 *  · Joint TOS/OMA/OAC Expert Guidance Statement on the Pharmacological
 *    Management of Adults With Overweight or Obesity Using the GRADE Approach.
 *    Obesity. 2026;34:851-870. (Fuerza de recomendación y certeza.)
 *  · Mozaffarian D, et al. Nutritional priorities to support GLP-1 therapy for
 *    obesity: joint Advisory ACLM/ASN/OMA/TOS. Am J Clin Nutr. 2025;122:344-367.
 *
 * Idea de fondo del documento de AACE: des-enfatizar el IMC y tratar según las
 * COMPLICACIONES. El IMC sirve para tamizar; el exceso de adiposidad se confirma
 * por exploración, cintura e índice cintura-talla.
 */

export const FUENTE_OBESIDAD =
  'Consenso AACE 2025 (Endocr Pract. 2025;31:1351-1394) · TOS/OMA/OAC GRADE 2026 (Obesity. 2026;34:851-870) · Advisory nutricional ACLM/ASN/OMA/TOS 2025 (Am J Clin Nutr. 2025;122:344-367)'

// ═══════════════════════════════════════════════════════════════════════════
// 1. ANTROPOMETRÍA
// ═══════════════════════════════════════════════════════════════════════════

export function imc(pesoKg: number, tallaCm: number): number | null {
  if (!(pesoKg > 0) || !(tallaCm > 0)) return null
  const m = tallaCm / 100
  return Math.round((pesoKg / (m * m)) * 10) / 10
}

export function clasificarIMC(valor: number): string | null {
  if (!(valor > 0)) return null
  if (valor < 18.5) return 'Bajo peso'
  if (valor < 25) return 'Peso normal'
  if (valor < 30) return 'Sobrepeso'
  if (valor < 35) return 'Obesidad clase I'
  if (valor < 40) return 'Obesidad clase II'
  return 'Obesidad clase III'
}

/**
 * Cortes de cintura de la International Diabetes Federation. Se miden cuando el
 * IMC es menor de 35. Para México aplica el renglón de Sudamérica y Centroamérica.
 */
export const CORTES_CINTURA: { region: string; hombre: number; mujer: number }[] = [
  { region: 'Sudamérica, Centroamérica y Asia', hombre: 90, mujer: 80 },
  { region: 'Europa, África subsahariana y Medio Oriente', hombre: 94, mujer: 80 },
  { region: 'Estados Unidos y Canadá', hombre: 102, mujer: 88 },
]

/** Índice cintura-talla: umbral ≥0.5 en ambos sexos y en todas las poblaciones. */
export function indiceCinturaTalla(cinturaCm: number, tallaCm: number): {
  valor: number; elevado: boolean; nota: string
} | null {
  if (!(cinturaCm > 0) || !(tallaCm > 0)) return null
  const v = Math.round((cinturaCm / tallaCm) * 100) / 100
  return {
    valor: v,
    elevado: v >= 0.5,
    nota: 'La evidencia indica que el índice cintura-talla es un indicador de riesgo cardiovascular SUPERIOR a la circunferencia de cintura sola. El umbral de 0.5 aplica a ambos sexos y a todas las poblaciones.',
  }
}

/**
 * Cintura elevada para población de México (renglón de Sudamérica y Centroamérica
 * de la IDF: 90 cm en hombres, 80 cm en mujeres).
 */
export function cinturaElevadaMexico(cinturaCm: number, esMujer: boolean): boolean | null {
  if (!(cinturaCm > 0)) return null
  return cinturaCm >= (esMujer ? 80 : 90)
}

export const NOTA_IMC_ETNIA =
  'Los cortes de la OMS operan en América. En India, Corea del Sur y Japón el corte de obesidad es ≥25 y el sobrepeso 23 a 24.9; en China, obesidad ≥28 y sobrepeso 24 a 27.9. En adultos MAYORES de Sudamérica y Centroamérica se ha recomendado un corte de obesidad de 27.2. El IMC subestima la adiposidad en personas frágiles o ancianas y la sobreestima en atletas musculosos.'

// ═══════════════════════════════════════════════════════════════════════════
// 2. COMPLICACIONES Y ESTADIFICACIÓN (ABCD)
// ═══════════════════════════════════════════════════════════════════════════

export const COMPLICACIONES_OBESIDAD = [
  'Osteoartritis de rodilla o cadera',
  'Apnea obstructiva del sueño',
  'Síndrome de hipoventilación por obesidad',
  'Linfedema',
  'Incontinencia urinaria de esfuerzo',
  'Enfermedad por reflujo gastroesofágico',
  'Prediabetes y síndrome metabólico',
  'MASLD — esteatosis hepática asociada a disfunción metabólica',
  'Glomerulopatía de la obesidad o enfermedad renal crónica',
  'Insuficiencia cardiaca con fracción de expulsión preservada',
  'Enfermedad cardiovascular aterosclerótica',
  'Tromboembolismo',
  'Hipertensión intracraneal idiopática',
  'Discapacidad que limita las actividades de la vida diaria',
]

export const ENFERMEDADES_RELACIONADAS = [
  'Diabetes tipo 2',
  'MASH (esteatohepatitis metabólica)',
  'Insuficiencia cardiaca con fracción de expulsión reducida',
  'Fibrilación auricular',
  'Ciertos cánceres',
  'Colelitiasis o colecistitis',
  'Asma',
  'Depresión o ansiedad',
  'Sesgo de peso internalizado',
  'Estigmatización',
  'Alimentación desordenada',
  'Deterioro cognitivo o demencia',
  'Enfermedades inflamatorias de la piel',
  'Intertrigo',
]

export interface EstadioABCD {
  estadio: 1 | 2 | 3
  descripcion: string
  equivalencia: string
  tratamiento: string
}

export function estadificarABCD(
  numComplicaciones: number, algunaSevera: boolean,
): EstadioABCD {
  if (numComplicaciones === 0) return {
    estadio: 1,
    descripcion: 'Sin enfermedad cardiometabólica, biomecánica ni psicológica conocida relacionada con la obesidad. SÍ conlleva riesgo de desarrollarlas, y ese riesgo se mitiga con la reducción de peso.',
    equivalencia: 'Corresponde a la obesidad preclínica de la Lancet Commission 2025.',
    tratamiento: 'El estadio 1 NO implica que el tratamiento no esté justificado: amerita tratamiento para prevenir complicaciones. Considerar medicamento de primera generación, con reducción de peso esperada de 5% a 15%.',
  }
  if (algunaSevera || numComplicaciones >= 3) return {
    estadio: 3,
    descripcion: 'Al menos una complicación o enfermedad relacionada con obesidad SEVERA, o múltiples complicaciones.',
    equivalencia: 'Corresponde a la obesidad clínica de la Lancet Commission 2025.',
    tratamiento: 'Preferir FUERTEMENTE un medicamento de segunda generación (semaglutida o tirzepatida) con reducción de peso esperada de al menos 15%. Puede requerirse un ensayo con primera generación según costo y cobertura.',
  }
  return {
    estadio: 2,
    descripcion: 'Una o más enfermedades relacionadas con obesidad, de leves a moderadas.',
    equivalencia: 'Corresponde a la obesidad clínica de la Lancet Commission 2025.',
    tratamiento: 'Considerar medicamento de primera generación, con reducción de peso esperada de 5% a 15%.',
  }
}

export const NOTA_TODOS_LOS_ESTADIOS =
  'En TODOS los estadios deben evaluarse el sesgo de peso internalizado, la estigmatización, las condiciones psicológicas y los determinantes sociales de la salud, en cuanto al grado en que impactan la calidad de vida o el tratamiento, e incorporarse al plan de cuidado.'

// ═══════════════════════════════════════════════════════════════════════════
// 3. METAS DE PÉRDIDA DE PESO POR COMPLICACIÓN (Tabla 2 de AACE 2025)
// ═══════════════════════════════════════════════════════════════════════════

export interface MetaPorComplicacion {
  complicacion: string
  beneficio: string
  beneficioAdicional: string
}

export const METAS_POR_COMPLICACION: MetaPorComplicacion[] = [
  { complicacion: 'Prevención de diabetes tipo 2', beneficio: '7% a 10%', beneficioAdicional: 'más de 10%' },
  { complicacion: 'Remisión de diabetes tipo 2', beneficio: '10%', beneficioAdicional: 'más de 10%' },
  { complicacion: 'Mejoría de la hiperglucemia', beneficio: '5% a 15%', beneficioAdicional: 'más de 15%' },
  { complicacion: 'Hipertensión arterial', beneficio: '5% a 15%', beneficioAdicional: 'más de 15%' },
  { complicacion: 'Dislipidemia', beneficio: '5% a 15%', beneficioAdicional: 'más de 15%' },
  { complicacion: 'Esteatosis hepática', beneficio: '5% a 10%', beneficioAdicional: 'más de 10%' },
  { complicacion: 'MASH', beneficio: '10% o más', beneficioAdicional: '15% o más' },
  { complicacion: 'Apnea obstructiva del sueño', beneficio: '7% a 10%', beneficioAdicional: 'más de 10%' },
  { complicacion: 'Osteoartritis', beneficio: '5% a 10%', beneficioAdicional: 'más de 10%' },
  { complicacion: 'Incontinencia urinaria de esfuerzo', beneficio: '5% a 10%', beneficioAdicional: 'más de 10%' },
  { complicacion: 'Enfermedad por reflujo gastroesofágico', beneficio: '5% a 10%', beneficioAdicional: 'más de 10%' },
  { complicacion: 'Síndrome de ovario poliquístico', beneficio: '5% a 15%', beneficioAdicional: 'más de 15%' },
  { complicacion: 'Enfermedad cardiovascular aterosclerótica y eventos mayores', beneficio: '10%', beneficioAdicional: 'más de 10%' },
  { complicacion: 'Prevención de cáncer', beneficio: 'Requiere investigación adicional', beneficioAdicional: '—' },
]

export interface RespuestaTratamiento {
  categoria: 'incompleta' | 'buena' | 'excelente'
  etiqueta: string
  conducta: string
}

/** Categorías de respuesta a los 3 a 6 meses, según el porcentaje de peso perdido. */
export function evaluarRespuesta(porcentajePerdido: number): RespuestaTratamiento | null {
  if (!Number.isFinite(porcentajePerdido)) return null
  if (porcentajePerdido >= 15) return {
    categoria: 'excelente', etiqueta: 'Respuesta excelente (15% o más)',
    conducta: 'Suficiente para tratar o prevenir un amplio espectro de complicaciones. Considerar un plan de mantenimiento costo-efectivo. Vigilar de cerca las complicaciones para des-escalar sus tratamientos específicos (diabetes, hipertensión, dislipidemia, apnea).',
  }
  if (porcentajePerdido > 5) return {
    categoria: 'buena', etiqueta: 'Buena respuesta (más de 5% y menos de 15%)',
    conducta: 'Continuar el tratamiento actual. Puede o no ser óptima según la complicación que se busque tratar: revisar la meta específica de cada una.',
  }
  return {
    categoria: 'incompleta', etiqueta: 'Respuesta incompleta (5% o menos)',
    conducta: 'Suele ser insuficiente para tratar las complicaciones. Obliga a cambiar el abordaje: intensificar el estilo de vida, cambiar de medicamento, combinar, o escalar a un medicamento de segunda generación. Una pérdida menor de 5% en los primeros 3 meses predice una reducción inadecuada a los 12 meses.',
  }
}

export const REGLA_3_MESES =
  'Evaluar la respuesta después de aproximadamente 3 meses EN LA DOSIS DE TRATAMIENTO. Si no se logró al menos 5% de reducción, la eficacia a largo plazo probablemente será insuficiente y hay que cambiar el abordaje. Quien logra 5% o más debe continuar. Con liraglutida, el mejor predictor fue una reducción de 4% o más a las 16 semanas.'

export const NOTA_DOSIS_MANTENIMIENTO =
  'La dosis óptima para MANTENER la pérdida de peso a largo plazo, balanceando eficacia y seguridad, NO necesita ser la dosis máxima aprobada. Dosis menores bien toleradas y seguras, sobre todo respecto a pérdida de músculo y hueso, pueden ser ventajosas.'

// ═══════════════════════════════════════════════════════════════════════════
// 4. FARMACOTERAPIA
// ═══════════════════════════════════════════════════════════════════════════

export interface FarmacoObesidad {
  nombre: string
  generacion: 1 | 2
  clase: string
  via: string
  inicio: string
  escalamiento: string
  maxima: string
  perdidaEsperada: string
  adversos: string
  contraindicaciones: string
  /** Fuerza de recomendación GRADE del documento TOS/OMA/OAC 2026. */
  grade: string
}

export const FARMACOS_OBESIDAD: FarmacoObesidad[] = [
  {
    nombre: 'Tirzepatida', generacion: 2, clase: 'Agonista dual de GIP y GLP-1', via: 'Subcutánea semanal',
    inicio: '2.5 mg por semana',
    escalamiento: 'Titular cada 4 semanas: 2.5 → 5 → 7.5 → 10 → 12.5 → 15 mg por semana.',
    maxima: '15 mg por semana',
    perdidaEsperada: '22.5% a las 72 semanas (SURMOUNT-1); casi 40% de los participantes perdió 25% o más del peso.',
    adversos: 'Náusea, diarrea, estreñimiento, dispepsia, vómito, dolor abdominal, cefalea, fatiga.',
    contraindicaciones: 'Antecedente personal o familiar de carcinoma medular de tiroides o MEN2. Enfermedad de la vesícula, pancreatitis, retinopatía diabética. Embarazo y lactancia.',
    grade: 'Recomendación FUERTE a favor, certeza moderada. Certeza ALTA para el cambio de peso.',
  },
  {
    nombre: 'Semaglutida', generacion: 2, clase: 'Agonista del receptor de GLP-1', via: 'Subcutánea semanal',
    inicio: '0.25 mg por semana',
    escalamiento: 'Titular cada 4 semanas: 0.25 → 0.5 → 1.0 → 1.7 → 2.4 mg por semana.',
    maxima: '2.4 mg por semana',
    perdidaEsperada: '16.9% a las 68 semanas (STEP 1); se mantuvo 16.7% a los 2 años (STEP 5).',
    adversos: 'Náusea, diarrea, estreñimiento, dispepsia, vómito, dolor abdominal, cefalea, fatiga.',
    contraindicaciones: 'Antecedente personal o familiar de carcinoma medular de tiroides o MEN2. Enfermedad de la vesícula, pancreatitis, retinopatía diabética. Embarazo y lactancia.',
    grade: 'Recomendación FUERTE a favor, certeza moderada. Es el ÚNICO fármaco de obesidad que ha demostrado reducir eventos cardiovasculares mayores en prevención secundaria en personas con obesidad SIN diabetes (SELECT: 20% de reducción).',
  },
  {
    nombre: 'Liraglutida', generacion: 1, clase: 'Agonista del receptor de GLP-1', via: 'Subcutánea diaria',
    inicio: '0.6 mg al día',
    escalamiento: 'Titular cada semana: 0.6 → 1.2 → 1.8 → 2.4 → 3.0 mg al día.',
    maxima: '3.0 mg al día',
    perdidaEsperada: '9.2% a las 56 semanas. En SCALE, 63.2% perdió 5% o más frente a 27.1% con placebo.',
    adversos: 'Náusea, diarrea, estreñimiento, dispepsia, vómito, dolor abdominal, reflujo.',
    contraindicaciones: 'Antecedente personal o familiar de carcinoma medular de tiroides o MEN2. Enfermedad de la vesícula, pancreatitis. Embarazo y lactancia.',
    grade: 'Recomendación CONDICIONAL a favor, certeza baja (certeza ALTA solo para el desenlace de perder 5% o más).',
  },
  {
    nombre: 'Fentermina/topiramato de liberación prolongada', generacion: 1, clase: 'Liberador de noradrenalina más modulación GABA', via: 'Oral',
    inicio: '3.75/23 mg cada mañana',
    escalamiento: 'Titular cada 2 semanas: 3.75/23 por 2 semanas → 7.5/46 por 12 semanas → 11.25/69 por 2 semanas → 15/92 mg.',
    maxima: '15/92 mg al día',
    perdidaEsperada: '9.6% a 9.9% a las 52 semanas, dependiente de la dosis.',
    adversos: 'Parestesias, mareo, disgeusia, insomnio, estreñimiento, boca seca, fatiga, visión borrosa, obnubilación mental, cambios del ánimo. El topiramato puede causar hipokalemia, acidosis metabólica y nefrolitiasis.',
    contraindicaciones: 'Embarazo (TERATOGENICIDAD conocida; tiene REMS obligatorio), lactancia, glaucoma de ángulo cerrado, hipertiroidismo, uso de IMAO, nefrolitiasis. Monitorizar frecuencia cardiaca y empeoramiento de ansiedad o depresión.',
    grade: 'Recomendación CONDICIONAL a favor, certeza baja.',
  },
  {
    nombre: 'Naltrexona/bupropión de liberación prolongada', generacion: 1, clase: 'Antagonista opioide más inhibidor de recaptura de dopamina y noradrenalina', via: 'Oral',
    inicio: '8/90 mg cada mañana',
    escalamiento: 'Titular cada semana: 1 tableta en la mañana → 1 tableta dos veces al día → 2 en la mañana y 1 en la noche → 2 tabletas dos veces al día.',
    maxima: '16/180 mg dos veces al día (naltrexona 32 mg / bupropión 360 mg)',
    perdidaEsperada: '4.2% a 5.2% a las 52 semanas. Quienes lograron 5% en los primeros 3 meses perdieron cerca de 12% en promedio.',
    adversos: 'Náusea, estreñimiento, cefalea, vómito, mareo, insomnio, boca seca, diarrea, ansiedad. Elevación ligera de presión arterial y frecuencia cardiaca.',
    contraindicaciones: 'Trastorno convulsivo, hipertensión no controlada, uso crónico de opioides, anorexia o bulimia nerviosa, uso de IMAO, supresión abrupta de alcohol o benzodiacepinas, glaucoma de ángulo cerrado, embarazo. Evitar con comidas grasosas. Precaución en mayores de 65 años. No recomendado en menores de 18.',
    grade: 'Recomendación FUERTE a favor, certeza moderada. Es el único con señal de reducción de muerte cardiovascular en el análisis GRADE (cerca de 4 menos por 1000).',
  },
  {
    nombre: 'Fentermina', generacion: 1, clase: 'Liberador de noradrenalina', via: 'Oral',
    inicio: '8 mg o 15 mg cada mañana',
    escalamiento: 'Titular hasta la dosis necesaria. Muchos pacientes responden con 8 mg tres veces al día.',
    maxima: '37.5 mg cada mañana',
    perdidaEsperada: '5% a 6% a las 28 semanas (5.45% a 7.7% en estudios de 12 a 28 semanas).',
    adversos: 'Inquietud, insomnio, cefalea, boca seca, taquicardia, elevación de la presión arterial.',
    contraindicaciones: 'Enfermedad cardiovascular (coronaria, arritmias, insuficiencia cardiaca, evento vascular cerebral), hipertensión no controlada, hipertiroidismo, glaucoma de ángulo cerrado, antecedente de trastorno por uso de sustancias, uso de IMAO, embarazo y lactancia.',
    grade: 'Recomendación CONDICIONAL a favor para uso de 3 meses o más, certeza baja. Está aprobada solo para uso a corto plazo; su uso prolongado es fuera de indicación.',
  },
  {
    nombre: 'Orlistat', generacion: 1, clase: 'Inhibidor de lipasa', via: 'Oral, con las comidas',
    inicio: '60 mg tres veces al día con los alimentos',
    escalamiento: 'Titular hasta la dosis necesaria; reducir la velocidad si hay efectos adversos.',
    maxima: '120 mg tres veces al día con los alimentos',
    perdidaEsperada: '4% a las 52 semanas. En XENDOS a 4 años redujo 37.3% el riesgo de diabetes tipo 2.',
    adversos: 'Flatulencia, urgencia fecal, evacuaciones oleosas, esteatorrea, especialmente tras comidas altas en grasa. Malabsorción de vitaminas liposolubles.',
    contraindicaciones: 'Colestasis, síndrome de malabsorción crónica, NEFROLITIASIS (cálculos de oxalato de calcio). Embarazo y lactancia, como todos los medicamentos para obesidad. Requiere suplemento de vitaminas A, D, E y K al acostarse o al menos 2 horas después de la dosis.',
    grade: 'Recomendación CONDICIONAL a favor, certeza baja.',
  },
]

/** Jerarquía de fármaco preferido según la complicación (Algoritmo 8 de AACE). */
export const PREFERIDO_POR_COMPLICACION: { complicacion: string; primera: string; segunda?: string; tercera?: string }[] = [
  { complicacion: 'Prediabetes, síndrome metabólico o prevención de diabetes', primera: 'Tirzepatida, semaglutida', segunda: 'Liraglutida, fentermina/topiramato', tercera: 'Orlistat' },
  { complicacion: 'Diabetes tipo 2', primera: 'Tirzepatida, semaglutida', segunda: 'Liraglutida, fentermina/topiramato', tercera: 'Orlistat, naltrexona/bupropión' },
  { complicacion: 'Prevención de eventos cardiovasculares mayores', primera: 'Semaglutida (liraglutida si hay diabetes tipo 2)' },
  { complicacion: 'Reducción de presión arterial', primera: 'Tirzepatida, semaglutida, fentermina/topiramato', segunda: 'Liraglutida, orlistat' },
  { complicacion: 'Enfermedad renal crónica', primera: 'Semaglutida, tirzepatida' },
  { complicacion: 'Insuficiencia cardiaca con fracción de expulsión preservada', primera: 'Semaglutida, tirzepatida' },
  { complicacion: 'MASH', primera: 'Semaglutida, tirzepatida' },
  { complicacion: 'Osteoartritis', primera: 'Semaglutida' },
  { complicacion: 'Apnea obstructiva del sueño', primera: 'Tirzepatida, fentermina/topiramato' },
]

export const ADVERTENCIA_EMBARAZO_OBESIDAD =
  'TODOS los medicamentos aprobados para obesidad están CONTRAINDICADOS en el embarazo y la lactancia. Debe prescribirse anticoncepción eficaz, con prueba de embarazo negativa antes de iniciar y monitoreo mensual. Con fentermina/topiramato, si ocurre embarazo debe suspenderse de inmediato.'

/** Ajustes obligados por comorbilidad (Algoritmo 10 de AACE). */
export const AJUSTES_POR_COMORBILIDAD = [
  { condicion: 'Nefrolitiasis', ajuste: 'Orlistat CONTRAINDICADO (cálculos de oxalato de calcio). Fentermina/topiramato CONTRAINDICADO (cálculos de fosfato de calcio).' },
  { condicion: 'Enfermedad renal crónica', ajuste: 'Fentermina/topiramato: no exceder 7.5/46 mg al día. Naltrexona/bupropión: no exceder 8/90 mg dos veces al día. Orlistat: vigilar nefropatía por oxalato. Con GLP-1, evitar vómito y depleción de volumen.' },
  { condicion: 'Insuficiencia hepatobiliar', ajuste: 'Fentermina: no exceder 8 mg al día. Fentermina/topiramato: no exceder 7.5/46 mg al día. Naltrexona/bupropión: no exceder 8/90 mg al día. Vigilar colelitiasis con todos.' },
  { condicion: 'Insuficiencia hepática severa', ajuste: 'Orlistat, fentermina, fentermina/topiramato y naltrexona/bupropión NO RECOMENDADOS.' },
  { condicion: 'Hipertensión no controlada', ajuste: 'Fentermina CONTRAINDICADA. Naltrexona/bupropión CONTRAINDICADO.' },
  { condicion: 'Enfermedad cardiovascular aterosclerótica', ajuste: 'Fentermina CONTRAINDICADA. Fentermina/topiramato con precaución vigilando frecuencia cardiaca y presión.' },
  { condicion: 'Trastorno alimentario restrictivo', ajuste: 'Contraindicación general para el uso de agonistas de GLP-1. Referir a especialista en trastornos alimentarios.' },
]

// ═══════════════════════════════════════════════════════════════════════════
// 5. CIRUGÍA
// ═══════════════════════════════════════════════════════════════════════════

export const CIRUGIA_BARIATRICA = {
  indicacionesClasicas: 'IMC ≥40, o IMC ≥35 con complicaciones relacionadas con la obesidad.',
  indicacionesActuales: 'La ASMBS y la IFSO ahora recomiendan cirugía bariátrica en adultos con IMC ≥35 INDEPENDIENTEMENTE de la presencia, ausencia o severidad de las complicaciones, y en adultos con IMC de 30 a 34.9 que tienen enfermedad cardiometabólica severa, como diabetes tipo 2 o enfermedad cardiovascular.',
  diabetes: 'Desde 2016, 45 sociedades internacionales sostienen que la cirugía metabólica debe considerarse con diabetes tipo 2 e IMC de 30 a 34.9 si la hiperglucemia está inadecuadamente controlada pese a tratamiento óptimo oral o inyectable.',
  procedimientos: 'Los más establecidos y eficaces: manga gástrica y bypass gástrico en Y de Roux (cerca del 90% de las operaciones a nivel mundial), y bypass gástrico de una anastomosis. También se realizan derivación biliopancreática con switch duodenal y banda gástrica ajustable, aunque la eficacia subóptima a largo plazo de la banda ha reducido mucho su uso.',
  combinacion: 'Debe combinarse con nutrición, actividad física y terapia conductual, con uso potencial de medicamentos para obesidad antes o después de la cirugía. El abordaje multidisciplinario perioperatorio y a largo plazo es obligatorio.',
  sinDatos: 'Los documentos consultados NO especifican los porcentajes de pérdida de peso esperada por tipo de procedimiento, ni el protocolo de suplementación posoperatoria con dosis, ni el calendario de seguimiento. AACE remite a las Guías de Práctica Clínica 2020 de soporte nutricional y metabólico perioperatorio (Mechanick JI et al., Obesity 2020;28(4):O1-O58).',
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. NUTRICIÓN Y EJERCICIO
// ═══════════════════════════════════════════════════════════════════════════

export const NUTRICION_OBESIDAD = {
  deficit: 'Cuando el estilo de vida es la única modalidad, las guías recomiendan convencionalmente un déficit de 500 a 750 kilocalorías al día, o ingestas estimadas de 1200 a 1500 kilocalorías diarias, calculadas a partir del gasto energético basal.',
  patron: 'NO hay una composición de macronutrientes conocida como superior a otra (mediterránea, DASH, baja en carbohidratos, basada en plantas). La intervención más efectiva depende de la capacidad del individuo de adherirse a largo plazo. Dicho eso, la reducción de riesgo cardiovascular a largo plazo solo se ha demostrado para la dieta mediterránea, y los datos de seguridad más allá de 2 a 3 años faltan para muchos de los otros planes.',
  proteina: 'Mantener al menos 1.2 g de proteína por kg de peso al día en la mayoría, y al menos 0.8 g/kg/día en quien tiene diabetes y enfermedad renal crónica sin diálisis. Ingestas de 2.3 g/kg/día o más pueden requerirse para maximizar la retención de masa magra, priorizando el entrenamiento de resistencia. El límite superior tolerable ronda 3.5 g/kg/día. Una alternativa práctica es fijar 80 a 120 g al día.',
  proteinaAdvertencia: 'Aumentar la proteína POR SÍ SOLA probablemente es inadecuado para preservar músculo EN AUSENCIA de entrenamiento estructurado de fuerza. El exceso de proteína por encima de las necesidades musculares puede convertirse en grasa y aumentar la adiposidad visceral.',
  micronutrientes: 'Con agonistas de GLP-1 la ingesta calórica baja 16% a 39%. Por debajo de 1200 kcal/día en mujeres y 1800 kcal/día en hombres hay riesgo de ingesta insuficiente de hierro, calcio, magnesio, zinc y vitaminas A, D, E, K, B1, B12 y C. Considerar suplementación proactiva de vitamina D, calcio, B12 o un multivitamínico.',
  senalesDeficiencia: 'Fatiga más allá de lo esperado, pérdida excesiva de cabello, descamación o comezón de la piel, debilidad muscular, cicatrización pobre de heridas y hematomas inusuales.',
}

export const EJERCICIO_OBESIDAD = {
  aerobico: 'Meta general de 150 minutos por semana de actividad aeróbica de intensidad moderada, repartidos en 3 o más días, o 75 minutos por semana de intensidad alta.',
  resistencia: 'Entrenamiento de resistencia de cuerpo completo al menos 2 a 3 días por semana. DEBE PRIORIZARSE, sobre todo junto con reducción de peso médica o quirúrgica intensiva, para mantener o mejorar la masa magra.',
  mantenimiento: 'Para MANTENER el peso perdido se requiere más volumen: 200 a 300 minutos semanales de ejercicio aeróbico de intensidad moderada, con prioridad en el entrenamiento de resistencia.',
  soloEjercicio: 'El ejercicio por sí solo produce una reducción de peso modesta (1% a 3%) o incluso neutralidad de peso, porque se compensa con mayor ingesta. Aun así mejora la sensibilidad a la insulina, la composición corporal, los factores de riesgo cardiometabólico y el bienestar, y ayuda a sostener la pérdida durante el mantenimiento.',
  practico: 'Empezar en la capacidad basal de la persona y subir despacio. Cualquier actividad es mejor que ninguna: una caminata corta a la hora de comer o pararse más seguido durante el día. Ejercicios en silla o en agua y referencia a terapia física para quien tiene limitación funcional significativa.',
  sueno: 'Dormir menos de 7 a 8 horas por noche y la mala calidad del sueño promueven ingesta desregulada, alteraciones metabólicas y obesidad. Tamizar apnea del sueño ante síntomas típicos o circunferencia de cuello mayor de 43 cm en hombres y 41 cm en mujeres.',
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. MASA MUSCULAR Y RECUPERACIÓN DE PESO
// ═══════════════════════════════════════════════════════════════════════════

export const MASA_MUSCULAR = {
  cuantoSePierde: 'En STEP 1, de 13.6 kg de reducción media, 8.3 kg (62%) fue masa grasa y 5.3 kg (38%) masa magra; como el músculo es cerca de la mitad de la masa magra, alrededor del 20% de la pérdida total fue músculo. El modelado sugiere que la pérdida muscular representa 10% a 15% del peso perdido en mujeres y 20% a 25% en hombres, en ausencia de entrenamiento de fuerza.',
  hueso: 'Una reducción de peso sustancial (15% o más) y rápida (en 3 a 4 meses) se asocia a pérdida ósea significativa. Un año de agonista de GLP-1 MÁS ejercicio preservó la densidad mineral ósea, mientras que el fármaco solo la disminuyó.',
  medicion: 'Bioimpedancia en el punto de atención; pletismografía por desplazamiento de aire en quien tiene marcapasos o dispositivos implantados; densitometría DXA es el estándar de oro, y puede considerarse anual o cada 2 años en quien toma agonistas de GLP-1.',
}

export const RECUPERACION_PESO = {
  cuanto: 'Al suspender un agonista de GLP-1 la recuperación de peso es común: HASTA DOS TERCIOS del peso perdido se recupera en el plazo de un año. Se ha observado incluso acompañado de consejería nutricional convencional o terapia conductual.',
  siSeContinua: 'Si el tratamiento se continúa, la reducción se sostiene al menos 4 años. En los estudios de re-aleatorización, continuar el medicamento resultó en cerca de 16 kg MENOS de peso que suspenderlo (certeza ALTA), con mejoría en calidad de vida.',
  recomendacion: 'El documento TOS/OMA/OAC 2026 emite una recomendación FUERTE a favor de CONTINUAR los medicamentos durante la fase de mantenimiento, frente a no continuarlos (certeza moderada).',
  adherenciaReal: 'La adherencia en ensayos es de 83% a 88% a las 66-68 semanas, pero en la práctica real baja a 33%-50% al año y 15% a los 2 años. La suspensión se asocia a edad de 65 años o más, respuesta pobre y efectos gastrointestinales moderados o severos.',
  siSeReinicia: 'Si el paciente suspende o pausa el tratamiento, necesitará REINICIAR a dosis baja y volver a titular para que el cuerpo se aclimate.',
}

/** Manejo práctico de los efectos gastrointestinales del GLP-1. */
export const EFECTOS_GI_GLP1 = {
  general: 'Los efectos gastrointestinales son los más comunes y ocurren sobre todo durante el escalamiento. En los ensayos se permitió permanecer en una dosis hasta 8 semanas para que se disiparan. Otra opción es mantener la dosis eficaz más baja y escalar solo cuando la reducción se detiene.',
  nausea: 'Es el más común y suele ocurrir en la mañana o tras periodos largos sin comer. Comidas pequeñas y frecuentes, evitar alimentos grasosos o muy altos en fibra los primeros días. Desayuno pequeño y luego comidas pequeñas cada 3 a 4 horas con líquidos adecuados. Té de jengibre o menta y bandas de acupresión pueden ayudar. La proclorperazina puede ser preferible al ondansetrón, que causa estreñimiento.',
  estrenimiento: 'Líquidos y fibra adecuados. Suplementación diaria de magnesio titulada hasta lograr evacuaciones regulares; el citrato de magnesio es efectivo y bien tolerado. Suplementos de fibra, polietilenglicol 3350 y ablandadores de heces para evitar el pujo.',
  diarrea: 'Evitar comidas grandes o altas en grasa. Cápsulas o polvos de fibra para dar volumen; antidiarreicos para alivio agudo.',
  alcohol: 'Puede empeorar la náusea y el reflujo con la terapia; debe minimizarse.',
}
