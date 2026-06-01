/**
 * Diccionario médico conservador.
 *
 * Solo corrige cuando la confianza es ALTA (forma exacta esperada). En cualquier
 * otro caso devuelve sugerencia + needs_review para que el médico valide.
 *
 * NUNCA cambia una palabra por otra de significado distinto sin evidencia clara.
 */

/* ─── Catálogos (subset clínicamente común — extensible) ──────────── */

export const ENF_CRONICAS = [
  'diabetes mellitus tipo 2', 'hipertensión arterial sistémica', 'enfermedad renal crónica',
  'insuficiencia cardiaca', 'cardiopatía isquémica', 'EPOC', 'asma', 'cirrosis',
  'hipotiroidismo', 'hipertiroidismo', 'lupus', 'artritis reumatoide', 'cáncer',
  'VIH', 'tuberculosis', 'obesidad',
] as const

export const SINTOMAS = [
  'fiebre', 'escalofríos', 'tos', 'disnea', 'dolor torácico', 'dolor abdominal',
  'diarrea', 'náusea', 'vómito', 'disuria', 'polaquiuria', 'hematuria', 'cefalea',
  'mareo', 'síncope', 'pérdida de peso', 'astenia', 'adinamia',
] as const

export const MEDICAMENTOS = [
  'losartán', 'telmisartán', 'amlodipino', 'metoprolol', 'carvedilol',
  'atorvastatina', 'rosuvastatina', 'aspirina', 'clopidogrel', 'warfarina',
  'rivaroxabán', 'apixabán', 'metformina', 'dapagliflozina', 'empagliflozina',
  'sitagliptina', 'linagliptina', 'insulina', 'levotiroxina',
  'omeprazol', 'pantoprazol', 'prednisona', 'deflazacort',
  'metotrexato', 'leflunomida', 'micofenolato', 'rituximab',
] as const

export const ANTIBIOTICOS = [
  'amoxicilina', 'amoxicilina/clavulanato', 'cefalexina', 'ceftriaxona', 'cefepime',
  'piperacilina/tazobactam', 'meropenem', 'ertapenem', 'vancomicina', 'linezolid',
  'daptomicina', 'clindamicina', 'metronidazol', 'ciprofloxacino', 'levofloxacino',
  'trimetoprim/sulfametoxazol', 'nitrofurantoína', 'fosfomicina',
  'fluconazol', 'voriconazol', 'aciclovir', 'valaciclovir', 'oseltamivir',
] as const

export const ABREVIATURAS: Record<string, string> = {
  DM2: 'diabetes mellitus tipo 2', HAS: 'hipertensión arterial sistémica',
  ERC: 'enfermedad renal crónica', EPOC: 'enfermedad pulmonar obstructiva crónica',
  IVU: 'infección de vías urinarias', IAM: 'infarto agudo de miocardio',
  EVC: 'enfermedad vascular cerebral', FA: 'fibrilación auricular',
  FC: 'frecuencia cardiaca', FR: 'frecuencia respiratoria',
  TA: 'tensión arterial', SatO2: 'saturación de oxígeno',
  IMC: 'índice de masa corporal', HbA1c: 'hemoglobina glucosilada',
  PCR: 'proteína C reactiva', VSG: 'velocidad de sedimentación globular',
  TSH: 'hormona estimulante de tiroides', T4L: 'tiroxina libre',
}

/* Datos críticos que SIEMPRE requieren revisión humana */
export const FARMACOS_CRITICOS = [
  'warfarina', 'rivaroxabán', 'apixabán', 'dabigatrán', 'enoxaparina', 'heparina',
  'insulina', 'metotrexato', 'micofenolato', 'rituximab', 'prednisona',
  'morfina', 'tramadol', 'oxicodona', 'fentanilo', 'codeína',
  'diazepam', 'alprazolam', 'clonazepam', 'lorazepam',
]

/* Familias de antibióticos beta-lactámicos para validación cruzada con alergia */
export const FAMILIA_BETALACTAMICOS = [
  'penicilina', 'amoxicilina', 'ampicilina', 'dicloxacilina', 'oxacilina',
  'cefalexina', 'ceftriaxona', 'cefepime', 'cefuroxima', 'cefotaxima',
  'piperacilina', 'meropenem', 'imipenem', 'ertapenem',
]

/* ─── Normalización conservadora ─────────────────────────────────── */

export interface NormalizacionResult {
  original: string
  suggested: string
  confidence: 'alta' | 'media' | 'baja'
  needs_review: boolean
}

const CORRECCIONES_ALTA_CONFIANZA: Record<string, string> = {
  // typos comunes, solo cambios de acento/ortografía no de significado
  'losartan':    'losartán',
  'telmisartan': 'telmisartán',
  'cefriaxona':  'ceftriaxona',
  'ceftriazona': 'ceftriaxona',
  'meropenen':   'meropenem',
  'omeprasol':   'omeprazol',
  'metformine':  'metformina',
  'aciclovir':   'aciclovir',
  'tuberculose': 'tuberculosis',
}

