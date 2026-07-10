/**
 * Traductor médico DETERMINISTA español→inglés para búsquedas en PubMed.
 *
 * Red de seguridad: si la traducción con IA falla (o no está disponible), esto
 * convierte los términos clínicos más comunes y quita palabras de relleno, para
 * que una pregunta en español SIEMPRE tenga una consulta usable en inglés
 * (PubMed casi solo tiene inglés). Los nombres latinos (enterococcus faecalis)
 * pasan intactos. No pretende ser perfecto — solo evitar el "0 resultados".
 */

// Palabras de relleno en español que no aportan a la búsqueda.
const STOP = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a',
  'en', 'con', 'por', 'para', 'y', 'o', 'u', 'que', 'qué', 'cual', 'cuál',
  'como', 'cómo', 'cuando', 'cuándo', 'donde', 'dónde', 'es', 'son', 'se', 'su',
  'sus', 'mi', 'mis', 'le', 'lo', 'sobre', 'ante', 'the', 'of', 'for', 'in',
])

// Diccionario de términos médicos frecuentes (singular; el plural se normaliza).
const DIC: Record<string, string> = {
  // acciones / conceptos
  tratamiento: 'treatment', tratar: 'treatment', manejo: 'management', abordaje: 'management',
  diagnostico: 'diagnosis', diagnostica: 'diagnosis', pronostico: 'prognosis',
  prevencion: 'prevention', profilaxis: 'prophylaxis', utilidad: 'efficacy', eficacia: 'efficacy',
  indicacion: 'indication', indicaciones: 'indications', contraindicacion: 'contraindication',
  dosis: 'dose', dosificacion: 'dosing', duracion: 'duration', via: 'route',
  efecto: 'effect', efectos: 'effects', adverso: 'adverse', adversos: 'adverse',
  secundario: 'adverse', secundarios: 'adverse', toxicidad: 'toxicity', seguridad: 'safety',
  interaccion: 'interaction', interacciones: 'interactions',
  // estado / cualidades
  sensible: 'susceptible', resistente: 'resistant', resistencia: 'resistance',
  agudo: 'acute', aguda: 'acute', cronico: 'chronic', cronica: 'chronic',
  grave: 'severe', severa: 'severe', leve: 'mild', moderado: 'moderate',
  recurrente: 'recurrent', refractario: 'refractory',
  // poblaciones
  embarazo: 'pregnancy', embarazada: 'pregnancy', lactancia: 'breastfeeding',
  nino: 'children', ninos: 'children', pediatrico: 'pediatric', pediatrica: 'pediatric',
  adulto: 'adult', adultos: 'adults', anciano: 'elderly', ancianos: 'elderly', geriatrico: 'geriatric',
  neonato: 'neonatal', neonatal: 'neonatal',
  // sistemas / órganos
  renal: 'renal', rinon: 'kidney', hepatico: 'liver', higado: 'liver',
  cardiaco: 'cardiac', corazon: 'heart', pulmonar: 'pulmonary', pulmon: 'lung',
  cerebral: 'brain', neurologico: 'neurological', digestivo: 'gastrointestinal',
  // frecuentes clínicos
  infeccion: 'infection', infecciones: 'infection', sepsis: 'sepsis', bacteria: 'bacterial',
  virus: 'viral', hongo: 'fungal', antibiotico: 'antibiotic', antibioticos: 'antibiotics',
  presion: 'pressure', hipertension: 'hypertension', hipotension: 'hypotension',
  diabetes: 'diabetes', diabetico: 'diabetic', dolor: 'pain', fiebre: 'fever',
  cancer: 'cancer', tumor: 'tumor', anemia: 'anemia', insuficiencia: 'failure',
  neumonia: 'pneumonia', asma: 'asthma', epoc: 'copd', enfermedad: 'disease',
  // fármacos comunes (español → inglés)
  penicilina: 'penicillin', amoxicilina: 'amoxicillin', ampicilina: 'ampicillin',
  ceftriaxona: 'ceftriaxone', cefalexina: 'cephalexin', vancomicina: 'vancomycin',
  gentamicina: 'gentamicin', clindamicina: 'clindamycin', azitromicina: 'azithromycin',
  ciprofloxacino: 'ciprofloxacin', levofloxacino: 'levofloxacin', metronidazol: 'metronidazole',
  meropenem: 'meropenem', paracetamol: 'acetaminophen', ibuprofeno: 'ibuprofen',
  metformina: 'metformin', insulina: 'insulin', enalapril: 'enalapril', losartan: 'losartan',
  omeprazol: 'omeprazole', heparina: 'heparin', warfarina: 'warfarin', furosemida: 'furosemide',
  finerenona: 'finerenone', diosmina: 'diosmin', espironolactona: 'spironolactone',
  atorvastatina: 'atorvastatin', prednisona: 'prednisone', dexametasona: 'dexamethasone',
}

// Nombres de fármacos en inglés (para detectar de qué fármaco se pregunta y
// buscar su dosis en openFDA). Incluye los del diccionario + otros comunes que
// se escriben igual o parecido en ambos idiomas.
export const FARMACOS_EN = new Set<string>([
  'penicillin', 'amoxicillin', 'ampicillin', 'ceftriaxone', 'cephalexin', 'vancomycin',
  'gentamicin', 'clindamycin', 'azithromycin', 'ciprofloxacin', 'levofloxacin',
  'metronidazole', 'meropenem', 'acetaminophen', 'ibuprofen', 'metformin', 'insulin',
  'enalapril', 'losartan', 'omeprazole', 'heparin', 'warfarin', 'furosemide',
  'finerenone', 'diosmin', 'spironolactone', 'atorvastatin', 'prednisone', 'dexamethasone',
  // se escriben igual o casi igual en ES/EN:
  'rivaroxaban', 'apixaban', 'dabigatran', 'empagliflozin', 'dapagliflozin', 'sitagliptin',
  'linagliptin', 'sacubitril', 'valsartan', 'ezetimibe', 'rosuvastatin', 'clopidogrel',
  'amlodipine', 'lisinopril', 'ceftazidime', 'cefepime', 'piperacillin', 'tazobactam',
  'linezolid', 'daptomycin', 'fluconazole', 'oseltamivir', 'sertraline', 'gabapentin',
  'pregabalin', 'tramadol', 'ketorolac', 'levothyroxine', 'hydrochlorothiazide',
])

/** Quita acentos para comparar contra el diccionario. */
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Convierte una pregunta en español a una consulta en inglés aproximada.
 * Palabras conocidas → inglés; latinas/desconocidas → tal cual; relleno → fuera.
 */
export function traducirBasico(preguntaEs: string): string {
  const tokens = sinAcentos(preguntaEs.toLowerCase())
    .replace(/[¿?¡!.,;:()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const out: string[] = []
  for (const tk of tokens) {
    if (STOP.has(tk)) continue
    // Diccionario directo, o quitando una 's' final (plural simple).
    const t = DIC[tk] ?? (tk.endsWith('s') ? DIC[tk.slice(0, -1)] : undefined) ?? tk
    if (t && !out.includes(t)) out.push(t)
  }
  return out.join(' ').trim()
}

/** Detecta fármacos (en inglés) mencionados en una pregunta/nota en español. */
export function farmacosDetectados(textoEs: string): string[] {
  const tokens = traducirBasico(textoEs).split(' ')
  const encontrados: string[] = []
  for (const t of tokens) if (FARMACOS_EN.has(t) && !encontrados.includes(t)) encontrados.push(t)
  return encontrados
}
