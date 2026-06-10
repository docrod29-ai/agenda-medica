/**
 * Parser clínico determinista — middleware de NLP local.
 *
 * Función: extraer información estructurada de una transcripción cruda
 * SIN depender de la IA externa. Sirve como:
 *   1. Fallback cuando Claude/Whisper devuelve JSON inválido o falla
 *   2. Garantía de que el médico NUNCA se queda con campos vacíos
 *   3. Pre-procesador opcional que valida lo que la IA dijo
 *
 * Cubre vocabulario clínico denso (infectología, microbio, PROA),
 * negaciones explícitas, signos vitales con unidades, escalas
 * preoperatorias (STOP-BANG, RCRI, CHADS-VASc, HAS-BLED, Caprini).
 *
 * Diseño: regex robusto + normalización (lower, sin tildes), sin
 * dependencias externas. Síncrono, puro, testeable.
 */

import type { TipoNota } from '@/types/expediente'

// ─────────────────────────────────────────────────────────────────
// Normalización
// ─────────────────────────────────────────────────────────────────

/** Quita tildes y baja a minúsculas para matching robusto. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────

export interface SignosVitalesExtraidos {
  fc: number | null
  fr: number | null
  ta: string
  temperatura: number | null
  spo2: number | null
  peso: number | null
  talla: number | null
}

export interface ResultadoParser {
  resumenClinico: string
  signosVitales: SignosVitalesExtraidos
  comorbilidades: string[]
  negaciones: string[]
  medicamentos: string[]
  alergias: string[]
  preopInputs: Record<string, unknown>
  /** Texto residual sin clasificar — útil para padding del resumen */
  textoResidual: string
}

// ─────────────────────────────────────────────────────────────────
// Patrones de signos vitales (con unidades y variantes)
// ─────────────────────────────────────────────────────────────────

const PATRON_TA = /\b(?:ta|tensi[oó]n|presi[oó]n|pa)\s*(?:de|en)?\s*(\d{2,3})\s*\/\s*(\d{2,3})\b/i
const PATRON_FC = /\b(?:fc|frecuencia\s+cardiaca|pulso|latidos?)\s*(?:de|en)?\s*(\d{2,3})(?:\s*(?:lpm|x\s*min|por\s+minuto))?\b/i
const PATRON_FR = /\b(?:fr|frecuencia\s+respiratoria|respiraciones)\s*(?:de|en)?\s*(\d{1,2})(?:\s*(?:rpm|x\s*min))?\b/i
const PATRON_TEMP = /\b(?:temp(?:eratura)?|fiebre\s+de|febril\s+a)\s*(?:de|en)?\s*(\d{2}(?:\.\d)?)\s*(?:grados?|°c)?\b/i
const PATRON_SPO2 = /\b(?:spo2|saturaci[oó]n|sat(?:s|o2)?)\s*(?:de|en)?\s*(\d{2,3})\s*%?/i
const PATRON_PESO = /\b(?:peso|pesa)\s*(?:de|en)?\s*(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos?)?\b/i
const PATRON_TALLA = /\b(?:talla|mide|estatura)\s*(?:de|en)?\s*(\d(?:\.\d{1,2})?)\s*(?:m|metros?)?\b/i

export function extraerSignosVitales(texto: string): SignosVitalesExtraidos {
  const t = normalizar(texto)
  const ta = t.match(PATRON_TA)
  const fc = t.match(PATRON_FC)
  const fr = t.match(PATRON_FR)
  const temp = t.match(PATRON_TEMP)
  const spo2 = t.match(PATRON_SPO2)
  const peso = t.match(PATRON_PESO)
  const talla = t.match(PATRON_TALLA)

  return {
    fc: fc ? Number(fc[1]) : null,
    fr: fr ? Number(fr[1]) : null,
    ta: ta ? `${ta[1]}/${ta[2]}` : '',
    temperatura: temp ? Number(temp[1]) : null,
    spo2: spo2 ? Number(spo2[1]) : null,
    peso: peso ? Number(peso[1]) : null,
    talla: talla ? Number(talla[1]) : null,
  }
}

