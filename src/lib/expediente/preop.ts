/**
 * MOTOR DE VALORACIÓN PREOPERATORIA
 *
 * Escalas y recomendaciones basadas en evidencia de alto nivel:
 *  - 2024 AHA/ACC/ACS/ASNC/HRS/SCA/SCCT/SCMR/SVM Guideline for Perioperative
 *    Cardiovascular Management for Noncardiac Surgery (J Am Coll Cardiol 2024;84:1869-1969)
 *  - Patel AY, Eagle KA, Vaishnava P. Cardiac Risk of Noncardiac Surgery.
 *    J Am Coll Cardiol 2015;66:2140-8
 *  - Lee TH et al. RCRI. Circulation 1999;100:1043-9
 *  - Hlatky MA et al. Duke Activity Status Index. Am J Cardiol 1989 (DASI)
 *  - Caprini JA. Risk assessment for VTE (2005 model)
 *
 * IMPORTANTE: solo se calculan de forma determinista las escalas con puntaje
 * exacto y verificable. Gupta MICA y NSQIP Surgical Risk Calculator usan
 * regresión propietaria → se enlaza a la calculadora oficial, no se fabrica.
 */

// ════════════════════════════════════════════════════════════════
// 1. RCRI — Revised Cardiac Risk Index (Lee Index)
// ════════════════════════════════════════════════════════════════

export interface RCRIInput {
  cirugiaAltoRiesgo: boolean      // intraperitoneal, intratorácica o vascular suprainguinal
  cardiopatiaIsquemica: boolean   // IAM previo, angina, ondas Q, prueba isquemia +, nitratos
  insuficienciaCardiaca: boolean  // historia de IC congestiva
  enfermedadCerebrovascular: boolean // EVC o AIT
  diabetesInsulina: boolean       // DM en tratamiento con insulina
  creatininaMayor2: boolean       // creatinina sérica > 2.0 mg/dL (177 µmol/L)
}

export interface RCRIResult {
  puntos: number
  clase: 'I' | 'II' | 'III' | 'IV'
  riesgoEstimadoLee: string       // 30-d major cardiac complications (Lee 1999)
  elevado: boolean                // umbral guía 2024: RCRI > 1
  interpretacion: string
}

const RCRI_LABELS: { key: keyof RCRIInput; label: string }[] = [
  { key: 'cirugiaAltoRiesgo',       label: 'Cirugía de alto riesgo (intraperitoneal, intratorácica o vascular suprainguinal)' },
  { key: 'cardiopatiaIsquemica',    label: 'Cardiopatía isquémica (IAM previo, angina, ondas Q, prueba de isquemia +, nitratos)' },
  { key: 'insuficienciaCardiaca',   label: 'Insuficiencia cardiaca congestiva (historia)' },
  { key: 'enfermedadCerebrovascular', label: 'Enfermedad cerebrovascular (EVC o AIT)' },
  { key: 'diabetesInsulina',        label: 'Diabetes mellitus en tratamiento con insulina' },
  { key: 'creatininaMayor2',        label: 'Creatinina sérica > 2.0 mg/dL (177 µmol/L)' },
]

export function rcriItems() { return RCRI_LABELS }

export function calcularRCRI(input: RCRIInput): RCRIResult {
  const puntos = Object.values(input).filter(Boolean).length
  let clase: RCRIResult['clase']
  let riesgo: string
  if (puntos === 0)      { clase = 'I';  riesgo = '≈ 0.4 %' }
  else if (puntos === 1) { clase = 'II'; riesgo = '≈ 0.9 %' }
  else if (puntos === 2) { clase = 'III'; riesgo = '≈ 6.6 %' }
  else                   { clase = 'IV'; riesgo = '≈ 11 %' }

  const elevado = puntos > 1 // umbral guía 2024 AHA/ACC (riesgo MACE > 1%)
  return {
    puntos, clase, riesgoEstimadoLee: riesgo, elevado,
    interpretacion: elevado
      ? `Riesgo cardiaco elevado. Conducta: evaluar la capacidad funcional (DASI). Si es menor a 4 METs en cirugía de riesgo elevado, solicitar BNP/NT-proBNP y troponina basal para afinar el riesgo; reservar pruebas no invasivas (ecocardiograma de estrés o SPECT) únicamente cuando su resultado cambiaría la conducta. Optimizar comorbilidades antes de la cirugía.`
      : `Riesgo cardiaco bajo. Conducta: puede proceder a cirugía sin estudios cardiacos adicionales si la capacidad funcional es adecuada.`,
  }
}

