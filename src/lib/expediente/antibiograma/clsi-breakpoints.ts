/**
 * Puntos de corte de CMI del CLSI M100-Ed35 (2025) → interpreta una CMI (µg/mL)
 * en categoría S/I/R, o CONFIRMA/discrepa con la categoría reportada por el lab.
 *
 * Fuente: CLSI M100-Ed35 (2025), Tabla 2A-1 (Enterobacterales, excl. Salmonella/Shigella).
 * Valores transcritos literalmente de la tabla leída. Convención:
 *   S = CMI ≤ sMax ; R = CMI ≥ rMin ; I/SDD = valores intermedios.
 * Combinaciones con inhibidor: el umbral se expresa por el componente activo (µg/mL).
 *
 * ⚠ Sólo se incluyen combinaciones bug-fármaco con punto de corte VIGENTE y no
 *    condicionadas a foco (las de "solo IVU no complicada" se marcan uti:true).
 */
import { norm } from './util'

export type GrupoCLSI = 'enterobacterales' | 'pseudomonas' | 'acinetobacter' | 'staphylococcus' | 'enterococcus' | 'pneumococcus'

export interface Corte {
  /** CMI ≤ sMax → S (µg/mL). */
  sMax: number
  /** CMI ≥ rMin → R (µg/mL). Entre sMax y rMin = I/SDD. */
  rMin: number
  /** Punto de corte sólo válido para IVU no complicada. */
  uti?: boolean
  /** Sin categoría "S" (p. ej. colistina: solo I/R). */
  sinS?: boolean
  /** Variante MENÍNGEA (S. pneumoniae): se usa cuando el sitio es SNC. */
  snc?: { sMax: number; rMin: number }
}

/** Sinónimos → clave canónica de fármaco. */
const FARMACO_ALIAS: Record<string, string[]> = {
  ampicilina: ['ampicilina'],
  'amoxicilina-clavulanato': ['amoxicilina-clavulanico', 'amoxicilina/clavulanico', 'amoxicilina-clavulanato', 'co-amoxiclav'],
  'ampicilina-sulbactam': ['ampicilina-sulbactam', 'ampicilina/sulbactam', 'unasyn'],
  'piperacilina-tazobactam': ['piperacilina-tazobactam', 'piperacilina/tazobactam', 'tazocin'],
  'ceftolozano-tazobactam': ['ceftolozano-tazobactam', 'ceftolozano/tazobactam', 'zerbaxa'],
  'ceftazidima-avibactam': ['ceftazidima-avibactam', 'ceftazidima/avibactam', 'avibactam'],
  'imipenem-relebactam': ['imipenem-relebactam', 'imipenem/relebactam', 'relebactam'],
  'meropenem-vaborbactam': ['meropenem-vaborbactam', 'meropenem/vaborbactam', 'vaborbactam'],
  'ticarcilina-clavulanato': ['ticarcilina-clavulanico', 'ticarcilina/clavulanico', 'ticarcilina-clavulanato'],
  'sulbactam-durlobactam': ['sulbactam-durlobactam', 'sulbactam/durlobactam', 'durlobactam'],
  netilmicina: ['netilmicina'],
  penicilina: ['penicilina', 'bencilpenicilina'],
  amoxicilina: ['amoxicilina'],
  oxacilina: ['oxacilina', 'meticilina', 'dicloxacilina'],
  vancomicina: ['vancomicina'],
  teicoplanina: ['teicoplanina'],
  linezolid: ['linezolid'],
  daptomicina: ['daptomicina'],
  eritromicina: ['eritromicina'],
  clindamicina: ['clindamicina'],
  moxifloxacino: ['moxifloxacino'],
  rifampicina: ['rifampicina', 'rifampina'],
  cefazolina: ['cefazolina'],
  ceftriaxona: ['ceftriaxona'],
  cefotaxima: ['cefotaxima'],
  ceftazidima: ['ceftazidima'],
  cefepime: ['cefepime', 'cefepima'],
  cefuroxima: ['cefuroxima'],
  cefoxitina: ['cefoxitina'],
  cefotetan: ['cefotetan'],
  aztreonam: ['aztreonam'],
  cefiderocol: ['cefiderocol'],
  ertapenem: ['ertapenem'],
  doripenem: ['doripenem'],
  imipenem: ['imipenem'],
  meropenem: ['meropenem'],
  colistina: ['colistina', 'colistimetato', 'polimixina'],
  gentamicina: ['gentamicina'],
  tobramicina: ['tobramicina'],
  amikacina: ['amikacina'],
  plazomicina: ['plazomicina'],
  tetraciclina: ['tetraciclina'],
  doxiciclina: ['doxiciclina'],
  minociclina: ['minociclina'],
  ciprofloxacino: ['ciprofloxacino'],
  levofloxacino: ['levofloxacino'],
  cotrimoxazol: ['trimetoprim-sulfametoxazol', 'trimetoprim/sulfametoxazol', 'cotrimoxazol', 'tmp-smx', 'tmp/smx'],
  cloranfenicol: ['cloranfenicol'],
  fosfomicina: ['fosfomicina'],
  nitrofurantoina: ['nitrofurantoina'],
}

