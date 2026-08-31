/**
 * «AGENDADA» ERA UNA DECLARACIÓN, NO UN HECHO DEL CALENDARIO.
 *
 * ── QUÉ FALTABA (WS-11.estados-del-cierre) ──────────────────────────────────
 *
 * REG-404 añadió `agendada` como estado VIVO, y arregló algo grave: antes el
 * pendiente de seguimiento se **cerraba** al crear la cita, así que agendar
 * contaba como haber visto al paciente y un no-show no reabría nada.
 *
 * Quedó la otra mitad, y el censo la nombraba: **`agendada` es lo que alguien
 * declaró, no lo que el calendario dice.** `TareaClinica` no tenía un solo campo
 * que apuntara a la cita. Consecuencia: si esa cita se cancela, se reagenda o el
 * paciente no viene, el pendiente se queda en `agendada` —el worklist lo lee
 * como `esperando_paciente`— **para siempre**. No hay a quién esperar, y el
 * seguimiento se evapora en silencio.
 *
 * Es justo lo contrario de lo que promete este eje: que un pendiente no
 * desaparezca.
 *
 * ── POR QUÉ HACÍA FALTA UN CAMPO, Y NO SÓLO UN CRUCE ────────────────────────
 *
 * Sin `citaId` no hay cruce posible: casar por paciente y fecha sería adivinar
 * cuál de sus citas es, y un paciente con dos controles el mismo mes tendría
 * dos candidatas indistinguibles. Es el patrón de REG-422: el identificador lo
 * acuña quien hace la acción y viaja con ella, en su propio campo — meterlo en
 * `notaId` sería un campo haciendo dos trabajos, que es REG-418.
 *
 * ── LO QUE ESTE MÓDULO NO DECIDE ────────────────────────────────────────────
 *
 * **No mueve la tarea.** Qué hacer cuando el paciente no vino —cuánto se espera,
 * si escala, a quién— es política clínica del médico y está declarada en
 * `LA_PREGUNTA_PARA_EL_DUENO`. Este módulo dice **qué pasó**; el acto lo sigue
 * haciendo una persona.
 *
 * **Y no convierte la ausencia en un hecho.** Una tarea antigua sin `citaId`, o
 * una cita que no está cargada, salen `no_consta` — nunca «la cita ya no está».
 * Ausencia de dato no es dato de ausencia.
 *
 * Módulo PURO.
 */
import type { AppointmentStatus } from '@/types'

/** Qué dice el calendario sobre una tarea que se declaró agendada. */
export type VeredictoDeCalendario =
  /** La cita existe y sigue en pie. La declaración se sostiene. */
  | 'coincide'
  /** La cita se canceló o se movió: ya no hay nada puesto. */
  | 'la_cita_ya_no_esta'
  /** La cita pasó y el paciente no vino. */
  | 'el_paciente_no_vino'
  /** La cita pasó y el paciente sí vino: el pendiente ya no está esperando. */
  | 'el_paciente_ya_vino'
  /** No se puede saber. NO significa que la cita no exista. */
  | 'no_consta'

export interface LecturaDelCalendario {
  readonly veredicto: VeredictoDeCalendario
  /** Qué se le dice al médico. Vacío cuando no hay nada que decir. */
  readonly frase: string
  /** ¿Hay que mirarlo? `coincide` y `no_consta` no piden nada. */
  readonly pideAtencion: boolean
}

/** Lo mínimo que hace falta de una cita para juzgar la declaración. */
export interface CitaLeible {
  readonly id: string
  readonly estado: AppointmentStatus
}

/** Lo mínimo que hace falta de la tarea. */
export interface TareaLeible {
  readonly estado: string
  readonly citaId?: string
}

/**
 * Los estados de cita que dejan al pendiente **sin nada puesto**.
 *
 * `reagendada` está aquí a propósito y es el caso que más se pierde: la cita se
 * movió, así que la que el pendiente nombraba ya no existe. Que haya otra nueva
 * no lo sabe este módulo, y suponerlo sería inventar el vínculo.
 */
const YA_NO_HAY_CITA: ReadonlySet<AppointmentStatus> = new Set<AppointmentStatus>([
  'cancelada', 'reagendada',
])

/** Los estados que dicen que el paciente NO vino. */
const NO_VINO: ReadonlySet<AppointmentStatus> = new Set<AppointmentStatus>(['no-asistio'])

/** Los estados que dicen que el paciente SÍ vino. */
const YA_VINO: ReadonlySet<AppointmentStatus> = new Set<AppointmentStatus>([
  'en-consulta', 'atendida', 'finalizada', 'pendiente-pago', 'pagada',
])

/**
 * Qué dice el calendario de una tarea declarada `agendada`.
 *
 * `cita` es `undefined` cuando no se cargó, y `null` cuando se buscó y **no
 * existe**. Los dos salen `no_consta` hoy, pero se reciben distintos a
 * propósito: son hechos distintos y el día que haya que actuar sobre «la cita
 * fue borrada» el dato estará aquí, no habrá que volver a buscarlo.
 */