// ════════════════════════════════════════════════════════════════
// 2. DASI — Duke Activity Status Index (capacidad funcional)
//    Pesos exactos de la guía 2024 (Tabla 5) / Hlatky 1989
// ════════════════════════════════════════════════════════════════

export const DASI_ITEMS: { key: string; label: string; peso: number }[] = [
  { key: 'cuidadoPersonal', label: 'Cuidarse a sí mismo (comer, vestirse, bañarse, ir al baño)', peso: 2.75 },
  { key: 'caminarInterior', label: 'Caminar en interiores (en su casa)', peso: 1.75 },
  { key: 'caminarCuadras',  label: 'Caminar 1-2 cuadras en terreno plano', peso: 2.75 },
  { key: 'subirEscaleras',  label: 'Subir un piso de escaleras o una cuesta', peso: 5.5 },
  { key: 'correr',          label: 'Correr una distancia corta', peso: 8 },
  { key: 'trabajoLigero',   label: 'Trabajo ligero en casa (sacudir, lavar platos)', peso: 2.7 },
  { key: 'trabajoModerado', label: 'Trabajo moderado en casa (aspirar, barrer, cargar despensa)', peso: 3.5 },
  { key: 'trabajoPesado',   label: 'Trabajo pesado en casa (tallar pisos, mover muebles)', peso: 8 },
  { key: 'jardineria',      label: 'Jardinería (rastrillar, podar, podadora)', peso: 4.5 },
  { key: 'relacionesSexuales', label: 'Relaciones sexuales', peso: 5.25 },
  { key: 'recreativasModeradas', label: 'Recreación moderada (golf, bolos, baile, tenis dobles)', peso: 6 },
  { key: 'deportesExtenuantes',  label: 'Deportes extenuantes (natación, tenis individual, básquet, esquí)', peso: 7.5 },
]

export interface DASIResult {
  score: number              // 0 – 58.2
  vo2pico: number            // mL/kg/min (Hlatky: 0.43·DASI + 9.6)
  mets: number               // VO2 / 3.5
  metsAdecuados: boolean     // METs ≥ 4 (umbral clínico tradicional)
  dasiSobreUmbral: boolean   // DASI > 34 (umbral BASEL-PMI / Wijeysundera 2018)
  capacidadBaja: boolean     // alias = !metsAdecuados (compat con UI existente)
  interpretacion: string
}

export function calcularDASI(seleccionadas: Record<string, boolean>): DASIResult {
  const score = DASI_ITEMS.reduce((s, it) => s + (seleccionadas[it.key] ? it.peso : 0), 0)
  const vo2pico = 0.43 * score + 9.6
  const mets = vo2pico / 3.5
  const scoreRedondeado = Math.round(score * 10) / 10
  const metsRedondeado = Math.round(mets * 10) / 10

  // Dos umbrales DISTINTOS — no son equivalentes:
  //   · METs ≥ 4 = umbral clínico tradicional de capacidad adecuada
  //   · DASI > 34 = umbral derivado del estudio BASEL-PMI (Wijeysundera 2018):
  //     DASI ≤ 34 se asoció a mayor riesgo de muerte/IAM perioperatorio.
  // La interpretación principal usa METs (concuerda con el valor mostrado).
  // El umbral DASI ≤34 se reporta como marcador adicional de riesgo.
  const metsAdecuados   = metsRedondeado >= 4
  const dasiSobreUmbral = scoreRedondeado > 34
  const capacidadBaja   = !metsAdecuados

  let interpretacion: string
  if (metsAdecuados && dasiSobreUmbral) {
    interpretacion = `Capacidad funcional adecuada (≈ ${metsRedondeado} METs, ≥ 4) y DASI ${scoreRedondeado} sobre el umbral de 34. Conducta: generalmente puede proceder a cirugía sin pruebas cardiacas adicionales.`
  } else if (metsAdecuados && !dasiSobreUmbral) {
    interpretacion = `Capacidad funcional adecuada por METs (≈ ${metsRedondeado}, ≥ 4), pero DASI ${scoreRedondeado} ≤ 34 — umbral del estudio BASEL-PMI asociado a mayor riesgo perioperatorio. Conducta: en cirugía de riesgo elevado, considerar BNP/NT-proBNP y troponina basal para afinar la estratificación.`
  } else {
    interpretacion = `Capacidad funcional reducida (≈ ${metsRedondeado} METs, < 4). Conducta: en cirugía de riesgo elevado, solicitar BNP/NT-proBNP y troponina basal. Considerar ecocardiograma o prueba de estrés solo si el resultado modificaría el plan (revascularización, optimización o cambio de abordaje).`
  }

  return {
    score: scoreRedondeado,
    vo2pico: Math.round(vo2pico * 10) / 10,
    mets: metsRedondeado,
    metsAdecuados, dasiSobreUmbral, capacidadBaja,
    interpretacion,
  }
}