// ─────────────────────────────────────────────────────────────────
// Diccionario clínico denso (PROA + valoración preop)
// ─────────────────────────────────────────────────────────────────

/** Mapea término coloquial/abreviatura → comorbilidad canónica. */
const COMORBILIDADES_DIC: Array<{ patron: RegExp; canonico: string; preopKey?: string }> = [
  { patron: /\b(?:hta|hipertension(?:\s+arterial)?|presi[oó]n\s+alta)\b/i, canonico: 'Hipertensión arterial', preopKey: 'hipertension' },
  { patron: /\b(?:dm2?|diabetes(?:\s+(?:mellitus|tipo\s*2))?)\b/i, canonico: 'Diabetes mellitus tipo 2', preopKey: 'diabetes' },
  { patron: /\b(?:dislipidemia|hipercolesterolemia|hipertrigliceridemia)\b/i, canonico: 'Dislipidemia' },
  { patron: /\b(?:cardiopat[ií]a\s+isqu[eé]mica|enfermedad\s+coronaria|infarto\s+previo|iam\s+previo)\b/i, canonico: 'Cardiopatía isquémica', preopKey: 'cardiopatiaIsquemica' },
  { patron: /\b(?:insuficiencia\s+cardiaca|icc|falla\s+cardiaca)\b/i, canonico: 'Insuficiencia cardiaca', preopKey: 'insuficienciaCardiaca' },
  { patron: /\b(?:evc|enfermedad\s+cerebrovascular|ictus|acv)\b/i, canonico: 'Enfermedad cerebrovascular', preopKey: 'enfermedadCerebrovascular' },
  { patron: /\b(?:erc|enfermedad\s+renal\s+cr[oó]nica|insuficiencia\s+renal)\b/i, canonico: 'Enfermedad renal crónica' },
  { patron: /\b(?:epoc|enfermedad\s+pulmonar\s+obstructiva)\b/i, canonico: 'EPOC', preopKey: 'epoc' },
  { patron: /\bsaos|apnea\s+(?:del?\s+)?sue[nñ]o\b/i, canonico: 'SAOS', preopKey: 'saos' },
  { patron: /\basma\b/i, canonico: 'Asma' },
  { patron: /\b(?:tabaquismo|fuma(?:dor)?|fumar)\b/i, canonico: 'Tabaquismo', preopKey: 'tabaquismoActivo' },
  { patron: /\b(?:obesidad|sobrepeso)\b/i, canonico: 'Obesidad', preopKey: 'obesidad' },
  { patron: /\b(?:anemia|hemoglobina\s+baja)\b/i, canonico: 'Anemia', preopKey: 'anemia' },
  { patron: /\b(?:fibrilaci[oó]n\s+auricular|fa\s+cr[oó]nica)\b/i, canonico: 'Fibrilación auricular' },
  { patron: /\b(?:hipotiroidismo|hipertiroidismo)\b/i, canonico: 'Trastorno tiroideo' },
]

/** Antibióticos / antimicrobianos comunes (PROA). */
const ANTIBIOTICOS_DIC = [
  'amoxicilina', 'amoxicilina/clavulanato', 'ampicilina', 'piperacilina', 'tazobactam',
  'ceftriaxona', 'cefotaxima', 'cefepime', 'ceftazidima', 'cefuroxima', 'cefalexina',
  'meropenem', 'imipenem', 'ertapenem', 'doripenem',
  'vancomicina', 'linezolid', 'daptomicina', 'teicoplanina',
  'levofloxacino', 'ciprofloxacino', 'moxifloxacino',
  'azitromicina', 'claritromicina', 'eritromicina',
  'clindamicina', 'metronidazol', 'tigeciclina', 'doxiciclina', 'minociclina',
  'gentamicina', 'amikacina', 'tobramicina',
  'trimetoprim/sulfametoxazol', 'tmp/smx', 'fosfomicina', 'nitrofurantoina',
  'colistina', 'polimixina', 'ceftolozano/tazobactam', 'ceftazidima/avibactam',
  'meropenem/vaborbactam', 'cefiderocol',
  'fluconazol', 'voriconazol', 'caspofungina', 'micafungina', 'anidulafungina',
  'anfotericina', 'aciclovir', 'oseltamivir', 'remdesivir',
]

