/**
 * LAS HORAS QUE LA REJILLA TIENE QUE ENSEÑAR.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La rejilla del calendario iba de 07:00 a 19:00 **escrito a mano**:
 *
 *     const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7am–7pm
 *
 * y las citas se pintaban metiéndolas en la celda de su hora. Una cita a las
 * 20:30 no encuentra celda, así que **no se pinta en ninguna parte**: ni
 * atenuada, ni recogida en un «+2 más». Desaparece.
 *
 * Medido el 30-ago-2026 con dos citas confirmadas de hoy, a las 06:30 y a las
 * 20:30: `/citas` las lista las dos; el calendario **no enseña ninguna**, ni en
 * la vista de semana ni en la de día. El médico mira su semana y ve la tarde
 * libre.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La rejilla se estira hasta abarcar **todo lo que tiene que enseñar**:
 *
 *  1. el horario que el consultorio declaró —para que una consulta que atiende
 *     hasta las 21:00 pueda AGENDAR a las 20:00, y no sólo verlo—;
 *  2. y **las horas donde de verdad hay citas**, que es lo que cierra el
 *     defecto: una cita puede caer fuera del horario por sobreagenda, por una
 *     importación, o porque el horario cambió DESPUÉS de agendarla. Ninguna de
 *     las tres puede hacerla invisible.
 *
 * El 07:00–19:00 de siempre se queda como suelo, para que un consultorio normal
 * vea exactamente la misma rejilla que veía.
 *
 * Es la regla 4 de seguridad clínica en la pantalla de la agenda: que no se vea
 * no significa que no esté.
 */

/** El suelo histórico: lo que la rejilla enseñaba antes de que nadie preguntara. */
export const PRIMERA_POR_DEFECTO = 7
export const ULTIMA_POR_DEFECTO = 19

/** `'HH:mm'` → hora, o `null` si no se puede leer. Nunca adivina. */
function hora(hhmm: string | undefined): number | null {
  if (!hhmm || hhmm.length < 2) return null
  const h = Number.parseInt(hhmm.slice(0, 2), 10)
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null
}

export interface DiaDeHorario {
  activo?: boolean
  inicio?: string
  fin?: string
  /** Horario partido: los huecos de dentro del día (la comida, un quirófano fijo). */
  descansos?: { inicio: string; fin: string }[]
}

/**
 * Las horas a pintar, de la primera a la última, ambas incluidas.
 *
 * `citas` son las de los días que se están mirando —no las de toda la ventana—:
 * mirar el lunes no tiene por qué estirar la rejilla por una cita del jueves de
 * la semana que viene.
 */
export function horasAEnsenar(
  citas: readonly { fechaHora: string }[],
  horarios: readonly DiaDeHorario[] = [],
): number[] {
  let primera = PRIMERA_POR_DEFECTO
  let ultima = ULTIMA_POR_DEFECTO

  for (const dia of horarios) {
    if (dia?.activo === false) continue
    const i = hora(dia?.inicio)
    const f = hora(dia?.fin)
    if (i !== null && i < primera) primera = i
    /*
     * El cierre se enseña ENTERO: un consultorio que cierra a las 20:00 atiende
     * dentro de la franja de las 19:00, así que la fila de las 19:00 tiene que
     * existir. La de las 20:00 no: a esa hora ya cerró.
     */
    if (f !== null) {
      const ultimaFranja = f - 1
      if (ultimaFranja > ultima) ultima = ultimaFranja
    }
  }

  for (const cita of citas) {
    const h = hora(cita?.fechaHora?.slice(11, 16))
    if (h === null) continue
    if (h < primera) primera = h
    if (h > ultima) ultima = h
  }

  return Array.from({ length: ultima - primera + 1 }, (_, i) => primera + i)
}

