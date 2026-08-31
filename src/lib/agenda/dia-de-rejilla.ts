/**
 * EL DÍA DE UNA CASILLA DE LA REJILLA — que no es un instante.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El calendario mezclaba dos husos en la MISMA casilla:
 *
 *  · el número de la cabecera salía de `d.getDate()` — el calendario **del
 *    aparato**;
 *  · y la llave con la que se buscan las citas de esa casilla salía de
 *    `fechaISOLocal(d)`, que convierte el instante a la zona **del consultorio**.
 *
 * `getWeekDates` fabrica sus siete fechas como POSICIONES DE CALENDARIO —a
 * mediodía, con aritmética local—, no como instantes. Convertirlas de huso las
 * corre de día en cuanto el aparato y el consultorio no coinciden.
 *
 * Medido el 31-ago-2026 con el navegador en `Pacific/Kiritimati` (UTC+14) y el
 * consultorio en México (UTC−6): la cabecera decía **24 al 30** y las llaves
 * decían **23 al 29**. La columna rotulada «30» contenía las citas del **29**, y
 * ningún día salía resaltado como hoy, porque el hoy del consultorio no
 * coincidía con ninguna llave.
 *
 * Es la mitad silenciosa del defecto: la ruidosa —abrir en la semana
 * equivocada— se ve; ésta pone las citas de un día bajo el rótulo de otro.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una casilla de rejilla es un **día del calendario**, no un momento en la
 * línea del tiempo. Se lee por sus partes locales —las mismas con las que se
 * construyó y con las que se rotula— y no se convierte de huso.
 *
 * Y el ancla de la rejilla se coloca en el día del CONSULTORIO, que es el que
 * usa todo lo demás de la pantalla.
 *
 * Para quien tiene el aparato en la zona de su consultorio —el caso normal—
 * esto no cambia absolutamente nada: las partes locales y las del consultorio
 * son las mismas.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No convierte husos, y ésa es la idea.** Para un instante de verdad —la
 *   hora de una cita, la marca de «ahora»— sigue haciendo falta `fechaISOLocal`
 *   y `ahoraMinutosDelDia`, que sí miran la zona del consultorio.
 * · No valida la cadena de entrada más allá de que tenga tres números.
 */

/** El día `YYYY-MM-DD` como POSICIÓN de calendario, a mediodía. */
export function anclaDeRejilla(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  // El mediodía deja margen a los saltos de horario de verano por los dos lados.
  return new Date(a, (m ?? 1) - 1, d ?? 1, 12)
}

/** El día que representa una casilla, por las partes con que se construyó. */
export function diaDeRejilla(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
