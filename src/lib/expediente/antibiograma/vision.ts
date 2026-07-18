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

export const CeldaExtraida = z.object({
  antibiotico: z.string().min(1),
  /** S/I/R (o SDD) tal como aparece impreso; null si solo trae CMI/halo sin categoría. */
  interpretacion: z.enum(['S', 'I', 'R', 'SDD']).nullable().optional(),
  /** CMI TAL CUAL viene, con su símbolo: "≤0.5", ">16", "2/38". El motor la parsea. */
  cmi_texto: z.string().nullable().optional(),
  /** CMI numérica si es un número simple. */
  cmi: z.number().positive().nullable().optional(),
  /** Diámetro de halo en mm (difusión en disco). */
  halo_mm: z.number().positive().nullable().optional(),
  conf: z.enum(['alta', 'media', 'baja']).optional(),
  needs_review: z.boolean().optional(),
})

/** Prueba confirmatoria YA IMPRESA en el reporte (los automatizados suelen traerlas). */
export const PruebaReportada = z.object({
  nombre: z.string(),     // "BLEE", "Carbapenemasa", "D-test", "Cefoxitina screen", "HLAR", "β-lactamasa"
  resultado: z.string(),  // "positivo" | "negativo" | "no detectado" | texto libre
})

export const PerfilExtraido = z.object({
  organismo: z.string(),
  /** Aislamientos adicionales si el cultivo es polimicrobiano. */
  organismosAdicionales: z.array(z.string()).optional(),
  /** Tipo de muestra: sangre/orina/esputo/herida/LCR… (define el sitio y los breakpoints). */
  muestra: z.string().optional(),
  /** Recuento (p. ej. ">100,000 UFC/mL" en urocultivo) — distingue infección de contaminación. */
  recuento: z.string().optional(),
  /** Fecha del cultivo/reporte tal como aparece. */
  fecha: z.string().optional(),
  /** Método de sensibilidad. */
  metodo: z.enum(['disco', 'mic', 'automatizado', 'gradiente', 'desconocido']).optional(),
  /** Sistema/equipo si se identifica (Vitek 2, Phoenix, MicroScan, manual…). */
  sistema: z.string().optional(),
  /** Tinción de Gram si viene reportada. */
  gram: z.string().optional(),
  resultados: z.array(CeldaExtraida),
  /** Pruebas confirmatorias impresas en el reporte. */
  pruebasReportadas: z.array(PruebaReportada).optional(),
  /** Comentarios/observaciones del laboratorio. */
  observaciones: z.string().optional(),
  avisos: z.array(z.string()).optional(),
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
  const esPos = (v: string) => /posit|detect|\+|present/i.test(v) && !/no detect|negat/i.test(v)
  const esNeg = (v: string) => /negat|no detect|ausen|\bneg\b|-$/i.test(v)
  const val = (v: string): ResultadoPrueba | undefined => (esPos(v) ? 'pos' : esNeg(v) ? 'neg' : undefined)

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