/** Patógenos comunes (infectología). */
const PATOGENOS_DIC = [
  'staphylococcus aureus', 's. aureus', 'mrsa', 'mssa',
  'escherichia coli', 'e. coli', 'klebsiella', 'pseudomonas aeruginosa', 'p. aeruginosa',
  'acinetobacter', 'enterobacter', 'serratia', 'proteus', 'enterococcus',
  'e. faecalis', 'e. faecium', 'vre',
  'streptococcus pneumoniae', 's. pneumoniae', 'neumococo',
  'streptococcus pyogenes', 'estreptococo',
  'clostridioides difficile', 'c. difficile', 'c diff',
  'mycobacterium tuberculosis', 'tuberculosis', 'tb',
  'candida albicans', 'candida', 'aspergillus',
  'sars-cov-2', 'influenza', 'virus sincitial', 'vsr',
  'blee', 'bla', 'kpc', 'ndm', 'oxa-48', 'amp-c',
]

/** Anticoagulantes (top-level preop). */
const ANTICOAGULANTES_DIC: Array<{ patron: RegExp; tipo: 'DOAC' | 'warfarina' }> = [
  { patron: /\b(?:apixaban|eliquis)\b/i, tipo: 'DOAC' },
  { patron: /\b(?:rivaroxaban|xarelto)\b/i, tipo: 'DOAC' },
  { patron: /\b(?:dabigatran|pradaxa)\b/i, tipo: 'DOAC' },
  { patron: /\b(?:edoxaban|lixiana)\b/i, tipo: 'DOAC' },
  { patron: /\b(?:warfarina|coumadin|acenocumarol|sintrom)\b/i, tipo: 'warfarina' },
]

const MEDICAMENTOS_CARDIO_DIC: Array<{ patron: RegExp; preopKey: string }> = [
  { patron: /\b(?:metoprolol|bisoprolol|atenolol|carvedilol|propranolol|nebivolol)\b/i, preopKey: 'tomaBetabloqueador' },
  { patron: /\b(?:enalapril|lisinopril|ramipril|captopril|losartan|telmisartan|valsartan|candesartan|irbesartan)\b/i, preopKey: 'tomaIECAoARA' },
  { patron: /\b(?:atorvastatina|rosuvastatina|simvastatina|pravastatina|pitavastatina)\b/i, preopKey: 'tomaEstatina' },
  { patron: /\b(?:dapagliflozina|empagliflozina|canagliflozina|ertugliflozina)\b/i, preopKey: 'tomaSGLT2' },
  { patron: /\b(?:semaglutida|liraglutida|dulaglutida|tirzepatida|ozempic|wegovy|mounjaro|trulicity|saxenda)\b/i, preopKey: 'tomaGLP1' },
  { patron: /\baspirina|asa\s+(?:81|100|150|300)|acido\s+acetilsalicilico\b/i, preopKey: 'tomaAspirina' },
]

// ─────────────────────────────────────────────────────────────────
// Detección de negaciones
// ─────────────────────────────────────────────────────────────────

/** Frases negadoras antes de un término clínico. */
const NEGADORES = /\b(?:niega|sin|no\s+(?:tiene|presenta|refiere|hay|ha\s+tenido)|nunca\s+(?:ha|tuvo)|ausente|descart[ao])\b/i

/**
 * Determina si un término aparece NEGADO en el texto.
 * Mira hasta ~40 chars antes del match buscando negadores, PERO
 * un punto o punto-y-coma resetea (cierra la negación).
 *   "niega TVP. Presenta diabetes" → diabetes NO está negada.
 *   "niega diabetes mellitus" → diabetes SÍ está negada.
 */
/** Palabras afirmativas que CIERRAN una negación previa */
const AFIRMADORES = /\b(?:presenta|refiere|tiene|tuvo|cursa\s+con|acude\s+por|en\s+tratamiento|con\s+diagnostico|diagnosticad[oa])\b/i

