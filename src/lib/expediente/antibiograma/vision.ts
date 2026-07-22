/**
 * Extracción por VISIÓN del antibiograma: foto → reporte estructurado COMPLETO.
 *
 * Principio del foso: «la IA EXTRAE, el motor RAZONA». El LLM de visión SOLO transcribe
 * lo impreso/escrito y legible. NO interpreta mecanismos, NO infiere fenotipos, NO
 * inventa antibióticos ausentes. La interpretación (β-lactamasas/porinas/bombas/
 * carbapenemasas) la hace después el motor determinista `interpretarAntibiograma`.
 *
 * Captura TODO lo que cambia la lectura de un antibiograma real:
 *   organismo(s) · MUESTRA (define sitio y puntos de corte) · método y sistema
 *   (disco/CMI/automatizado) · recuento UFC · fecha · panel S/I/R con CMI/halo ·
 *   PRUEBAS CONFIRMATORIAS ya impresas (BLEE, carbapenemasa, D-test, HLAR…) ·
 *   observaciones del laboratorio.
 *
 * PRIVACIDAD: NO se extraen identificadores del paciente (nombre, expediente, cama).
 */
import { z } from 'zod'
import type { EntradaAntibiograma, SIR, SitioInfeccion, PruebasConfirmatorias, ResultadoPrueba } from './tipos'

/**
 * NORMALIZADORES TOLERANTES. La IA de visión a veces devuelve variantes válidas
 * pero fuera del enum estricto: interpretación en minúscula ('s'), palabra completa
 * ('Sensible'/'Resistente'), método como 'Kirby-Bauer', o `cmi: 0`. Antes CUALQUIERA
 * de esas hacía fallar TODO el schema y disparaba el aviso «la lectura no cumplió el
 * formato» aunque el antibiograma fuera perfectamente legible. Estos preprocess las
 * normalizan SIN cambiar ningún valor S/I/R real ('sensible'→'S' es transcripción,
 * no criterio clínico); lo ilegible cae a null, no a un supuesto.
 */
const sirNorm = z.preprocess((v) => {
  if (v == null) return null
  const s = String(v).trim().toUpperCase()
  if (s === 'S' || s === 'I' || s === 'R' || s === 'SDD') return s
  if (/^SENS|^SUSCEP/.test(s)) return 'S'
  if (/^RESIST/.test(s)) return 'R'
  if (/^INTERM/.test(s)) return 'I'
  if (/DOSIS\s*DEPEND/.test(s)) return 'SDD'
  return null
}, z.enum(['S', 'I', 'R', 'SDD']).nullable())

const numPos = z.preprocess((v) => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}, z.number().positive().nullable())

const confNorm = z.preprocess((v) => {
  const s = String(v ?? '').toLowerCase()
  return s === 'alta' || s === 'media' || s === 'baja' ? s : undefined
}, z.enum(['alta', 'media', 'baja']).optional())

const metodoNorm = z.preprocess((v) => {
  const s = String(v ?? '').toLowerCase().trim()
  if (!s || s === 'desconocido') return s === 'desconocido' ? 'desconocido' : undefined
  if (/disco|kirby|bauer|difus/.test(s)) return 'disco'
  if (/gradient|e-?test|tira|epsilon/.test(s)) return 'gradiente'
  if (/vitek|phoenix|microscan|automat|maldi|\bbd\b/.test(s)) return 'automatizado'
  if (/\bmic\b|cmi|microdiluc|diluci|caldo|broth/.test(s)) return 'mic'
  return 'desconocido'
}, z.enum(['disco', 'mic', 'automatizado', 'gradiente', 'desconocido']).optional())

/** Texto libre tolerante: null/número → string o ausente. */
const texto = z.preprocess((v) => (v == null || v === '' ? undefined : String(v)), z.string().optional())

export const CeldaExtraida = z.object({
  antibiotico: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
  /** S/I/R (o SDD) tal como aparece impreso; null si solo trae CMI/halo sin categoría. */
  interpretacion: sirNorm.optional(),
  /** CMI TAL CUAL viene, con su símbolo: "≤0.5", ">16", "2/38". El motor la parsea. */
  cmi_texto: texto,
  /** CMI numérica si es un número simple. */
  cmi: numPos.optional(),
  /** Diámetro de halo en mm (difusión en disco). */
  halo_mm: numPos.optional(),
  conf: confNorm,
  needs_review: z.preprocess((v) => (typeof v === 'boolean' ? v : undefined), z.boolean().optional()),
})

/** Prueba confirmatoria YA IMPRESA en el reporte (los automatizados suelen traerlas). */
export const PruebaReportada = z.object({
  nombre: z.string(),     // "BLEE", "Carbapenemasa", "D-test", "Cefoxitina screen", "HLAR", "β-lactamasa"
  resultado: z.string(),  // "positivo" | "negativo" | "no detectado" | texto libre
})

