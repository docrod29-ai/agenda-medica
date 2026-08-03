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
 * ── EL DETALLE QUE ARRUINA UN CSV EN SILENCIO ────────────────────────────────
 *
 * Un campo con una coma, unas comillas o un salto de línea **desplaza todas las
 * columnas siguientes** — y el archivo se abre igual, sin error, con los datos
 * corridos. `meta` es texto libre puesto por veinte sitios distintos, así que
 * pasa. Por eso todo campo se entrecomilla siempre y las comillas se duplican,
 * que es lo que dice RFC 4180 y lo que Excel espera.
 *
 * Módulo PURO.
 */
import { etiquetaEvento } from '@/lib/expediente/audit-eventos'

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
 * Un campo de CSV, siempre entrecomillado.
 *
 * Entrecomillar SIEMPRE —y no sólo cuando hace falta— quita la decisión de en
 * medio: no hay caso raro que se escape. Las comillas internas se duplican.
 */
export function campo(v: unknown): string {
  if (v === null || v === undefined) return '""'
  const t = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return `"${t.replace(/"/g, '""')}"`
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

export const POR_QUE_SE_ENTRECOMILLA_TODO =
  'Un campo con una coma, unas comillas o un salto de línea desplaza todas las ' +
  'columnas siguientes, y el archivo se abre igual, sin error, con los datos ' +
  'corridos. `meta` es texto libre puesto por veinte sitios distintos, así que ' +
  'pasa. Entrecomillar siempre quita la decisión de en medio: no queda caso ' +
  'raro que se escape.'
