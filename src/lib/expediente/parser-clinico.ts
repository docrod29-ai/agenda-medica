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
/**
 * PESO — auditoría 2026-07 (P1). Antes exigía `\d{2,3}`, así que el peso de un
 * RECIÉN NACIDO en kilos ("pesa 3.5 kg") NUNCA se capturaba: 3.5 tiene un solo
 * dígito entero. Ahora acepta 1-3 dígitos y también gramos ("3200 gramos"), que es
 * como se dicta en neonatología, convirtiéndolos a kg.
 */
const PATRON_PESO = /\b(?:peso|pesa)\s*(?:de|en)?\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*(kg|kilos?|kilogramos?|gr|gramos?|g)?\b/i

/**
 * TALLA — auditoría 2026-07 (P1). Se guarda en CENTÍMETROS (`types/expediente.ts`:
 * `talla?: number // cm`) y así la consume `imc(pesoKg, tallaCm)`, que divide entre
 * 100. Pero el patrón capturaba METROS y los escribía crudos en el campo de cm:
 *   · adulto "talla 1.70 m" → 1.7 → IMC = 72/(1.7/100)² ≈ 249 134 (absurdo)
 *   · recién nacido "talla 50 cm" → capturaba sólo el "5" → 5
 * Ahora acepta 1-3 dígitos con unidad opcional y NORMALIZA SIEMPRE A CENTÍMETROS.
 */
const PATRON_TALLA = /\b(?:talla|mide|estatura|longitud)\s*(?:de|en)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(cm|cent[ií]metros?|m|metros?)?\b/i

