/**
 * Sugerencias de la IA: lo que el modelo propone pero el médico NO dictó.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * El prompt le ordenaba al modelo, con estas palabras, "si el médico solo dictó
 * parte, complétalo con lo que aplique al cuadro clínico", y le exigía para CADA
 * fármaco dosis, vía, intervalo, duración, ajuste renal y signos de alarma. Además
 * esas secciones son obligatorias para poder firmar, así que el sistema empujaba
 * estructuralmente al modelo a rellenarlas.
 *
 * El médico dictaba "faringitis, le doy amoxicilina" y firmaba una nota que decía
 * 500 mg cada 8 horas por 7 días, con ajuste renal y signos de alarma. Todo eso
 * suele ser correcto — pero él no lo indicó, y salía con su firma y su cédula. Si
 * alguien pregunta quién indicó 7 días, la respuesta honesta era "el modelo".
 *
 * LA SOLUCIÓN (decisión del médico: que siga proponiendo, pero marcado)
 *
 * El modelo sigue completando, porque ahorra dictado y suele acertar. Pero cada
 * línea que no salga de lo dictado va prefijada con una marca. Antes de firmar, o
 * el médico las acepta como suyas, o se van. Nada entra a una nota firmada sin que
 * él lo haya visto.
 *
 * Todo aquí es puro y determinista → testeable.
 */

/**
 * Marca de línea sugerida. Se eligió texto legible y no un símbolo oscuro: si por
 * cualquier fallo llegara a imprimirse, en el papel se lee claramente qué es.
 */
export const MARCA_SUGERENCIA = '[IA — no dictado]'

/** ¿Este texto contiene alguna línea sugerida por la IA sin confirmar? */
export function tieneSugerencias(texto: string | undefined | null): boolean {
  return typeof texto === 'string' && texto.includes(MARCA_SUGERENCIA)
}

/** Cuántas líneas sugeridas hay en un texto. */
export function contarSugerencias(texto: string | undefined | null): number {
  if (typeof texto !== 'string') return 0
  return texto.split('\n').filter(l => l.includes(MARCA_SUGERENCIA)).length
}

/**
 * ACEPTAR: el médico las hace suyas. Se quita solo la marca; el contenido se queda
 * tal cual y pasa a ser indistinguible de lo que dictó, porque ya lo avaló.
 */
export function aceptarSugerencias(texto: string): string {
  return texto
    .split('\n')
    .map(l => l.includes(MARCA_SUGERENCIA) ? l.replace(MARCA_SUGERENCIA, '').replace(/^\s+/, '') : l)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * QUITAR: el médico no las avala. Desaparece la línea entera, no solo la marca —
 * dejar el contenido sin marca sería exactamente el problema original.
 */
export function quitarSugerencias(texto: string): string {
  return texto
    .split('\n')
    .filter(l => !l.includes(MARCA_SUGERENCIA))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Aplica una decisión a todas las secciones de la nota de una vez. */
export function resolverSugerencias<T extends { value?: string }>(
  secciones: readonly T[],
  decision: 'aceptar' | 'quitar',
): T[] {
  const fn = decision === 'aceptar' ? aceptarSugerencias : quitarSugerencias
  return secciones.map(s => (s.value && tieneSugerencias(s.value) ? { ...s, value: fn(s.value) } : s))
}

/** Total de sugerencias pendientes en la nota completa. */
export function sugerenciasPendientes(secciones: readonly { value?: string }[]): number {
  return secciones.reduce((n, s) => n + contarSugerencias(s.value), 0)
}
