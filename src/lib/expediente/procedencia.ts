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
  /**
   * EL MÉDICO LO ACEPTÓ, UNO POR UNO.
   *
   * De dónde salió un dato y si un humano lo hizo suyo son dos preguntas
   * distintas, y el registro sólo respondía la primera. Guardaba `camposAprobados: 3`
   * —un número suelto— así que sabía CUÁNTOS había aceptado y no CUÁLES: ante una
   * revisión, «el médico aprobó tres cosas» no dice nada de la que se discute.
   *
   * Se anota aparte, sin tocar `origen`, porque un dato puede ser las dos cosas:
   * venir del dictado con su cita textual Y haber sido aceptado. Fundirlos en un
   * solo campo perdería una de las dos.
   *
   * `undefined` significa «no aplica» —lo escribió el médico, no hay nada que
   * aceptar—; `false`, que la IA lo propuso y NADIE lo aceptó explícitamente.
   * Esa diferencia es justo la que importa.
   */
  confirmado?: boolean
}

export interface ResumenProcedencia {
  dictado: number
  ia: number
  manual: number
  /**
   * De los que propuso la IA, cuántos aceptó el médico explícitamente.
   *
   * OPCIONAL a propósito: las notas firmadas antes de que esto existiera no lo
   * llevan, y ponerles un `0` obligatorio al leerlas afirmaría que el médico no
   * aceptó nada — cuando la verdad es que no se estaba registrando. En un
   * expediente, «no consta» y «cero» no son lo mismo.
   */
  confirmados?: number
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
 *
 * `aprobados` son los identificadores que el médico marcó en el panel de
 * revisión. Es opcional: sin él, el manifiesto es exactamente el de antes.
 *
 * ── POR QUÉ NO SE COMPARAN LOS ÍNDICES DIRECTAMENTE ──────────────────────────
 *
 * El panel numera sobre la lista de la EXTRACCIÓN y esta función sobre la lista
 * FINAL de la nota. En cuanto el médico rechaza un diagnóstico, las dos
 * numeraciones se desfasan y el `dx:1` de uno deja de ser el `dx:1` del otro.
 * Dar por confirmado un diagnóstico usando el visto bueno de OTRO es peor que no
 * registrar nada: sería un dato falso en el registro medicolegal, y con la firma
 * del médico encima.
 *
 * Por eso se usa el índice del ítem de la extracción con el que de verdad
 * coincidió cada campo, que es la única numeración que el panel comparte.
 */
export function construirManifiesto(
  final: FinalNota,
  extraction?: ExtractionBlock,
  aprobados?: ReadonlySet<string>,
): ManifiestoProcedencia {
  const campos: CampoProcedencia[] = []

  /** Devuelve el ítem coincidente Y su posición en la extracción (para el id del panel). */
  const buscar = (lista: ItemExtraido[] | undefined, clave: (x: ItemExtraido) => string, valor: string) => {
    if (!lista) return { item: undefined, indice: -1 }
    const n = normaliza(valor)
    let i = lista.findIndex(x => normaliza(clave(x)) === n)
    // coincidencia laxa: la extracción contiene el valor final o viceversa (p. ej. "cefalea" vs "cefalea tensional")
    if (i < 0) i = lista.findIndex(x => { const k = normaliza(clave(x)); return !!k && !!n && (k.includes(n) || n.includes(k)) })
    return { item: i >= 0 ? lista[i] : undefined, indice: i }
  }

  /**
   * `undefined` cuando no hay nada que confirmar: lo escribió el médico, así que
   * preguntar si «aceptó» su propio texto no significa nada.
   */
  const confirmadoDe = (idPanel: string | null): boolean | undefined => {
    if (!aprobados || idPanel === null) return undefined
    return aprobados.has(idPanel)
  }

  final.diagnosticos?.forEach((d, i) => {
    const desc = String(d.descripcion ?? '').trim()
    if (!desc) return
    const { item, indice } = buscar(extraction?.diagnosticos, x => String(x.descripcion ?? ''), desc)
    campos.push({
      id: `dx:${i}`, etiqueta: 'Diagnóstico', valor: desc, ...origenDe(item),
      confirmado: confirmadoDe(indice >= 0 ? `dx:${indice}` : null),
    })
  })

  final.medicamentos?.forEach((med, i) => {
    const nom = String(med.nombre ?? '').trim()
    if (!nom) return
    const { item, indice } = buscar(extraction?.medicamentos, x => String(x.nombre ?? ''), nom)
    campos.push({
      id: `med:${i}`, etiqueta: 'Medicamento', valor: [nom, med.dosis].filter(Boolean).join(' ').trim(), ...origenDe(item),
      confirmado: confirmadoDe(indice >= 0 ? `med:${indice}` : null),
    })
  })

  final.alergias?.forEach((a, i) => {
    const alg = typeof a === 'string' ? a : String(a?.alergeno ?? '')
    if (!alg.trim()) return
    const { item, indice } = buscar(extraction?.alergias, x => String(x.alergeno ?? ''), alg)
    campos.push({
      id: `alg:${i}`, etiqueta: 'Alergia', valor: alg.trim(), ...origenDe(item),
      confirmado: confirmadoDe(indice >= 0 ? `alg:${indice}` : null),
    })
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
        // Los signos vitales se identifican por su NOMBRE en los dos sitios, así
        // que aquí no hay desfase posible.
        confirmado: confirmadoDe(ex ? `sv:${k}` : null),
      })
    }
  }

  const resumen: ResumenProcedencia = {
    dictado: campos.filter(c => c.origen === 'dictado').length,
    ia: campos.filter(c => c.origen === 'ia').length,
    manual: campos.filter(c => c.origen === 'manual').length,
    confirmados: campos.filter(c => c.confirmado === true).length,
    total: campos.length,
  }
  return { campos, resumen }
}

const ETIQUETA_ORIGEN: Record<OrigenCampo, string> = {
  dictado: 'del dictado (con cita)',
  ia: 'inferencia de IA',
  manual: 'capturado a mano',
}

/** Frase corta para el sello ("6 del dictado · 2 de IA · 1 a mano · 3 aceptados"). */
export function resumenProcedencia(r: ResumenProcedencia): string {
  const partes: string[] = []
  if (r.dictado) partes.push(`${r.dictado} del dictado`)
  if (r.ia) partes.push(`${r.ia} de IA`)
  if (r.manual) partes.push(`${r.manual} a mano`)
  // Va al final y sólo cuando lo hubo: es la parte del sello que HABLA DEL
  // MÉDICO, no de la máquina, y por eso es la que más pesa en una revisión.
  if (r.confirmados) partes.push(`${r.confirmados} aceptados por el médico`)
  return partes.join(' · ') || 'sin datos estructurados'
}

export function etiquetaOrigen(o: OrigenCampo): string {
  return ETIQUETA_ORIGEN[o]
}