/** Peso a KILOS: convierte gramos y descarta lo implausible (0.3-400 kg). */
function pesoAKg(valor: string, unidad: string | undefined): number | null {
  const n = Number(valor.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  const u = (unidad || '').toLowerCase()
  const enGramos = /^(gr|g|gramos?)$/.test(u)
  const kg = enGramos ? n / 1000 : n
  return kg >= 0.3 && kg <= 400 ? kg : null
}

/** Talla a CENTÍMETROS: metros (explícitos o ≤3) × 100. Plausible 20-250 cm. */
function tallaACm(valor: string, unidad: string | undefined): number | null {
  const n = Number(valor.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  const u = (unidad || '').toLowerCase()
  const enMetros = /^(m|metros?)$/.test(u) || (!u && n <= 3)
  const cm = enMetros ? n * 100 : n
  return cm >= 20 && cm <= 250 ? Math.round(cm * 10) / 10 : null
}

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
    peso: peso ? pesoAKg(peso[1], peso[2]) : null,
    talla: talla ? tallaACm(talla[1], talla[2]) : null,
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

/**
 * Frases negadoras antes de un término clínico.
 *
 * ── DOS LISTAS PARA LO MISMO (6-ago-2026, REG-192) ──────────────────────────
 *
 * `negaciones.ts` tiene su propia `NIEGA_EN_LINEA`, y ésta se había quedado
 * corta: le faltaban `no padece`, `no padezco`, `sin antecedentes de`,
 * `ausencia de` y `se descarta`. La consecuencia concreta es que **«No padece
 * diabetes» entraba al expediente como antecedente positivo**, y de ahí pasa a
 * contaminar lo que se calcula encima (STOP-BANG en la valoración
 * preoperatoria, por ejemplo).
 *
 * Es el mismo patrón que costó REG-177 con la lista de huecos: dos listas que
 * tienen que decir lo mismo acaban diciendo cosas distintas, y la que se olvide
 * de actualizar es la que deja pasar el error.
 *
 * No se fusionan en una sola constante porque no hacen lo mismo: aquí se mira
 * hacia atrás en una ventana de texto y allí se decide sobre una frase entera.
 * Lo que sí se hace es que ésta no vuelva a quedarse corta, y una prueba
 * comprueba que todos los verbos de la otra están aquí.
 *
 * `sufre/sufro/sufría/sufrió`, `padecía/padeció` y `negó/negaron` se añadieron el
 * 8-ago-2026. El pretérito lo señaló la revisión del Dr.: estaban las
 * conjugaciones vecinas y faltaba justo la que se usa para contar un
 * antecedente, así que `No padeció diabetes.` seguía devolviendo la diabetes
 * como POSITIVA.
 *
 * Se escriben SIN tilde porque la ventana se normaliza antes de probarla (ver
 * `estaNegado`): `negó` llega aquí como `nego`.
 */
const NEGADORES = /\b(?:niega|nieg[ao]|nego|negaron|sin(?:\s+antecedente[s]?\s+de)?|no\s+(?:tiene|tengo|presenta|refiere|refiero|hay|padece|padezco|padecia|padecio|sufre|sufro|sufria|sufrio|ha\s+tenido)|nunca\s+(?:ha|tuvo)|ausente|ausencia\s+de|(?:se\s+)?descart[ao])\b/i

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
  /**
   * La ventana se normaliza UNA VEZ, aquí, y de ella comen los dos lados.
   *
   * `estaNegado` se llama por dos caminos: desde `extraerComorbilidades`, con el
   * texto ya normalizado, y desde los extractores de alergias, STOP-BANG y
   * Caprini, con el texto CRUDO. Por el segundo camino una negación acentuada
   * («negó», «descartó») no casaba, porque `\b` de JavaScript no considera letra
   * a la «ó» — la misma trampa que documenta `NO_ES_NEGACION` en `negaciones.ts`.
   *
   * Normalizar sólo antes de `NEGADORES` dejaría a `AFIRMADORES` mirando texto
   * crudo, y entonces «con **diagnóstico** de» no cerraría una negación que «con
   * diagnostico de» sí cierra: la misma frase daría dos respuestas según llevara
   * tilde. Lo señaló la revisión del Dr. (8-ago-2026). Los índices de aquí abajo
   * son de la ventana normalizada, que es la única que se toca a partir de este
   * punto.
   */
  let ventana = normalizar(texto.slice(ventanaInicio, indiceMatch))
  // Corta en el último signo terminal (punto, punto-y-coma, salto de línea)
  // — la cláusula anterior no negaría a la siguiente
  const corte = Math.max(ventana.lastIndexOf('.'), ventana.lastIndexOf(';'), ventana.lastIndexOf('\n'))
  if (corte !== -1) ventana = ventana.slice(corte + 1)
  // Si hay un afirmador entre el negador y el término, busca el
  // ÚLTIMO afirmador y descarta todo lo previo (la negación quedó cerrada)
  const re = new RegExp(AFIRMADORES.source, 'gi')
  let m, ultimoAfirm = -1, lenUltimo = 0
  while ((m = re.exec(ventana)) !== null) {
    // P0 (auditoría): un afirmador que es PARTE de un negador ("no tiene/presenta/
    // refiere", "nunca tuvo") NO cierra la negación. Sin esto, "no tiene diabetes"
    // se leía como diabetes POSITIVA (el "tiene" cancelaba el "no"). Se ignora el
    // afirmador precedido inmediatamente por no/nunca/sin.
    const antes = ventana.slice(Math.max(0, m.index - 7), m.index)
    if (/\b(?:no|nunca|sin)\s+$/i.test(antes)) continue
    ultimoAfirm = m.index; lenUltimo = m[0].length
  }
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
    // Respetar la NEGACIÓN (auditoría P1): "niega alergia a penicilina" / "sin
    // alergia a X" NO documenta la alergia. Antes se agregaba igual → disparaba la
    // alerta de reacción cruzada que BLOQUEA la firma NOM-004 de una receta correcta.
    if (estaNegado(texto, m.index)) continue
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

/** Marca el flag solo si el término aparece Y no viene negado. */
function marcarSiNoNegado(texto: string, re: RegExp, flags: Record<string, boolean>, clave: string): void {
  const m = texto.match(re)
  if (m && m.index !== undefined && !estaNegado(texto, m.index)) flags[clave] = true
}

export function extraerCaprini(texto: string, preopFlags: Record<string, boolean>): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  if (/\b(?:tvp|trombosis\s+venosa)\b/i.test(texto)) {
    const m = texto.match(/\b(?:tvp|trombosis\s+venosa)\b/i)
    if (m && m.index !== undefined && !estaNegado(texto, m.index)) {
      flags.antecedenteTVP = true
    }
  }
  /**
   * NEGACIÓN. Estos tres se marcaban con solo MENCIONAR la palabra, sin mirar si
   * venía negada — mientras la línea de arriba, para TVP, sí llama a estaNegado().
   *
   * El médico dicta "niega várices, niega fractura de cadera" y el parser marcaba
   * AMBAS como presentes: ~+6 puntos de Caprini y una recomendación de
   * tromboprofilaxis en un paciente que negó justo esos factores. Es un dato
   * inventado que alimenta una escala determinista y termina en una conducta.
   */
  marcarSiNoNegado(texto, /\bvarices\b/i, flags, 'varices')
  marcarSiNoNegado(texto, /\bfractura\s+(?:de\s+)?cadera\b/i, flags, 'fracturaCadera')
  marcarSiNoNegado(texto, /\bartroplastia\b/i, flags, 'artroplastiaElectiva')
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
  // `tipo` OPCIONAL: el parser no sabe si es fármaco, alimento o ambiental, y
  // ponerlo a ojo es inventar. Ausente significa «no se capturó».
  alergias: Array<{ alergeno: string; tipo?: string; reaccion: string; severidad: string; confirmada: boolean }>
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
    /**
     * NO INVENTAR LO QUE NO SE EXTRAJO.
     *
     * El parser saca un NOMBRE del texto y nada más. Rellenaba `via: 'oral'` y
     * `severidad: 'moderada'` — dos datos que nadie dijo y que en el expediente
     * se leen igual que los que sí dijo el médico. El propio esquema lo prohíbe
     * con estas palabras: «un valor plausible-pero-falso es peor que un hueco…
     * no se debe degradar una posible anafilaxia a "moderada" en silencio».
     *
     * Y este camino es justo el de los días malos: corre cuando el proveedor de
     * IA se cae, que es cuando menos se está mirando la pantalla.
     */
    medicamentos: r.medicamentos.map(nombre => ({
      nombre, dosis: '', via: '', frecuencia: '', duracion: '', indicacion: '',
    })),
    alergias: r.alergias.map(alergeno => ({
      alergeno, reaccion: '', severidad: 'desconocida', confirmada: false,
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
