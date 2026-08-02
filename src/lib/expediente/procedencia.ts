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
 *   - 'calculado': lo derivó un motor determinista de otros datos (NEWS2, IMC,
 *                 día de UCI…). No lo dijo nadie ni lo tecleó nadie: si el dato
 *                 de origen cambia, éste cambia solo.
 *   - 'importado': llegó de un sistema externo — un monitor de cabecera por HL7,
 *                 un laboratorio. Lo midió una máquina que nadie estaba mirando.
 *
 * ── POR QUÉ HACÍAN FALTA LOS DOS ÚLTIMOS ─────────────────────────────────────
 *
 * Hasta ahora todo lo que no venía de la extracción caía en `manual`, y `manual`
 * significa **«lo escribió el médico»**. Con el adaptador de dispositivos
 * (`lib/dispositivos/vitales-hl7.ts`) ya entran signos vitales de un monitor: si
 * se sellaran como `manual`, el registro afirmaría que el médico tecleó una
 * frecuencia cardiaca que en realidad midió un aparato conectado a un cable que
 * quizá estaba suelto. Y un NEWS2 calculado no lo «dijo» nadie.
 *
 * En un registro que existe para responder «¿quién dijo esto?», meter a la
 * máquina y al médico en la misma casilla es perder justo la respuesta.
 *
 * Honestidad: el origen se DERIVA de evidencia real (¿coincide con la extracción?,
 * ¿trae cita?). Nunca se inventa. Es puro y testeable; no altera ningún valor clínico
 * (solo lo clasifica para mostrarlo y sellarlo en el registro).
 */
import type { Confianza } from './extraction-schema'

export type OrigenCampo = 'dictado' | 'ia' | 'manual' | 'calculado' | 'importado'

/**
 * Los orígenes que NO son una persona de este consultorio.
 *
 * Sirve para lo que importa: un dato que nadie de aquí afirmó no puede
 * presentarse como si lo hubiera afirmado alguien de aquí.
 */
export const ORIGENES_SIN_AUTOR_HUMANO: readonly OrigenCampo[] = ['calculado', 'importado']

export function esDeMaquina(o: OrigenCampo): boolean {
  return ORIGENES_SIN_AUTOR_HUMANO.includes(o)
}

/**
 * De la `fuente` con la que se guarda una toma al vocabulario de procedencia.
 *
 * Los dos vocabularios existían por separado: las tomas de UCI y los signos ya
 * declaran de dónde vienen (`panel-uci`, `teclado`, `dispositivo`…) y el sello
 * de la nota sólo sabía de dictado/IA/mano. Sin este puente, un signo vital que
 * llegó del monitor se sellaba como `manual` — es decir, **como si lo hubiera
 * escrito el médico**.
 *
 * Lo que no se reconoce NO se degrada a `manual`: se devuelve `null` para que
 * quien llama decida, porque inventar un autor es peor que no tener uno.
 */
export function origenDesdeFuente(fuente: string | undefined | null): OrigenCampo | null {
  const f = String(fuente ?? '').trim().toLowerCase()
  if (!f) return null
  if (f === 'dispositivo' || f.startsWith('hl7') || f.startsWith('monitor')) return 'importado'
  if (f === 'calculado' || f.startsWith('derivad')) return 'calculado'
  if (f === 'voz' || f === 'dictado') return 'dictado'
  if (f === 'teclado' || f === 'panel-uci' || f === 'manual') return 'manual'
  return null
}

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

/**
 * Clasifica un campo contra su coincidencia en la extracción.
 *
 * ── DOS FORMAS DE MENTIR QUE ESTE MÓDULO TENÍA ───────────────────────────────
 *
 * 1. **La cita no se verificaba.** Bastaba una cadena no vacía para sellar el
 *    campo como «dictado» y mostrarla entrecomillada, como si fuera literal. Si
 *    el modelo se inventaba la frase, el sello la respaldaba. Ahora, cuando se
 *    conoce la transcripción, la cita tiene que APARECER en ella; si no, el
 *    campo baja a «ia» y la cita no se muestra.
 *
 * 2. **El valor editado quedaba sellado como dictado.** Los medicamentos se
 *    emparejan por NOMBRE pero el valor sellado incluye la dosis: el médico
 *    corregía la dosis y el campo seguía diciendo «dictado», con la cita del
 *    dictado ORIGINAL contradiciendo el valor mostrado. Un valor que cambió el
 *    médico es del médico.
 */