/** Tabla 2A-1 — Enterobacterales (CLSI M100-Ed35, 2025). CMI en µg/mL. */
const ENTEROBACTERALES: Record<string, Corte> = {
  ampicilina: { sMax: 8, rMin: 32 },
  'amoxicilina-clavulanato': { sMax: 8, rMin: 32 },
  'ampicilina-sulbactam': { sMax: 8, rMin: 32 },
  'piperacilina-tazobactam': { sMax: 8, rMin: 32 },
  'ceftolozano-tazobactam': { sMax: 2, rMin: 8 },
  'ceftazidima-avibactam': { sMax: 8, rMin: 16 },
  'imipenem-relebactam': { sMax: 1, rMin: 4 },
  'meropenem-vaborbactam': { sMax: 4, rMin: 16 },
  cefazolina: { sMax: 2, rMin: 8 },                 // sistémico (surrogate IVU: ≤16/≥32)
  ceftriaxona: { sMax: 1, rMin: 4 },
  cefotaxima: { sMax: 1, rMin: 4 },
  ceftazidima: { sMax: 4, rMin: 16 },
  cefepime: { sMax: 2, rMin: 16 },                  // 4-8 = SDD (dosis alta)
  cefuroxima: { sMax: 8, rMin: 32 },                // parenteral
  cefoxitina: { sMax: 8, rMin: 32 },
  cefotetan: { sMax: 16, rMin: 64 },
  aztreonam: { sMax: 4, rMin: 16 },
  cefiderocol: { sMax: 4, rMin: 16 },
  ertapenem: { sMax: 0.5, rMin: 2 },
  doripenem: { sMax: 1, rMin: 4 },
  imipenem: { sMax: 1, rMin: 4 },
  meropenem: { sMax: 1, rMin: 4 },
  colistina: { sMax: 0, rMin: 4, sinS: true },      // I ≤2, R ≥4 (sin categoría S)
  gentamicina: { sMax: 2, rMin: 8 },
  tobramicina: { sMax: 2, rMin: 8 },
  amikacina: { sMax: 4, rMin: 16 },
  plazomicina: { sMax: 2, rMin: 8 },
  tetraciclina: { sMax: 4, rMin: 16 },
  doxiciclina: { sMax: 4, rMin: 16 },
  minociclina: { sMax: 4, rMin: 16 },
  ciprofloxacino: { sMax: 0.25, rMin: 1 },
  levofloxacino: { sMax: 0.5, rMin: 2 },
  cotrimoxazol: { sMax: 2, rMin: 4 },
  cloranfenicol: { sMax: 8, rMin: 32 },
  fosfomicina: { sMax: 64, rMin: 256, uti: true },  // solo E. coli IVU
  nitrofurantoina: { sMax: 32, rMin: 128, uti: true },
}

