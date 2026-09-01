/**
 * MAYÚSCULA INICIAL EN ESPAÑOL — sólo la primera letra, no cada palabra.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `text-transform: capitalize` pone en mayúscula la primera letra de CADA
 * palabra. Es la regla del inglés, no la del español. En la pantalla donde el
 * paciente elige el día de su cita, `es-MX` devuelve «lun 31 de ago» y el CSS lo
 * pintaba:
 *
 *     Lun 31 De Ago        ← «De» en mayúscula, en las doce fichas del calendario
 *
 * En español las preposiciones no van en mayúscula dentro de una frase. Es la
 * primera pantalla en la que el paciente toma una decisión, y todas sus fichas
 * estaban mal escritas.
 *
 * ── POR QUÉ NO SE ARREGLA CON CSS ────────────────────────────────────────────
 *
 * Porque no existe un `text-transform` que haga esto: `capitalize` es por
 * palabra por definición. Tiene que hacerse sobre el texto, y por eso vive aquí
 * y no en una hoja de estilo.
 *
 * ── QUÉ **NO** HACE ──────────────────────────────────────────────────────────
 *
 * No corrige nombres propios ni siglas: si el texto trae «lunes, 1 de
 * septiembre», devuelve «Lunes, 1 de septiembre», que es lo correcto. Lo que no
 * puede saber es si «sep» era «Sep» por ser abreviatura de un nombre propio —
 * en español los meses van en minúscula, así que no lo son.
 */
export function conMayusculaInicial(texto: string): string {
  const s = String(texto ?? '')
  if (!s) return s
  // `charAt(0)` y no `[0]`: una cadena vacía no debe devolver `undefined`.
  return s.charAt(0).toLocaleUpperCase('es-MX') + s.slice(1)
}
