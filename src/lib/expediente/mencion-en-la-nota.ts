/**
 * LA NOTA LO DICE DOS VECES — y hasta hoy sólo se miraba la primera.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * Dos guardianes contrastan el dictado contra la nota: el de negaciones («el
 * paciente dijo que no y la nota lo afirma») y el de temporalidad («se dijo en
 * pasado y la nota lo pone como actual»). Los dos hacían lo mismo:
 *
 *     const idx = t.indexOf(sinAcentos(forma))   // ← la PRIMERA aparición
 *     if (idx < 0) continue
 *     if (yaVieneBien.test(antes)) continue      // ← y si esa venía bien, adiós
 *
 * `indexOf` sin segundo argumento devuelve **la primera**. Si esa primera
 * aparición venía escrita correctamente —«niega diabetes», «antecedente de
 * neumonía»—, el guardián se daba por satisfecho y **no volvía a mirar**. Todas
 * las apariciones siguientes quedaban fuera de la vigilancia.
 *
 * ── POR QUÉ ESO ES EXACTAMENTE EL CASO QUE IMPORTA ───────────────────────────
 *
 * Una nota real nombra un padecimiento varias veces, y casi siempre la primera
 * es la del apartado de antecedentes —donde está bien escrito— mientras que la
 * que arrastra el expediente es la de más abajo:
 *
 *     ANTECEDENTES: antecedente de neumonía en 2023, resuelta.
 *     ANÁLISIS Y PLAN: paciente con neumonía, se inicia amoxicilina.
 *
 * El apartado de antecedentes **blindaba** al diagnóstico de abajo. Cuanto mejor
 * escrita estaba la nota arriba, más ciego se quedaba el guardián abajo.
 *
 * Y el texto contra el que se contrasta es el que arma `textoDeLaNota`: resumen,
 * después los diagnósticos estructurados, después las secciones. El resumen va
 * primero, así que un resumen bien redactado tapaba el diagnóstico estructurado
 * — que es justo el que se copia a la receta y a la consulta siguiente, como ya
 * se documentó al reparar `[object Object]`.
 *
 * ── LA REGLA NO CAMBIA; CAMBIA CUÁNTAS VECES SE APLICA ───────────────────────
 *
 * Cada aparición se juzga con **el mismo criterio de siempre**: la misma ventana
 * de 60 caracteres hacia atrás y la misma expresión de disculpa que ya usaba
 * cada motor. No hay criterio nuevo. Lo que había era una aparición juzgada y
 * las demás no; ahora se juzgan todas y basta con que **una** no tenga disculpa.
 *
 * Es lo que ya decía el comentario de la ventana de 60 en los dos motores: «una
 * negación ajena taparía una afirmación real — que es el fallo caro». Eso mismo
 * pasaba a escala de nota entera, y nadie lo había mirado.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No decide nada clínico, no reescribe la nota y no elige entre el dictado y lo
 * escrito. Devuelve la cita para enseñarla. Y sigue señalando de menos: un
 * padecimiento que no esté en el vocabulario del motor que llama aquí no se
 * vigila — no se da por bueno.
 *
 * Módulo PURO.
 */

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Cuánto se mira hacia atrás para ver si la mención ya viene bien escrita.
 *
 * 60 caracteres, que es el número que los dos motores traían por separado y con
 * la misma justificación: es lo que mide «niega …» o «antecedente de …» en la
 * misma oración. Más larga empezaría a leer la oración anterior, y una disculpa
 * ajena taparía una afirmación real. Vivía duplicado en dos archivos; aquí hay
 * una sola definición porque dos acabarían separándose.
 */
export const VENTANA_ATRAS = 60

/** Cuánto se cita para la pantalla: lo justo para reconocer la frase. */
const CITA_ATRAS = 40
const CITA_ADELANTE = 60

/**
 * La primera mención de este padecimiento en la nota que **no** trae disculpa.
 *
 * @param textoNota  la nota entera, tal como la lee el médico.
 * @param formas     cómo se escribe ese padecimiento (el vocabulario del motor
 *                   que llama; que falte una forma significa que ese caso no se
 *                   vigila, no que se dé por bueno).
 * @param disculpa   qué hace correcta a una mención para el motor que llama:
 *                   la negación en línea, o el encuadre de antecedente.
 * @returns la cita para enseñar al médico, o `null` si todas las apariciones
 *   venían bien escritas — o si la nota no la nombra.
 */
export function mencionSinDisculpa(
  textoNota: string,
  formas: readonly string[],
  disculpa: RegExp,
): string | null {
  const t = sinAcentos(textoNota)
  const posiciones = new Set<number>()
  for (const forma of formas) {
    const f = sinAcentos(forma)
    if (!f) continue
    for (let i = t.indexOf(f); i >= 0; i = t.indexOf(f, i + 1)) posiciones.add(i)
  }
  /**
   * En orden de lectura, no en orden de vocabulario. Antes la cita dependía de
   * cómo estuviera ordenada la lista de formas —un detalle interno—, y lo que el
   * médico necesita ver es la primera vez que la nota lo dice mal.
   */
  for (const idx of [...posiciones].sort((a, b) => a - b)) {
    const antes = textoNota.slice(Math.max(0, idx - VENTANA_ATRAS), idx)
    if (disculpa.test(sinAcentos(antes))) continue
    return textoNota.slice(Math.max(0, idx - CITA_ATRAS), idx + CITA_ADELANTE).trim()
  }
  return null
}

export const POR_QUE_TODAS_LAS_APARICIONES =
  'La primera vez que una nota nombra un padecimiento suele ser la del apartado ' +
  'de antecedentes, donde está bien escrito. Mirar sólo esa hacía que una nota ' +
  'bien redactada arriba dejara ciego al guardián abajo, justo sobre el ' +
  'diagnóstico que se arrastra al expediente. Se juzgan todas con el mismo ' +
  'criterio de siempre; basta con que una no tenga disculpa.'