/** Tabla 2B-1 — Pseudomonas aeruginosa (CLSI M100-Ed35, 2025). CMI en µg/mL. */
const PSEUDOMONAS: Record<string, Corte> = {
  'piperacilina-tazobactam': { sMax: 16, rMin: 64 },
  'ceftazidima-avibactam': { sMax: 8, rMin: 16 },
  'ceftolozano-tazobactam': { sMax: 4, rMin: 16 },
  'imipenem-relebactam': { sMax: 2, rMin: 8 },
  'ticarcilina-clavulanato': { sMax: 16, rMin: 128 },
  ceftazidima: { sMax: 8, rMin: 32 },
  cefepime: { sMax: 8, rMin: 32 },
  cefiderocol: { sMax: 4, rMin: 16 },
  aztreonam: { sMax: 8, rMin: 32 },
  doripenem: { sMax: 2, rMin: 8 },
  imipenem: { sMax: 2, rMin: 8 },
  meropenem: { sMax: 2, rMin: 8 },
  colistina: { sMax: 0, rMin: 4, sinS: true },
  tobramicina: { sMax: 1, rMin: 4 },
  amikacina: { sMax: 16, rMin: 64 },
  netilmicina: { sMax: 8, rMin: 32 },
  ciprofloxacino: { sMax: 0.5, rMin: 2 },
  levofloxacino: { sMax: 1, rMin: 4 },
}

/** Tabla 2B-2 — Acinetobacter spp. (CLSI M100-Ed35, 2025). CMI en µg/mL. */
const ACINETOBACTER: Record<string, Corte> = {
  'piperacilina-tazobactam': { sMax: 16, rMin: 128 },
  'ampicilina-sulbactam': { sMax: 8, rMin: 32 },
  'sulbactam-durlobactam': { sMax: 4, rMin: 16 },
  'ticarcilina-clavulanato': { sMax: 16, rMin: 128 },
  ceftazidima: { sMax: 8, rMin: 32 },
  cefepime: { sMax: 8, rMin: 32 },
  cefotaxima: { sMax: 8, rMin: 64 },
  ceftriaxona: { sMax: 8, rMin: 64 },
  cefiderocol: { sMax: 4, rMin: 16 },
  doripenem: { sMax: 2, rMin: 8 },
  imipenem: { sMax: 2, rMin: 8 },
  meropenem: { sMax: 2, rMin: 8 },
  colistina: { sMax: 0, rMin: 4, sinS: true },
  gentamicina: { sMax: 4, rMin: 16 },
  tobramicina: { sMax: 4, rMin: 16 },
  amikacina: { sMax: 16, rMin: 64 },
  netilmicina: { sMax: 8, rMin: 32 },
  minociclina: { sMax: 1, rMin: 4 },
  ciprofloxacino: { sMax: 1, rMin: 4 },
  levofloxacino: { sMax: 2, rMin: 8 },
  cotrimoxazol: { sMax: 2, rMin: 4 },
}

/** Tabla 2C — Staphylococcus spp. (CLSI M100-Ed35, 2025). CMI en µg/mL.
 *  (oxacilina = S. aureus/lugdunensis ≤2/≥4; cefoxitina como subrogado de oxacilina ≤4/≥8) */
const STAPHYLOCOCCUS: Record<string, Corte> = {
  penicilina: { sMax: 0.12, rMin: 0.25 },
  oxacilina: { sMax: 2, rMin: 4 },              // S. aureus / S. lugdunensis
  cefoxitina: { sMax: 4, rMin: 8 },             // subrogado de oxacilina (mecA)
  vancomicina: { sMax: 2, rMin: 16 },           // S. aureus: I 4-8
  teicoplanina: { sMax: 8, rMin: 32 },
  linezolid: { sMax: 4, rMin: 8 },
  gentamicina: { sMax: 4, rMin: 16 },
  eritromicina: { sMax: 0.5, rMin: 8 },
  clindamicina: { sMax: 0.5, rMin: 4 },
  tetraciclina: { sMax: 4, rMin: 16 },
  doxiciclina: { sMax: 4, rMin: 16 },
  minociclina: { sMax: 4, rMin: 16 },
  ciprofloxacino: { sMax: 1, rMin: 4 },
  levofloxacino: { sMax: 1, rMin: 4 },
  moxifloxacino: { sMax: 0.5, rMin: 2 },
  rifampicina: { sMax: 1, rMin: 4 },
  cotrimoxazol: { sMax: 2, rMin: 4 },
  cloranfenicol: { sMax: 8, rMin: 32 },
  nitrofurantoina: { sMax: 32, rMin: 128, uti: true },
}

