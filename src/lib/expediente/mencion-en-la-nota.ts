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
 * Dónde acaba el apartado anterior: hasta ahí, y no más atrás, se mira.
 *
 * ── LA VENTANA CRUZABA DE APARTADO (verificado el 7-ago-2026) ────────────────
 *
 * Mirar todas las apariciones no bastaba, y se comprobó con los motores reales
 * sobre la nota que motiva este módulo:
 *
 *     ANTECEDENTES PERSONALES PATOLÓGICOS: niega diabetes mellitus, niega hipertensión.
 *     IMPRESIÓN DIAGNÓSTICA: 1. Diabetes mellitus tipo 2 descontrolada.
 *
 *     contradicciones(...)  →  []
 *
 * La segunda aparición —la que hay que cazar— tiene el «niega hipertensión» de
 * la línea de ARRIBA dentro de sus 60 caracteres previos. Se recorrían todas las
 * apariciones y se descartaban todas: el guardián seguía ciego con el arreglo
 * puesto, sobre el caso exacto que lo motivó.
 *
 * Es, palabra por palabra, lo que el comentario de `VENTANA_ATRAS` ya temía —«una
 * disculpa ajena taparía una afirmación real»—. Acortar la ventana sólo lo hacía
 * menos probable; lo que hacía falta era no salirse del apartado.
 *
 * ── QUÉ CORTA Y QUÉ NO ───────────────────────────────────────────────────────
 *
 * El punto, el salto de línea, el punto y coma y los dos puntos separan lo que en
 * una nota clínica son apartados distintos («ANTECEDENTES:», «1.»).
 *
 * La coma **NO** corta, y eso es deliberado: «niega diabetes, hipertensión y
 * asma» es una sola enumeración negada, y cortarla resucitaría de golpe el falso
 * positivo que la ventana existía para evitar.
 */
const FIN_DE_APARTADO = /[.\n;:!?¡¿]/g

/** Los `VENTANA_ATRAS` caracteres previos, recortados en su propio apartado. */
function contextoPrevio(textoNota: string, idx: number): string {
  const ventana = textoNota.slice(Math.max(0, idx - VENTANA_ATRAS), idx)
  let corte = 0
  for (const m of ventana.matchAll(FIN_DE_APARTADO)) corte = m.index + 1
  return ventana.slice(corte)
}

/**
 * Menciones que NO afirman el padecimiento, y que sólo se ven al recortar.
 *
 * ── POR QUÉ NACE CON EL RECORTE Y NO ANTES ───────────────────────────────────
 *
 * Mientras la ventana cruzaba de apartado, «Antecedentes: niega diabetes. Plan:
 * glucosa para descartar diabetes» se callaba **por el motivo equivocado**: el
 * «niega» de la frase anterior tapaba la segunda mención. Al recortar, esa
 * segunda mención queda sola —«glucosa para descartar »— y `DISCULPA_EN_LA_NOTA`
 * no la reconoce: su `descarta` no casa con «descartar».
 *
 * O sea que arreglar el recorte sin esto **estrenaría** un falso positivo de alta
 * frecuencia —el plan de estudios de casi cualquier nota— sobre un aviso que no
 * se puede plegar. Es el mismo daño que «plasma»/«asma» y por eso va en el mismo
 * sitio.
 *
 * Es **vocabulario, no criterio**: que falte una forma significa que esa mención
 * se sigue contando como afirmación —se avisa de más, no de menos— y el aviso
 * lleva la cita delante para descartarlo de un vistazo.
 *
 * ── VA ANCLADO AL TÉRMINO, Y ESO NO ES ESTILO ────────────────────────────────
 *
 * Sin el `$`, el «descartar» de «glucosa para descartar diabetes y control de la
 * hipertensión» callaría también a la hipertensión, que la nota sí afirma. La
 * marca sólo vale si va pegada a la mención que se está juzgando.
 *
 * ── Y NO VIVE EN `DISCULPA_EN_LA_NOTA` ───────────────────────────────────────
 *
 * Ése es el regex que C-6 separó del lado del dictado. «Lo mandé a descartar
 * diabetes» no es el paciente negando nada: meterlo allí volvería a mezclar las
 * dos preguntas que C-6 acababa de separar.
 */
const COLA = '(?:\\s+(?:de|del|de\\s+la|la|el|los|las|un|una))?\\s*$'
const NO_AFIRMA = new RegExp([
  '\\bdescartar' + COLA,
  '\\b(?:prevenir|prevencion|profilaxis)' + COLA,
  '\\briesgo\\s+(?:de|para)' + COLA,
  '\\b(?:tamizaje|cribado|escrutinio)' + COLA,
].join('|'), 'i')

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
    const antes = sinAcentos(contextoPrevio(textoNota, idx))
    if (disculpa.test(antes)) continue
    if (NO_AFIRMA.test(antes)) continue
    return textoNota.slice(Math.max(0, idx - CITA_ATRAS), idx + CITA_ADELANTE).trim()
  }
  return null
}

export const POR_QUE_EL_CONTEXTO_NO_SALE_DEL_APARTADO =
  'Mirar todas las apariciones no bastaba: la segunda mención tenía el «niega» ' +
  'de la línea de arriba dentro de sus 60 caracteres previos, así que se ' +
  'descartaba igual y el guardián seguía ciego sobre el caso que lo motivó. El ' +
  'contexto se recorta en el punto, el salto de línea, el punto y coma y los dos ' +
  'puntos — no en la coma, que es la que enumera lo negado.'

export const POR_QUE_TODAS_LAS_APARICIONES =
  'La primera vez que una nota nombra un padecimiento suele ser la del apartado ' +
  'de antecedentes, donde está bien escrito. Mirar sólo esa hacía que una nota ' +
  'bien redactada arriba dejara ciego al guardián abajo, justo sobre el ' +
  'diagnóstico que se arrastra al expediente. Se juzgan todas con el mismo ' +
  'criterio de siempre; basta con que una no tenga disculpa.'
