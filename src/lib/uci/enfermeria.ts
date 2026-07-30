/**
 * VISTA DE ENFERMERÍA DE UCI — charter §40.
 *
 * El charter la deja **después del núcleo médico** a propósito, y así se hizo:
 * esto no inventa ningún motor. Compone los que ya existen —el MAR (§37) y la
 * antigüedad de la última toma (§3)— en una sola lista de lo que hay que hacer
 * ahora, en toda la unidad.
 *
 * ── LO QUE ESTE MÓDULO NO SABE, Y LO DICE ────────────────────────────────────
 *
 * **No prioriza clínicamente.** Ordena por el estado del REGISTRO, no por la
 * gravedad de lo que está pendiente: un antibiótico atrasado y una vitamina
 * atrasada se ven exactamente igual desde aquí, porque el módulo no sabe cuál
 * importa más y fingir que sí sería un juicio clínico.
 *
 * Quien lea la lista tiene que saberlo, y por eso `NO_PRIORIZA_CLINICAMENTE`
 * está en pantalla, no en un comentario.
 *
 * ── DE DÓNDE SALE CADA TAREA ─────────────────────────────────────────────────
 *
 * De un hecho registrado, siempre:
 *  · **medicamento atrasado / toca** — del motor del MAR, con la gracia que fija
 *    la unidad. Infusión continua, PRN y dosis única **nunca** aparecen aquí.
 *  · **sin toma** — no hay ninguna medición en el episodio.
 *  · **horario ilegible** — una orden activa cuyo horario no se pudo interpretar.
 *    Es trabajo para el médico, pero enfermería es quien se topa con ella.
 *
 * Nada sale de una sugerencia ni de una regla que nadie escribió.
 *
 * Módulo PURO.
 */

import type { Indicacion } from '@/types/hospital'
import { vistaMar, FALTA_GRACIA, type LineaMar } from '@/lib/uci/mar'

export const TIPOS_TAREA = [
  'medicamento_atrasado', 'medicamento_toca', 'sin_toma', 'horario_ilegible',
] as const
export type TipoTarea = (typeof TIPOS_TAREA)[number]

export const TAREA_LABEL: Record<TipoTarea, string> = {
  medicamento_atrasado: 'Atrasado',
  medicamento_toca: 'Toca',
  sin_toma: 'Sin tomas',
  horario_ilegible: 'Horario ilegible',
}

export interface TareaEnfermeria {
  internamientoId: string
  pacienteNombre: string
  cama: string | null
  tipo: TipoTarea
  /** Frase lista para la pantalla, ya redactada por el motor de origen. */
  texto: string
  /** Desde cuándo aplica, si el motor lo sabe. */
  desdeIso: string | null
}

export interface PacienteEnfermeria {
  internamientoId: string
  pacienteNombre: string
  cama?: string | null
  indicaciones?: readonly Indicacion[]
  /** Horas desde la última toma vigente. `null` si no hay ninguna. */
  horasDesdeUltimaToma: number | null
}

export const NO_PRIORIZA_CLINICAMENTE =
  'Esta lista ordena por el estado del REGISTRO, no por gravedad clínica: un ' +
  'antibiótico atrasado y una vitamina atrasada se ven igual aquí. El sistema no ' +
  'sabe cuál importa más, y decidirlo es criterio de quien está en la cabecera.'

/** Orden: primero lo que ya se pasó de hora. */
const PESO: Record<TipoTarea, number> = {
  medicamento_atrasado: 0,
  sin_toma: 1,
  medicamento_toca: 2,
  horario_ilegible: 3,
}

/**
 * Tareas de UN paciente.
 *
 * @param graciaMin minutos de margen del MAR. **Obligatorio**: lo fija la unidad.
 */
export function tareasDePaciente(
  p: PacienteEnfermeria,
  ahoraIso: string,
  graciaMin: number,
): TareaEnfermeria[] {
  // La gracia se valida AQUÍ, no sólo dentro del MAR: si el paciente no tiene
  // ninguna indicación, `vistaMar` no llega a comprobarla y una gracia inválida
  // pasaba en silencio. Un caso del golden lo encontró.
  if (!Number.isFinite(graciaMin) || graciaMin < 0) {
    throw new Error(`tareasDePaciente: gracia inválida «${graciaMin}». ${FALTA_GRACIA}`)
  }

  const base = {
    internamientoId: p.internamientoId,
    pacienteNombre: p.pacienteNombre,
    cama: p.cama?.trim() || null,
  }
  const tareas: TareaEnfermeria[] = []

  if (p.horasDesdeUltimaToma === null) {
    tareas.push({
      ...base, tipo: 'sin_toma', desdeIso: null,
      texto: 'Sin ninguna toma registrada en el episodio.',
    })
  }

  const v = vistaMar(p.indicaciones ?? [], ahoraIso, graciaMin)
  const deLinea = (l: LineaMar, tipo: TipoTarea): TareaEnfermeria => ({
    ...base, tipo, texto: `${l.descripcion} — ${l.mensaje}`,
    desdeIso: tipo === 'medicamento_atrasado' ? l.atrasadaDesde : l.tocaDesde,
  })

  for (const l of v.lineas) {
    if (l.estado === 'atrasado') tareas.push(deLinea(l, 'medicamento_atrasado'))
    else if (l.estado === 'toca') tareas.push(deLinea(l, 'medicamento_toca'))
    else if (l.estado === 'horario_no_interpretable') {
      tareas.push({
        ...base, tipo: 'horario_ilegible', desdeIso: null,
        texto: `${l.descripcion} — ${l.mensaje}`,
      })
    }
  }

  return tareas
}

/**
 * Ordena la lista de toda la unidad.
 *
 * Por tipo primero y, dentro del mismo tipo, por cama — para que la lista no
 * baile entre recargas y se pueda recorrer la unidad en orden físico.
 */
export function ordenarTareas(tareas: readonly TareaEnfermeria[]): TareaEnfermeria[] {
  return [...tareas].sort((a, b) => {
    const d = PESO[a.tipo] - PESO[b.tipo]
    if (d !== 0) return d
    return (a.cama ?? '').localeCompare(b.cama ?? '', 'es', { numeric: true })
  })
}

export interface ResumenEnfermeria {
  tareas: TareaEnfermeria[]
  /** Cuántas de cada tipo. Sólo aparecen los tipos con al menos una. */
  conteo: Partial<Record<TipoTarea, number>>
  /** Pacientes sin ninguna tarea: la lista también dice quién está al día. */
  sinTareas: string[]
}

/** La lista completa de la unidad. */
export function turnoDeEnfermeria(
  pacientes: readonly PacienteEnfermeria[],
  ahoraIso: string,
  graciaMin: number,
): ResumenEnfermeria {
  const todas: TareaEnfermeria[] = []
  const sinTareas: string[] = []

  for (const p of pacientes) {
    const t = tareasDePaciente(p, ahoraIso, graciaMin)
    if (t.length === 0) sinTareas.push(p.internamientoId)
    todas.push(...t)
  }

  const conteo: Partial<Record<TipoTarea, number>> = {}
  for (const t of todas) conteo[t.tipo] = (conteo[t.tipo] ?? 0) + 1

  return { tareas: ordenarTareas(todas), conteo, sinTareas }
}
