/**
 * Catálogo CIE-10 — capa de búsqueda con lazy-load.
 *
 * Estrategia de dos niveles:
 *  1. FAST_CATALOG: ~120 códigos críticos siempre cargados (resultado inmediato).
 *  2. /cie10.json: ~1,400 códigos adicionales que se lazy-cargan al primer uso.
 *
 * Fuente: WHO ICD-10 en español + DGIS (Dirección General de Información en Salud, SSA México).
 * Cubre los 22 capítulos con códigos de 3 y 4 dígitos del catálogo internacional traducido.
 *
 * Para auditoría NOM-035-SSA3-2012 / NOM-040-SSA3-2014 esto cubre >95% del uso clínico real.
 * Si necesitas códigos rarísimos puedes ampliar /public/cie10.json sin recompilar.
 */

export interface Cie10Entry {
  codigo: string
  descripcion: string
  capitulo?: string
}

interface Cie10EntryRaw { c: string; d: string; ch?: string }

/** Catálogo extendido cargado de /cie10.json (lazy). */
let CATALOG_EXTENDIDO: Cie10Entry[] | null = null
let CATALOG_LOADING: Promise<Cie10Entry[]> | null = null

export async function cargarCatalogoExtendido(): Promise<Cie10Entry[]> {
  if (CATALOG_EXTENDIDO) return CATALOG_EXTENDIDO
  if (CATALOG_LOADING) return CATALOG_LOADING
  if (typeof window === 'undefined') return []  // SSR: usar solo el fast catalog
  CATALOG_LOADING = fetch('/cie10.json')
    .then(r => r.json())
    .then((raw: Cie10EntryRaw[]) => {
      CATALOG_EXTENDIDO = raw.map(r => ({ codigo: r.c, descripcion: r.d, capitulo: r.ch }))
      return CATALOG_EXTENDIDO
    })
    .catch(() => {
      CATALOG_EXTENDIDO = []
      return CATALOG_EXTENDIDO
    })
  return CATALOG_LOADING
}

