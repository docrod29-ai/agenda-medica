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
 * ¿La coincidencia EMPIEZA una palabra, o va pegada al final de otra?
 *
 * ── «PLASMA» NO ES «ASMA» (verificado el 7-ago-2026) ─────────────────────────
 *
 * `indexOf` no sabe de palabras. Con un paciente que negó el asma, la línea de
 * laboratorio «glucosa en plasma venoso 96 mg/dL» disparaba una contradicción de
 * ASMA citando el laboratorio. Y «plasma» sale en casi toda nota con estudios,
 * así que era un falso positivo de alta frecuencia sobre un aviso que **no se
 * puede plegar** (`NO_SE_PLIEGAN`): justo la receta para que el médico aprenda a
 * ignorarlo, y con él los que sí importan.
 *
 * Lo mismo con «sida» dentro de «presidatura» y «ivu» dentro de «divulgar».
 *
 * ── SÓLO SE EXIGE FRONTERA POR DELANTE, NO POR DETRÁS ────────────────────────
 *
 * Por detrás no, para no perder los plurales y las flexiones: «infartos»,
 * «cirugías», «fracturas» tienen que seguir contando. Exigir frontera por los
 * dos lados convertiría un falso positivo en una ceguera, que es peor.
 *
 * ── LO QUE ESTO SÍ CUESTA, DECLARADO ─────────────────────────────────────────
 *
 * Un padecimiento escrito como parte de una palabra compuesta deja de contar:
 * «miocardiopatía» ya no cuenta como «cardiopatía», ni «esteatohepatitis» como
 * «hepatitis». `bronconeumonía` no se pierde porque está listada aparte, y ése
 * es el patrón correcto: **el compuesto se declara en el vocabulario**, no se
 * caza por subcadena. Distinguir «miocardiopatía» (relacionado) de «plasma»
 * (nada que ver) exige saber medicina, y eso no lo decide este módulo.
 *
 * Qué compuestos añadir al vocabulario está en la cola del dueño (C-7).
 */
const LETRA_O_DIGITO = /[\p{L}\p{N}]/u

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
export interface Aparicion {
  inicio: number
  fin: number
}

/**
 * Dónde nombra el texto este padecimiento, en orden de lectura.
 *
 * Se saca aparte porque el dictado necesita lo mismo que la nota —dónde está
 * cada mención, con la frontera de palabra que impide que «plasma» sea «asma»—
 * pero no necesita la cita. Dos copias de la regla de frontera acabarían
 * separándose, y una de las dos volvería a leer «asma» dentro de «plasma».
 *
 * Cuando dos formas empiezan en el mismo sitio («diabetes» dentro de «diabetes
 * mellitus») se conserva **la más larga**: es la misma mención escrita de dos
 * maneras, y el final más lejano es el que mide de verdad dónde acaba.
 */
export function apariciones(texto: string, formas: readonly string[]): Aparicion[] {
  const t = sinAcentos(texto)
  const porInicio = new Map<number, number>()
  for (const forma of formas) {
    const f = sinAcentos(forma)
    if (!f) continue
    for (let i = t.indexOf(f); i >= 0; i = t.indexOf(f, i + 1)) {
      if (i > 0 && LETRA_O_DIGITO.test(t[i - 1])) continue // «plasma» no es «asma»
      porInicio.set(i, Math.max(porInicio.get(i) ?? 0, i + f.length))
    }
  }
  return [...porInicio.entries()]
    .map(([inicio, fin]) => ({ inicio, fin }))
    .sort((a, b) => a.inicio - b.inicio)
}

export function mencionSinDisculpa(
  textoNota: string,
  formas: readonly string[],
  disculpa: RegExp,
): string | null {
  /**
   * En orden de lectura, no en orden de vocabulario. Antes la cita dependía de
   * cómo estuviera ordenada la lista de formas —un detalle interno—, y lo que el
   * médico necesita ver es la primera vez que la nota lo dice mal.
   */
  for (const { inicio: idx } of apariciones(textoNota, formas)) {
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
