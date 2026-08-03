/**
 * LA BITÁCORA DE ACCESOS, EN UN ARCHIVO QUE SE PUEDE ENTREGAR.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El panel de Cumplimiento pinta la bitácora (`audit_log`) y cita NOM-024 en el
 * título de la sección. Pero **no se puede sacar de ahí**: no hay descarga, y lo
 * que se ve son los **200 asientos más recientes** —500 si se filtra por
 * paciente—.
 *
 * Ante una auditoría, una queja ante el INAI o un litigio, lo que se pide es el
 * rastro **del periodo**, no lo que quepa en una pantalla. Un registro que sólo
 * se puede mirar no es un registro entregable.
 *
 * ── POR QUÉ CSV Y NO JSON ────────────────────────────────────────────────────
 *
 * Quien lo pide es un abogado, un auditor o el propio titular. Abren una hoja de
 * cálculo, no un editor de texto.
 *
 * ── DOS FORMAS DE ARRUINAR UN CSV, Y LA SEGUNDA ES PEOR ──────────────────────
 *
 * **1. El escapado.** Un campo con una coma, unas comillas o un salto de línea
 * desplaza todas las columnas siguientes — y el archivo se abre igual, sin
 * error, con los datos corridos. `meta` es texto libre puesto por veinte sitios
 * distintos, así que pasa.
 *
 * **2. La inyección de fórmulas.** Excel y Sheets **ejecutan** cualquier celda
 * que empiece por `=`, `+`, `-` o `@`. Si ese texto lo escribió otra persona —el
 * nombre de un paciente, una nota, cualquier cosa que acabe en `meta`—, quien
 * ejecuta la fórmula al abrir el archivo es **el propio médico**, o el auditor.
 *
 * Y aquí está lo importante: **entrecomillar NO protege de lo segundo**. Excel
 * evalúa igual. La primera versión de este archivo entrecomillaba todo y se creía
 * a salvo; el repositorio ya tenía la defensa correcta desde antes
 * (`lib/csv-seguro.ts`, apóstrofo delante según OWASP) y no la estaba usando.
 *
 * Escribir la mitad de una defensa es peor que no escribirla: se da por
 * resuelto lo que sigue abierto.
 *
 * Módulo PURO.
 */
import { etiquetaEvento } from '@/lib/expediente/audit-eventos'
import { celdaSegura } from '@/lib/csv-seguro'

export interface AsientoBitacora {
  id?: string
  evento?: string
  timestamp?: string
  medicoEmail?: string
  medicoUid?: string
  patientId?: string
  notaId?: string
  meta?: unknown
}

/**
 * Las columnas, en el orden en que un auditor las lee: cuándo, qué, quién,
 * sobre quién.
 */
export const COLUMNAS = [
  'fecha_hora', 'evento', 'evento_legible', 'medico_email', 'medico_uid',
  'paciente_id', 'nota_id', 'detalle', 'asiento_id',
] as const

/**
 * Un campo de CSV: escapado Y neutralizado contra fórmulas.
 *
 * Delega en `celdaSegura`, que es la defensa que el repositorio ya tenía. Lo
 * único que se añade aquí es que un objeto viaje como JSON en vez de como
 * `[object Object]` — `meta` es un objeto y perderlo entero sería vaciar la
 * columna que explica cada asiento.
 */
export function campo(v: unknown): string {
  if (v === null || v === undefined) return ''
  return celdaSegura(typeof v === 'object' ? JSON.stringify(v) : v)
}

/** Una fila del CSV a partir de un asiento. */
export function fila(a: AsientoBitacora): string {
  return [
    a.timestamp ?? '',
    a.evento ?? '',
    // La etiqueta legible va AL LADO del código, no en su lugar: el auditor lee
    // la etiqueta, y quien revise el sistema necesita el código exacto.
    a.evento ? etiquetaEvento(a.evento) : '',
    a.medicoEmail ?? '',
    a.medicoUid ?? '',
    a.patientId ?? '',
    a.notaId ?? '',
    a.meta ?? '',
    a.id ?? '',
  ].map(campo).join(',')
}

/** La cabecera del archivo. */
export function cabecera(): string {
  return COLUMNAS.map(campo).join(',')
}

/**
 * El CSV completo de una lista de asientos.
 *
 * Se usa en las pruebas y para lotes pequeños; la ruta escribe fila a fila para
 * no cargar el periodo entero en memoria.
 */
export function csvDeBitacora(asientos: AsientoBitacora[]): string {
  return [cabecera(), ...asientos.map(fila)].join('\n') + '\n'
}

export const POR_QUE_NO_BASTA_ENTRECOMILLAR =
  'Entrecomillar arregla que una coma desplace las columnas, pero NO la ' +
  'inyección de fórmulas: Excel ejecuta igual una celda que empieza por = + - @, ' +
  'y quien la ejecuta al abrir el archivo es el propio médico o el auditor. La ' +
  'defensa correcta es el apóstrofo delante (OWASP), y ya estaba escrita en ' +
  '`lib/csv-seguro.ts`. Escribir la mitad de una defensa es peor que no ' +
  'escribirla: se da por resuelto lo que sigue abierto.'
