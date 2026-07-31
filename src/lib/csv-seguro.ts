/**
 * Blindaje contra INYECCIÓN DE FÓRMULAS en CSV.
 *
 * Un CSV es texto, pero Excel/Sheets ejecutan como fórmula cualquier celda que
 * empiece por `= + - @` (y por TAB o retorno de carro). Si ese texto viene de un
 * dato que escribió otra persona —el nombre de un consultorio, el nombre o las
 * notas de un paciente— entonces al abrir el archivo el que ejecuta la fórmula es
 * QUIEN exporta: el dueño abriendo su contabilidad, o el médico migrando sus
 * pacientes. `=HYPERLINK(...)`, `=cmd|...`, exfiltración de celdas: todo vive.
 *
 * El envolver en comillas NO protege: Excel evalúa igual. La defensa estándar
 * (OWASP) es anteponer un apóstrofo a la celda peligrosa, que Excel trata como
 * "esto es texto" y no muestra.
 *
 * Puro y determinista → testeable.
 */

const PELIGRO = /^[=+\-@\t\r]/

/** Neutraliza una celda para que ningún programa de hoja la ejecute como fórmula. */
export function celdaSegura(valor: unknown): string {
  const s = valor == null ? '' : String(valor)
  // Anteponer apóstrofo si arranca con un carácter de fórmula.
  const neutralizado = PELIGRO.test(s) ? `'${s}` : s
  // Comillas CSV normales (para comas, comillas y saltos internos).
  return /[",\n\r]/.test(neutralizado) ? `"${neutralizado.replace(/"/g, '""')}"` : neutralizado
}

/** Une celdas ya-seguras en una fila CSV. */
export function filaCSV(celdas: unknown[]): string {
  return celdas.map(celdaSegura).join(',')
}