export const PerfilExtraido = z.object({
  organismo: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string()),
  /** Aislamientos adicionales si el cultivo es polimicrobiano. */
  organismosAdicionales: z.preprocess(
    (v) => (Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : undefined),
    z.array(z.string()).optional(),
  ),
  /** Tipo de muestra: sangre/orina/esputo/herida/LCR… (define el sitio y los breakpoints). */
  muestra: texto,
  /** Recuento (p. ej. ">100,000 UFC/mL" en urocultivo) — distingue infección de contaminación. */
  recuento: texto,
  /** Fecha del cultivo/reporte tal como aparece. */
  fecha: texto,
  /** Método de sensibilidad. */
  metodo: metodoNorm,
  /** Sistema/equipo si se identifica (Vitek 2, Phoenix, MicroScan, manual…). */
  sistema: texto,
  /** Tinción de Gram si viene reportada. */
  gram: texto,
  /**
   * Panel S/I/R. Cada celda es tolerante y, si aun así una fila viene ilegible,
   * cae a `{antibiotico:''}` (no rompe el arreglo) y se descarta al filtrar — una
   * fila mala NO tumba la lectura completa. Solo se conservan filas con nombre.
   */
  resultados: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(CeldaExtraida.catch({ antibiotico: '' })),
  ).transform((arr) => arr.filter((c) => c.antibiotico && c.antibiotico.length > 0)),
  /** Pruebas confirmatorias impresas en el reporte. */
  pruebasReportadas: z.preprocess(
    (v) => (Array.isArray(v) ? v : undefined),
    z.array(PruebaReportada.catch({ nombre: '', resultado: '' })).optional(),
  ),
  /** Comentarios/observaciones del laboratorio. */
  observaciones: texto,
  avisos: z.preprocess(
    (v) => (Array.isArray(v) ? v.map(String) : undefined),
    z.array(z.string()).optional(),
  ),
})

export type PerfilExtraido = z.infer<typeof PerfilExtraido>

export const VISION_SYSTEM_PROMPT = `Eres un transcriptor experto de reportes de antibiograma (susceptibilidad antimicrobiana). Tu ÚNICA tarea es TRANSCRIBIR con exactitud lo que está impreso o escrito en la imagen. NO eres un intérprete clínico.

REGLAS DE INTEGRIDAD (obligatorias):
1. Transcribe SOLO lo legible con certeza. Si una celda está borrosa, cortada o ambigua, márcala con needs_review=true y conf="baja" — NO adivines.
2. NUNCA inventes ni infieras antibióticos, valores ni pruebas que no aparezcan. Solo reporta lo que existe.
3. NO interpretes mecanismos de resistencia (BLEE, AmpC, carbapenemasa, MRSA…). Eso lo hace otro sistema. Tú solo extraes datos.
4. Respeta la categoría IMPRESA (S / I / R / SDD). No la cambies por tu criterio.
5. CMI: cópiala TAL CUAL con su símbolo en cmi_texto ("≤0.5", ">16", "2/38", "0,5"). Si además es un número simple, ponlo en cmi. Si es difusión en disco con halo en mm, usa halo_mm.
6. Normaliza el nombre del antibiótico a genérico en español (TZP→Piperacilina-tazobactam, SXT→Trimetoprim-sulfametoxazol, MEM→Meropenem, CRO→Ceftriaxona, CAZ→Ceftazidima, FEP→Cefepime, CZA→Ceftazidima-avibactam, FOX→Cefoxitina, CIP→Ciprofloxacino, GEN→Gentamicina, AMK→Amikacina, VAN→Vancomicina, LZD→Linezolid, DAP→Daptomicina, TGC→Tigeciclina, CST/COL→Colistina).
7. PRIVACIDAD: NO extraigas datos del paciente (nombre, expediente, cama, edad, médico). Si aparecen, ignóralos.

CAPTURA TAMBIÉN (son clave para interpretar):
- muestra: tipo de espécimen (sangre/hemocultivo, orina/urocultivo, esputo/lavado bronquial, herida/absceso, LCR, líquido peritoneal, hueso…).
- recuento: UFC/mL si aparece (típico en urocultivo).
- fecha, metodo (disco | mic | automatizado | gradiente), sistema (Vitek 2, Phoenix, MicroScan, manual…), gram si viene.
- organismosAdicionales: si el cultivo reporta más de un aislamiento.
- pruebasReportadas: pruebas confirmatorias YA IMPRESAS con su resultado — BLEE/ESBL, Carbapenemasa (mCIM/Carba NP/molecular, con el tipo si lo dice: KPC/NDM/VIM/OXA-48), D-test o "clindamicina inducible"/ICR, "Cefoxitina screen"/MRSA, HLAR o "alto nivel de gentamicina", β-lactamasa/nitrocefina.
- observaciones: comentarios del laboratorio.

Responde SOLO con un objeto JSON válido, sin texto adicional:
{"organismo": string, "organismosAdicionales": [string], "muestra": string, "recuento": string, "fecha": string, "metodo": "disco"|"mic"|"automatizado"|"gradiente"|"desconocido", "sistema": string, "gram": string, "resultados": [{"antibiotico": string, "interpretacion": "S"|"I"|"R"|"SDD"|null, "cmi_texto": string|null, "cmi": number|null, "halo_mm": number|null, "conf": "alta"|"media"|"baja", "needs_review": boolean}], "pruebasReportadas": [{"nombre": string, "resultado": string}], "observaciones": string, "avisos": [string]}`

