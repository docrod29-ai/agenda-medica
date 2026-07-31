/**
 * EL ANÁLISIS DE LA NOTA, DESDE EL COPILOT.
 *
 * El Dr., el 30-jul-2026: «que funcione el copiloto CON la nota… y genere la
 * mejor nota con las mejores recomendaciones y plan incluido, ya para cuando
 * pasa a revisar y firmar». Y antes: «siento que es algo confuso y debe ayudar
 * al médico, no confundirlo».
 *
 * ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────
 *
 * El Copilot razonaba en su propio recuadro y ahí se quedaba. El médico lo leía,
 * cerraba el panel, y **escribía el plan a mano** — otra vez, con lo que acababa
 * de leer. Dos superficies que dicen lo mismo y ninguna que se firme.
 *
 * Esto lleva su razonamiento a la sección de plan. Nada más.
 *
 * ── LO QUE NO HACE, Y ES LO IMPORTANTE ───────────────────────────────────────
 *
 * **No indica tratamientos ni pone dosis.** El Copilot está construido para
 * sugerir QUÉ VERIFICAR y QUÉ DECIDIR, no para dar órdenes, y este módulo no le
 * cambia el papel: convierte sus problemas en un plan **propuesto**, sistema por
 * sistema, con lo que falta por resolver.
 *
 * **Nada entra en la nota sin que el médico lo pida.** No se pega solo al
 * generar: hay un botón. Y el texto llega marcado como propuesta, para que quien
 * lo lea —o quien audite la nota mañana— sepa qué escribió una máquina y qué
 * escribió el médico. Él edita y firma; la firma sigue siendo suya.
 *
 * Módulo PURO.
 */

import type { FusionCopilot, ProblemaCopilot } from '@/lib/uci/copilot'

/** Nombre legible de cada sistema, para encabezar su bloque del plan. */
const SISTEMA: Readonly<Record<string, string>> = {
  neurologico: 'Neurológico',
  respiratorio: 'Respiratorio',
  hemodinamico: 'Hemodinámico',
  abdominodigestivo: 'Abdominodigestivo',
  hidrometabolico: 'Hidrometabólico',
  hematoinfeccioso: 'Hematoinfeccioso',
  musculoesqueletico: 'Musculoesquelético',
}

const ORDEN = ['alta', 'media', 'baja'] as const

/** El orden en que se recorre un pase de UCI. Lo que no esté, al final. */
const ORDEN_SISTEMAS = [
  'neurologico', 'respiratorio', 'hemodinamico', 'abdominodigestivo',
  'hidrometabolico', 'hematoinfeccioso', 'musculoesqueletico',
]
const indiceSistema = (s: string) => {
  const i = ORDEN_SISTEMAS.indexOf(s)
  return i === -1 ? ORDEN_SISTEMAS.length : i
}

export interface PlanPropuesto {
  /** Texto listo para la sección «Plan por sistema». Vacío si no hay nada. */
  texto: string
  /** Cuántos problemas entraron. */
  problemas: number
  /** Cuántos venían de la segunda opinión y el primario no tocó. */
  divergencias: number
  /** Marca para que se distinga de lo que escribió el médico. */
  encabezado: string
}

/**
 * ── EL ERROR QUE ESTO CORRIGE ────────────────────────────────────────────────
 *
 * La primera versión metía esto en «Plan por sistema». El Dr.: «el plan deben ser
 * indicaciones; cuando pasas el plan a la nota lo mandas todo reborujado — más
 * bien lo que pasas es el ANÁLISIS, pero debe ser ordenado».
 *
 * Tiene razón y la distinción es de documentación clínica, no de estilo:
 *
 *   · **Análisis** — qué está pasando y por qué. Razonamiento.
 *   · **Plan** — qué se va a HACER. Indicaciones: fármaco, dosis, parámetro,
 *     estudio a solicitar. Se ejecuta.
 *
 * El Copilot está construido para razonar y para señalar qué verificar, NO para
 * dar órdenes. Así que su salida es análisis y va al análisis. El plan lo escribe
 * el médico, porque el plan lo firma el médico y alguien lo va a ejecutar.
 *
 * Meter razonamiento en la sección de indicaciones no era sólo desordenado: hacía
 * que una nota pareciera ordenar algo que nadie ordenó.
 */
export const ENCABEZADO_PROPUESTA =
  'ANÁLISIS PROPUESTO POR EL COPILOT — revisar y corregir. No son indicaciones.'

