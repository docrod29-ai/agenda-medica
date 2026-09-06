/**
 * V15-FOLLOWUP-WORK-001 (Fase 7, §10 del master loop) — agrupar `/pendientes`
 * por ESTADO DE ACCIÓN, no por el orden binario urgente/resto que traía desde
 * antes de V15.
 *
 * ── LO QUE PIDE §10 ──────────────────────────────────────────────────────────
 *
 * «Group by action state, not by arbitrary module: needs review · waiting on
 * patient · waiting on result · needs scheduling · needs communication ·
 * needs signature · overdue · closed recently.»
 *
 * ── LO QUE `TareaClinica` PUEDE RESPONDER HOY, Y LO QUE NO ──────────────────
 *
 * De las ocho, CINCO tienen una señal real e inequívoca en el modelo actual
 * (`./modelo.ts`, `./derivar.ts`):
 *
 *   OVERDUE           — `estaVencida()`. Ya existía y ya lo prueba `modelo`.
 *   NEEDS REVIEW       — `tipo === 'resultado_por_revisar'` (el resultado YA
 *                        llegó, según su propio texto de creación: «llegó y
 *                        nadie lo ha mirado») O `estado === 'completada'`
 *                        (el trabajo se hizo, cualquiera sea el tipo — la
 *                        distinción completada≠cerrada que ya documenta
 *                        `POR_QUE_COMPLETADA_NO_ES_CERRADA`).
 *   WAITING ON RESULT  — `tipo === 'estudio_pendiente'` mientras sigue viva:
 *                        su propio comentario de tipo dice «se pidió un
 *                        laboratorio o gabinete y falta el resultado».
 *   NEEDS SCHEDULING   — `tipo === 'seguimiento'`: «volver a ver al
 *                        paciente» es, literalmente, agendar.
 *   WAITING ON PATIENT — `tipo === 'receta_por_entregar'`: `derivar.ts` la
 *                        crea con el detalle «se cierra cuando el paciente
 *                        la tiene» — es E­SO lo que se espera, no una
 *                        respuesta del laboratorio.
 *
 * CLOSED RECENTLY no tiene señal en `tareasVivas()` — esa consulta EXCLUYE
 * `cerrada` a propósito (comentario en `firestore.ts`: «Las tareas VIVAS»).
 * Mostrarlo exige una lectura aparte; queda fuera de este módulo puro y es la
 * rebanada siguiente de esta misma fase (anotado en
 * `agent-state/V15_CURRENT_ITERATION.md`, no un olvido).
 *
 * NEEDS COMMUNICATION y NEEDS SIGNATURE **no tienen tipo ni campo que las
 * distinga hoy** de ninguna otra tarea — inventar esa distinción sería
 * exactamente lo que la regla 5 de seguridad clínica prohíbe («señalar de
 * menos, nunca de más»: que falte una categoría significa que ESE recorte no
 * se vigila, no que se reparta entre las demás). `reconciliacion_medicamento`
 * (una discrepancia de medicamento que el médico debe decidir) e
 * `indicacion_paciente` (sin productor todavía, ver `modelo.ts`) y `otra`
 * caen en `otros` — declarado, no forzado a encajar en una de las siete
 * anteriores.
 *
 * Módulo PURO — ninguna consulta a Firestore, ningún cálculo clínico.
 */
import { estaVencida, type TareaClinica } from './modelo'

export type EstadoDeAccion =
  | 'vencida'
  | 'necesita_revision'
  | 'esperando_resultado'
  | 'necesita_agendar'
  | 'esperando_paciente'
  | 'otros'

export const ETIQUETA_ESTADO_DE_ACCION: Record<EstadoDeAccion, string> = {
  vencida: 'Vencidos',
  necesita_revision: 'Necesita revisión',
  esperando_resultado: 'Esperando resultado',
  necesita_agendar: 'Necesita agendar',
  esperando_paciente: 'Esperando al paciente',
  otros: 'Otros pendientes',
}

/** El orden en que se pintan los grupos — lo más accionable primero. */
export const ORDEN_ESTADO_DE_ACCION: readonly EstadoDeAccion[] = [
  'vencida',
  'necesita_revision',
  'esperando_resultado',
  'necesita_agendar',
  'esperando_paciente',
  'otros',
]

/**
 * Una tarea, un grupo — nunca dos. El orden de los `if` ES la prioridad: una
 * tarea vencida se enseña como vencida aunque también sea, por tipo, «un
 * resultado por revisar» — la fecha vencida es la urgencia mayor.
 */
export function estadoDeAccion(
  t: Pick<TareaClinica, 'estado' | 'tipo' | 'venceEn'>,
  ahoraMs: number,
): EstadoDeAccion {
  if (estaVencida(t, ahoraMs)) return 'vencida'
  if (t.tipo === 'resultado_por_revisar' || t.estado === 'completada') return 'necesita_revision'
  if (t.tipo === 'estudio_pendiente') return 'esperando_resultado'
  /**
   * UN SEGUIMIENTO YA AGENDADO NO NECESITA AGENDARSE (REG-404).
   *
   * Antes no había forma de distinguirlos: la tarea se cerraba al agendar, así
   * que todo `seguimiento` vivo estaba, por definición, sin agendar. Con
   * `agendada` como estado vivo lo que se espera ya no es una acción del
   * consultorio sino que el paciente venga — que es exactamente
   * `esperando_paciente`, la categoría que ya existe. No hace falta una nueva.
   */
  if (t.tipo === 'seguimiento') return t.estado === 'agendada' ? 'esperando_paciente' : 'necesita_agendar'
  if (t.tipo === 'receta_por_entregar') return 'esperando_paciente'
  /**
   * UNA PREGUNTA ESCALADA ES «LLEGÓ Y NADIE LO HA MIRADO» (REG-521).
   *
   * Es la misma forma que el resultado por revisar: un dato que entró de fuera
   * —aquí del paciente, allí del laboratorio— y espera a que un humano del
   * consultorio lo lea y decida. No es una categoría nueva: es la que ya existe
   * para eso. Dejarla en `otros` la habría puesto al final de la pantalla, que
   * es exactamente donde una pregunta urgente no puede estar.
   */
  if (t.tipo === 'pregunta_paciente') return 'necesita_revision'
  return 'otros'
}