/** Devuelve sugerencia ortográfica. Solo cambia con confianza alta. */
export function normalizarTermino(term: string): NormalizacionResult {
  const orig = term.trim()
  const low = orig.toLowerCase()

  // Abreviatura conocida
  const abrev = ABREVIATURAS[orig.toUpperCase()]
  if (abrev) return { original: orig, suggested: abrev, confidence: 'alta', needs_review: false }

  // Corrección alta confianza
  if (CORRECCIONES_ALTA_CONFIANZA[low]) {
    return { original: orig, suggested: CORRECCIONES_ALTA_CONFIANZA[low], confidence: 'alta', needs_review: false }
  }

  // Coincidencia exacta con catálogo conocido
  const allKnown = [...MEDICAMENTOS, ...ANTIBIOTICOS, ...ENF_CRONICAS, ...SINTOMAS]
  if (allKnown.some(k => k.toLowerCase() === low)) {
    return { original: orig, suggested: orig, confidence: 'alta', needs_review: false }
  }

  // No reconocido — sin sugerencia para evitar cambiar por algo incorrecto
  return { original: orig, suggested: orig, confidence: 'baja', needs_review: true }
}

/* ─── Validaciones clínicas cruzadas ─────────────────────────────── */

export interface AlertaClinica {
  severidad: 'info' | 'advertencia' | 'critica'
  mensaje: string
  campos: string[]
}

interface Allergeno { alergeno?: string; reaccion?: string }
interface MedItem { nombre?: string; dosis?: string }

/** Detecta interacciones graves entre alergias y medicamentos prescritos. */
export function validarAlergiasVsMedicamentos(
  alergias: Allergeno[],
  medicamentos: MedItem[],
): AlertaClinica[] {
  const alertas: AlertaClinica[] = []
  const alergiasLow = alergias.map(a => (a.alergeno ?? '').toLowerCase())

  for (const med of medicamentos) {
    const nom = (med.nombre ?? '').toLowerCase()
    if (!nom) continue

    // Alergia a penicilina + betalactámico
    const alergicoBetalactamico = alergiasLow.some(a =>
      FAMILIA_BETALACTAMICOS.some(f => a.includes(f) || a.includes('beta'))
    )
    const esBetalactamico = FAMILIA_BETALACTAMICOS.some(f => nom.includes(f))
    if (alergicoBetalactamico && esBetalactamico) {
      alertas.push({
        severidad: 'critica',
        mensaje: `Paciente con alergia documentada a beta-lactámicos y se prescribe ${med.nombre}. Reacción cruzada posible — verificar.`,
        campos: ['alergias', 'medicamentos'],
      })
    }

    // AINE + alergia a AINE
    if (alergiasLow.some(a => a.includes('aine') || a.includes('aspirin'))) {
      const esAine = /ibuprofen|naproxen|aspir|ketorol|diclofen|paracetam/.test(nom)
      if (esAine) {
        alertas.push({
          severidad: 'critica',
          mensaje: `Posible alergia a AINE y se prescribe ${med.nombre}. Revisar.`,
          campos: ['alergias', 'medicamentos'],
        })
      }
    }
  }
  return alertas
}

/** Detecta prescripciones que requieren ajuste por función renal/embarazo/anticoagulación. */
export function validacionesGeneralesMedicamentos(
  medicamentos: MedItem[],
  contexto: { embarazo?: boolean; erc?: boolean; anticoagulado?: boolean },
): AlertaClinica[] {
  const alertas: AlertaClinica[] = []
  for (const med of medicamentos) {
    const nom = (med.nombre ?? '').toLowerCase()
    if (!nom) continue

    if (contexto.embarazo && /metotrex|warfarina|isotret|ibuprofen|naproxen/.test(nom)) {
      alertas.push({
        severidad: 'critica',
        mensaje: `Embarazo + ${med.nombre}: medicamento potencialmente riesgoso en gestación. Evaluar alternativa.`,
        campos: ['medicamentos'],
      })
    }
    if (contexto.erc && /metformina|aines|gentamicina|amikacina|vancomicina|ibuprofen|naproxen/.test(nom)) {
      alertas.push({
        severidad: 'advertencia',
        mensaje: `ERC + ${med.nombre}: requiere ajuste de dosis o tiene riesgo de nefrotoxicidad. Verificar.`,
        campos: ['medicamentos'],
      })
    }
    if (contexto.anticoagulado && /aines|ibuprofen|aspir|ketorol|naproxen|diclofen/.test(nom)) {
      alertas.push({
        severidad: 'advertencia',
        mensaje: `Anticoagulado + ${med.nombre}: riesgo aumentado de sangrado.`,
        campos: ['medicamentos'],
      })
    }
  }
  return alertas
}

/** Marca medicamentos críticos para que necesiten revisión adicional. */
export function esMedicamentoCritico(nombre: string): boolean {
  const low = nombre.toLowerCase()
  return FARMACOS_CRITICOS.some(c => low.includes(c))
}