/**
 * ¿ESTÁ EL CONSULTORIO ABIERTO A ESA HORA, ESE DÍA?
 *
 * La rejilla enseña de 07:00 a 19:00 como suelo, pero el consultorio por defecto
 * atiende de 09:00 a 18:00 —y los viernes hasta las 14:00, y los fines de semana
 * nada—. Sin esto, **todas las filas pesan lo mismo**: la de las 07:00 se ve
 * igual de agendable que la de las 11:00, y el médico no puede ver de un vistazo
 * cuándo está abierto.
 *
 * El producto ya dice esto mismo para el fin de semana, con un tinte apenas
 * perceptible en la celda. Esto extiende ese vocabulario que ya existe a las
 * horas cerradas; no inventa uno nuevo.
 *
 * **Tiñe, no bloquea.** Agendar fuera de horario es legítimo —una urgencia, un
 * favor— y este repositorio ya tiene dicho cómo se tratan esos casos: «la salida
 * autorizada, no un muro». Lo que faltaba era que se viera.
 *
 * La franja de las 17:00 con cierre a las 18:00 está ABIERTA: dura hasta las
 * 18:00, que es justo cuando cierra. La de las 18:00 ya no.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **El horario partido**: `DaySchedule` admite huecos dentro del día (la
 *   comida) y esto sólo mira `inicio` y `fin`. La hora de comer se enseñará como
 *   abierta, igual que antes.
 * · No mira días festivos.
 * · No sabe de horarios por médico: usa el del consultorio.
 */
export function estaAbierto(hora: number, dia: DiaDeHorario | undefined): boolean {
  /*
   * SIN DÍA, NO SE OPINA. La primera versión devolvía `false` aquí y teñía la
   * columna entera de cerrado cuando el consultorio no había declarado ese día.
   * Eso es ausencia de dato tomada por dato de ausencia —la regla 4— pintada en
   * la rejilla. Lo cazó su propio caso de prueba.
   */
  if (!dia) return true
  if (dia.activo === false) return false
  const i = hora24(dia.inicio)
  const f = hora24(dia.fin)
  if (i === null || f === null) return true   // sin horario declarado, no se opina
  if (hora < i || hora >= f) return false

  /*
   * EL HORARIO PARTIDO — que no es un caso raro: el tipo lo dice con todas las
   * letras, «un médico que atiende de 9 a 14 y de 16 a 20, que en México es lo
   * normal, no la excepción».
   *
   * `getAvailableSlots` ya se salta las franjas que pisan un descanso, así que
   * sin esto la rejilla enseñaba como abierta una hora que el selector de horas
   * se niega a ofrecer: la pantalla dice una cosa y el motor otra.
   *
   * SE TIÑE DE MENOS, NUNCA DE MÁS. Sólo se marca cerrada la hora que el
   * descanso cubre ENTERA. Un descanso de 14:30 a 15:30 deja las 14:00 y las
   * 15:00 medio abiertas —se puede agendar en ellas— y pintarlas de cerrado
   * sería decirle al médico que no puede cuando sí puede.
   */
  return !(dia.descansos ?? []).some(d => {
    /*
     * EN MINUTOS, no en horas. La primera versión comparaba con `hora24`, que
     * se queda con la hora y **tira los minutos**: un descanso de 14:30 a 15:30
     * se leía como 14 a 15 y cerraba las 14:00 enteras. Lo cazó su propio caso.
     */
    const di = minutosDelDia(d?.inicio)
    const df = minutosDelDia(d?.fin)
    if (di === null || df === null) return false
    // Cubre la franja ENTERA: empieza en la hora o antes, acaba en la siguiente o después.
    return di <= hora * 60 && df >= (hora + 1) * 60
  })
}

/** `'HH:mm'` → minutos desde medianoche, o `null`. Los minutos importan. */
function minutosDelDia(hhmm: string | undefined): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/** `'HH:mm'` → hora, o `null`. Igual que la de arriba, con nombre propio. */
function hora24(hhmm: string | undefined): number | null {
  if (!hhmm || hhmm.length < 2) return null
  const h = Number.parseInt(hhmm.slice(0, 2), 10)
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null
}
