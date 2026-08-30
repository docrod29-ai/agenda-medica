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

export interface DiaDeHorario { activo?: boolean; inicio?: string; fin?: string }

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