// ════════════════════════════════════════════════════════════════
// 3. CAPRINI — Riesgo de tromboembolia venosa (modelo 2005)
// ════════════════════════════════════════════════════════════════

export const CAPRINI_ITEMS: { key: string; label: string; peso: number }[] = [
  // 1 punto
  { key: 'edad41_60', label: 'Edad 41-60 años', peso: 1 },
  { key: 'cirugiaMenor', label: 'Cirugía menor', peso: 1 },
  { key: 'imcMayor25', label: 'IMC > 25 kg/m²', peso: 1 },
  { key: 'piernasHinchadas', label: 'Edema de miembros inferiores', peso: 1 },
  { key: 'varices', label: 'Venas varicosas', peso: 1 },
  { key: 'embarazoPosparto', label: 'Embarazo o posparto (< 1 mes)', peso: 1 },
  { key: 'anticonceptivosTRH', label: 'Anticonceptivos orales o terapia hormonal', peso: 1 },
  { key: 'sepsis', label: 'Sepsis (< 1 mes)', peso: 1 },
  { key: 'enfPulmonarGrave', label: 'Enfermedad pulmonar grave / neumonía (< 1 mes)', peso: 1 },
  { key: 'epoc', label: 'EPOC', peso: 1 },
  { key: 'iamReciente', label: 'Infarto agudo de miocardio', peso: 1 },
  { key: 'iccReciente', label: 'Insuficiencia cardiaca congestiva (< 1 mes)', peso: 1 },
  { key: 'reposoCama', label: 'Paciente médico en reposo en cama', peso: 1 },
  { key: 'eii', label: 'Antecedente de enfermedad inflamatoria intestinal', peso: 1 },
  // 2 puntos
  { key: 'edad61_74', label: 'Edad 61-74 años', peso: 2 },
  { key: 'cirugiaMayor', label: 'Cirugía mayor abierta o laparoscópica (> 45 min)', peso: 2 },
  { key: 'artroscopia', label: 'Cirugía artroscópica', peso: 2 },
  { key: 'malignidad', label: 'Neoplasia maligna (actual o previa)', peso: 2 },
  { key: 'confinadoCama72', label: 'Confinado a cama > 72 horas', peso: 2 },
  { key: 'yesoInmovilizador', label: 'Inmovilización con férula/yeso (< 1 mes)', peso: 2 },
  { key: 'accesoVenosoCentral', label: 'Catéter venoso central', peso: 2 },
  // 3 puntos
  { key: 'edad75', label: 'Edad ≥ 75 años', peso: 3 },
  { key: 'antecedenteTVP', label: 'Antecedente de TVP/TEP', peso: 3 },
  { key: 'historiaFamiliarTVP', label: 'Historia familiar de trombosis', peso: 3 },
  { key: 'trombofilia', label: 'Trombofilia (Factor V Leiden, protrombina 20210A, anticoagulante lúpico, anticardiolipina, homocisteína elevada, TIH)', peso: 3 },
  // 5 puntos
  { key: 'evcReciente', label: 'EVC (< 1 mes)', peso: 5 },
  { key: 'artroplastiaElectiva', label: 'Artroplastia electiva mayor', peso: 5 },
  { key: 'fracturaCadera', label: 'Fractura de cadera, pelvis o pierna', peso: 5 },
  { key: 'lesionMedular', label: 'Lesión medular aguda (< 1 mes)', peso: 5 },
  { key: 'politraumatismo', label: 'Politraumatismo (< 1 mes)', peso: 5 },
]

export interface CapriniResult {
  puntos: number
  nivel: 'Muy bajo' | 'Bajo' | 'Moderado' | 'Alto'
  profilaxisSugerida: string
}

