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

/** Busca la CMI (mg/L) de un antibiótico por sinónimo (o null si no se reportó). */
function cmiDe(resultados: ResultadoAntibiograma[], sinonimos: string[]): number | null {
  for (const r of resultados) {
    const a = norm(r.antibiotico)
    if (sinonimos.some(s => a.includes(norm(s))) && typeof r.cmi === 'number') return r.cmi
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
    // Vancomicina CMI > 2 en S. aureus: eficacia reducida (VISA/hVISA o "MIC creep").
    const vancoCmi = cmiDe(resultados, ['vancomicina'])
    if (vancoCmi !== null && vancoCmi > 2) {
      alertas.push({ nivel: 'alta', mensaje: `Vancomicina CMI ${vancoCmi} (>2) en S. aureus: eficacia reducida (VISA/hVISA o MIC creep). Considerar daptomicina (no en neumonía) u otra alternativa según el sitio; no confiar en vancomicina.` })
      advertencias.push('Vancomicina CMI >2 en S. aureus: mayor probabilidad de falla clínica; preferir alternativa aunque el reporte diga "S".')
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

  // Marcadores β-lactámicos compartidos por AmpC/BLEE.
  const cefoxitinaR = ES_R(estado(resultados, ['cefoxitina']))
  const any3gR = CEF3G.some(c => ES_R(estado(resultados, [c])))
  const carbaS = CARBAPENEM.some(c => ES_S(estado(resultados, [c])))
  const aztreonamR = ES_R(estado(resultados, ['aztreonam']))
  // AmpC fenotípico: cefoxitina R + 3G R capta AmpC PLASMÍDICA y cromosómica desreprimida.
  const ampcFenotipico = esEntero && cefoxitinaR && any3gR

  // ── Carbapenemasa (probable): Gram-negativo + carbapenem R ────────
  //    Infiere CLASE por ceftazidima-avibactam cuando esté disponible.
  if (esEntero || esPseudomonas || esAcinetobacter) {
    const anyCarbapenemR = CARBAPENEM.some(c => ES_R(estado(resultados, [c])))
    if (anyCarbapenemR) {
      const cza = estado(resultados, ['ceftazidima-avibactam', 'ceftazidima/avibactam', 'ceftazidima avibactam', 'avibactam'])
      let claseBase = 'Requiere confirmación de clase (KPC/NDM/OXA-48/VIM) por método fenotípico/molecular.'
      let sugerencia = 'Infectología obligada; la elección depende de la CLASE de carbapenemasa — confirmarla.'
      if (cza === 'S') {
        claseBase = 'Ceftazidima-avibactam S → sugiere carbapenemasa de SERINA (KPC u OXA-48), no metalo-β-lactamasa.'
        sugerencia = 'Ceftazidima-avibactam es opción dirigida (meropenem-vaborbactam para KPC). Confirmar clase molecular.'
      } else if (cza === 'R') {
        claseBase = 'Ceftazidima-avibactam R → sugiere metalo-β-lactamasa (NDM/VIM/IMP) o co-resistencia.'
        sugerencia = 'Sospecha de MBL: cefiderocol, o aztreonam + ceftazidima-avibactam en combinación. Infectología + microbiología.'
      }
      fenotipos.push({ clave: 'carbapenemasa', nombre: 'Resistencia a carbapenémicos (posible carbapenemasa)', confianza: 'probable',
        base: `Carbapenémico R en Gram-negativo (CLSI M100). ${claseBase}` })
      alertas.push({ nivel: 'critica', mensaje: `Carbapenem-R: ${sugerencia}` })
      advertencias.push('No asumir sensibilidad a β-lactámicos de nueva generación sin conocer la clase (p. ej. NDM inactiva avibactam).')
      notificacion = true
      aislamiento = 'Precauciones de contacto (organismo productor de carbapenemasa).'
    }
  }

  // ── AmpC: intrínseco (grupo ESCPM) o fenotípico (cefoxitina R + 3G R) ─
  //    La cefoxitina R capta AmpC PLASMÍDICA además de la cromosómica desreprimida.
  if (esAmpCintrinseco || ampcFenotipico) {
    const cefepimeS = ES_S(estado(resultados, ['cefepime']))
    const confianza: FenotipoDetectado['confianza'] = esAmpCintrinseco ? 'confirmado' : 'probable'
    const nombre = esAmpCintrinseco
      ? 'AmpC cromosómica inducible (grupo ESCPM)'
      : 'AmpC (plasmídica o desreprimida — cefoxitina R + 3G R)'
    const base = esAmpCintrinseco
      ? 'Especie del grupo ESCPM con AmpC cromosómica inducible (EUCAST intrinsic resistance). Riesgo de desrepresión bajo cefalosporinas de 3G.'
      : 'Cefoxitina R + cefalosporina de 3G R en Enterobacterales: AmpC plasmídica o cromosómica desreprimida (no inhibida por clavulanato).'
    fenotipos.push({ clave: 'AmpC', nombre, confianza, base })
    advertencias.push('AmpC: NO usar cefalosporinas de 3ª generación aunque el antibiograma las reporte S (desrepresión/hidrólisis). Cefepime (si S) es más estable a AmpC; carbapenémico en infección grave.')
    alertas.push({ nivel: 'alta', mensaje: cefepimeS
      ? 'AmpC: cefepime (S) es opción por su estabilidad relativa a AmpC; carbapenémico si es grave o de alto inóculo.'
      : 'AmpC: usar carbapenémico (cefepime no disponible o no sensible).' })
  }

  // ── BLEE (probable): 3G R + carbapenem S + cefoxitina NO R ────────
  //    Cefoxitina S distingue BLEE de AmpC; aztreonam R lo refuerza.
  if (esEntero && !esAmpCintrinseco && !ampcFenotipico && any3gR && carbaS && !cefoxitinaR) {
    const base = aztreonamR
      ? 'Cefalosporina de 3G R + aztreonam R + cefoxitina no-R + carbapenémico S en Enterobacterales: patrón de BLEE (inhibida por clavulanato).'
      : 'Cefalosporina de 3G R + carbapenémico S + cefoxitina no-R en Enterobacterales: BLEE probable (idealmente confirmar sinergia con clavulanato).'
    fenotipos.push({ clave: 'BLEE', nombre: 'β-lactamasa de espectro extendido (BLEE, probable)', confianza: 'probable', base })
    advertencias.push('BLEE: evitar cefalosporinas de 3G, aztreonam y también cefepime (poco confiable a alto inóculo/bacteriemia) aunque reporten S. Carbapenémico es el estándar en infección seria.')
    alertas.push({ nivel: 'alta', mensaje: 'BLEE probable: carbapenémico dirigido en infección seria; desescalar según foco y evolución.' })
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
