/**
 * Corrección determinista de la VÍA para fármacos que NO existen en presentación
 * oral. La extracción de IA pone `via: 'oral'` por defecto a TODO medicamento
 * cuando no se dictó la vía (ver extraction-schema). Para un fármaco parenteral
 * puro —insulina, heparina de bajo peso, varios agonistas GLP-1 inyectables— eso
 * imprime una receta con "insulina · oral", que es un error de seguridad: esa vía
 * no existe para ese fármaco.
 *
 * Regla CONSERVADORA: solo se corrige cuando (1) el fármaco está en la lista de
 * parenterales puros y (2) la vía actual está vacía o es 'oral' (el valor por
 * defecto/erróneo). Si el médico puso explícitamente otra vía (iv, im, etc.) NO se
 * toca. El médico sigue viendo el medicamento y puede editarlo antes de imprimir.
 *
 * NO se incluyen fármacos con forma oral disponible (p. ej. semaglutida existe
 * como Rybelsus oral; metotrexato es oral o SC): ahí "oral" puede ser correcto y
 * corregir a ciegas sería peor.
 */

/** Código de vía del enum de Medicamento (ver types/expediente). */
import { esViaAusente, normalizarVia } from '@/lib/expediente/via-normalizada'

export type ViaSugerida = 'sc'

interface ReglaParenteral {
  /** Se prueba contra el nombre del fármaco en minúsculas. */
  re: RegExp
  via: ViaSugerida
}

/**
 * Parenterales puros (sin presentación oral). Solo entradas inequívocas.
 * Fuente: no existe formulación oral aprobada de estos principios activos.
 */
const PARENTERAL_PURO: ReglaParenteral[] = [
  // Insulinas (todas subcutáneas en ambulatorio; la IV es hospitalaria y se dicta explícita)
  { re: /\binsulina\b|\binsulin\b|glargina|lispro|\baspart\b|detemir|degludec|glulisina|\bnph\b|isófana|isofana|regular\s+humana/i, via: 'sc' },
  // Heparinas de bajo peso molecular y análogos (subcutáneas)
  { re: /enoxaparina|dalteparina|tinzaparina|nadroparina|bemiparina|fondaparinux/i, via: 'sc' },
  // Agonistas GLP-1 / GIP INYECTABLES sin forma oral (semaglutida EXCLUIDA: existe Rybelsus oral)
  { re: /liraglutida|dulaglutida|exenatida|lixisenatida|tirzepatida/i, via: 'sc' },
]

/**
 * ¿La vía dada es el valor por defecto/erróneo que conviene corregir?
 *
 * ── EL HUECO QUE DEJABA FUERA AL CASO MÁS PELIGROSO (5-ago-2026) ────────────
 *
 * Aquí se comparaba contra una lista de formas de «oral» y contra la cadena
 * vacía. Auditando las notas firmadas del Dr. apareció que la IA escribe otra
 * cosa cuando no sabe: **«no especificada»** (4 de sus 28 medicamentos).
 *
 * Con ese valor, este guard NO ACTUABA:
 *
 *     insulina + 'oral'             → sc   ✅
 *     insulina + ''                 → sc   ✅
 *     insulina + 'no especificada'  → «no especificada»   ❌
 *
 * O sea que la protección que existe para que nunca se imprima «insulina · vía
 * que no existe» se apagaba justo cuando la vía era desconocida — que es cuando
 * más falta hace.
 *
 * `esViaAusente` reúne todas las formas de «no lo sé» en un solo sitio, para que
 * este guard y el aviso al médico las traten igual.
 */
function viaEsCorregible(via: string | undefined | null): boolean {
  if (esViaAusente(via)) return true
  return normalizarVia(via) === 'oral'
}

/**
 * Devuelve la vía corregida si el fármaco es parenteral puro y la vía actual es
 * corregible; si no, devuelve la vía original sin cambios.
 */
export function corregirViaParenteral(nombre: string, via: string | undefined | null): string {
  const n = (nombre ?? '').toLowerCase()
  if (!n) return via ?? ''
  if (!viaEsCorregible(via)) return via ?? ''
  const regla = PARENTERAL_PURO.find(r => r.re.test(n))
  return regla ? regla.via : (via ?? '')
}

/** ¿Se corregiría la vía de este fármaco? (para marcar/avisar en UI si se quiere). */
export function esParenteralPuro(nombre: string): boolean {
  const n = (nombre ?? '').toLowerCase()
  return !!n && PARENTERAL_PURO.some(r => r.re.test(n))
}
