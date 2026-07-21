/**
 * SELLO DE PROCEDENCIA — trazabilidad medicolegal por campo de la nota.
 *
 * Para cada dato ESTRUCTURADO que quedó en la nota (diagnósticos, medicamentos,
 * alergias, signos vitales) deriva DE DÓNDE salió, cruzando la lista final contra
 * el bloque de extracción auditada de la IA:
 *
 *   - 'dictado' : la IA lo sacó del dictado Y conserva la cita textual (source_quote).
 *                 Es lo máximo en trazabilidad: se puede leer la frase exacta.
 *   - 'ia'      : la IA lo propuso, pero SIN una frase literal que lo respalde
 *                 (inferencia del modelo). Se marca aparte, con honestidad.
 *   - 'manual'  : está en la nota pero NO vino de la extracción → lo escribió el médico.
 *
 * Honestidad: el origen se DERIVA de evidencia real (¿coincide con la extracción?,
 * ¿trae cita?). Nunca se inventa. Es puro y testeable; no altera ningún valor clínico
 * (solo lo clasifica para mostrarlo y sellarlo en el registro).
 */
import type { Confianza } from './extraction-schema'

export type OrigenCampo = 'dictado' | 'ia' | 'manual'

export interface CampoProcedencia {
  id: string
  etiqueta: string
  valor: string
  origen: OrigenCampo
  cita?: string
  confianza?: Confianza
}

export interface ResumenProcedencia {
  dictado: number
  ia: number
  manual: number
  total: number
}

export interface ManifiestoProcedencia {
  campos: CampoProcedencia[]
  resumen: ResumenProcedencia
}

/** Normaliza para comparar: minúsculas, sin acentos, sin espacios de sobra. */
export function normaliza(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Un ítem de la extracción auditada (permisivo: los campos crecen con el tiempo). */
type ItemExtraido = {
  source_quote?: string
  confidence?: Confianza
  [k: string]: unknown
}

interface ExtractionBlock {
  diagnosticos?: ItemExtraido[]
  medicamentos?: ItemExtraido[]
  alergias?: ItemExtraido[]
  signosVitales?: Record<string, { value?: unknown; source_quote?: string; confidence?: Confianza }>
}

interface FinalNota {
  diagnosticos?: { descripcion?: string }[]
  medicamentos?: { nombre?: string; dosis?: string }[]
  alergias?: (string | { alergeno?: string })[]
  signosVitales?: Record<string, unknown>
}

/** Clasifica un campo contra su coincidencia en la extracción. */
function origenDe(match: ItemExtraido | undefined): { origen: OrigenCampo; cita?: string; confianza?: Confianza } {
  if (!match) return { origen: 'manual' }
  const cita = typeof match.source_quote === 'string' ? match.source_quote.trim() : ''
  if (cita) return { origen: 'dictado', cita, confianza: match.confidence }
  return { origen: 'ia', confianza: match.confidence }
}

/**
 * Deriva el manifiesto de procedencia de la nota. Puro: solo lee, no muta nada.
 */
export function construirManifiesto(final: FinalNota, extraction?: ExtractionBlock): ManifiestoProcedencia {
  const campos: CampoProcedencia[] = []

  const buscar = (lista: ItemExtraido[] | undefined, clave: (x: ItemExtraido) => string, valor: string) => {
    if (!lista) return undefined
    const n = normaliza(valor)
    return lista.find(x => normaliza(clave(x)) === n)
      // coincidencia laxa: la extracción contiene el valor final o viceversa (p. ej. "cefalea" vs "cefalea tensional")
      ?? lista.find(x => { const k = normaliza(clave(x)); return k && n && (k.includes(n) || n.includes(k)) })
  }

  final.diagnosticos?.forEach((d, i) => {
    const desc = String(d.descripcion ?? '').trim()
    if (!desc) return
    const m = buscar(extraction?.diagnosticos, x => String(x.descripcion ?? ''), desc)
    campos.push({ id: `dx:${i}`, etiqueta: 'Diagnóstico', valor: desc, ...origenDe(m) })
  })

  final.medicamentos?.forEach((med, i) => {
    const nom = String(med.nombre ?? '').trim()
    if (!nom) return
    const m = buscar(extraction?.medicamentos, x => String(x.nombre ?? ''), nom)
    campos.push({ id: `med:${i}`, etiqueta: 'Medicamento', valor: [nom, med.dosis].filter(Boolean).join(' ').trim(), ...origenDe(m) })
  })

  final.alergias?.forEach((a, i) => {
    const alg = typeof a === 'string' ? a : String(a?.alergeno ?? '')
    if (!alg.trim()) return
    const m = buscar(extraction?.alergias, x => String(x.alergeno ?? ''), alg)
    campos.push({ id: `alg:${i}`, etiqueta: 'Alergia', valor: alg.trim(), ...origenDe(m) })
  })

  if (final.signosVitales) {
    for (const [k, v] of Object.entries(final.signosVitales)) {
      if (v === null || v === undefined || v === '') continue
      const ex = extraction?.signosVitales?.[k]
      const cita = typeof ex?.source_quote === 'string' ? ex.source_quote.trim() : ''
      const origen: OrigenCampo = ex ? (cita ? 'dictado' : 'ia') : 'manual'
      campos.push({
        id: `sv:${k}`, etiqueta: `Signo vital ${k.toUpperCase()}`, valor: String(v),
        origen, cita: cita || undefined, confianza: ex?.confidence,
      })
    }
  }

  const resumen: ResumenProcedencia = {
    dictado: campos.filter(c => c.origen === 'dictado').length,
    ia: campos.filter(c => c.origen === 'ia').length,
    manual: campos.filter(c => c.origen === 'manual').length,
    total: campos.length,
  }
  return { campos, resumen }
}

const ETIQUETA_ORIGEN: Record<OrigenCampo, string> = {
  dictado: 'del dictado (con cita)',
  ia: 'inferencia de IA',
  manual: 'capturado a mano',
}

/** Frase corta para el sello ("6 del dictado · 2 de IA · 1 a mano"). */
export function resumenProcedencia(r: ResumenProcedencia): string {
  const partes: string[] = []
  if (r.dictado) partes.push(`${r.dictado} del dictado`)
  if (r.ia) partes.push(`${r.ia} de IA`)
  if (r.manual) partes.push(`${r.manual} a mano`)
  return partes.join(' · ') || 'sin datos estructurados'
}

export function etiquetaOrigen(o: OrigenCampo): string {
  return ETIQUETA_ORIGEN[o]
}