/** Tabla 2D — Enterococcus spp. (CLSI M100-Ed35, 2025). CMI en µg/mL. */
const ENTEROCOCCUS: Record<string, Corte> = {
  penicilina: { sMax: 8, rMin: 16 },
  ampicilina: { sMax: 8, rMin: 16 },
  vancomicina: { sMax: 4, rMin: 32 },           // I 8-16
  teicoplanina: { sMax: 8, rMin: 32 },
  daptomicina: { sMax: 2, rMin: 8 },            // Enterococcus ≠ E. faecium (E. faecium: SDD ≤4)
  linezolid: { sMax: 2, rMin: 8 },
  eritromicina: { sMax: 0.5, rMin: 8 },
  tetraciclina: { sMax: 4, rMin: 16 },
  doxiciclina: { sMax: 4, rMin: 16 },
  minociclina: { sMax: 4, rMin: 16 },
  ciprofloxacino: { sMax: 1, rMin: 4 },
  levofloxacino: { sMax: 2, rMin: 8 },
  cloranfenicol: { sMax: 8, rMin: 32 },
  rifampicina: { sMax: 1, rMin: 4 },
  fosfomicina: { sMax: 64, rMin: 256, uti: true },   // E. faecalis IVU
  nitrofurantoina: { sMax: 32, rMin: 128, uti: true },
}

/** Tabla 2G — Streptococcus pneumoniae (CLSI M100-Ed35, 2025). CMI en µg/mL.
 *  Los β-lactámicos tienen corte por SITIO: `snc` = meníngeo; el default = no-meníngeo (parenteral). */
const PNEUMOCOCCUS: Record<string, Corte> = {
  penicilina: { sMax: 2, rMin: 8, snc: { sMax: 0.06, rMin: 0.12 } },   // parenteral no-meníngeo / meníngeo
  amoxicilina: { sMax: 2, rMin: 8 },                                   // no-meníngeo
  'amoxicilina-clavulanato': { sMax: 2, rMin: 8 },
  cefepime: { sMax: 1, rMin: 4, snc: { sMax: 0.5, rMin: 2 } },
  cefotaxima: { sMax: 1, rMin: 4, snc: { sMax: 0.5, rMin: 2 } },
  ceftriaxona: { sMax: 1, rMin: 4, snc: { sMax: 0.5, rMin: 2 } },
  meropenem: { sMax: 0.25, rMin: 1 },
  ertapenem: { sMax: 1, rMin: 4 },
  imipenem: { sMax: 0.12, rMin: 1 },
  eritromicina: { sMax: 0.25, rMin: 1 },
  clindamicina: { sMax: 0.25, rMin: 1 },
  tetraciclina: { sMax: 1, rMin: 4 },
  doxiciclina: { sMax: 0.25, rMin: 1 },
  levofloxacino: { sMax: 2, rMin: 8 },
  moxifloxacino: { sMax: 1, rMin: 4 },
  cotrimoxazol: { sMax: 0.5, rMin: 4 },
  cloranfenicol: { sMax: 4, rMin: 8 },
}

const TABLAS: Record<GrupoCLSI, Record<string, Corte>> = {
  enterobacterales: ENTEROBACTERALES,
  pseudomonas: PSEUDOMONAS,
  acinetobacter: ACINETOBACTER,
  staphylococcus: STAPHYLOCOCCUS,
  enterococcus: ENTEROCOCCUS,
  pneumococcus: PNEUMOCOCCUS,
}