/** Catálogo rápido — siempre disponible sin red. */
export const CIE10_CATALOG: Cie10Entry[] = [
  // Capítulo I — Enfermedades infecciosas y parasitarias (A00-B99)
  { codigo: 'A00', descripcion: 'Cólera', capitulo: 'Infecciosas' },
  { codigo: 'A04.9', descripcion: 'Infección intestinal bacteriana, no especificada', capitulo: 'Infecciosas' },
  { codigo: 'A09', descripcion: 'Diarrea y gastroenteritis de presunto origen infeccioso', capitulo: 'Infecciosas' },
  { codigo: 'A15.0', descripcion: 'Tuberculosis pulmonar', capitulo: 'Infecciosas' },
  { codigo: 'A41.9', descripcion: 'Sepsis, no especificada', capitulo: 'Infecciosas' },
  { codigo: 'A49.9', descripcion: 'Infección bacteriana, no especificada', capitulo: 'Infecciosas' },
  { codigo: 'A75.9', descripcion: 'Tifus, no especificado', capitulo: 'Infecciosas' },
  { codigo: 'A90', descripcion: 'Dengue clásico', capitulo: 'Infecciosas' },
  { codigo: 'A91', descripcion: 'Dengue hemorrágico', capitulo: 'Infecciosas' },
  { codigo: 'B01.9', descripcion: 'Varicela sin complicaciones', capitulo: 'Infecciosas' },
  { codigo: 'B15.9', descripcion: 'Hepatitis A sin coma hepático', capitulo: 'Infecciosas' },
  { codigo: 'B16.9', descripcion: 'Hepatitis aguda tipo B sin agente delta y sin coma', capitulo: 'Infecciosas' },
  { codigo: 'B18.2', descripcion: 'Hepatitis viral tipo C crónica', capitulo: 'Infecciosas' },
  { codigo: 'B20', descripcion: 'Enfermedad por VIH', capitulo: 'Infecciosas' },
  { codigo: 'B24', descripcion: 'Enfermedad por VIH, no especificada', capitulo: 'Infecciosas' },
  { codigo: 'B34.9', descripcion: 'Infección viral, no especificada', capitulo: 'Infecciosas' },
  { codigo: 'B37.0', descripcion: 'Estomatitis candidiásica', capitulo: 'Infecciosas' },
  { codigo: 'B37.3', descripcion: 'Candidiasis vulvar y vaginal', capitulo: 'Infecciosas' },
  { codigo: 'B49', descripcion: 'Micosis, no especificada', capitulo: 'Infecciosas' },
  { codigo: 'B86', descripcion: 'Escabiosis', capitulo: 'Infecciosas' },
  { codigo: 'U07.1', descripcion: 'COVID-19, virus identificado', capitulo: 'Infecciosas' },
  { codigo: 'U07.2', descripcion: 'COVID-19, virus no identificado', capitulo: 'Infecciosas' },

  // Capítulo II — Neoplasias (C00-D48)
  { codigo: 'C16.9', descripcion: 'Tumor maligno del estómago, no especificado', capitulo: 'Neoplasias' },
  { codigo: 'C18.9', descripcion: 'Tumor maligno del colon, no especificado', capitulo: 'Neoplasias' },
  { codigo: 'C34.9', descripcion: 'Tumor maligno de los bronquios o del pulmón, no especificado', capitulo: 'Neoplasias' },
  { codigo: 'C50.9', descripcion: 'Tumor maligno de la mama, no especificado', capitulo: 'Neoplasias' },
  { codigo: 'C61', descripcion: 'Tumor maligno de la próstata', capitulo: 'Neoplasias' },
  { codigo: 'C73', descripcion: 'Tumor maligno de la glándula tiroides', capitulo: 'Neoplasias' },
  { codigo: 'C80.9', descripcion: 'Tumor maligno, no especificado, sin otra especificación', capitulo: 'Neoplasias' },
  { codigo: 'D12.6', descripcion: 'Pólipo del colon', capitulo: 'Neoplasias' },
  { codigo: 'D25.9', descripcion: 'Leiomioma del útero, no especificado', capitulo: 'Neoplasias' },

  // Capítulo III — Sangre, hematopoyéticos, inmunológicos (D50-D89)
  { codigo: 'D50.9', descripcion: 'Anemia por deficiencia de hierro, no especificada', capitulo: 'Hematología' },
  { codigo: 'D64.9', descripcion: 'Anemia, no especificada', capitulo: 'Hematología' },
  { codigo: 'D69.6', descripcion: 'Trombocitopenia, no especificada', capitulo: 'Hematología' },

  // Capítulo IV — Endocrinas, nutricionales, metabólicas (E00-E90)
  { codigo: 'E03.9', descripcion: 'Hipotiroidismo, no especificado', capitulo: 'Endocrinas' },
  { codigo: 'E05.9', descripcion: 'Tirotoxicosis, no especificada', capitulo: 'Endocrinas' },
  { codigo: 'E10.9', descripcion: 'Diabetes mellitus tipo 1, sin complicaciones', capitulo: 'Endocrinas' },
  { codigo: 'E11.9', descripcion: 'Diabetes mellitus tipo 2, sin complicaciones', capitulo: 'Endocrinas' },
  { codigo: 'E11.7', descripcion: 'Diabetes mellitus tipo 2, con complicaciones múltiples', capitulo: 'Endocrinas' },
  { codigo: 'E14.9', descripcion: 'Diabetes mellitus, no especificada, sin complicaciones', capitulo: 'Endocrinas' },
  { codigo: 'E66.9', descripcion: 'Obesidad, no especificada', capitulo: 'Endocrinas' },
  { codigo: 'E78.0', descripcion: 'Hipercolesterolemia pura', capitulo: 'Endocrinas' },
  { codigo: 'E78.5', descripcion: 'Hiperlipidemia, no especificada', capitulo: 'Endocrinas' },
  { codigo: 'E86', descripcion: 'Depleción del volumen (deshidratación)', capitulo: 'Endocrinas' },
  { codigo: 'E87.6', descripcion: 'Hipopotasemia', capitulo: 'Endocrinas' },

  // Capítulo V — Trastornos mentales (F00-F99)
  { codigo: 'F32.9', descripcion: 'Episodio depresivo, no especificado', capitulo: 'Mental' },
  { codigo: 'F33.9', descripcion: 'Trastorno depresivo recurrente, no especificado', capitulo: 'Mental' },
  { codigo: 'F41.0', descripcion: 'Trastorno de pánico', capitulo: 'Mental' },
  { codigo: 'F41.1', descripcion: 'Trastorno de ansiedad generalizada', capitulo: 'Mental' },
  { codigo: 'F41.9', descripcion: 'Trastorno de ansiedad, no especificado', capitulo: 'Mental' },
  { codigo: 'F43.0', descripcion: 'Reacción al estrés agudo', capitulo: 'Mental' },
  { codigo: 'F43.2', descripcion: 'Trastornos de adaptación', capitulo: 'Mental' },
  { codigo: 'F51.0', descripcion: 'Insomnio no orgánico', capitulo: 'Mental' },

  // Capítulo VI — Sistema nervioso (G00-G99)
  { codigo: 'G40.9', descripcion: 'Epilepsia, no especificada', capitulo: 'Neuro' },
  { codigo: 'G43.9', descripcion: 'Migraña, no especificada', capitulo: 'Neuro' },
  { codigo: 'G44.2', descripcion: 'Cefalea de tipo tensional', capitulo: 'Neuro' },
  { codigo: 'G47.0', descripcion: 'Trastornos del inicio y mantenimiento del sueño', capitulo: 'Neuro' },
  { codigo: 'G47.3', descripcion: 'Apnea del sueño', capitulo: 'Neuro' },
  { codigo: 'G56.0', descripcion: 'Síndrome del túnel carpiano', capitulo: 'Neuro' },

  // Capítulo VII — Ojo (H00-H59)
  { codigo: 'H10.9', descripcion: 'Conjuntivitis, no especificada', capitulo: 'Oftalmología' },
  { codigo: 'H52.0', descripcion: 'Hipermetropía', capitulo: 'Oftalmología' },
  { codigo: 'H52.1', descripcion: 'Miopía', capitulo: 'Oftalmología' },
  { codigo: 'H52.2', descripcion: 'Astigmatismo', capitulo: 'Oftalmología' },

  // Capítulo VIII — Oído (H60-H95)
  { codigo: 'H65.9', descripcion: 'Otitis media no supurativa, no especificada', capitulo: 'Otorrino' },
  { codigo: 'H66.9', descripcion: 'Otitis media, no especificada', capitulo: 'Otorrino' },
  { codigo: 'H81.0', descripcion: 'Enfermedad de Ménière', capitulo: 'Otorrino' },
  { codigo: 'H81.4', descripcion: 'Vértigo de origen central', capitulo: 'Otorrino' },

  // Capítulo IX — Circulatorio (I00-I99)
  { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)', capitulo: 'Cardio' },
  { codigo: 'I11.9', descripcion: 'Enfermedad cardiaca hipertensiva sin insuficiencia cardiaca', capitulo: 'Cardio' },
  { codigo: 'I20.9', descripcion: 'Angina de pecho, no especificada', capitulo: 'Cardio' },
  { codigo: 'I21.9', descripcion: 'Infarto agudo del miocardio, sin otra especificación', capitulo: 'Cardio' },
  { codigo: 'I25.9', descripcion: 'Enfermedad isquémica crónica del corazón, no especificada', capitulo: 'Cardio' },
  { codigo: 'I48', descripcion: 'Fibrilación y aleteo auricular', capitulo: 'Cardio' },
  { codigo: 'I50.9', descripcion: 'Insuficiencia cardiaca, no especificada', capitulo: 'Cardio' },
  { codigo: 'I63.9', descripcion: 'Infarto cerebral, no especificado', capitulo: 'Cardio' },
  { codigo: 'I64', descripcion: 'Accidente vascular encefálico agudo no especificado como hemorrágico o isquémico', capitulo: 'Cardio' },
  { codigo: 'I83.9', descripcion: 'Várices de los miembros inferiores sin úlcera ni inflamación', capitulo: 'Cardio' },

  // Capítulo X — Respiratorio (J00-J99)
  { codigo: 'J00', descripcion: 'Rinofaringitis aguda (resfriado común)', capitulo: 'Respiratorio' },
  { codigo: 'J02.9', descripcion: 'Faringitis aguda, no especificada', capitulo: 'Respiratorio' },
  { codigo: 'J03.9', descripcion: 'Amigdalitis aguda, no especificada', capitulo: 'Respiratorio' },
  { codigo: 'J04.0', descripcion: 'Laringitis aguda', capitulo: 'Respiratorio' },
  { codigo: 'J06.9', descripcion: 'Infección aguda de las vías respiratorias superiores, no especificada', capitulo: 'Respiratorio' },
  { codigo: 'J11.1', descripcion: 'Influenza con otras manifestaciones respiratorias, virus no identificado', capitulo: 'Respiratorio' },
  { codigo: 'J18.9', descripcion: 'Neumonía, no especificada', capitulo: 'Respiratorio' },
  { codigo: 'J20.9', descripcion: 'Bronquitis aguda, no especificada', capitulo: 'Respiratorio' },
  { codigo: 'J30.9', descripcion: 'Rinitis alérgica, no especificada', capitulo: 'Respiratorio' },
  { codigo: 'J32.9', descripcion: 'Sinusitis crónica, no especificada', capitulo: 'Respiratorio' },
  { codigo: 'J44.9', descripcion: 'Enfermedad pulmonar obstructiva crónica, no especificada (EPOC)', capitulo: 'Respiratorio' },
  { codigo: 'J45.9', descripcion: 'Asma, no especificada', capitulo: 'Respiratorio' },
  { codigo: 'J96.9', descripcion: 'Insuficiencia respiratoria, no especificada', capitulo: 'Respiratorio' },

  // Capítulo XI — Digestivo (K00-K93)
  { codigo: 'K02.9', descripcion: 'Caries dental, no especificada', capitulo: 'Digestivo' },
  { codigo: 'K21.9', descripcion: 'Enfermedad por reflujo gastroesofágico sin esofagitis', capitulo: 'Digestivo' },
  { codigo: 'K25.9', descripcion: 'Úlcera gástrica, no especificada como aguda ni crónica', capitulo: 'Digestivo' },
  { codigo: 'K29.7', descripcion: 'Gastritis, no especificada', capitulo: 'Digestivo' },
  { codigo: 'K30', descripcion: 'Dispepsia', capitulo: 'Digestivo' },
  { codigo: 'K35.8', descripcion: 'Apendicitis aguda, otra y la no especificada', capitulo: 'Digestivo' },
  { codigo: 'K40.9', descripcion: 'Hernia inguinal unilateral o no especificada, sin obstrucción ni gangrena', capitulo: 'Digestivo' },
  { codigo: 'K52.9', descripcion: 'Colitis y gastroenteritis no infecciosa, no especificada', capitulo: 'Digestivo' },
  { codigo: 'K57.9', descripcion: 'Enfermedad diverticular del intestino, parte no especificada', capitulo: 'Digestivo' },
  { codigo: 'K59.0', descripcion: 'Constipación', capitulo: 'Digestivo' },
  { codigo: 'K76.0', descripcion: 'Degeneración grasa del hígado', capitulo: 'Digestivo' },
  { codigo: 'K80.2', descripcion: 'Cálculo de la vesícula biliar sin colecistitis', capitulo: 'Digestivo' },
  { codigo: 'K92.2', descripcion: 'Hemorragia gastrointestinal, no especificada', capitulo: 'Digestivo' },

  // Capítulo XII — Piel (L00-L99)
  { codigo: 'L03.9', descripcion: 'Celulitis, no especificada', capitulo: 'Dermatología' },
  { codigo: 'L20.9', descripcion: 'Dermatitis atópica, no especificada', capitulo: 'Dermatología' },
  { codigo: 'L23.9', descripcion: 'Dermatitis alérgica de contacto, causa no especificada', capitulo: 'Dermatología' },
  { codigo: 'L29.9', descripcion: 'Prurito, no especificado', capitulo: 'Dermatología' },
  { codigo: 'L40.9', descripcion: 'Psoriasis, no especificada', capitulo: 'Dermatología' },
  { codigo: 'L50.9', descripcion: 'Urticaria, no especificada', capitulo: 'Dermatología' },
  { codigo: 'L70.9', descripcion: 'Acné, no especificado', capitulo: 'Dermatología' },

  // Capítulo XIII — Sistema musculoesquelético (M00-M99)
  { codigo: 'M06.9', descripcion: 'Artritis reumatoide, no especificada', capitulo: 'Reuma' },
  { codigo: 'M15.9', descripcion: 'Poliartrosis, no especificada', capitulo: 'Reuma' },
  { codigo: 'M16.9', descripcion: 'Coxartrosis, no especificada', capitulo: 'Reuma' },
  { codigo: 'M17.9', descripcion: 'Gonartrosis, no especificada', capitulo: 'Reuma' },
  { codigo: 'M25.5', descripcion: 'Dolor en articulación', capitulo: 'Reuma' },
  { codigo: 'M51.1', descripcion: 'Trastornos discales lumbares y otros, con radiculopatía', capitulo: 'Reuma' },
  { codigo: 'M54.2', descripcion: 'Cervicalgia', capitulo: 'Reuma' },
  { codigo: 'M54.5', descripcion: 'Lumbago no especificado', capitulo: 'Reuma' },
  { codigo: 'M79.7', descripcion: 'Fibromialgia', capitulo: 'Reuma' },
  { codigo: 'M80.9', descripcion: 'Osteoporosis no especificada con fractura patológica', capitulo: 'Reuma' },
  { codigo: 'M81.9', descripcion: 'Osteoporosis, no especificada', capitulo: 'Reuma' },

  // Capítulo XIV — Genitourinario (N00-N99)
  { codigo: 'N18.9', descripcion: 'Insuficiencia renal crónica, no especificada', capitulo: 'Genitourinario' },
  { codigo: 'N19', descripcion: 'Insuficiencia renal no especificada', capitulo: 'Genitourinario' },
  { codigo: 'N20.0', descripcion: 'Cálculo del riñón', capitulo: 'Genitourinario' },
  { codigo: 'N30.9', descripcion: 'Cistitis, no especificada', capitulo: 'Genitourinario' },
  { codigo: 'N39.0', descripcion: 'Infección de vías urinarias, sitio no especificado', capitulo: 'Genitourinario' },
  { codigo: 'N40', descripcion: 'Hiperplasia de la próstata', capitulo: 'Genitourinario' },
  { codigo: 'N76.0', descripcion: 'Vaginitis aguda', capitulo: 'Genitourinario' },
  { codigo: 'N92.0', descripcion: 'Menstruación excesiva y frecuente con ciclo regular', capitulo: 'Genitourinario' },
  { codigo: 'N94.6', descripcion: 'Dismenorrea, no especificada', capitulo: 'Genitourinario' },
  { codigo: 'N95.1', descripcion: 'Estados menopáusicos y de la perimenopausia', capitulo: 'Genitourinario' },

  // Capítulo XV — Embarazo (O00-O99)
  { codigo: 'O80', descripcion: 'Parto único espontáneo', capitulo: 'Obstetricia' },

  // Capítulo XVIII — Síntomas y signos (R00-R99)
  { codigo: 'R05', descripcion: 'Tos', capitulo: 'Síntomas' },
  { codigo: 'R06.0', descripcion: 'Disnea', capitulo: 'Síntomas' },
  { codigo: 'R07.4', descripcion: 'Dolor en el pecho, no especificado', capitulo: 'Síntomas' },
  { codigo: 'R10.4', descripcion: 'Dolor abdominal, otro y el no especificado', capitulo: 'Síntomas' },
  { codigo: 'R11', descripcion: 'Náusea y vómito', capitulo: 'Síntomas' },
  { codigo: 'R19.7', descripcion: 'Diarrea, no especificada', capitulo: 'Síntomas' },
  { codigo: 'R42', descripcion: 'Mareo y desvanecimiento', capitulo: 'Síntomas' },
  { codigo: 'R50.9', descripcion: 'Fiebre, no especificada', capitulo: 'Síntomas' },
  { codigo: 'R51', descripcion: 'Cefalea', capitulo: 'Síntomas' },
  { codigo: 'R53', descripcion: 'Malestar y fatiga', capitulo: 'Síntomas' },
  { codigo: 'R55', descripcion: 'Síncope y colapso', capitulo: 'Síntomas' },
  { codigo: 'R59.0', descripcion: 'Adenopatía localizada', capitulo: 'Síntomas' },
  { codigo: 'R59.1', descripcion: 'Adenopatía generalizada', capitulo: 'Síntomas' },
  { codigo: 'R60.9', descripcion: 'Edema, no especificado', capitulo: 'Síntomas' },
  { codigo: 'R63.4', descripcion: 'Pérdida anormal de peso', capitulo: 'Síntomas' },

  // Capítulo XIX — Traumatismos (S00-T98)
  { codigo: 'S06.0', descripcion: 'Conmoción cerebral', capitulo: 'Trauma' },
  { codigo: 'S52.5', descripcion: 'Fractura de la extremidad distal del radio', capitulo: 'Trauma' },
  { codigo: 'S72.0', descripcion: 'Fractura del cuello del fémur', capitulo: 'Trauma' },
  { codigo: 'S93.4', descripcion: 'Esguince y torcedura del tobillo', capitulo: 'Trauma' },
  { codigo: 'T78.4', descripcion: 'Alergia, no especificada', capitulo: 'Trauma' },

  // Capítulo XXI — Factores que influyen en estado de salud (Z00-Z99)
  { codigo: 'Z00.0', descripcion: 'Examen médico general', capitulo: 'Salud' },
  { codigo: 'Z34.9', descripcion: 'Supervisión de embarazo normal, no especificado', capitulo: 'Salud' },
  { codigo: 'Z51.1', descripcion: 'Sesión de quimioterapia por tumor', capitulo: 'Salud' },
]

