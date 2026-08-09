/**
 * EL CABO SUELTO QUE NADIE RECOGE.
 *
 * ── EL PROBLEMA, QUE NO ES DE SOFTWARE ───────────────────────────────────────
 *
 * El médico pide una biometría, lo escribe en el plan, firma la nota y sigue con
 * el siguiente paciente. El estudio se hace. El resultado llega. Y ahí se queda,
 * porque el pendiente vivía en una frase dentro de una nota firmada — un sitio
 * donde nadie vuelve a mirar salvo que sospeche que hay algo.
 *
 * «No dar seguimiento a un resultado» es de las causas más constantes de daño
 * evitable en consulta externa, y no ocurre por ignorancia clínica: ocurre
 * porque el pendiente no tiene dueño, ni fecha, ni sitio donde reclamarse.
 *
 * ── LO QUE ESTE MÓDULO AÑADE ─────────────────────────────────────────────────
 *
 * Convierte esos cabos en una ENTIDAD con las tres cosas que les faltaban:
 *
 *   · un DUEÑO — una tarea sin dueño es una tarea que nadie hace;
 *   · una FECHA — sin ella «pendiente» dura para siempre;
 *   · un ESTADO que distingue hacer de cerrar.
 *
 * ── COMPLETADA NO ES CERRADA, Y ES LA DISTINCIÓN QUE SOSTIENE TODO ───────────
 *
 * «Completada» es que el trabajo se hizo: se sacó la sangre, salió el
 * resultado. «Cerrada» es que alguien LO MIRÓ y decidió. Entre esas dos vive
 * exactamente el daño que esto existe para evitar — el laboratorio hecho, el
 * resultado en el sistema, y nadie que lo lea.
 *
 * ── OJO CON EL NOMBRE ────────────────────────────────────────────────────────
 *
 * `context/TareasContext` es otra cosa completamente: un almacén en memoria para
 * el estado de «la IA está pensando». Sólo coincide la palabra.
 *
 * Módulo PURO.
 */

/** El ciclo del charter. El orden es el que se puede recorrer. */
export type EstadoTarea =
  | 'solicitada'    // existe y nadie la ha tomado
  | 'aceptada'      // alguien la hizo suya
  | 'en_curso'      // se está haciendo
  | 'completada'    // el trabajo se hizo
  | 'cerrada'       // alguien lo revisó y decidió. AQUÍ termina, no antes.
  | 'cancelada'     // ya no aplica; exige motivo

export type TipoTarea =
  | 'estudio_pendiente'     // se pidió un laboratorio o gabinete y falta el resultado
  | 'resultado_por_revisar' // llegó y nadie lo ha mirado
  | 'seguimiento'           // volver a ver al paciente
  | 'receta_por_entregar'
  /**
   * SIN PRODUCTOR TODAVÍA — y se dice aquí para que nadie lo dé por hecho.
   *
   * El tipo existe y `/pendientes` ya sabe etiquetarlo, pero NADA crea tareas de
   * esta clase. No es un olvido: no hay un hecho en la consulta que signifique
   * «hay una indicación que entregar». Las indicaciones se escriben dentro del
   * plan, que es obligatorio en todas las notas — derivar una tarea de ahí
   * pondría una en CADA consulta, y un worklist que se llena de tareas que nadie
   * pidió se abandona en una semana. Entonces tampoco se ve el estudio que sí
   * importaba.
   *
   * Lo que falta es la decisión de producto: qué acto concreto significa que hay
   * indicaciones que entregar (¿imprimir una hoja para el paciente? ¿marcarlo?).
   * Esa decisión no la toma un archivo de software.
   */
  | 'indicacion_paciente'
  /**
   * §F3 — el paciente dijo algo que NO coincide con su lista de medicamentos.
   *
   * «El losartán ya lo dejé» y la lista lo tiene vigente. La tarea existe
   * porque el sistema NO corrige la lista solo: el paciente puede equivocarse,
   * el reconocedor puede transcribir mal el nombre, y suspender un
   * anticoagulante es un acto médico (§C3: no elegir la verdad automáticamente).
   */
  | 'reconciliacion_medicamento'
  | 'otra'

export type Prioridad = 'critica' | 'alta' | 'normal'

export interface TareaClinica {
  id?: string
  clinicId: string
  /** A quién pertenece el cabo suelto. Sin paciente no hay tarea clínica. */
  patientId: string
  patientNombre?: string
  /** De qué consulta salió. Es la traza hacia atrás. */
  notaId?: string
  tipo: TipoTarea
  titulo: string
  detalle?: string
  prioridad: Prioridad
  /**
   * Quién responde. Puede estar vacío al nacer —una tarea derivada no sabe
   * todavía a quién asignarse— y por eso `sinDueno` es una consulta de primera
   * clase: son las que se pierden.
   */
  ownerUid?: string
  ownerNombre?: string
  estado: EstadoTarea
  creadaEn: string
  /** Cuándo debería estar lista. Sin esto «pendiente» no vence nunca. */
  venceEn?: string
  completadaEn?: string
  cerradaEn?: string
  cerradaPor?: string
  motivoCancelacion?: string
  /** Quién o qué la creó: 'nota', 'laboratorio', 'manual'. */
  origen: string
}

