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
  /**
   * AGENDADA — la cita existe y el paciente todavía no ha venido (REG-404).
   *
   * Es un estado VIVO, y ahí está el punto. Antes, «Agendar el seguimiento» se
   * cerraba al crear la cita: agendar contaba como haber visto al paciente. Si
   * después no venía, nada lo reabría y nada lo echaba en falta — el control que
   * el médico pidió no ocurría y el sistema decía que sí, porque nadie le
   * preguntó nunca al calendario.
   *
   * Con este estado el pendiente sigue vivo hasta que el encuentro pase o
   * alguien decida que ya no aplica. Es la diferencia entre una intención y un
   * resultado, que es de lo que trata este workstream entero.
   */
  | 'agendada'
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
  /**
   * SE PIDIÓ UNA INTERCONSULTA Y EL COLEGA NO HA CONTESTADO — REG-422.
   *
   * Hasta hoy una interconsulta vivía SÓLO dentro de `Internamiento.interconsultas`,
   * así que `tareasVivas`, `cabosDelPaciente` y `estadoDeAccion` no la veían nunca:
   * una pedida y no contestada era invisible fuera de una pestaña de un episodio.
   * Es la misma fuga que REG-252 cerró para los resultados de laboratorio.
   *
   * ── SU GRUPO DEL WORKLIST ES `otros`, Y ESO ES UNA DECISIÓN ────────────────
   *
   * `estadoDeAccion` no la nombra, así que cae en `otros` («Otros pendientes»).
   * No es un olvido:
   *
   *  · `esperando_resultado` la etiquetaría MAL — dice «Esperando resultado» y
   *    aquí se espera a un colega, no a una máquina.
   *  · una categoría nueva es la clase de modelo sin información que REG-404
   *    evitó a propósito: se añade cuando haya algo que decir con ella.
   *
   * `otros` es honesto —hay un pendiente vivo y su cajón no está decidido— y lo
   * que importaba se consigue igual: **se ve**. Qué grupo merece es una decisión
   * de producto, y queda dicha en el censo.
   *
   * ── SIN `venceEn`, A PROPÓSITO ────────────────────────────────────────────
   *
   * El plazo tras el cual una interconsulta sin contestar está vencida depende
   * de especialidad, urgencia y acuerdo del hospital: es criterio clínico y no
   * está decidido. Sin él `estaVencida` no opina, que es lo correcto — inventar
   * «48 h» pondría en rojo un pendiente que quizá no lo está, y en cuanto un
   * grupo «Vencidos» miente, deja de leerse.
   */
  | 'interconsulta_pendiente'
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
  /**
   * EL HECHO DEL QUE NACIÓ, CUANDO NO ES UNA NOTA — REG-422.
   *
   * `notaId` daba identidad estable a lo que nace de una consulta, y sobre él se
   * construye `idDerivado` para que repetir la acción de origen no duplique la
   * tarea. Una interconsulta no nace de una nota: nace de un elemento dentro de
   * un episodio de internamiento.
   *
   * Meter ese id en `notaId` habría sido lo barato y lo peor: TODO el que lee
   * `notaId` espera una nota —la traza de la pantalla, el enlace de vuelta, los
   * motores que la abren— y de pronto encontraría un id que no resuelve a
   * ninguna. Un campo haciendo dos trabajos es la forma exacta de REG-418, y
   * arreglar uno rompería al otro.
   *
   * Va acompañado de `origen`, que dice de QUÉ clase es este id.
   */
  origenId?: string
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
  /**
   * QUÉ SE DECIDIÓ, QUÉ SE HIZO Y SI SE LE AVISÓ AL PACIENTE (REG-360).
   *
   * Hasta hoy «cerrar» era **un solo acto que abarcaba tres etapas del §9**:
   * DECISION, ACTION y PATIENT COMMUNICATION. Ni siquiera después de cerrar
   * había campo que dijera qué se decidió, qué se hizo o si se avisó — y
   * `progreso-resultado.ts` las devolvía `sin_dato` SIEMPRE, a propósito,
   * porque rellenarlas al cerrar habría sido inventar un dato.
   *
   * Un resultado crítico revisado y cerrado **sin que nadie llamara al
   * paciente** se veía exactamente igual que uno donde sí se llamó. Ése es el
   * hueco.
   */
  cierre?: CierreDeTarea
  /**
   * El registro de transiciones. Append-only y acotado: sin él, «cerrada» no
   * dice cuándo se aceptó, quién la tuvo, ni si se reabrió por el camino.
   */
  transiciones?: readonly Transicion[]
}

