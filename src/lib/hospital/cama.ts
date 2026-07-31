/**
 * Comparación de camas entre el CENSO y el INVENTARIO.
 *
 * EL DEFECTO: la cama del internamiento se captura como texto libre ("ej. 302-A")
 * y el tablero la cruzaba contra la etiqueta del catálogo con `===` exacto. Basta
 * que enfermería escriba "302 A", "302a" o "Cama 302-A" para que el cruce falle:
 * la cama sale pintada de LIBRE con el paciente dentro.
 *
 * En un hospital eso no es un detalle cosmético — es la vía directa a asignar dos
 * pacientes a la misma cama, y además infla la capacidad disponible que ve quien
 * decide si acepta un ingreso.
 *
 * Se normaliza lo que varía de verdad al teclear —mayúsculas, acentos, espacios,
 * separadores y el prefijo "cama"— y NADA más. En concreto no se hace comparación
 * difusa ni por parecido: la 302 y la 320 son camas distintas y confundirlas sería
 * peor que no cruzar.
 *
 * Puro y determinista → testeable.
 */

/** Forma canónica de una etiqueta de cama. '' si no hay nada que comparar. */
export function normalizarCama(etiqueta: string | undefined | null): string {
  return (etiqueta ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // acentos
    .replace(/^\s*(cama|cuarto|hab(itacion)?|room|bed)\s*[.:#-]?\s*/, '')  // prefijo redundante
    .replace(/[\s._\-/]+/g, '')                          // 302 A · 302-A · 302_A → 302a
    .trim()
}

/** ¿Estas dos etiquetas nombran la misma cama? Vacío nunca casa con vacío. */
export function mismaCama(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = normalizarCama(a)
  const nb = normalizarCama(b)
  /**
   * Una cama SIN etiqueta no ocupa nada. Si se dejara casar '' con '', todo
   * internamiento al que no se le puso cama ocuparía cualquier cama sin nombre
   * del inventario, que es el error contrario y también peligroso.
   */
  if (!na || !nb) return false
  return na === nb
}