/**
 * Las transiciones legales.
 *
 * Se puede saltar de `solicitada` a `en_curso` —quien la toma suele empezar en
 * el mismo gesto— pero NUNCA de `completada` a `cerrada` sin pasar por que
 * alguien la mire: eso lo garantiza que `cerrar` exige un autor.
 *
 * `cancelada` es alcanzable desde cualquier estado vivo, porque un pendiente
 * puede dejar de aplicar en cualquier momento (el paciente se fue, el estudio se
 * pidió por error). Lo que no se puede es cancelar algo ya cerrado: eso sería
 * reescribir la historia.
 */
const TRANSICIONES: Record<EstadoTarea, EstadoTarea[]> = {
  solicitada: ['aceptada', 'en_curso', 'cancelada'],
  aceptada:   ['en_curso', 'completada', 'cancelada'],
  en_curso:   ['completada', 'cancelada'],
  completada: ['cerrada', 'en_curso'],   // reabrir si el resultado obliga a repetir
  cerrada:    [],
  cancelada:  [],
}

export interface Veredicto {
  permitido: boolean
  /** Por qué no. Vacío cuando sí. */
  motivo: string
}

/**
 * ¿Se puede pasar de un estado a otro? Devuelve el porqué en vez de lanzar:
 * quien llama suele ser una pantalla, y una excepción ahí se convierte en un
 * error genérico que no explica nada.
 */
export function puedeTransicionar(de: EstadoTarea, a: EstadoTarea): Veredicto {
  if (de === a) return { permitido: false, motivo: 'Ya está en ese estado.' }
  const destinos = TRANSICIONES[de] ?? []
  if (!destinos.includes(a)) {
    if (de === 'cerrada') return { permitido: false, motivo: 'Una tarea cerrada no se reabre: cerrar es la constancia de que alguien la revisó.' }
    if (de === 'cancelada') return { permitido: false, motivo: 'Una tarea cancelada no revive. Crea una nueva si vuelve a aplicar.' }
    return { permitido: false, motivo: `No se puede pasar de «${de}» a «${a}».` }
  }
  return { permitido: true, motivo: '' }
}

/** ¿Está vencida? Sin fecha de vencimiento, NUNCA — y eso es el problema, no la solución. */
export function estaVencida(t: Pick<TareaClinica, 'venceEn' | 'estado'>, ahoraMs: number): boolean {
  if (!t.venceEn) return false
  if (t.estado === 'cerrada' || t.estado === 'cancelada') return false
  const v = Date.parse(t.venceEn)
  return Number.isFinite(v) && v < ahoraMs
}

/**
 * ¿Hay que escalar esto?
 *
 * Dos motivos, y son distintos:
 *
 *  · **Nadie la ha tomado.** Una tarea sin dueño no se hace sola, y cuanto más
 *    tiempo lleve sin dueño menos probable es que alguien la adopte.
 *  · **Está vencida.** Se pasó la fecha y sigue viva.
 *
 * Lo CRÍTICO escala sin esperar a vencer: si un resultado crítico no tiene dueño,
 * el problema es ahora mismo, no cuando pase la fecha.
 */
export function debeEscalar(t: Pick<TareaClinica, 'venceEn' | 'estado' | 'ownerUid' | 'prioridad'>, ahoraMs: number): { escalar: boolean; motivo: string } {
  if (t.estado === 'cerrada' || t.estado === 'cancelada') return { escalar: false, motivo: '' }
  const sinDueno = !t.ownerUid
  if (t.prioridad === 'critica' && sinDueno) {
    return { escalar: true, motivo: 'Prioridad crítica sin nadie asignado.' }
  }
  if (estaVencida(t, ahoraMs)) {
    return { escalar: true, motivo: sinDueno ? 'Venció y nadie la tomó.' : 'Venció y sigue abierta.' }
  }
  return { escalar: false, motivo: '' }
}

/** Las que están vivas: lo que de verdad hay que trabajar. */
export function estaViva(t: Pick<TareaClinica, 'estado'>): boolean {
  return t.estado !== 'cerrada' && t.estado !== 'cancelada'
}

/**
 * El orden del worklist.
 *
 * Primero lo que hay que escalar, después por prioridad, y dentro de cada grupo
 * lo más viejo arriba. Ordenar sólo por fecha enterraría un resultado crítico de
 * esta mañana bajo veinte seguimientos de hace un mes.
 */
export function ordenWorklist(a: TareaClinica, b: TareaClinica, ahoraMs: number): number {
  const esc = (t: TareaClinica) => (debeEscalar(t, ahoraMs).escalar ? 0 : 1)
  const pri = (t: TareaClinica) => ({ critica: 0, alta: 1, normal: 2 })[t.prioridad] ?? 3
  return esc(a) - esc(b) || pri(a) - pri(b) || String(a.creadaEn).localeCompare(String(b.creadaEn))
}

export const POR_QUE_COMPLETADA_NO_ES_CERRADA =
  '«Completada» es que el trabajo se hizo: se sacó la sangre, salió el ' +
  'resultado. «Cerrada» es que alguien LO MIRÓ y decidió. Entre esas dos vive ' +
  'exactamente el daño que esto existe para evitar: el laboratorio hecho, el ' +
  'resultado en el sistema, y nadie que lo lea.'
