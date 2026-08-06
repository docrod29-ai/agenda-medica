/**
 * UN HUECO ESCRITO CON LETRAS SIGUE SIENDO UN HUECO.
 *
 * ── EL DEFECTO, VISTO EN SUS NOTAS FIRMADAS (5-ago-2026) ─────────────────────
 *
 * Cuando el modelo no captura un campo, no lo deja vacío: escribe **«No
 * especificada»**. Parece inofensivo —hasta suena honesto— y sin embargo es la
 * raíz de tres defectos distintos encontrados el mismo día:
 *
 *   · En `via`   apagó el guard que impide imprimir «insulina · oral», porque el
 *     guard sólo actuaba sobre `oral` o vacío (REG-172).
 *   · En `via`   apagó el aviso de vía no dictada, que es justo el caso que
 *     existía para cazar.
 *   · En `dosis` hizo que 3 de 28 medicamentos **parecieran tener dosis**. Al
 *     cerrar la compuerta de firma, la mitad de sus notas quedaron bloqueadas
 *     por medicamentos que sí estaban documentados (REG-176).
 *
 * El patrón es siempre el mismo: **un campo relleno con la confesión de estar
 * vacío se comporta como un dato**. Todo lo que compara contra la cadena vacía
 * —guards, avisos, compuertas, informes— deja de verlo.
 *
 * ── POR QUÉ ESTO VIVE EN EL ESQUEMA Y NO SÓLO EN EL PROMPT ───────────────────
 *
 * Al prompt se le añadió la regla 1-bis: «vacío significa vacío». Está bien que
 * esté, pero **un prompt es persuasión, no garantía**: el modelo puede volver a
 * escribirlo mañana, con otra redacción, y nadie se enteraría hasta auditar los
 * datos otra vez. Por eso el saneo se hace en la frontera por la que entra toda
 * extracción —el esquema— donde ya no depende de que el modelo obedezca.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No inventa el valor que falta ni adivina. Convierte un hueco disfrazado en el
 * hueco que ya era, para que quien tiene que cuidarlo —el guard, el aviso, el
 * médico— vuelva a verlo.
 *
 * Y **no toca las frases que el médico pone a propósito**: `DOSIS_DESCONOCIDA`
 * («desconocida (el paciente no la refiere)») es una declaración suya, no un
 * hueco del modelo, y la comparación es de igualdad exacta precisamente para
 * distinguirlas.
 *
 * Módulo PURO.
 */

/**
 * Las formas de decir «no lo sé» que se guardaban como si fueran un dato.
 *
 * Salen de las notas reales, no de un diccionario: «No especificada» es la que
 * escribe el modelo de este sistema. Las demás están porque son la misma idea
 * escrita de otra manera, y la próxima versión del modelo puede elegir
 * cualquiera de ellas.
 */
const HUECOS_ESCRITOS: readonly string[] = [
  'no especificada', 'no especificado', 'no especifica',
  'sin especificar', 'no definida', 'no definido', 'indefinida', 'indefinido',
  'desconocida', 'desconocido', 'se desconoce', 'no se especifica',
  'no refiere', 'no refiere dosis', 'no indicada', 'no indicado',
  'no disponible', 'sin datos', 'sin dato', 'sin informacion',
  'no aplica', 'n/a', 'na', 'ninguna', 'ninguno', 'none', 'null', 'undefined',
  '?', '??', '-', '--', '---', '.', '...',
]

/** Sin tildes, sin mayúsculas, sin espacios de sobra. */
export const limpiaTexto = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * ¿Este valor es un hueco —vacío de verdad, o vacío escrito con letras?
 *
 * La comparación es de **igualdad exacta** sobre el texto normalizado, no
 * `includes`. Una dosis como «1 tableta, no especificada la marca» es un dato
 * con ruido, y vaciarla perdería el «1 tableta».
 */
export function esHuecoEscrito(valor: unknown): boolean {
  const v = limpiaTexto(valor)
  if (!v) return true
  return HUECOS_ESCRITOS.some(h => limpiaTexto(h) === v)
}

/**
 * El valor tal cual, o cadena vacía si era un hueco disfrazado.
 *
 * Se conserva el texto ORIGINAL cuando no es un hueco —con sus tildes y
 * mayúsculas— porque esto sanea, no reescribe.
 */
export function sinHuecoEscrito(valor: unknown): string {
  const original = String(valor ?? '').trim()
  return esHuecoEscrito(original) ? '' : original
}

export const POR_QUE_EN_EL_ESQUEMA =
  'Al prompt se le puede pedir que deje el campo vacío, y se le pidió. Pero un ' +
  'prompt es persuasión y el esquema es garantía: el saneo va en la frontera por ' +
  'la que entra toda extracción, donde ya no depende de que el modelo obedezca.'

export const POR_QUE_IGUALDAD_EXACTA =
  'Se compara el campo entero, no si contiene la frase. «1 tableta, no ' +
  'especificada la marca» es un dato con ruido: vaciarlo perdería el «1 tableta».'
