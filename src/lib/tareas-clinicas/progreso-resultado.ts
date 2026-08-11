/**
 * V15-RESULTS-CLOSURE-001 (Fase 6, §9 del master loop) — el progreso de UN
 * resultado como las ocho etapas que pide el master loop, no como un semáforo
 * de tres estados.
 *
 * ── EL HALLAZGO, ANTES DE ESCRIBIR CÓDIGO ───────────────────────────────────
 *
 * §9 pide: RESULT → SIGNIFICANCE → OWNER → REVIEW → DECISION → ACTION →
 * PATIENT COMMUNICATION → CLOSED, «como cola de trabajo, no como tabla
 * estática».
 *
 * `TareaClinica` (`./modelo.ts`) sólo tiene dato real para CINCO de las ocho:
 *
 *   RESULT        — la tarea existe.
 *   SIGNIFICANCE  — `prioridad`, obligatorio desde que la tarea nace.
 *   OWNER         — `ownerUid`/`ownerNombre`.
 *   REVIEW        — la progresión de `estado` (aceptada → en_curso).
 *   CLOSED        — `estado === 'cerrada'`.
 *
 * DECISION, ACTION y PATIENT COMMUNICATION **no tienen campo propio**. El
 * propio modelo lo dice en `POR_QUE_COMPLETADA_NO_ES_CERRADA`: «cerrada» es
 * que alguien LO MIRÓ y decidió — hoy «cerrar» es el único acto, y abarca las
 * tres etapas de golpe sin registrar cada una por separado. Ni siquiera
 * después de cerrar hay campo que diga QUÉ se decidió, QUÉ acción se tomó o
 * SI se avisó al paciente.
 *
 * Rellenar esas tres con "hecha" en cuanto `estado === 'cerrada'` sería
 * INVENTAR un dato que el sistema no tiene — justo lo que la regla 5 de
 * seguridad clínica prohíbe («señalar de menos, nunca de más»: que falte un
 * dato significa que ESO no se vigila, no que se dé por bueno). Por eso las
 * tres quedan `sin_dato` SIEMPRE, cerrada o no — es el hallazgo estructural
 * de esta fase, no un defecto de esta función.
 *
 * Módulo PURO — ninguna consulta a Firestore, ningún cálculo clínico.
 */
import type { EstadoTarea, Prioridad, TareaClinica } from './modelo'

export type EstadoEtapa = 'hecha' | 'actual' | 'pendiente' | 'sin_dato'

export interface EtapaResultado {
  clave: string
  etiqueta: string
  estado: EstadoEtapa
  /** Sólo presente cuando `estado === 'sin_dato'`: por qué no se puede saber. */
  motivoSinDato?: string
}

/**
 * Los dos tipos de `TareaClinica` que SON un resultado en el sentido de §9:
 * un estudio pedido que falta, o un resultado que ya llegó y falta revisar.
 * Un seguimiento o una receta por entregar no son "resultados" — no se les
 * pinta esta pista para no sugerir una etapa que no aplica.
 */
const TIPOS_DE_RESULTADO = new Set(['estudio_pendiente', 'resultado_por_revisar'])

export function esTareaDeResultado(tipo: string): boolean {
  return TIPOS_DE_RESULTADO.has(tipo)
}

const MOTIVO_SIN_DATO_CIERRE =
  'No se registra aparte de "cerrar" la tarea: hoy ese único acto abarca decisión, acción y aviso al paciente sin distinguirlos.'

function etapaSinDato(clave: string, etiqueta: string): EtapaResultado {
  return { clave, etiqueta, estado: 'sin_dato', motivoSinDato: MOTIVO_SIN_DATO_CIERRE }
}

export function progresoResultado(
  t: Pick<TareaClinica, 'estado' | 'ownerUid'> & { prioridad?: Prioridad },
): EtapaResultado[] {
  const estado: EstadoTarea = t.estado
  const terminal = estado === 'cerrada' || estado === 'cancelada'
  const tieneDueno = !!t.ownerUid
  const enRevision = estado === 'en_curso' || estado === 'completada' || estado === 'cerrada'
  const cerrada = estado === 'cerrada'

  // «actual» sólo se marca en la primera etapa sin completar de una tarea
  // viva: una terminal (cerrada/cancelada) no tiene "siguiente paso".
  const actualEsDueno = !terminal && !tieneDueno
  const actualEsRevision = !terminal && tieneDueno && !enRevision
  const actualEsCierre = !terminal && enRevision

  const marcar = (hecha: boolean, actual: boolean): EstadoEtapa => (hecha ? 'hecha' : actual ? 'actual' : 'pendiente')

  return [
    { clave: 'resultado', etiqueta: 'Resultado', estado: 'hecha' },
    { clave: 'significado', etiqueta: 'Significado', estado: 'hecha' },
    { clave: 'dueno', etiqueta: 'Dueño', estado: marcar(tieneDueno, actualEsDueno) },
    { clave: 'revision', etiqueta: 'Revisión', estado: marcar(enRevision, actualEsRevision) },
    etapaSinDato('decision', 'Decisión'),
    etapaSinDato('accion', 'Acción'),
    etapaSinDato('aviso_paciente', 'Aviso al paciente'),
    { clave: 'cerrado', etiqueta: 'Cerrado', estado: marcar(cerrada, actualEsCierre) },
  ]
}