function origenDe(
  match: ItemExtraido | undefined,
  ctx?: { transcripcionNorm?: string; valorFinal?: string; valorExtraido?: string; sinExtraccion?: OrigenCampo },
): { origen: OrigenCampo; cita?: string; confianza?: Confianza } {
  if (!match) return { origen: ctx?.sinExtraccion ?? 'manual' }

  /**
   * ¿El médico CAMBIÓ el valor después de la extracción?
   *
   * Sólo se compara cuando la extracción trae ese dato. Que la extracción no
   * capturara la dosis y el médico la escriba no convierte el fármaco en «lo
   * escribió a mano»: el fármaco sí salió del dictado. Lo que no se puede es
   * seguir diciendo «dictado» sobre una dosis que el médico CORRIGIÓ, con la
   * cita del dictado original contradiciendo lo que se ve.
   */
  if (ctx?.valorFinal && ctx?.valorExtraido) {
    const a = normaliza(ctx.valorFinal), b = normaliza(ctx.valorExtraido)
    if (a !== b) return { origen: 'manual', confianza: match.confidence }
  }

  const cita = typeof match.source_quote === 'string' ? match.source_quote.trim() : ''
  if (!cita) return { origen: 'ia', confianza: match.confidence }

  // Si no se pasó la transcripción no se puede verificar; se conserva el
  // comportamiento anterior en vez de degradar algo que quizá era correcto.
  if (ctx?.transcripcionNorm && !ctx.transcripcionNorm.includes(normaliza(cita))) {
    return { origen: 'ia', confianza: match.confidence }
  }
  return { origen: 'dictado', cita, confianza: match.confidence }
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
  /**
   * `transcripcion`: para poder comprobar que la cita textual EXISTE.
   * `sinExtraccion`: qué origen darle a lo que no coincide con ninguna
   * extracción. Por defecto `manual` («lo escribió el médico»), que es falso
   * cuando la nota la produjo el parser local: ahí no hay bloque de extracción y
   * TODO salía como escrito a mano sobre datos de máquina.
   */
  opciones?: { transcripcion?: string; sinExtraccion?: OrigenCampo },
): ManifiestoProcedencia {
  const campos: CampoProcedencia[] = []
  const transcripcionNorm = opciones?.transcripcion ? normaliza(opciones.transcripcion) : undefined
  const sinExtraccion = opciones?.sinExtraccion

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
      id: `dx:${i}`, etiqueta: 'Diagnóstico', valor: desc,
      ...origenDe(item, { transcripcionNorm, sinExtraccion }),
      confirmado: confirmadoDe(indice >= 0 ? `dx:${indice}` : null),
    })
  })

  final.medicamentos?.forEach((med, i) => {
    const nom = String(med.nombre ?? '').trim()
    if (!nom) return
    const { item, indice } = buscar(extraction?.medicamentos, x => String(x.nombre ?? ''), nom)
    const valorFinal = [nom, med.dosis].filter(Boolean).join(' ').trim()
    // Sólo se puede comparar la dosis si la extracción trajo una.
    const dosisExtraida = String((item as { dosis?: string } | undefined)?.dosis ?? '').trim()
    const valorExtraido = item && dosisExtraida
      ? [item.nombre, dosisExtraida].filter(Boolean).join(' ').trim()
      : undefined
    campos.push({
      id: `med:${i}`, etiqueta: 'Medicamento', valor: valorFinal,
      ...origenDe(item, { transcripcionNorm, valorFinal, valorExtraido, sinExtraccion }),
      confirmado: confirmadoDe(indice >= 0 ? `med:${indice}` : null),
    })
  })

  final.alergias?.forEach((a, i) => {
    const alg = typeof a === 'string' ? a : String(a?.alergeno ?? '')
    if (!alg.trim()) return
    const { item, indice } = buscar(extraction?.alergias, x => String(x.alergeno ?? ''), alg)
    campos.push({
      id: `alg:${i}`, etiqueta: 'Alergia', valor: alg.trim(),
      ...origenDe(item, { transcripcionNorm, sinExtraccion }),
      confirmado: confirmadoDe(indice >= 0 ? `alg:${indice}` : null),
    })
  })

  if (final.signosVitales) {
    for (const [k, v] of Object.entries(final.signosVitales)) {
      if (v === null || v === undefined || v === '') continue
      const ex = extraction?.signosVitales?.[k]
      const cita = typeof ex?.source_quote === 'string' ? ex.source_quote.trim() : ''
      const citaVerificada = !!cita && (!transcripcionNorm || transcripcionNorm.includes(normaliza(cita)))
      const origen: OrigenCampo = ex ? (citaVerificada ? 'dictado' : 'ia') : (sinExtraccion ?? 'manual')
      campos.push({
        id: `sv:${k}`, etiqueta: `Signo vital ${k.toUpperCase()}`, valor: String(v),
        origen, cita: citaVerificada ? cita : undefined, confianza: ex?.confidence,
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
  // Los dos que no tienen autor humano: ni los dijo nadie ni los tecleó nadie.
  calculado: 'calculado por el sistema',
  importado: 'importado de un dispositivo',
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