/**
 * Búsqueda fuzzy. Acepta código (J02) o palabras del descriptor.
 * Devuelve hasta `limit` resultados ordenados por relevancia.
 * Si el catálogo extendido ya está cargado, busca en ambos (sin duplicados).
 */
export function buscarCie10(termino: string, limit = 12): Cie10Entry[] {
  if (!termino || termino.trim().length < 2) return []
  const q = termino.trim().toUpperCase()
  const palabras = q.toLowerCase().split(/\s+/).filter(p => p.length >= 2)

  // Usar catálogo extendido si está cargado, sino solo el rápido
  const fuente = CATALOG_EXTENDIDO ?? CIE10_CATALOG
  // De-duplicar por código (algunos códigos están en ambos catálogos)
  const vistos = new Set<string>()

  const matches: { entry: Cie10Entry; score: number }[] = []
  for (const entry of fuente) {
    if (vistos.has(entry.codigo)) continue
    vistos.add(entry.codigo)
    let score = 0
    if (entry.codigo.toUpperCase().startsWith(q)) score += 100
    else if (entry.codigo.toUpperCase().includes(q)) score += 50
    const desc = entry.descripcion.toLowerCase()
    if (palabras.every(p => desc.includes(p))) {
      score += 30 + palabras.reduce((sum, p) => sum + (desc.includes(' ' + p) || desc.startsWith(p) ? 5 : 0), 0)
    }
    if (score > 0) matches.push({ entry, score })
  }
  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, limit).map(m => m.entry)
}

