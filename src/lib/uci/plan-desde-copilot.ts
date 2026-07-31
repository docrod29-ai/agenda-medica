/**
 * EL PLAN DE LA NOTA, DESDE EL COPILOT — que su razonamiento llegue al documento.
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

export const ENCABEZADO_PROPUESTA =
  'PLAN PROPUESTO POR EL COPILOT — revisar, corregir y firmar. No es una indicación.'

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

  // Por sistema, y dentro de cada uno por prioridad: el pase se recorre así.
  const porSistema = new Map<string, ProblemaCopilot[]>()
  for (const p of problemas) {
    const k = p.sistema || 'otro'
    if (!porSistema.has(k)) porSistema.set(k, [])
    porSistema.get(k)!.push(p)
  }

  const bloques: string[] = [ENCABEZADO_PROPUESTA, '']
  for (const [sistema, ps] of porSistema) {
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
export function combinarPlan(planDelMedico: string, propuesto: PlanPropuesto): string {
  if (!propuesto.texto) return planDelMedico
  if (!planDelMedico.trim()) return propuesto.texto
  return `${planDelMedico.trim()}\n\n${propuesto.texto}`
}

export const POR_QUE_NO_SE_PEGA_SOLO =
  'El plan del Copilot NO entra en la nota al generarse: hay un botón. Y llega ' +
  'marcado como propuesta, para que quien lea la nota —o quien la audite mañana— ' +
  'sepa qué escribió una máquina y qué escribió el médico. Él edita y firma; la ' +
  'firma sigue siendo suya. Y si ya había escrito un plan, el propuesto va DEBAJO: ' +
  'sobrescribir lo que escribió un médico en su nota no se hace nunca.'