export function calcularCaprini(sel: Record<string, boolean>): CapriniResult {
  const puntos = CAPRINI_ITEMS.reduce((s, it) => s + (sel[it.key] ? it.peso : 0), 0)
  let nivel: CapriniResult['nivel']
  let profilaxis: string
  if (puntos === 0)      { nivel = 'Muy bajo'; profilaxis = 'Deambulación temprana. No requiere profilaxis farmacológica de rutina.' }
  else if (puntos <= 2)  { nivel = 'Bajo';     profilaxis = 'Profilaxis mecánica (medias de compresión / compresión neumática intermitente).' }
  else if (puntos <= 4)  { nivel = 'Moderado'; profilaxis = 'Profilaxis farmacológica (HBPM o heparina no fraccionada) o mecánica, según riesgo de sangrado.' }
  else                   { nivel = 'Alto';     profilaxis = 'Profilaxis farmacológica (HBPM) + mecánica. Considerar duración extendida en cirugía oncológica/ortopédica mayor.' }
  return { puntos, nivel, profilaxisSugerida: profilaxis }
}

// ════════════════════════════════════════════════════════════════
// 3b. STOP-BANG — Riesgo de apnea obstructiva del sueño (AOS)
//     Chung F et al. Anesthesiology 2008 / Br J Anaesth 2012
// ════════════════════════════════════════════════════════════════

export const STOPBANG_ITEMS: { key: string; label: string }[] = [
  { key: 'snoring',     label: 'Ronquido fuerte (S - Snoring): más fuerte que hablar o se oye tras puertas cerradas' },
  { key: 'tiredness',   label: 'Cansancio diurno (T - Tiredness): somnolencia/fatiga frecuente durante el día' },
  { key: 'observed',    label: 'Apnea observada (O - Observed): alguien ha visto que deja de respirar al dormir' },
  { key: 'pressure',    label: 'Presión (P - Pressure): hipertensión arterial o en tratamiento' },
  { key: 'bmi35',       label: 'IMC > 35 kg/m² (B - BMI)' },
  { key: 'age50',       label: 'Edad > 50 años (A - Age)' },
  { key: 'neck40',      label: 'Circunferencia de cuello > 40 cm (N - Neck)' },
  { key: 'genderMale',  label: 'Sexo masculino (G - Gender)' },
]

export interface StopBangResult {
  puntos: number
  nivel: 'Bajo' | 'Intermedio' | 'Alto'
  interpretacion: string
}

export function calcularStopBang(sel: Record<string, boolean>): StopBangResult {
  const puntos = STOPBANG_ITEMS.filter(i => sel[i.key]).length
  let nivel: StopBangResult['nivel']
  if (puntos <= 2) nivel = 'Bajo'
  else if (puntos <= 4) nivel = 'Intermedio'
  else nivel = 'Alto'
  return {
    puntos, nivel,
    interpretacion: nivel === 'Alto'
      ? 'Alta probabilidad de apnea del sueño moderada-grave. Conducta: si la cirugía es electiva, considerar polisomnografía y valoración por neumología/medicina del sueño; precauciones de vía aérea, minimizar opioides y sedantes, monitorización con oximetría continua posoperatoria y continuar CPAP si ya lo usa.'
      : nivel === 'Intermedio'
        ? 'Probabilidad intermedia de apnea del sueño. Conducta: extremar precauciones perioperatorias (limitar sedantes/opioides, oximetría posoperatoria) y valorar estudio del sueño según el contexto.'
        : 'Baja probabilidad de apnea del sueño. Conducta: manejo perioperatorio habitual.',
  }
}

// ════════════════════════════════════════════════════════════════
// 3c. ARISCAT — Riesgo de complicaciones pulmonares posoperatorias
//     Canet J et al. Anesthesiology 2010
// ════════════════════════════════════════════════════════════════

export interface AriscatInput {
  edad: number
  spo2: number                 // % aire ambiente
  infeccionRespiratoria: boolean // último mes
  anemia: boolean              // Hb ≤ 10 g/dL
  incision: '' | 'periferica' | 'abdominal_alta' | 'intratoracica'
  duracion: '' | 'menos2h' | 'de2a3h' | 'mas3h'
  emergencia: boolean
}

export interface AriscatResult {
  puntos: number
  nivel: 'Bajo' | 'Intermedio' | 'Alto'
  riesgoEstimado: string
  conducta: string
}