/**
 * Un problema del Copilot, como renglón de plan.
 *
 * Se conserva SU redacción. Reescribirla sería interpretar un razonamiento
 * clínico, que es justo lo que no toca hacer aquí.
 */
function comoPlan(p: ProblemaCopilot): string {
  const partes: string[] = [`${p.titulo}.`]
  if (p.porque?.trim()) partes.push(p.porque.trim().replace(/\.?$/, '.'))
  if (p.faltante?.trim()) partes.push(`Falta para decidir: ${p.faltante.trim().replace(/\.?$/, '.')}`)
  return partes.join(' ')
}

/**
 * Arma el plan a partir de la síntesis del Copilot.
 *
 * @param f la fusión de las dos opiniones, tal como la devolvió la ruta.
 * @returns el plan propuesto. `texto` vacío si el Copilot no encontró nada — y
 *   eso NO se rellena con una frase de relleno: si no hay problemas que plantear,
 *   la sección se queda vacía y el médico escribe lo suyo.
 */
export function planDesdeCopilot(f: FusionCopilot | null): PlanPropuesto {
  const vacio: PlanPropuesto = { texto: '', problemas: 0, divergencias: 0, encabezado: ENCABEZADO_PROPUESTA }
  if (!f) return vacio

  const problemas = f.primario?.problemas ?? []
  const divergencias = f.divergencias ?? []
  if (problemas.length === 0 && divergencias.length === 0) return vacio

  /**
   * En el ORDEN DEL PASE, no en el que los devolvió el modelo.
   *
   * De ahí venía el «reborujado»: un `Map` conserva el orden de llegada, así que
   * la nota salía hidrometabólico, luego neuro, luego respiratorio… según lo que
   * al modelo se le ocurriera primero. Un pase de UCI se recorre siempre igual —
   * neuro, respiratorio, hemodinámico— y la nota tiene que leerse así.
   */
  const porSistema = new Map<string, ProblemaCopilot[]>()
  for (const p of problemas) {
    const k = p.sistema || 'otro'
    if (!porSistema.has(k)) porSistema.set(k, [])
    porSistema.get(k)!.push(p)
  }
  const sistemasOrdenados = [...porSistema.entries()].sort(
    (a, b) => indiceSistema(a[0]) - indiceSistema(b[0]))

  const bloques: string[] = [ENCABEZADO_PROPUESTA, '']
  for (const [sistema, ps] of sistemasOrdenados) {
    ps.sort((a, b) => ORDEN.indexOf(a.prioridad) - ORDEN.indexOf(b.prioridad))
    bloques.push(`${SISTEMA[sistema] ?? sistema}`)
    for (const p of ps) bloques.push(`· ${comoPlan(p)}`)
    bloques.push('')
  }

  if (divergencias.length > 0) {
    /**
     * Las divergencias van APARTE y se dicen como lo que son.
     *
     * Son puntos que la segunda opinión levantó y la primera no tocó. Mezclarlas
     * con el resto las haría pasar por consenso, y el valor de pedir dos
     * opiniones es justamente ver dónde NO coinciden.
     */
    bloques.push('La segunda opinión añade (no coincide con la primera)')
    for (const p of divergencias) bloques.push(`· ${comoPlan(p)}`)
    bloques.push('')
  }

  return {
    texto: bloques.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    problemas: problemas.length,
    divergencias: divergencias.length,
    encabezado: ENCABEZADO_PROPUESTA,
  }
}

/**
 * Añade el plan propuesto a lo que el médico ya escribió, sin pisarlo.
 *
 * Si él ya redactó un plan, el del Copilot va DEBAJO. Sobrescribir lo que
 * escribió un médico en su nota no se hace nunca.
 */
export function combinarPlan(analisisDelMedico: string, propuesto: PlanPropuesto): string {
  if (!propuesto.texto) return analisisDelMedico
  if (!analisisDelMedico.trim()) return propuesto.texto
  return `${analisisDelMedico.trim()}\n\n${propuesto.texto}`
}

export const POR_QUE_NO_SE_PEGA_SOLO =
  'El análisis del Copilot NO entra en la nota al generarse: hay un botón. Y llega ' +
  'marcado como propuesta, para que quien lea la nota —o quien la audite mañana— ' +
  'sepa qué escribió una máquina y qué escribió el médico. Él edita y firma; la ' +
  'firma sigue siendo suya. Y si ya había escrito un plan, el propuesto va DEBAJO: ' +
  'sobrescribir lo que escribió un médico en su nota no se hace nunca.'