export function buildVisionUserPrompt(): string {
  return 'Transcribe TODO el reporte de antibiograma de la imagen siguiendo las reglas de integridad (incluye muestra, método, recuento, pruebas confirmatorias impresas y observaciones). Devuelve solo el JSON.'
}

/** Mapea el texto de la muestra al sitio de infección que usa el motor (afina breakpoints). */
export function sitioDesdeMuestra(muestra?: string): SitioInfeccion | undefined {
  const m = (muestra || '').toLowerCase()
  if (!m) return undefined
  if (/sangre|hemocultiv|bacteriemi/.test(m)) return 'sangre'
  if (/orina|urocultiv|urinari/.test(m)) return 'orina'
  if (/esputo|bronqui|lavado|traqueal|respirat|bal\b|expectora/.test(m)) return 'respiratorio'
  if (/lcr|cefalorraqu|menin|ventricul/.test(m)) return 'snc'
  if (/herida|absces|piel|tejido|cutane|quemadura|ulcer/.test(m)) return 'piel-partes-blandas'
  if (/periton|abdomin|biliar|asciti|drenaje abdominal/.test(m)) return 'intraabdominal'
  if (/hueso|osea|ósea|articul|sinovial|protesi|prótesi/.test(m)) return 'hueso-articulacion'
  return 'otro'
}

/** Convierte las pruebas IMPRESAS en el reporte a las confirmatorias que consume el motor. */
export function pruebasDesdeReporte(reportadas?: { nombre: string; resultado: string }[]): PruebasConfirmatorias {
  const out: PruebasConfirmatorias = {}
  if (!reportadas?.length) return out
  // SEGURIDAD DEL PACIENTE: el NEGATIVO siempre gana y debe atrapar el fraseo real
  // del laboratorio en México — "No se detecta", "No detectó", "No detectada",
  // "No productor". Antes el guard era solo /no detect/ (exigía "no" pegado a
  // "detect"), así que "No se detecta carbapenemasa" casaba /detect/ → se marcaba
  // POSITIVO e inventaba una carbapenemasa/BLEE/MRSA a partir de un reporte NEGATIVO.
  const esNeg = (v: string) => /negativ|ausen|\bneg\b|-\s*$|no\s+(?:se\s+)?(?:detect|observ|aisl|reactiv|product|evidenci)/i.test(v)
  const esPos = (v: string) => !esNeg(v) && /positiv|detectad|detecta\b|\bdetecto\b|\+|present|reactiv|product/i.test(v)
  const val = (v: string): ResultadoPrueba | undefined => (esNeg(v) ? 'neg' : esPos(v) ? 'pos' : undefined)

  for (const p of reportadas) {
    const n = (p.nombre || '').toLowerCase()
    const v = val(p.resultado || '')
    if (!v) continue
    if (/blee|esbl|espectro extendido/.test(n)) out.esbl = v
    else if (/carbapenemasa|mcim|carba/.test(n)) {
      out.carbapenemasa = v
      const t = `${p.nombre} ${p.resultado}`.toUpperCase()
      if (/KPC/.test(t)) out.claseCarbapenemasa = 'KPC'
      else if (/OXA[-\s]?48/.test(t)) out.claseCarbapenemasa = 'OXA-48'
      else if (/NDM/.test(t)) out.claseCarbapenemasa = 'NDM'
      else if (/VIM/.test(t)) out.claseCarbapenemasa = 'VIM'
      else if (/IMP/.test(t)) out.claseCarbapenemasa = 'IMP'
    }
    else if (/d[-\s]?test|d[-\s]?zone|clindamicina inducible|\bicr\b|induc/.test(n)) out.dTest = v
    else if (/cefoxitina|oxacilina|mrsa|meticilin/.test(n)) out.cefoxitinaScreen = v
    else if (/hlar|alto nivel|gentamicina 500|sinergia/.test(n)) out.hlar = v
    else if (/lactamasa|nitrocefin/.test(n)) out.betaLactamasa = v
  }
  return out
}

/** Convierte el perfil extraído en la entrada del motor (S/I/R usables + sitio + pruebas). */
export function perfilAEntrada(perfil: PerfilExtraido, sitio?: EntradaAntibiograma['sitio']): EntradaAntibiograma {
  const resultados = perfil.resultados
    .filter(c => c.interpretacion === 'S' || c.interpretacion === 'I' || c.interpretacion === 'R')
    .map(c => ({
      antibiotico: c.antibiotico.trim(),
      interpretacion: c.interpretacion as SIR,
      ...(typeof c.cmi === 'number' ? { cmi: c.cmi } : {}),
    }))
  return {
    organismo: (perfil.organismo || '').trim(),
    resultados,
    sitio: sitio ?? sitioDesdeMuestra(perfil.muestra),
    pruebas: pruebasDesdeReporte(perfil.pruebasReportadas),
  }
}