export function calcularAriscat(i: AriscatInput): AriscatResult {
  let p = 0
  // Edad
  if (i.edad > 80) p += 16
  else if (i.edad >= 51) p += 3
  // SpO2
  if (i.spo2 > 0 && i.spo2 <= 90) p += 24
  else if (i.spo2 >= 91 && i.spo2 <= 95) p += 8
  // Infección respiratoria último mes
  if (i.infeccionRespiratoria) p += 17
  // Anemia (Hb ≤ 10)
  if (i.anemia) p += 11
  // Incisión quirúrgica
  if (i.incision === 'abdominal_alta') p += 15
  else if (i.incision === 'intratoracica') p += 24
  // Duración
  if (i.duracion === 'de2a3h') p += 16
  else if (i.duracion === 'mas3h') p += 23
  // Emergencia
  if (i.emergencia) p += 8

  let nivel: AriscatResult['nivel']
  let riesgo: string
  if (p < 26)      { nivel = 'Bajo';       riesgo = '≈ 1.6 %' }
  else if (p < 45) { nivel = 'Intermedio'; riesgo = '≈ 13.3 %' }
  else             { nivel = 'Alto';       riesgo = '≈ 42.1 %' }
  const conducta = nivel === 'Bajo'
    ? 'Manejo respiratorio habitual.'
    : 'Optimización pulmonar preoperatoria (suspender tabaco, tratar infección/broncoespasmo, fisioterapia respiratoria e inspirometría incentiva), corregir anemia si aplica, técnica anestésica protectora (ventilación protectora, evitar bloqueo neuromuscular residual) y vigilancia respiratoria posoperatoria.'
  return { puntos: p, nivel, riesgoEstimado: riesgo, conducta }
}

// ════════════════════════════════════════════════════════════════
// 3d. CHA₂DS₂-VASc — Riesgo tromboembólico en fibrilación auricular
//     Lip GYH et al. Chest 2010
// ════════════════════════════════════════════════════════════════

export const CHADSVASC_ITEMS: { key: string; label: string; peso: number }[] = [
  { key: 'icc',         label: 'Insuficiencia cardiaca / disfunción ventricular (C)', peso: 1 },
  { key: 'hta',         label: 'Hipertensión arterial (H)', peso: 1 },
  { key: 'edad75',      label: 'Edad ≥ 75 años (A₂)', peso: 2 },
  { key: 'diabetes',    label: 'Diabetes mellitus (D)', peso: 1 },
  { key: 'evcPrevia',   label: 'EVC / AIT / tromboembolia previa (S₂)', peso: 2 },
  { key: 'enfVascular', label: 'Enfermedad vascular (IAM, EAP, placa aórtica) (V)', peso: 1 },
  { key: 'edad65_74',   label: 'Edad 65-74 años (A)', peso: 1 },
  { key: 'sexoFemenino', label: 'Sexo femenino (Sc)', peso: 1 },
]

export interface ChadsVascResult {
  puntos: number
  interpretacion: string
}

export function calcularChadsVasc(sel: Record<string, boolean>): ChadsVascResult {
  // Edad ≥75 (2 pts) tiene prioridad sobre 65-74 (1 pt)
  let puntos = 0
  for (const it of CHADSVASC_ITEMS) {
    if (it.key === 'edad65_74' && sel['edad75']) continue
    if (sel[it.key]) puntos += it.peso
  }
  const interpretacion = puntos >= 2
    ? 'Riesgo tromboembólico alto: justifica anticoagulación oral en fibrilación auricular. Conducta perioperatoria: el riesgo trombótico NO obliga a puenteo salvo riesgo muy alto (válvula mecánica mitral, EVC reciente); en la mayoría de pacientes con FA se suspende el anticoagulante sin puente. Reiniciar lo antes posible tras hemostasia.'
    : puntos === 1
      ? 'Riesgo intermedio: individualizar la anticoagulación. Conducta: suspensión perioperatoria simple sin puenteo.'
      : 'Riesgo bajo: generalmente no requiere anticoagulación crónica.'
  return { puntos, interpretacion }
}

// ════════════════════════════════════════════════════════════════
// 3e. HAS-BLED — Riesgo de sangrado con anticoagulación
//     Pisters R et al. Chest 2010
// ════════════════════════════════════════════════════════════════