/**
 * SI SE LE AVISÓ AL PACIENTE — y las tres respuestas no son dos.
 *
 * `no_aplica` existe porque hay resultados que no requieren avisar (un control
 * normal de rutina que el paciente ya sabía que saldría normal), y obligar a
 * decir «sí» o «no» empujaría a decir «sí» por comodidad. Lo que no puede pasar
 * es que el silencio se lea como cualquiera de los tres.
 */
export type AvisoAlPaciente = 'avisado' | 'no_avisado' | 'no_aplica'

export interface CierreDeTarea {
  /** Qué se decidió. Obligatorio: cerrar sin decisión es cerrar sin cerrar. */
  readonly decision: string
  /**
   * Qué se hizo. Vacío significa **que no se registró**, no que no se hiciera
   * nada — y por eso quien lo lea tiene que poder distinguirlo.
   */
  readonly accion?: string
  /** Si se le avisó al paciente. Sin valor = no se registró. */
  readonly avisoAlPaciente?: AvisoAlPaciente
  readonly quien: string
  readonly cuando: string
}

export interface Transicion {
  readonly de: EstadoTarea
  readonly a: EstadoTarea
  readonly quien: string
  readonly cuando: string
  readonly motivo?: string
}

/**
 * Cuántas transiciones se conservan. Una tarea que se reabre muchas veces no
 * puede hacer crecer su documento sin techo (el patrón que REG-350 cerró en las
 * notas). Se conservan las **últimas**: lo reciente es lo que se audita.
 */
export const TOPE_TRANSICIONES = 50

/**
 * Registra una transición sin dejar crecer el documento.
 *
 * PURO: devuelve la lista nueva, no muta.
 */
export function conTransicion(
  previas: readonly Transicion[] | undefined,
  t: Transicion,
): readonly Transicion[] {
  const todas = [...(previas ?? []), t]
  return todas.length > TOPE_TRANSICIONES ? todas.slice(todas.length - TOPE_TRANSICIONES) : todas
}

/**
 * ¿Se puede cerrar con este cierre?
 *
 * **La decisión es obligatoria y el aviso al paciente NO.** No es una asimetría
 * caprichosa:
 *
 * · Cerrar sin decir qué se decidió es cerrar sin cerrar — es exactamente el
 *   acto vacío que este campo existe para impedir.
 * · Exigir además el aviso convertiría cada cierre en un formulario de tres
 *   campos, y un worklist que cuesta se abandona en una semana. Entonces deja de
 *   verse el resultado que sí importaba, que es peor que no tener el campo.
 *
 * Lo que NO se admite es inventarlo: sin registrar, se queda sin registrar y
 * quien lo lea lo verá como `sin_dato`, no como «no se avisó» ni como «se
 * avisó».
 */
export function puedeCerrarse(cierre: Partial<CierreDeTarea> | undefined): Veredicto {
  if (!cierre || typeof cierre.decision !== 'string' || !cierre.decision.trim()) {
    return { permitido: false, motivo: 'Para cerrar hay que decir qué se decidió: cerrar sin decisión es cerrar sin cerrar.' }
  }
  if (typeof cierre.quien !== 'string' || !cierre.quien.trim()) {
    return { permitido: false, motivo: 'Un cierre sin autor no se puede auditar.' }
  }
  return { permitido: true, motivo: '' }
}

/**
 * LO QUE UN CIERRE DE VALOR CRÍTICO DEJA SIN DECIR (WS-11, REG-403).
 *
 * ── LA DIFERENCIA QUE NADIE REGISTRABA ──────────────────────────────────────
 *
 * `avisoAlPaciente` es opcional, y su razón está escrita arriba y es buena:
 * exigirlo en cada cierre convertiría el worklist en un formulario de tres
 * campos, y un worklist que cuesta se abandona en una semana.
 *
 * Ese razonamiento se hizo para el resultado de rutina. **Un valor crítico no es
 * un cierre cualquiera.** Un potasio de 7,1 cerrado con «repetir y tratar» y el
 * aviso en blanco deja el expediente sin poder distinguir las dos cosas que ahí
 * importan:
 *
 *     «lo vi»   ≠   «localicé a alguien»
 *
 * Y esa distinción es justo el sentido de que un valor sea crítico. Cerrar la
 * tarea dice lo primero; nada dice lo segundo.
 *
 * ── POR QUÉ PREGUNTA Y NO BLOQUEA ───────────────────────────────────────────
 *
 * Porque **si el aviso debe ser obligatorio, y en cuánto tiempo, es política
 * clínica** — y fijarla está en la lista de prohibiciones del repositorio, igual
 * que inventar una dosis. Aquí no se decide: se **pregunta**, que es la regla 6
 * de seguridad clínica, y el médico contesta o deja constancia de que no lo
 * registró.
 *
 * Sigue valiendo lo de siempre: sin registrar es `null`, y `null` no es
 * `'no_avisado'`. Confundirlos convierte «no lo sé» en un hecho clínico.
 */
