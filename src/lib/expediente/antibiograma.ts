/**
 * Motor DETERMINISTA de interpretación de antibiogramas — núcleo PROA.
 *
 * Patrón de diseño (clave del foso): "la IA EXTRAE, el motor DECIDE".
 *   - Un LLM (visión) lee la placa/reporte y devuelve pares {antibiótico, S/I/R}.
 *   - ESTE motor, 100% determinista y auditable, infiere los fenotipos de
 *     resistencia y las alertas de stewardship. NO hay alucinación posible:
 *     son reglas fijas, versionadas y con test.
 *
 * Base clínica (reglas de libro, no controversiales):
 *   - CLSI M100 — puntos de corte y lectura interpretada.
 *   - EUCAST Expert Rules & Intrinsic Resistance (v3.x) — inferencia de fenotipo.
 *   - NOM-045-SSA2-2005 — notificación obligatoria de MDR/carbapenemasa/MRSA/VRE.
 *
 * ⚠️ APOYO DECISIONAL. No sustituye el juicio del infectólogo ni la prueba
 *    confirmatoria de mecanismo (p. ej. clase de carbapenemasa). Pendiente de
 *    validación clínica del Dr. antes de conducir prescripción en producción.
 */

export type SIR = 'S' | 'I' | 'R'

export interface ResultadoAntibiograma {
  antibiotico: string
  interpretacion: SIR
  cmi?: number
}

export interface EntradaAntibiograma {
  organismo: string
  resultados: ResultadoAntibiograma[]
}

export type FenotipoClave =
  | 'MRSA' | 'VRE' | 'carbapenemasa' | 'BLEE' | 'AmpC'
  | 'FQ-R' | 'colistin-R' | 'MDR'

export interface FenotipoDetectado {
  clave: FenotipoClave
  nombre: string
  confianza: 'confirmado' | 'probable' | 'sospecha'
  base: string
}

export interface AlertaAntibiograma {
  nivel: 'critica' | 'alta' | 'info'
  mensaje: string
}

export interface InterpretacionAntibiograma {
  organismo: string
  fenotipos: FenotipoDetectado[]
  alertas: AlertaAntibiograma[]
  /** NOM-045: fenotipo de notificación epidemiológica obligatoria. */
  notificacionObligatoria: boolean
  /** Precaución de aislamiento sugerida (o null). */
  aislamiento: string | null
  /** Sugerencias PK/PD deterministas por clase presente y sensible. */
  optimizacionPKPD: string[]
  /** Caveats de stewardship que contradicen el S/I/R "literal". */
  advertencias: string[]
}

// ─────────────────────────────────────────────────────────────────
// Normalización y catálogos de reconocimiento
// ─────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Grupo ESCPM/SPICE: portan AmpC cromosómica INDUCIBLE → riesgo de
 *  desrepresión bajo cefalosporinas de 3ª generación. */
const GRUPO_AMPC = ['enterobacter', 'klebsiella aerogenes', 'serratia', 'citrobacter freundii',
  'citrobacter', 'morganella', 'providencia', 'hafnia']

const ENTEROBACTERALES = ['escherichia', 'e. coli', 'e.coli', 'coli', 'klebsiella', 'enterobacter',
  'serratia', 'citrobacter', 'proteus', 'morganella', 'providencia', 'salmonella', 'shigella',
  'hafnia', 'raoultella', 'pantoea', 'kluyvera']

function organismoEs(org: string, claves: string[]): boolean {
  const o = norm(org)
  return claves.some(k => o.includes(norm(k)))
}

/** Busca el S/I/R de un antibiótico por cualquiera de sus sinónimos. */
function estado(resultados: ResultadoAntibiograma[], sinonimos: string[]): SIR | null {
  for (const r of resultados) {
    const a = norm(r.antibiotico)
    if (sinonimos.some(s => a.includes(norm(s)))) return r.interpretacion
  }
  return null
}

const ES_R = (v: SIR | null) => v === 'R'
const ES_S = (v: SIR | null) => v === 'S'