export const HASBLED_ITEMS: { key: string; label: string }[] = [
  { key: 'htaNoControlada', label: 'Hipertensión no controlada (TAS > 160 mmHg) (H)' },
  { key: 'renalAnormal',    label: 'Función renal anormal (diálisis, trasplante, creatinina > 2.26 mg/dL) (A)' },
  { key: 'hepaticaAnormal', label: 'Función hepática anormal (cirrosis, bilirrubina >2x, transaminasas >3x) (A)' },
  { key: 'evc',             label: 'EVC previo (S)' },
  { key: 'sangradoPrevio',  label: 'Sangrado previo o predisposición (anemia) (B)' },
  { key: 'inrLabil',        label: 'INR lábil (TRT < 60%) (L)' },
  { key: 'edad65',          label: 'Edad > 65 años (E)' },
  { key: 'farmacos',        label: 'Fármacos que aumentan sangrado (antiplaquetarios, AINE) (D)' },
  { key: 'alcohol',         label: 'Consumo de alcohol ≥ 8 bebidas/semana (D)' },
]

export interface HasBledResult {
  puntos: number
  nivel: 'Bajo' | 'Alto'
  interpretacion: string
}

export function calcularHasBled(sel: Record<string, boolean>): HasBledResult {
  const puntos = HASBLED_ITEMS.filter(i => sel[i.key]).length
  const nivel: HasBledResult['nivel'] = puntos >= 3 ? 'Alto' : 'Bajo'
  return {
    puntos, nivel,
    interpretacion: nivel === 'Alto'
      ? 'Riesgo de sangrado alto. Importante: NO contraindica anticoagular; identifica al paciente que requiere vigilancia estrecha. Conducta: corregir factores modificables (controlar TA, estabilizar INR, evitar AINE y alcohol), extremar la hemostasia y planear con cuidado el momento de suspender/reiniciar el anticoagulante.'
      : 'Riesgo de sangrado bajo. Conducta: corregir de todos modos los factores modificables.',
  }
}

// ════════════════════════════════════════════════════════════════
// 4. MOTOR DE RECOMENDACIONES (2024 AHA/ACC)
//    Cada recomendación cita su clase (COR) y nivel de evidencia (LOE)
// ════════════════════════════════════════════════════════════════

export type CategoriaRec =
  | 'Medicamentos' | 'Biomarcadores' | 'Tiempos' | 'Pruebas' | 'Tromboprofilaxis' | 'General'

export interface Recomendacion {
  categoria: CategoriaRec
  texto: string
  cor?: string       // Clase de recomendación (I, IIa, IIb, III)
  loe?: string       // Nivel de evidencia (A, B-R, B-NR, C-LD, C-EO)
  fuente: string
}

export interface PreopContexto {
  // Comorbilidades / situación
  cardiopatiaIsquemica: boolean
  insuficienciaCardiacaFErEF: boolean
  hipertension: boolean
  diabetes: boolean
  edad: number
  cirugiaRiesgoElevado: boolean      // riesgo MACE > 1%
  cirugiaElectiva: boolean
  // Antecedentes de revascularización
  stentDES: boolean
  stentDESMotivo?: 'SCA' | 'cronico'
  mesesDesdeStent?: number
  iamReciente: boolean
  mesesDesdeIAM?: number
  // Medicamentos actuales (para recomendaciones de manejo)
  tomaBetabloqueador: boolean
  tomaIECAoARA: boolean
  tomaEstatina: boolean
  tomaSGLT2: boolean
  tomaGLP1: boolean
  glp1Semanal?: boolean
  tomaAspirina: boolean
  pciPrevia: boolean
  tomaAnticoagulante: boolean
  tipoAnticoagulante?: 'DOAC' | 'warfarina'
  valvulaMecanicaMitral: boolean
}

const G2024 = '2024 AHA/ACC Perioperative Guideline (JACC 2024;84:1869-1969)'