export function estaNegado(texto: string, indiceMatch: number): boolean {
  const ventanaInicio = Math.max(0, indiceMatch - 40)
  let ventana = texto.slice(ventanaInicio, indiceMatch)
  // Corta en el último signo terminal (punto, punto-y-coma, salto de línea)
  // — la cláusula anterior no negaría a la siguiente
  const corte = Math.max(ventana.lastIndexOf('.'), ventana.lastIndexOf(';'), ventana.lastIndexOf('\n'))
  if (corte !== -1) ventana = ventana.slice(corte + 1)
  // Si hay un afirmador entre el negador y el término, busca el
  // ÚLTIMO afirmador y descarta todo lo previo (la negación quedó cerrada)
  const re = new RegExp(AFIRMADORES.source, 'gi')
  let m, ultimoAfirm = -1, lenUltimo = 0
  while ((m = re.exec(ventana)) !== null) { ultimoAfirm = m.index; lenUltimo = m[0].length }
  if (ultimoAfirm !== -1) ventana = ventana.slice(ultimoAfirm + lenUltimo)
  return NEGADORES.test(ventana)
}

// ─────────────────────────────────────────────────────────────────
// Extractores específicos
// ─────────────────────────────────────────────────────────────────

export function extraerComorbilidades(texto: string): {
  positivas: string[]
  negadas: string[]
  preopFlags: Record<string, boolean>
} {
  const t = normalizar(texto)
  const positivas = new Set<string>()
  const negadas = new Set<string>()
  const preopFlags: Record<string, boolean> = {}

  for (const item of COMORBILIDADES_DIC) {
    const match = t.match(item.patron)
    if (!match || match.index === undefined) continue
    if (estaNegado(t, match.index)) {
      negadas.add(item.canonico)
      if (item.preopKey) preopFlags[item.preopKey] = false
    } else {
      positivas.add(item.canonico)
      if (item.preopKey) preopFlags[item.preopKey] = true
    }
  }

  return {
    positivas: [...positivas],
    negadas: [...negadas],
    preopFlags,
  }
}

export function extraerMedicamentosPreop(texto: string): {
  medicamentos: string[]
  preopFlags: Record<string, unknown>
} {
  const t = normalizar(texto)
  const medicamentos = new Set<string>()
  const preopFlags: Record<string, unknown> = {}

  for (const item of MEDICAMENTOS_CARDIO_DIC) {
    const match = t.match(item.patron)
    if (!match || match.index === undefined) continue
    if (estaNegado(t, match.index)) {
      preopFlags[item.preopKey] = false
    } else {
      preopFlags[item.preopKey] = true
      medicamentos.add(match[0])
    }
  }

  for (const item of ANTICOAGULANTES_DIC) {
    const match = t.match(item.patron)
    if (!match || match.index === undefined) continue
    if (!estaNegado(t, match.index)) {
      preopFlags.tomaAnticoagulante = true
      preopFlags.tipoAnticoagulante = item.tipo
      medicamentos.add(match[0])
    }
  }

  return { medicamentos: [...medicamentos], preopFlags }
}

export function extraerAntibioticosYPatogenos(texto: string): {
  antibioticos: string[]
  patogenos: string[]
} {
  const textoNorm = normalizar(texto)
  const antibioticos = ANTIBIOTICOS_DIC.filter(ab => textoNorm.includes(ab))
  const patogenos = PATOGENOS_DIC.filter(p => textoNorm.includes(p))
  return { antibioticos, patogenos }
}

export function extraerAlergias(texto: string): string[] {
  const alergias = new Set<string>()
  // Patrón: "alergia a X", "alérgico a X"
  const re = /\b(?:alergi[ao]?|al[eé]rgic[oa])\s+(?:a|al)\s+([a-z][a-z\s]{2,30}?)(?=[.,;]|\sni|\sy\s|$)/gi
  let m
  while ((m = re.exec(texto)) !== null) {
    alergias.add(m[1].trim())
  }
  return [...alergias]
}

// ─────────────────────────────────────────────────────────────────
// Escalas preoperatorias (STOP-BANG, etc.)
// ─────────────────────────────────────────────────────────────────