// Sinónimos por antibiótico/clase.
const CEF3G = ['ceftriaxona', 'cefotaxima', 'ceftazidima', 'cefixima', 'ceftibuteno']
const CARBAPENEM = ['meropenem', 'imipenem', 'ertapenem', 'doripenem']
const FLUOROQUINOLONA = ['ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'ofloxacino', 'norfloxacino']
const COLISTINA = ['colistina', 'colistimetato', 'polimixina']
const BETALACTAM_ANTIPSEUDOMONAS = ['piperacilina', 'tazobactam', 'cefepime', 'ceftazidima', 'meropenem', 'imipenem']
const AMINOGLUCOSIDO = ['gentamicina', 'amikacina', 'tobramicina']

// ─────────────────────────────────────────────────────────────────
// Motor de inferencia
// ─────────────────────────────────────────────────────────────────

export function interpretarAntibiograma(entrada: EntradaAntibiograma): InterpretacionAntibiograma {
  const { organismo, resultados } = entrada
  const fenotipos: FenotipoDetectado[] = []
  const alertas: AlertaAntibiograma[] = []
  const advertencias: string[] = []
  const optimizacionPKPD: string[] = []
  let notificacion = false
  let aislamiento: string | null = null

  const esEntero = organismoEs(organismo, ENTEROBACTERALES)
  const esAmpCintrinseco = organismoEs(organismo, GRUPO_AMPC)
  const esSaureus = organismoEs(organismo, ['staphylococcus aureus', 's. aureus', 's.aureus', 'aureus'])
  const esEnterococo = organismoEs(organismo, ['enterococcus', 'enterococo', 'faecium', 'faecalis'])
  const esPseudomonas = organismoEs(organismo, ['pseudomonas', 'aeruginosa'])
  const esAcinetobacter = organismoEs(organismo, ['acinetobacter', 'baumannii'])

  // ── MRSA: S. aureus + oxacilina/cefoxitina R (CLSI M100) ──────────
  if (esSaureus) {
    const oxa = estado(resultados, ['oxacilina', 'cefoxitina', 'meticilina'])
    if (ES_R(oxa)) {
      fenotipos.push({ clave: 'MRSA', nombre: 'S. aureus resistente a meticilina (MRSA)', confianza: 'confirmado',
        base: 'Oxacilina/cefoxitina R (CLSI M100). mecA/PBP2a — resistencia a TODOS los β-lactámicos salvo ceftarolina.' })
      alertas.push({ nivel: 'critica', mensaje: 'MRSA: los β-lactámicos convencionales NO sirven. Vancomicina (AUC/MIC 400-600), daptomicina o linezolid según el sitio.' })
      advertencias.push('MRSA: ignorar cualquier β-lactámico reportado S (excepto ceftarolina); mecA confiere resistencia de clase.')
      notificacion = true
      aislamiento = 'Precauciones de contacto (MRSA).'
    }
  }

  // ── VRE: Enterococcus + vancomicina R ─────────────────────────────
  if (esEnterococo) {
    const van = estado(resultados, ['vancomicina'])
    if (ES_R(van)) {
      fenotipos.push({ clave: 'VRE', nombre: 'Enterococo resistente a vancomicina (VRE)', confianza: 'confirmado',
        base: 'Vancomicina R en Enterococcus (CLSI M100). VanA/VanB.' })
      alertas.push({ nivel: 'critica', mensaje: 'VRE: linezolid o daptomicina (según especie/sitio). E. faecium suele ser también ampicilina-R.' })
      notificacion = true
      aislamiento = 'Precauciones de contacto (VRE).'
    }
  }

  // ── Carbapenemasa (probable, fenotípico): Gram-negativo + carbapenem R ─
  if (esEntero || esPseudomonas || esAcinetobacter) {
    const anyCarbapenemR = CARBAPENEM.some(c => ES_R(estado(resultados, [c])))
    if (anyCarbapenemR) {
      fenotipos.push({ clave: 'carbapenemasa', nombre: 'Resistencia a carbapenémicos (posible carbapenemasa)', confianza: 'probable',
        base: 'Carbapenémico R en Gram-negativo (CLSI M100). Requiere confirmación de clase (KPC/NDM/OXA-48/VIM) por método fenotípico/molecular.' })
      alertas.push({ nivel: 'critica', mensaje: 'Carbapenem-R: infectología obligada. La elección (ceftazidima-avibactam, meropenem-vaborbactam, cefiderocol, combinaciones) depende de la CLASE de carbapenemasa — confirmarla.' })
      advertencias.push('No asumir sensibilidad a β-lactámicos de nueva generación sin conocer la clase de carbapenemasa (p. ej. NDM inactiva avibactam).')
      notificacion = true
      aislamiento = 'Precauciones de contacto (organismo productor de carbapenemasa).'
    }
  }

  // ── AmpC intrínseco (grupo ESCPM): riesgo de desrepresión ─────────
  if (esAmpCintrinseco) {
    const cef3S = CEF3G.some(c => ES_S(estado(resultados, [c])))
    fenotipos.push({ clave: 'AmpC', nombre: 'AmpC cromosómica inducible (grupo ESCPM)', confianza: 'confirmado',
      base: 'Especie con AmpC inducible intrínseca (EUCAST intrinsic resistance). Riesgo de desrepresión y falla clínica bajo cefalosporinas de 3G aunque el antibiograma las reporte S.' })
    if (cef3S) {
      advertencias.push('AmpC: NO usar cefalosporinas de 3ª generación (ceftriaxona/cefotaxima/ceftazidima) en monoterapia AUNQUE el antibiograma las reporte S — riesgo de desrepresión durante el tratamiento. Preferir cefepime o carbapenémico.')
      alertas.push({ nivel: 'alta', mensaje: 'Grupo ESCPM (Enterobacter/Serratia/Citrobacter/Morganella/Providencia): usar cefepime o carbapenémico, no 3G.' })
    }
  }

  // ── BLEE (probable): Enterobacterales + 3G R + carbapenem S ────────
  if (esEntero && !esAmpCintrinseco) {
    const any3gR = CEF3G.some(c => ES_R(estado(resultados, [c])))
    const carbaS = CARBAPENEM.some(c => ES_S(estado(resultados, [c])))
    if (any3gR && carbaS) {
      fenotipos.push({ clave: 'BLEE', nombre: 'β-lactamasa de espectro extendido (BLEE, probable)', confianza: 'probable',
        base: 'Cefalosporina de 3G R + carbapenémico S en Enterobacterales (CLSI M100). Idealmente confirmar con sinergia a clavulanato.' })
      advertencias.push('BLEE: evitar cefalosporinas y aztreonam aunque alguna reporte S. En infección grave/bacteriemia, carbapenémico es el estándar; piperacilina-tazobactam solo en escenarios seleccionados.')
      alertas.push({ nivel: 'alta', mensaje: 'BLEE probable: carbapenémico como terapia dirigida en infección seria; considerar desescalada guiada por foco y evolución.' })
    }
  }

  // ── Fluoroquinolona-R ─────────────────────────────────────────────
  if (FLUOROQUINOLONA.some(f => ES_R(estado(resultados, [f])))) {
    fenotipos.push({ clave: 'FQ-R', nombre: 'Resistencia a fluoroquinolonas', confianza: 'confirmado',
      base: 'Fluoroquinolona R (CLSI M100).' })
  }

  // ── Colistina-R (última línea comprometida) ───────────────────────
  if (ES_R(estado(resultados, COLISTINA))) {
    fenotipos.push({ clave: 'colistin-R', nombre: 'Resistencia a colistina/polimixina', confianza: 'confirmado',
      base: 'Colistina R (CLSI/EUCAST). Última línea comprometida.' })
    alertas.push({ nivel: 'critica', mensaje: 'Colistina-R: opciones muy limitadas. Infectología + microbiología para terapia combinada guiada por CMI.' })
  }

  // ── MDR simplificado (recuento de clases resistentes) ─────────────
  const clasesR = contarClasesResistentes(resultados)
  if (clasesR >= 3) {
    fenotipos.push({ clave: 'MDR', nombre: 'Multidrogorresistente (≥3 clases, aproximado)', confianza: 'sospecha',
      base: `No-sensible en ${clasesR} clases distintas. Clasificación formal MDR/XDR/PDR requiere el mapeo de categorías de Magiorakos et al. (CMI 2012).` })
  }

  // ── Optimización PK/PD (determinista por clase presente y sensible) ─
  if (BETALACTAM_ANTIPSEUDOMONAS.some(b => ES_S(estado(resultados, [b])))) {
    optimizacionPKPD.push('β-lactámicos (tiempo-dependientes): en infección grave o CMI alta, optimizar con infusión extendida/continua para maximizar %fT>CMI.')
  }
  if (esSaureus && fenotipos.some(f => f.clave === 'MRSA')) {
    optimizacionPKPD.push('Vancomicina para MRSA: dosificar por AUC/MIC 400-600 (vancocinemia), no por valle fijo.')
  }
  if (AMINOGLUCOSIDO.some(a => ES_S(estado(resultados, [a])))) {
    optimizacionPKPD.push('Aminoglucósidos (concentración-dependientes): dosis única diaria, objetivo AUC/MIC; monitorizar función renal y niveles.')
  }
  if (FLUOROQUINOLONA.some(f => ES_S(estado(resultados, [f])))) {
    optimizacionPKPD.push('Fluoroquinolonas (concentración-dependientes): eficacia por AUC/MIC; dosis plena, no reducir salvo por función renal.')
  }

  return {
    organismo,
    fenotipos,
    alertas,
    notificacionObligatoria: notificacion,
    aislamiento,
    optimizacionPKPD,
    advertencias,
  }
}

/** Cuenta clases antimicrobianas con al menos un agente NO sensible (R o I).
 *  Aproximación para señalar MDR; la clasificación formal usa Magiorakos. */
function contarClasesResistentes(resultados: ResultadoAntibiograma[]): number {
  const clases: Record<string, string[]> = {
    penicilinas: ['ampicilina', 'amoxicilina', 'piperacilina'],
    cefalosporinas: [...CEF3G, 'cefepime', 'cefalotina', 'cefuroxima', 'cefazolina'],
    carbapenemicos: CARBAPENEM,
    fluoroquinolonas: FLUOROQUINOLONA,
    aminoglucosidos: AMINOGLUCOSIDO,
    tmp_smx: ['trimetoprim', 'sulfametoxazol', 'cotrimoxazol'],
    tetraciclinas: ['tetraciclina', 'doxiciclina', 'tigeciclina', 'minociclina'],
    polimixinas: COLISTINA,
    glicopeptidos: ['vancomicina', 'teicoplanina'],
    macrolidos: ['eritromicina', 'azitromicina', 'claritromicina'],
  }
  let n = 0
  for (const agentes of Object.values(clases)) {
    const hayR = resultados.some(r =>
      (r.interpretacion === 'R' || r.interpretacion === 'I') &&
      agentes.some(a => norm(r.antibiotico).includes(norm(a))))
    if (hayR) n++
  }
  return n
}
