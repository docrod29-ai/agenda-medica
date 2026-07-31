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
import { norm, coincideAntibiotico } from './util'

export type GrupoCLSI =
  | 'enterobacterales' | 'pseudomonas' | 'acinetobacter'
  | 'staphylococcus'          // S. aureus y S. lugdunensis
  | 'staphylococcus_cons'     // coagulasa-negativos ≠ lugdunensis (oxacilina con corte propio)
  | 'enterococcus'            // enterococos ≠ E. faecium
  | 'enterococcus_faecium'    // daptomicina solo SDD
  | 'pneumococcus'

export interface Corte {
  /** CMI ≤ sMax → S (µg/mL). */
  sMax: number
  /** CMI ≥ rMin → R (µg/mL). Entre sMax y rMin = I (o SDD si sdd=true). */
  rMin: number
  /** Punto de corte sólo válido para IVU no complicada. */
  uti?: boolean
  /** Sin categoría "S" (p. ej. colistina: solo I/R). */
  sinS?: boolean
  /** Sin categoría S: todo lo que no es R se informa como SDD (dosis dependiente).
   *  Caso real: daptomicina en E. faecium — CLSI no define S, solo SDD ≤4. */
  soloSDD?: boolean
  /** La banda intermedia es SDD (susceptible dosis-dependiente), no "I".
   *  P. ej. cefepime en Enterobacterales: S ≤2, SDD 4-8, R ≥16 (CLSI M100-Ed35). */
  sdd?: boolean
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
  // Auditoría 2026-07 (P0): se quita el alias suelto 'avibactam' (casaba
  // «aztreonam-avibactam»). Sin entrada propia, aztreonam-avibactam devuelve
  // «sin punto de corte» —seguro— hasta que el Dr valide sus breakpoints.
  'ceftazidima-avibactam': ['ceftazidima-avibactam', 'ceftazidima/avibactam', 'caz-avi'],
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
  cefepime: { sMax: 2, rMin: 16, sdd: true },       // S ≤2, SDD 4-8 (dosis alta), R ≥16
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
  'piperacilina-tazobactam': { sMax: 16, rMin: 64 },   // Dr-validado M100-Ed35: S≤16/4, I=32/4, R≥64/4 (32 es I, NO SDD)
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
  minociclina: { sMax: 1, rMin: 4 },   // Dr-validado M100-Ed35: S≤1, I=2, R≥4 (disco: si I, confirmar por CMI)
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


/**
 * Tabla 2C — ESTAFILOCOCOS COAGULASA-NEGATIVOS distintos de S. lugdunensis.
 *
 * Idéntica a la de S. aureus SALVO oxacilina, y esa excepción importa mucho.
 *
 * El corte de S. aureus (S ≤2 / R ≥4) se estaba aplicando a TODOS los
 * estafilococos, así que un S. epidermidis con CMI 1 salía SENSIBLE a oxacilina.
 * En la práctica clínica del médico, alrededor del 80 % de los coagulasa-negativos
 * portan mecA, de modo que ese "S" es casi siempre un falso sensible — y en una
 * bacteriemia asociada a catéter lleva a tratar con un β-lactámico antiestafilocócico
 * que va a fallar.
 *
 * El CLSI bajó el corte de ≥4 a ≥0,5 mg/L precisamente porque el anterior no
 * detectaba la resistencia mediada por mecA en coagulasa-negativos.
 *
 * S. lugdunensis se comporta como S. aureus (más virulento, mecA infrecuente) y
 * por eso conserva el corte de aquel.
 */
const STAPHYLOCOCCUS_CONS: Record<string, Corte> = {
  ...STAPHYLOCOCCUS,
  oxacilina: { sMax: 0.25, rMin: 0.5 },
}

/**
 * Tabla 2D — ENTEROCOCCUS FAECIUM.
 *
 * Difiere de los demás enterococos SOLO en daptomicina, y de forma cualitativa:
 * el CLSI **no define categoría S** para esta combinación. Solo existe SDD ≤4
 * (dosis dependiente, 8-12 mg/kg/día) y R ≥8.
 *
 * Antes se aplicaba el corte de estafilococo (S ≤1), así que en un VRE —donde
 * daptomicina es una de las dos opciones reales— el motor la descartaba con el
 * punto de corte de otra especie, y encima se contradecía: una tabla decía "S" y
 * el módulo de Gram positivos emitía "no usar daptomicina" para la misma CMI.
 *
 * Informarla como SDD y no como S es lo correcto y además lo honesto: obliga a
 * decidir la dosis alta de forma explícita, que es justo lo que el CLSI pretende.
 */
const ENTEROCOCCUS_FAECIUM: Record<string, Corte> = {
  ...ENTEROCOCCUS,
  daptomicina: { sMax: 4, rMin: 8, soloSDD: true },
}

const TABLAS: Record<GrupoCLSI, Record<string, Corte>> = {
  enterobacterales: ENTEROBACTERALES,
  pseudomonas: PSEUDOMONAS,
  acinetobacter: ACINETOBACTER,
  staphylococcus: STAPHYLOCOCCUS,
  staphylococcus_cons: STAPHYLOCOCCUS_CONS,
  enterococcus: ENTEROCOCCUS,
  enterococcus_faecium: ENTEROCOCCUS_FAECIUM,
  pneumococcus: PNEUMOCOCCUS,
}

const REF_TABLA: Record<GrupoCLSI, string> = {
  enterobacterales: 'CLSI M100-Ed35 (2025), Tabla 2A-1 (Enterobacterales)',
  pseudomonas: 'CLSI M100-Ed35 (2025), Tabla 2B-1 (P. aeruginosa)',
  acinetobacter: 'CLSI M100-Ed35 (2025), Tabla 2B-2 (Acinetobacter)',
  staphylococcus: 'CLSI M100-Ed35 (2025), Tabla 2C (S. aureus / S. lugdunensis)',
  staphylococcus_cons: 'CLSI M100-Ed35 (2025), Tabla 2C (estafilococo coagulasa-negativo: oxacilina ≤0.25/≥0.5)',
  enterococcus: 'CLSI M100-Ed35 (2025), Tabla 2D (Enterococcus ≠ faecium)',
  enterococcus_faecium: 'CLSI M100-Ed35 (2025), Tabla 2D (E. faecium: daptomicina solo SDD ≤4, dosis 8-12 mg/kg/día)',
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
  if (/staphylo|aureus|epidermidis|lugdunensis|haemolyticus|hominis|capitis|warneri|saprophyticus|schleiferi|coagulasa/.test(o)) {
    // S. aureus y S. lugdunensis conservan su corte de oxacilina; el resto de los
    // coagulasa-negativos usa el corte bajo, que es el que detecta mecA.
    const esAureusOLugdunensis = /aureus|lugdunensis/.test(o) && !/coagulasa\s*negativ/.test(o)
    return esAureusOLugdunensis ? 'staphylococcus' : 'staphylococcus_cons'
  }
  if (/enterococ|faecium|faecalis/.test(o)) {
    return /faecium/.test(o) ? 'enterococcus_faecium' : 'enterococcus'
  }
  if (ENTEROBACTERALES_CLAVES.some(k => o.includes(norm(k)))) return 'enterobacterales'
  return null
}

function claveFarmaco(antibiotico: string): string | null {
  const a = norm(antibiotico)
  // más específico primero (combinaciones antes que el componente suelto)
  const orden = Object.keys(FARMACO_ALIAS).sort((x, y) => y.length - x.length)
  for (const clave of orden) {
    // Auditoría 2026-07 (P0/P1, muchos auditores): antes era `a.includes(s)` crudo,
    // así que «Aztreonam-avibactam», «Cefepime-taniborbactam» y otros BL/BLI nuevos
    // recibían los puntos de corte del componente suelto o de otra combinación. Se
    // usa el matcher endurecido con límite de token y regla de inhibidores.
    if (FARMACO_ALIAS[clave].some(s => coincideAntibiotico(a, s))) return clave
  }
  return null
}

export type CategoriaSIR = 'S' | 'SDD' | 'I' | 'R'

export interface CategoriaCLSI {
  categoria: CategoriaSIR
  corte: Corte
  referencia: string
  soloUTI: boolean
  /**
   * true cuando el punto de corte NO aplica a este caso (foco no urinario, o
   * fosfomicina en Enterobacterales que no sean E. coli): la categoría NO debe
   * mostrarse como susceptible utilizable. Se prefiere perder sensibilidad a
   * inducir un error terapéutico.
   */
  noAplicable?: boolean
  motivoNoAplicable?: string
  /**
   * La categoría NO es «S» porque la CMI vino censurada con «>» y el valor
   * reportado ya alcanza el techo de susceptibilidad (E0-15c). Permite que la
   * salida explique el porqué en vez de mostrar una I sin motivo.
   */
  desdeCmiCensurada?: boolean
}

/**
 * Interpreta una CMI (µg/mL) según el punto de corte CLSI del grupo/fármaco.
 * `sitio`='snc' aplica la variante MENÍNGEA (neumococo) cuando existe.
 *
 * `censura` es el operador con el que el laboratorio reportó la CMI (E0-15c,
 * decisión del médico dueño): una CMI **es un intervalo, no un número**.
 *
 *   «>2 mg/L»  ⇒  el valor real pertenece a (2, +∞)
 *   «<0.12»    ⇒  el valor real pertenece a (−∞, 0.12)
 *
 * Por tanto, si el valor reportado con «>» ya alcanza el techo de susceptibilidad,
 * **S es matemáticamente imposible**: el valor real está por encima. Descartar el
 * operador convertía un neumococo penicilina «>2» en «2 → S = tratable con
 * penicilina», que es un falso susceptible en meningitis.
 */
export function interpretarCMI(
  organismo: string,
  antibiotico: string,
  cmi: number,
  sitio?: string,
  censura?: '>' | '<',
): CategoriaCLSI | null {
  const grupo = grupoDe(organismo)
  if (!grupo || !(cmi >= 0)) return null
  const clave = claveFarmaco(antibiotico)
  if (!clave) return null
  const base = TABLAS[grupo][clave]
  if (!base) return null
  // Variante meníngea del neumococo cuando el sitio es SNC.
  const corte: Corte = sitio === 'snc' && base.snc ? { ...base, sMax: base.snc.sMax, rMin: base.snc.rMin } : base
  let categoria: CategoriaSIR
  if (cmi >= corte.rMin) categoria = 'R'
  else if (corte.soloSDD) categoria = 'SDD'       // daptomicina/E. faecium: no existe S
  else if (corte.sinS) categoria = 'I'            // colistina: ≤2 = I, ≥4 = R
  else if (cmi <= corte.sMax) categoria = 'S'
  else categoria = corte.sdd ? 'SDD' : 'I'        // banda intermedia: SDD (dosis-dependiente) o I

  /**
   * CMI CENSURADA «>X» — S es imposible cuando X ya alcanza el techo de S.
   * El valor real está por ENCIMA de X, así que como mínimo cae en la banda
   * intermedia. No se sube a R: eso sería inventar en la otra dirección (el
   * valor real podría estar entre sMax y rMin). Se marca `desdeCmiCensurada`
   * para que la salida pueda decir POR QUÉ no es S.
   */
  let desdeCmiCensurada = false
  if (censura === '>' && categoria === 'S' && cmi >= corte.sMax) {
    categoria = corte.sdd ? 'SDD' : 'I'
    desdeCmiCensurada = true
  }

  // GATING DE FOCO/ORGANISMO para fármacos SOLO-IVU (nitrofurantoína, fosfomicina).
  // Decisión clínica del Dr: la celda NO debe verse "S/verde" fuera de su indicación
  // validada — un falso «susceptible» es más peligroso que un falso «no utilizable».
  if (corte.uti) {
    const esUrinario = sitio === 'orina'
    const esEcoli = /escherichia|e\.?\s*coli|\bcoli\b/.test(norm(organismo))
    let motivo = ''
    if (!esUrinario) {
      motivo = 'Solo aplicable en IVU. Si es urocultivo, marca el sitio «Orina»; en cualquier otro foco (sangre, hueso, abdomen, próstata…) no uses este resultado.'
    } else if (clave === 'fosfomicina' && grupo === 'enterobacterales' && !esEcoli) {
      // El punto de corte de fosfomicina CLSI está validado SOLO en E. coli urinaria;
      // no se extrapola a Klebsiella/Enterobacter/Citrobacter/Serratia/Proteus/Morganella.
      motivo = 'Fosfomicina: punto de corte CLSI validado solo en E. coli urinaria. No aplicable a esta especie (fosA cromosómica; la «S» in vitro no predice eficacia).'
    }
    if (motivo) {
      return { categoria, corte, referencia: REF_TABLA[grupo], soloUTI: true, noAplicable: true, motivoNoAplicable: motivo, desdeCmiCensurada }
    }
  }

  return { categoria, corte, referencia: REF_TABLA[grupo], soloUTI: !!corte.uti, desdeCmiCensurada }
}