export function generarRecomendaciones(c: PreopContexto): Recomendacion[] {
  const recs: Recomendacion[] = []

  // ── Estatinas ──
  if (c.tomaEstatina) {
    recs.push({ categoria: 'Medicamentos', cor: 'I', loe: 'B-R', fuente: G2024,
      texto: 'CONTINUAR la estatina durante todo el periodo perioperatorio (reduce MACE).' })
  } else if (c.cardiopatiaIsquemica || c.cirugiaRiesgoElevado) {
    recs.push({ categoria: 'Medicamentos', cor: 'IIa', loe: 'B-R', fuente: G2024,
      texto: 'Considerar INICIAR estatina (especialmente en enfermedad aterosclerótica / cirugía vascular).' })
  }

  // ── Betabloqueadores ──
  if (c.tomaBetabloqueador) {
    recs.push({ categoria: 'Medicamentos', cor: 'I', loe: 'B-NR', fuente: G2024,
      texto: 'CONTINUAR el betabloqueador en dosis estable durante el perioperatorio. NO suspender abruptamente (riesgo de rebote).' })
  } else {
    recs.push({ categoria: 'Medicamentos', cor: '3: Daño', loe: 'B-R', fuente: G2024,
      texto: 'NO iniciar betabloqueador el día de la cirugía (aumenta mortalidad). Si hay nueva indicación, iniciar idealmente > 7 días antes para titular.' })
  }

  // ── IECA / ARA-II (RAASi) ──
  if (c.tomaIECAoARA) {
    if (c.insuficienciaCardiacaFErEF) {
      recs.push({ categoria: 'Medicamentos', cor: 'IIa', loe: 'C-EO', fuente: G2024,
        texto: 'IECA/ARA-II por ICFEr: es razonable CONTINUAR en el perioperatorio.' })
    } else if (c.hipertension && c.cirugiaRiesgoElevado) {
      recs.push({ categoria: 'Medicamentos', cor: 'IIb', loe: 'B-R', fuente: G2024,
        texto: 'IECA/ARA-II por HTA (TA controlada) + cirugía de riesgo elevado: considerar OMITIR la dosis 24 h antes para limitar hipotensión intraoperatoria. Reiniciar posoperatorio cuando sea clínicamente factible.' })
    } else {
      recs.push({ categoria: 'Medicamentos', fuente: G2024,
        texto: 'IECA/ARA-II: decisión individualizada de continuar vs omitir 24 h antes (vigilar hipotensión intraoperatoria).' })
    }
  }

  // ── SGLT2i ──
  if (c.tomaSGLT2) {
    recs.push({ categoria: 'Medicamentos', cor: 'I', loe: 'B-NR', fuente: G2024,
      texto: 'SUSPENDER iSGLT2 3-4 días antes de cirugía electiva (canagliflozina/dapagliflozina/empagliflozina ≥ 3 días; ertugliflozina ≥ 4 días) para reducir riesgo de cetoacidosis euglucémica.' })
  }

  // ── GLP-1 ──
  if (c.tomaGLP1) {
    recs.push({ categoria: 'Medicamentos', loe: 'C-LD', fuente: G2024,
      texto: c.glp1Semanal
        ? 'Agonista GLP-1 de dosis SEMANAL: suspender > 1 semana antes de cirugía electiva (riesgo de retraso del vaciamiento gástrico / broncoaspiración).'
        : 'Agonista GLP-1 de dosis DIARIA: omitir la dosis del día previo a la cirugía.' })
  }

  // ── Aspirina / antiagregación ──
  if (c.pciPrevia) {
    recs.push({ categoria: 'Medicamentos', cor: 'I', loe: 'B-R', fuente: G2024,
      texto: 'Con PCI previa: CONTINUAR aspirina 75-100 mg si es posible (reduce eventos cardiacos).' })
  } else if (c.tomaAspirina) {
    recs.push({ categoria: 'Medicamentos', cor: 'IIb', loe: 'B-R', fuente: G2024,
      texto: 'Sin PCI previa: continuar aspirina solo en seleccionados (riesgo cardiaco > riesgo de sangrado). No iniciar de rutina (sin beneficio, más sangrado).' })
  }

  // ── Tiempos tras stent / IAM ──
  if (c.stentDES && typeof c.mesesDesdeStent === 'number') {
    const m = c.mesesDesdeStent
    if (m < 1) {
      recs.push({ categoria: 'Tiempos', cor: '3: Daño', loe: 'B-NR', fuente: G2024,
        texto: `Stent ≤ 30 días: cirugía electiva que requiera suspender antiagregante es POTENCIALMENTE DAÑINA (alto riesgo de trombosis del stent). Diferir.` })
    } else if (c.stentDESMotivo === 'SCA' && m < 12) {
      recs.push({ categoria: 'Tiempos', cor: 'I', loe: 'B-NR', fuente: G2024,
        texto: `DES por SCA: diferir cirugía electiva ≥ 12 meses si requiere interrumpir antiagregante (actual: ${m} meses).` })
    } else if (c.stentDESMotivo === 'cronico' && m < 6) {
      recs.push({ categoria: 'Tiempos', cor: 'IIa', loe: 'B-NR', fuente: G2024,
        texto: `DES por enfermedad coronaria crónica: razonable diferir ≥ 6 meses (actual: ${m} meses). Si es tiempo-sensible, considerar ≥ 3 meses.` })
    } else {
      recs.push({ categoria: 'Tiempos', fuente: G2024,
        texto: `Tiempo desde stent (${m} meses) cumple el intervalo recomendado.` })
    }
  }
  if (c.iamReciente && typeof c.mesesDesdeIAM === 'number' && c.mesesDesdeIAM < 2) {
    recs.push({ categoria: 'Tiempos', fuente: 'Patel 2015 (JACC) / ACC-AHA',
      texto: `IAM/SCA reciente (${c.mesesDesdeIAM} meses): se recomienda intervalo ≥ 60 días antes de cirugía electiva no cardiaca.` })
  }

  // ── Anticoagulantes / bridging ──
  if (c.tomaAnticoagulante) {
    if (c.tipoAnticoagulante === 'DOAC') {
      recs.push({ categoria: 'Medicamentos', fuente: G2024,
        texto: 'DOAC: suspender según riesgo de sangrado del procedimiento (bajo/moderado ~1 día; alto ~2 días antes) y ajustar por función renal (especialmente dabigatrán). Reiniciar tras hemostasia.' })
    } else if (c.tipoAnticoagulante === 'warfarina') {
      recs.push({ categoria: 'Medicamentos', fuente: G2024,
        texto: 'Warfarina (VKA): suspender ~5 días antes; reiniciar 12-24 h posoperatorio tras hemostasia en procedimientos de bajo/moderado riesgo.' })
    }
    if (c.valvulaMecanicaMitral) {
      recs.push({ categoria: 'Tromboprofilaxis', fuente: G2024,
        texto: 'Puente (bridging) con anticoagulación parenteral: LIMITAR a riesgo trombótico muy alto (p. ej. válvula mecánica MITRAL). En FA, el ensayo BRIDGE mostró que el puenteo NO es superior y aumenta sangrado.' })
    } else {
      recs.push({ categoria: 'Tromboprofilaxis', fuente: G2024,
        texto: 'La mayoría de pacientes (p. ej. FA) NO se benefician del puenteo (BRIDGE): no bridging fue no inferior y con menos sangrado. Reservar bridging para riesgo trombótico muy alto.' })
    }
  }

  // ── Biomarcadores ──
  const candidatoBiomarcador = c.cirugiaRiesgoElevado &&
    (c.edad >= 65 || (c.edad >= 45 && (c.cardiopatiaIsquemica || c.insuficienciaCardiacaFErEF)))
  if (candidatoBiomarcador) {
    recs.push({ categoria: 'Biomarcadores', cor: 'IIa', loe: 'B-NR', fuente: G2024,
      texto: 'Medir BNP o NT-proBNP ANTES de la cirugía de riesgo elevado para complementar la evaluación de riesgo. Umbrales de anormalidad: BNP > 92 ng/L; NT-proBNP ≥ 300 ng/L.' })
    recs.push({ categoria: 'Biomarcadores', cor: 'IIb', loe: 'B-NR', fuente: G2024,
      texto: 'Considerar troponina cardiaca basal preoperatoria (umbral: > percentil 99 del ensayo).' })
    recs.push({ categoria: 'Biomarcadores', cor: 'IIb', loe: 'B-NR', fuente: G2024,
      texto: 'Considerar medir troponina a las 24 y 48 h posoperatorias para detectar lesión miocárdica (MINS).' })
  }

  // ── Pruebas / generales ──
  if (c.cirugiaRiesgoElevado) {
    recs.push({ categoria: 'Pruebas', cor: 'IIa', loe: 'B-NR', fuente: G2024,
      texto: 'Evaluación estructurada de capacidad funcional (DASI). Pruebas de estrés solo si los resultados cambiarían el manejo.' })
    recs.push({ categoria: 'General', fuente: G2024 + ' / CARP trial',
      texto: 'NO se recomienda revascularización coronaria profiláctica con el único fin de reducir eventos perioperatorios.' })
  }
  if (c.cardiopatiaIsquemica) {
    recs.push({ categoria: 'Pruebas', cor: 'IIa', fuente: G2024,
      texto: 'ECG de 12 derivaciones preoperatorio razonable en cardiopatía conocida (excepto cirugía de bajo riesgo).' })
  }

  return recs
}