export function extraerStopBang(textoOriginal: string): Record<string, boolean> {
  const texto = normalizar(textoOriginal)
  const flags: Record<string, boolean> = {}
  // Ronquido FUERTE — exige el adjetivo o expresión equivalente
  if (/\bronc(?:a|ar)\s+(?:fuerte|muy\s+fuerte|tras\s+puertas\s+cerradas)\b/i.test(texto)) {
    flags.snoring = true
  } else if (/\bronc(?:a|ar)\b.*\b(?:poco|bajo|leve)\b/i.test(texto) || /\bniega\s+roncar\b/i.test(texto)) {
    flags.snoring = false
  }
  if (/\b(?:somnolencia\s+diurna|cansancio\s+diurno|fatiga\s+diurna|se\s+queda\s+dormido\s+(?:de\s+d[ií]a|en\s+el\s+d[ií]a))\b/i.test(texto)) {
    flags.tiredness = true
  }
  if (/\b(?:observad[ao]\s+apnea|apneas?\s+observad[ao]s?|deja\s+de\s+respirar)\b/i.test(texto)) {
    flags.observed = true
  }
  if (/\b(?:hipertension|hta|presi[oó]n\s+alta)\b/i.test(texto) && !/\bniega\s+(?:hipertension|hta)\b/i.test(texto)) {
    flags.pressure = true
  }
  if (/\bimc\s*(?:de\s*)?(\d{2}(?:\.\d)?)/i.test(texto)) {
    const imc = Number(RegExp.$1)
    if (imc > 35) flags.bmi35 = true
  }
  if (/\b(?:cuello|circunferencia)\s+(?:de\s+)?(\d{2})\s*cm\b/i.test(texto)) {
    const cuello = Number(RegExp.$1)
    if (cuello > 40) flags.neck40 = true
  }
  if (/\b(?:hombre|masculino|var[oó]n)\b/i.test(texto)) flags.genderMale = true
  if (/\b(?:mujer|femenin[ao])\b/i.test(texto)) flags.genderMale = false
  return flags
}

export function extraerCaprini(texto: string, preopFlags: Record<string, boolean>): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  if (/\b(?:tvp|trombosis\s+venosa)\b/i.test(texto)) {
    const m = texto.match(/\b(?:tvp|trombosis\s+venosa)\b/i)
    if (m && m.index !== undefined && !estaNegado(texto, m.index)) {
      flags.antecedenteTVP = true
    }
  }
  if (/\bvarices\b/i.test(texto)) flags.varices = true
  if (/\bfractura\s+(?:de\s+)?cadera\b/i.test(texto)) flags.fracturaCadera = true
  if (/\bartroplastia\b/i.test(texto)) flags.artroplastiaElectiva = true
  if (preopFlags.epoc) flags.epoc = true
  if (preopFlags.iamReciente) flags.iamReciente = true
  return flags
}

export function extraerEdad(texto: string): number | null {
  const m = texto.match(/\b(\d{1,3})\s*a[ñn]os(?:\s+de\s+edad)?\b/i)
  return m ? Number(m[1]) : null
}

// ─────────────────────────────────────────────────────────────────
// Orquestador principal
// ─────────────────────────────────────────────────────────────────