export function loQueElCalendarioDice(
  tarea: TareaLeible,
  cita: CitaLeible | null | undefined,
): LecturaDelCalendario {
  if (tarea.estado !== 'agendada') {
    return { veredicto: 'no_consta', frase: '', pideAtencion: false }
  }
  if (!tarea.citaId) {
    /**
     * Tarea anterior a este campo. No se marca como problema: no lo es, y
     * pintarlo en cada pendiente viejo sería ruido que enseña a ignorar el
     * aviso que sí importa.
     */
    return { veredicto: 'no_consta', frase: '', pideAtencion: false }
  }
  if (!cita) return { veredicto: 'no_consta', frase: '', pideAtencion: false }
  /**
   * La cita que se nombró no es la que llegó. Se prefiere no opinar antes que
   * opinar sobre otra: sería peor que callarse.
   */
  if (cita.id !== tarea.citaId) return { veredicto: 'no_consta', frase: '', pideAtencion: false }

  if (YA_NO_HAY_CITA.has(cita.estado)) {
    return {
      veredicto: 'la_cita_ya_no_esta',
      frase: 'La cita que tenía puesta ya no está: se canceló o se movió. El seguimiento sigue pendiente.',
      pideAtencion: true,
    }
  }
  if (NO_VINO.has(cita.estado)) {
    return {
      veredicto: 'el_paciente_no_vino',
      frase: 'El paciente no acudió a la cita. El seguimiento sigue pendiente.',
      pideAtencion: true,
    }
  }
  if (YA_VINO.has(cita.estado)) {
    return {
      veredicto: 'el_paciente_ya_vino',
      frase: 'El paciente ya acudió a esa cita: este pendiente ya no está esperando.',
      pideAtencion: true,
    }
  }
  return { veredicto: 'coincide', frase: '', pideAtencion: false }
}


export const POR_QUE_HACE_FALTA_EL_ID =
  'Porque sin `citaId` no hay cruce posible. Casar por paciente y fecha sería '
  + 'adivinar cuál de sus citas es, y un paciente con dos controles el mismo mes '
  + 'tendría dos candidatas indistinguibles. El identificador lo acuña quien '
  + 'agenda y viaja con la tarea, en su propio campo — como en REG-422.'

export const POR_QUE_NO_SE_MUEVE_LA_TAREA =
  'Porque qué hacer cuando el paciente no vino —cuánto se espera, si escala, a '
  + 'quién— es política clínica del médico. Este módulo dice QUÉ PASÓ; el acto lo '
  + 'sigue haciendo una persona. Mover la tarea sola sería el defecto que REG-404 '
  + 'cerró, con el signo cambiado.'

export const LA_PREGUNTA_PARA_EL_DUENO =
  'NEEDS_CLINICAL_REVIEW. Cuando un paciente no acude a la cita de seguimiento: '
  + '¿cuánto se espera antes de que el pendiente vuelva a pedir acción, y escala a '
  + 'alguien? Hoy se marca y se enseña, y el pendiente sigue vivo sin vencimiento. '
  + 'Sin ese plazo no se puede poner `venceEn`, y ponerlo por nuestra cuenta sería '
  + 'inventar un criterio de seguimiento clínico.'

export const LO_QUE_NO_SE_VIGILA: readonly string[] = [
  'Si una cita `reagendada` tiene una cita NUEVA detrás. Se sabe que la que el pendiente nombraba ya no existe; que exista otra no lo dice este dato, y suponerlo sería inventar el vínculo.',
  'Las tareas anteriores a `citaId`: salen `no_consta`, que es «no se puede saber», nunca «no hay cita».',
  'Los pendientes que NO son de seguimiento. `agendada` sólo tiene sentido cuando lo que se espera es que el paciente venga.',
  'Que la cita sea del mismo paciente que la tarea. Se compara el identificador que la tarea guardó, y quien lo guardó es quien agendó.',
]


/**
 * EL TOPE DE LECTURAS DEL CALENDARIO.
 *
 * No es una cifra clínica: es cuántas citas se leen de una pasada para no
 * convertir la pantalla más visitada del médico en una lectura sin cota, que es
 * lo que WS-03 persigue. El worklist ya viene topado; esto sólo garantiza que un
 * cambio en aquel tope no arrastre a éste sin que nadie lo decida.
 */
export const TOPE_CITAS_A_LEER = 40

/**
 * Los identificadores de cita que hay que leer para juzgar un worklist.
 *
 * Sólo de las tareas declaradas `agendada` y que traen `citaId` — las viejas no
 * lo tienen y no hay nada que leer por ellas. Sin repetir, y topado.
 */
export function citasQueHayQueLeer(
  tareas: readonly TareaLeible[], tope = TOPE_CITAS_A_LEER,
): string[] {
  const ids: string[] = []
  for (const t of tareas ?? []) {
    if (t.estado !== 'agendada') continue
    const id = String(t.citaId ?? '').trim()
    if (!id || ids.includes(id)) continue
    ids.push(id)
    if (ids.length >= tope) break
  }
  return ids
}
