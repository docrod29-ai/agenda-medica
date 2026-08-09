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

/* ══════════════════════════════════════════════════════════════════════════
   LA PROSA DE UNA SECCIÓN — el mismo problema, otra forma
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Las frases que un modelo escribe cuando se le obliga a no dejar una sección
 * en blanco.
 *
 * ── DE DÓNDE SALEN (7-ago-2026, REG-217) ────────────────────────────────────
 *
 * La regla 15 del prompt ORDENABA escribirlas —«No referido», «No explorado en
 * esta consulta»— contradiciendo de frente a la regla 1-bis, que las prohíbe.
 * El modelo obedecía a la 15 y la nota salía hueca.
 *
 * La regla ya se corrigió. Esto es la red debajo: **un prompt es persuasión, un
 * saneo en la frontera es garantía.**
 */
const HUECOS_DE_PROSA: readonly string[] = [
  'no referido', 'no referida', 'no referidos', 'no referidas',
  'no explorado', 'no explorada', 'no explorado en esta consulta',
  'no explorada en esta consulta', 'no se exploro', 'no se exploro en esta consulta',
  'no especificado en esta consulta', 'no especificada en esta consulta',
  'no especificado', 'no especificada', 'no mencionado', 'no mencionada',
  'sin datos en esta consulta', 'sin informacion en esta consulta',
  'no consignado', 'no consignada', 'no documentado', 'no documentada',
  'no valorado', 'no valorada', 'no interrogado', 'no interrogada',
  'no se refirio', 'no se menciono', 'no se consigno',
]

/**
 * ¿Esta sección está vacía, aunque tenga letras dentro?
 *
 * ── LA DISTINCIÓN QUE HACE ÚTIL A ESTA FUNCIÓN ─────────────────────────────
 *
 *     «No referido.»                  → HUECO. La sección no dice nada.
 *     «No refiere fiebre ni disnea.»  → DATO. Es un negativo pertinente, y la
 *                                       regla 16 del prompt lo pide a propósito.
 *
 * Por eso se compara **la sección entera** —quitando puntuación final— y no si
 * contiene la frase. Vaciar por contención borraría los negativos pertinentes,
 * que son de lo más valioso que tiene una nota.
 */
export function seccionEsHueco(valor: unknown): boolean {
  const v = limpiaTexto(valor).replace(/[.;,:!?\s]+$/g, '').trim()
  if (!v) return true
  if (HUECOS_ESCRITOS.some(h => limpiaTexto(h) === v)) return true
  return HUECOS_DE_PROSA.some(h => h === v)
}

/** La sección tal cual, o vacía si era un hueco con letras. */
export function sinHuecoDeProsa(valor: unknown): string {
  const original = String(valor ?? '').trim()
  return seccionEsHueco(original) ? '' : original
}

export const POR_QUE_LA_SECCION_SE_COMPARA_ENTERA =
  'Vaciar por contención borraría los negativos pertinentes —«no refiere fiebre ' +
  'ni disnea»—, que son de lo más valioso que tiene una nota y que el propio ' +
  'prompt pide documentar.'

export const POR_QUE_IMPORTA_QUE_QUEDE_VACIA =
  'La compuerta que impide firmar sólo comprueba que la sección obligatoria no ' +
  'esté en blanco. Una sección que dice «No referido.» la pasa: la nota hueca ' +
  'quedaba firmable, con cédula. Vaciarla es lo que hace que la compuerta la vea.'