export function preguntasAlCerrar(
  t: Pick<TareaClinica, 'prioridad'>,
  cierre: Partial<CierreDeTarea> | undefined,
): readonly string[] {
  if (t.prioridad !== 'critica') return []
  if (cierre?.avisoAlPaciente) return []
  return ['Este resultado es crítico. ¿Se le avisó a alguien? Cerrar sin contestar deja el expediente diciendo que no consta.']
}

export const POR_QUE_EL_CRITICO_PREGUNTA_Y_NO_BLOQUEA =
  'Si el aviso de un valor crítico debe ser obligatorio, y en cuánto tiempo, es ' +
  'POLÍTICA CLÍNICA: la fija el médico responsable, no el código. Aquí se ' +
  'pregunta —regla 6— y se deja constancia de lo que se contestó. Bloquear el ' +
  'cierre sería fijar esa política de tapadillo, y no bloquear ni preguntar ' +
  'dejaría «lo vi» y «localicé a alguien» indistinguibles, que es exactamente ' +
  'lo que hace crítico a un valor crítico.'

/**
 * ¿Se le avisó al paciente? Devuelve `null` cuando NO SE REGISTRÓ.
 *
 * `null` no es `'no_avisado'`. Confundirlos convierte «no lo sé» en un hecho
 * clínico, y del lado que hace que nadie llame: si el sistema afirma que no se
 * avisó, alguien lo arregla; si afirma que sí, nadie vuelve a mirar. Por eso
 * ninguna de las dos se deduce del cierre.
 */
export function avisoRegistrado(t: Pick<TareaClinica, 'cierre'>): AvisoAlPaciente | null {
  return t.cierre?.avisoAlPaciente ?? null
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
  solicitada: ['aceptada', 'en_curso', 'agendada', 'cancelada'],
  aceptada:   ['en_curso', 'agendada', 'completada', 'cancelada'],
  en_curso:   ['agendada', 'completada', 'cancelada'],
  /**
   * De `agendada` se sale por donde manda la realidad: el paciente vino
   * (`completada`), la cita se movió y hay que volver a agendar (`en_curso`), o
   * el control dejó de aplicar (`cancelada`).
   *
   * **No se puede saltar a `cerrada`.** Cerrar es la constancia de que alguien
   * revisó, y desde «hay una cita puesta» no hay nada que revisar todavía: ese
   * atajo sería exactamente el que convertía agendar en haber atendido.
   */
  agendada:   ['completada', 'en_curso', 'cancelada'],
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

/**
 * CÓMO SE LLAMA CADA TIPO DE PENDIENTE EN LA PANTALLA — una sola vez.
 *
 * Estaba copiado tal cual en `/pendientes` y en `ContinuidadPanel`, y la
 * tercera copia iba a nacer con `/pacientes`. Dos copias ya eran la trampa que
 * `AGENTS.md` nombra: el día que «Reconciliar» cambie de nombre habrá que
 * acordarse de tres sitios, y el tercero se queda.
 *
 * Vive con el modelo y no en un componente porque el nombre pertenece al TIPO,
 * no a la pantalla que lo pinta; y fuera del componente desde el primer día es
 * además lo que pide la regla de diseño para no retroajustar i18n después.
 */
export const ETIQUETA_TIPO: Record<TipoTarea | string, string> = {
  estudio_pendiente: 'Estudio',
  resultado_por_revisar: 'Resultado',
  seguimiento: 'Seguimiento',
  receta_por_entregar: 'Receta',
  indicacion_paciente: 'Indicación',
  reconciliacion_medicamento: 'Reconciliar',
  interconsulta_pendiente: 'Interconsulta',
  otra: 'Pendiente',
}

export const POR_QUE_COMPLETADA_NO_ES_CERRADA =
  '«Completada» es que el trabajo se hizo: se sacó la sangre, salió el ' +
  'resultado. «Cerrada» es que alguien LO MIRÓ y decidió. Entre esas dos vive ' +
  'exactamente el daño que esto existe para evitar: el laboratorio hecho, el ' +
  'resultado en el sistema, y nadie que lo lea.'