export function parsearTranscripcion(transcripcion: string, tipo?: TipoNota): ResultadoParser {
  if (!transcripcion || !transcripcion.trim()) {
    return {
      resumenClinico: '',
      signosVitales: { fc: null, fr: null, ta: '', temperatura: null, spo2: null, peso: null, talla: null },
      comorbilidades: [],
      negaciones: [],
      medicamentos: [],
      alergias: [],
      preopInputs: {},
      textoResidual: '',
    }
  }

  const signosVitales = extraerSignosVitales(transcripcion)
  const { positivas, negadas, preopFlags: preopComorb } = extraerComorbilidades(transcripcion)
  const { medicamentos, preopFlags: preopMed } = extraerMedicamentosPreop(transcripcion)
  const alergias = extraerAlergias(transcripcion)
  const edad = extraerEdad(transcripcion)

  let preopInputs: Record<string, unknown> = {}
  if (tipo === 'valoracion_preoperatoria') {
    preopInputs = {
      ...preopComorb,
      ...preopMed,
      ...(edad !== null ? { edad } : {}),
      stopbang: extraerStopBang(transcripcion),
      caprini: extraerCaprini(transcripcion, { ...preopComorb, ...preopMed } as Record<string, boolean>),
    }
    if (signosVitales.spo2 !== null) {
      preopInputs.ariscat = { spo2: signosVitales.spo2, edad: edad ?? null }
    }
  }

  // Resumen clínico: si hay comorbilidades o negaciones, arma frase estructurada.
  // Si no, devuelve la transcripción cruda para que el médico edite.
  const partes: string[] = []
  if (positivas.length) partes.push(`Antecedentes: ${positivas.join(', ')}.`)
  if (negadas.length) partes.push(`Niega: ${negadas.join(', ')}.`)
  if (medicamentos.length) partes.push(`Medicamentos: ${medicamentos.join(', ')}.`)
  if (alergias.length) partes.push(`Alergias: ${alergias.join(', ')}.`)
  if (signosVitales.ta || signosVitales.fc || signosVitales.spo2) {
    const sv: string[] = []
    if (signosVitales.ta) sv.push(`TA ${signosVitales.ta}`)
    if (signosVitales.fc) sv.push(`FC ${signosVitales.fc}`)
    if (signosVitales.fr) sv.push(`FR ${signosVitales.fr}`)
    if (signosVitales.temperatura) sv.push(`Temp ${signosVitales.temperatura}°C`)
    if (signosVitales.spo2) sv.push(`SpO2 ${signosVitales.spo2}%`)
    partes.push(`Signos vitales: ${sv.join(', ')}.`)
  }

  const resumenEstructurado = partes.join('\n')
  const resumenClinico = resumenEstructurado
    ? `${resumenEstructurado}\n\n[Transcripción original]\n${transcripcion}`
    : `[Transcripción — edita y estructura]\n\n${transcripcion}`

  return {
    resumenClinico,
    signosVitales,
    comorbilidades: positivas,
    negaciones: negadas,
    medicamentos,
    alergias,
    preopInputs,
    textoResidual: transcripcion,
  }
}

/**
 * Adaptador: convierte el resultado del parser local al shape que
 * espera el cliente (RespuestaExtraccion). Útil como fallback cuando
 * la IA externa devuelve JSON no parseable.
 */
export function parserClinicoComoRespuestaIA(
  transcripcion: string,
  tipo: TipoNota,
): {
  ok: true
  resumenEjecutivo: string
  secciones: Record<string, string>
  diagnosticos: Array<{ descripcion: string; codigoCIE10: string; tipo: string; estado: string }>
  medicamentos: Array<{ nombre: string; dosis: string; via: string; frecuencia: string; duracion: string; indicacion: string }>
  alergias: Array<{ alergeno: string; tipo: string; reaccion: string; severidad: string; confirmada: boolean }>
  signosVitales: SignosVitalesExtraidos
  preopInputs?: Record<string, unknown>
  safety: {
    fields_auto_filled: string[]
    fields_requiring_review: string[]
    conflicts_detected: string[]
    missing_critical_fields: string[]
  }
  fallbackLocal: true
} {
  const r = parsearTranscripcion(transcripcion, tipo)

  return {
    ok: true,
    resumenEjecutivo: r.comorbilidades.length
      ? `Paciente con ${r.comorbilidades.slice(0, 3).join(', ')}.`
      : 'Nota generada por parser local — IA externa no disponible.',
    secciones: {
      resumenClinico: r.resumenClinico,
    },
    diagnosticos: [],
    medicamentos: r.medicamentos.map(nombre => ({
      nombre, dosis: '', via: 'oral', frecuencia: '', duracion: '', indicacion: '',
    })),
    alergias: r.alergias.map(alergeno => ({
      alergeno, tipo: 'medicamento', reaccion: '', severidad: 'moderada', confirmada: false,
    })),
    signosVitales: r.signosVitales,
    preopInputs: tipo === 'valoracion_preoperatoria' ? r.preopInputs : undefined,
    safety: {
      fields_auto_filled: [],
      fields_requiring_review: ['todos los campos — revisión manual obligatoria'],
      conflicts_detected: [],
      missing_critical_fields: ['IA externa falló — parser local solo extrae lo básico'],
    },
    fallbackLocal: true,
  }
}