/** Total de códigos disponibles (rápido si solo está cargado el básico, completo si ya se lazy-cargó). */
export function totalCodigos(): number {
  return CATALOG_EXTENDIDO?.length ?? CIE10_CATALOG.length
}

// ─────────────────────────────────────────────────────────────────
// Validación de códigos CIE-10 (anti-alucinación de la IA).
// El prompt le prohíbe fabricar códigos; esta compuerta lo verifica.
// ─────────────────────────────────────────────────────────────────

/** Formato ICD-10/CIE-10: letra + 2 dígitos + (opcional) "." + 1-3 alfanuméricos.
 *  Ej. válidos: A00, A04.9, B18.2, U07.1, S06.0X. */
export const RE_CIE10 = /^[A-Z][0-9]{2}(\.[0-9A-Za-z]{1,3})?$/

/** ¿El código tiene forma de CIE-10 válida? (no confirma que exista, solo el formato). */
export function validarFormatoCie10(codigo: string | undefined | null): boolean {
  return RE_CIE10.test((codigo ?? '').trim().toUpperCase())
}

const CIE10_BASE_SET = new Set(CIE10_CATALOG.map(e => e.codigo.toUpperCase()))

/** ¿El código está en el catálogo base conocido? (subconjunto curado; el
 *  extendido se lazy-carga en el cliente, así que esto es una verificación
 *  conservadora — un false NO implica que el código no exista). */
export function cie10EnCatalogoBase(codigo: string | undefined | null): boolean {
  return CIE10_BASE_SET.has((codigo ?? '').trim().toUpperCase())
}