const REF_TABLA: Record<GrupoCLSI, string> = {
  enterobacterales: 'CLSI M100-Ed35 (2025), Tabla 2A-1 (Enterobacterales)',
  pseudomonas: 'CLSI M100-Ed35 (2025), Tabla 2B-1 (P. aeruginosa)',
  acinetobacter: 'CLSI M100-Ed35 (2025), Tabla 2B-2 (Acinetobacter)',
  staphylococcus: 'CLSI M100-Ed35 (2025), Tabla 2C (Staphylococcus)',
  enterococcus: 'CLSI M100-Ed35 (2025), Tabla 2D (Enterococcus)',
  pneumococcus: 'CLSI M100-Ed35 (2025), Tabla 2G (S. pneumoniae)',
}

const ENTEROBACTERALES_CLAVES = [
  'escherichia', 'e. coli', 'e.coli', 'coli', 'klebsiella', 'enterobacter',
  'serratia', 'citrobacter', 'proteus', 'morganella', 'providencia',
  'hafnia', 'raoultella', 'pantoea', 'kluyvera', 'aerogenes', 'cloacae', 'freundii',
]

export function grupoDe(organismo: string): GrupoCLSI | null {
  const o = norm(organismo)
  // Neumococo: exigir contexto de Streptococcus/neumococo — NO /pneumoniae/ suelto (colisiona con Klebsiella).
  if (/neumococo|pneumococ|streptococc.*pneumon|s\.?\s*pneumoniae/.test(o) && !/klebsiella/.test(o)) return 'pneumococcus'
  if (/pseudomonas|aeruginosa/.test(o)) return 'pseudomonas'
  if (/acinetobacter|baumannii/.test(o)) return 'acinetobacter'
  if (/staphylo|aureus|epidermidis|lugdunensis/.test(o)) return 'staphylococcus'
  if (/enterococ|faecium|faecalis/.test(o)) return 'enterococcus'
  if (ENTEROBACTERALES_CLAVES.some(k => o.includes(norm(k)))) return 'enterobacterales'
  return null
}

function claveFarmaco(antibiotico: string): string | null {
  const a = norm(antibiotico)
  // más específico primero (combinaciones antes que el componente suelto)
  const orden = Object.keys(FARMACO_ALIAS).sort((x, y) => y.length - x.length)
  for (const clave of orden) {
    if (FARMACO_ALIAS[clave].some(s => a.includes(norm(s)))) return clave
  }
  return null
}

export interface CategoriaCLSI {
  categoria: 'S' | 'I' | 'R'
  corte: Corte
  referencia: string
  soloUTI: boolean
}

/** Interpreta una CMI (µg/mL) según el punto de corte CLSI del grupo/fármaco.
 *  `sitio`='snc' aplica la variante MENÍNGEA (neumococo) cuando existe. */
export function interpretarCMI(organismo: string, antibiotico: string, cmi: number, sitio?: string): CategoriaCLSI | null {
  const grupo = grupoDe(organismo)
  if (!grupo || !(cmi >= 0)) return null
  const clave = claveFarmaco(antibiotico)
  if (!clave) return null
  const base = TABLAS[grupo][clave]
  if (!base) return null
  // Variante meníngea del neumococo cuando el sitio es SNC.
  const corte: Corte = sitio === 'snc' && base.snc ? { ...base, sMax: base.snc.sMax, rMin: base.snc.rMin } : base
  let categoria: 'S' | 'I' | 'R'
  if (cmi >= corte.rMin) categoria = 'R'
  else if (corte.sinS) categoria = 'I'            // colistina: ≤2 = I, ≥4 = R
  else if (cmi <= corte.sMax) categoria = 'S'
  else categoria = 'I'
  return { categoria, corte, referencia: REF_TABLA[grupo], soloUTI: !!corte.uti }
}
