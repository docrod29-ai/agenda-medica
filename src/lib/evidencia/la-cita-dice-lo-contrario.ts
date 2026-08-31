/**
 * CUANDO EL PASAJE QUE RESPALDA UNA AFIRMACIÓN DICE LO CONTRARIO.
 *
 * ── EL DEFECTO ──────────────────────────────────────────────────────────────
 *
 * El modelo escribe «reduce la mortalidad» y ancla la frase en un pasaje que
 * dice *«did not reduce mortality»*. La cita **existe**, es **literal**, sale de
 * los **hallazgos** — pasa las tres compuertas que este producto ya tenía
 * (REG-359 la ancla carácter a carácter, REG-400 comprueba de qué parte del
 * artículo sale) — y dice exactamente lo opuesto.
 *
 * Es el peor de los tres defectos de cita, porque es el único que se ve **más**
 * respaldado cuanto más se comprueba.
 *
 * ── LO QUE ESTO NO ES ───────────────────────────────────────────────────────
 *
 * **No es un evaluador de entailment**, y no se declara como tal. Juzgar si un
 * pasaje SIGNIFICA lo que la afirmación dice exige un modelo, su conjunto de
 * referencia y un umbral que tiene que fijar un médico. Eso sigue abierto en
 * WS-12 y está declarado en `ia/contratos-de-evaluacion.ts`.
 *
 * Esto es la mitad que **sí** se puede decidir sin modelo: la POLARIDAD. Si la
 * afirmación asevera un efecto y su pasaje lo niega, no hace falta entender
 * ninguno de los dos para saber que algo está mal.
 *
 * **No dice quién tiene razón.** No afirma que la afirmación sea falsa: dice que
 * el pasaje que la sostiene está en forma negativa y ella no. Puede que el
 * modelo citara mal, o que citara el artículo equivocado, o que la frase sea
 * buen razonamiento clínico sin ese respaldo. Las tres se arreglan distinto y
 * las tres las decide el médico.
 *
 * ── POR QUÉ NO SE REUSA `negaciones.ts` ─────────────────────────────────────
 *
 * Porque no es el mismo problema con otro nombre. Aquél detecta lo que **el
 * paciente** niega en un dictado en español —«niega», «no tiene», «sin
 * antecedente de»— para que una enfermedad negada no acabe de diagnóstico.
 * Aquí se lee la polaridad de un **resumen científico en inglés** —«did not
 * reduce», «failed to», «no significant difference»— sobre un verbo de efecto.
 * Distinto idioma, distinto vocabulario y distinta consecuencia. Compartir el
 * detector obligaría a que cada uno arrastrara los patrones del otro.
 *
 * ── LA REGLA QUE LO HACE SEGURO: SEÑALAR DE MENOS ───────────────────────────
 *
 * Un aviso que salta cuando no debe se deja de leer, y entonces no sirve el día
 * que acierta. Por eso sólo dispara cuando **todas** las apariciones del
 * concepto en el pasaje están negadas. Un pasaje que dice *«did not increase
 * adverse events and reduced mortality»* tiene «reduc» AFIRMADO, así que una
 * afirmación sobre reducción no se marca — aunque haya un «did not» en la frase.
 *
 * Cuando la lectura es mixta o el concepto no aparece, **no se dice nada**.
 *
 * ── EL VOCABULARIO ES VOCABULARIO, NO CRITERIO (regla 5) ────────────────────
 *
 * `EFECTOS` no es la lista de los efectos que importan: es la lista de los que
 * este motor sabe leer. Un verbo que falte significa que ese caso **no se
 * vigila** — no que esté bien. Está declarado abajo y se amplía sin tocar
 * lógica.
 *
 * Módulo PURO.
 */

/** Polaridad de un concepto dentro de un texto. */
export type Polaridad = 'afirma' | 'niega' | 'mixta' | 'no_aparece'

/**
 * Los efectos que este motor sabe leer, en los dos idiomas.
 *
 * La afirmación llega en ESPAÑOL —la escribe el modelo para el médico— y el
 * pasaje llega en INGLÉS, porque sale del resumen de PubMed. Un motor que sólo
 * leyera uno de los dos estaría ciego por diseño.
 *
 * Son raíces, no palabras: «reduc» cubre reduce, reduced, reduction, reducción,
 * reducir. Eso es deliberado — conjugar a mano es cómo se pierde un caso.
 */
export const EFECTOS: readonly { readonly concepto: string; readonly raices: readonly string[] }[] = Object.freeze([
  /* `reduj` cubre el pretérito español —«redujo», «redujeron»—, que `reduc` NO
     alcanza. Sin él, «no redujo la mortalidad» no se veía siquiera. */
  { concepto: 'reducción',   raices: ['reduc', 'reduj', 'disminu', 'decreas'] },
  { concepto: 'aumento',     raices: ['aument', 'increment', 'increas'] },
  { concepto: 'mejoría',     raices: ['mejor', 'improv'] },
  { concepto: 'prevención',  raices: ['previen', 'previn', 'prevenc', 'prevenir', 'prevent'] },
  { concepto: 'asociación',  raices: ['asoci', 'associat'] },
  { concepto: 'beneficio',   raices: ['benefic', 'benefit'] },
  { concepto: 'eficacia',    raices: ['efica', 'effectiv', 'efficac'] },
  { concepto: 'superioridad', raices: ['superiorit', 'superiorid'] },
])

/**
 * Marcas de negación que pueden preceder al verbo, en los dos idiomas.
 *
 * Se buscan HACIA ATRÁS desde la aparición del concepto, dentro de una ventana
 * corta: «did not significantly reduce» tiene la negación cuatro palabras antes,
 * y «reduced mortality; the drug did not cause harm» NO debe contar.
 */
const NEGACIONES = [
  'did not', 'does not', 'do not', 'was not', 'were not', 'is not', 'are not',
  'has not', 'have not', 'had not', 'could not', 'cannot', "didn't", "wasn't",
  'failed to', 'fails to', 'no significant', 'not significant', 'without significant',
  'no evidence', 'no difference', 'no benefit', 'no association',
  'neither', 'unable to', 'absence of', 'lack of',
  'no redujo', 'no disminuy', 'no aument', 'no mejor', 'no previn', 'no se asoci',
  'no hubo', 'no mostr', 'no se observ', 'sin diferencia', 'sin beneficio',
] as const

/**
 * Negaciones que sólo valen PEGADAS al verbo.
 *
 * «no reduce» y «no disminuye» son la forma normal en español y no hay frase
 * hecha que capturarlas; pero un «no» suelto marcaría «patients with no diabetes
 * reduced their dose», donde la reducción está afirmada. Se admiten con una
 * ventana muy corta, la del adverbio: si hay un sustantivo en medio, ya no es
 * este verbo el que se niega.
 */
const NEGACIONES_ADYACENTES = ['no ', 'sin '] as const

/** Ventana de las negaciones adyacentes. Cabe «no » y poco más. */
export const VENTANA_ADYACENTE = 8

/**
 * Lo que CORTA el alcance de una negación.
 *
 * Éste es el arreglo que salvó al módulo de su peor falso positivo. En
 *
 *     «did not increase adverse events **and** reduced mortality»
 *
 * el «did not» es de *increase*, no de *reduce*, y una ventana de caracteres a
 * secas lo habría atribuido a los dos. Al llegar a una conjunción o a un signo
 * de puntuación, la negación se queda del otro lado.
 */
const CORTA_EL_ALCANCE = [' and ', ' but ', ' whereas ', ' while ', ' however ', ' although ',
  ' y ', ' pero ', ' aunque ', ' mientras ', ';', ',', '.', ':'] as const

/** Cuántos caracteres hacia atrás se mira para encontrar la negación. */
export const VENTANA_DE_NEGACION = 42

/** Sin acentos y en minúsculas: los pasajes llegan escritos de mil maneras. */
function plano(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Índices donde aparece cualquiera de las raíces del concepto. */
function apariciones(texto: string, raices: readonly string[]): number[] {
  const t = plano(texto)
  const out: number[] = []
  for (const r of raices) {
    let i = t.indexOf(r)
    while (i !== -1) {
      out.push(i)
      i = t.indexOf(r, i + 1)
    }
  }
  return out.sort((a, b) => a - b)
}

/**
 * ¿Está negada ESTA aparición del concepto?
 *
 * Se mira hacia atrás, pero sólo hasta donde llega el alcance: la última
 * conjunción o signo de puntuación corta, porque la negación no lo cruza.
 */
function negadaEn(texto: string, idx: number): boolean {
  const t = plano(texto)
  const desde = Math.max(0, idx - VENTANA_DE_NEGACION)
  let antes = t.slice(desde, idx)

  /* El alcance empieza después del último corte que haya en la ventana. */
  let corte = -1
  for (const c of CORTA_EL_ALCANCE) {
    const i = antes.lastIndexOf(c)
    if (i > corte) corte = i + c.length - 1
  }
  if (corte >= 0) antes = antes.slice(corte + 1)

  if (NEGACIONES.some(n => antes.includes(n))) return true
  const pegado = antes.slice(Math.max(0, antes.length - VENTANA_ADYACENTE))
  return NEGACIONES_ADYACENTES.some(n => pegado.includes(n))
}

/**
 * La polaridad de un concepto dentro de un texto.
 *
 * `mixta` cuando unas apariciones están negadas y otras no. Es un veredicto de
 * pleno derecho y su consecuencia es **callarse**: con una sola aparición
 * afirmada, el pasaje sostiene la afirmación por algún lado y marcarlo sería
 * señalar de más.
 */
export function polaridadDe(texto: string, raices: readonly string[]): Polaridad {
  const idx = apariciones(texto, raices)
  if (idx.length === 0) return 'no_aparece'
  const negadas = idx.filter(i => negadaEn(texto, i)).length
  if (negadas === 0) return 'afirma'
  if (negadas === idx.length) return 'niega'
  return 'mixta'
}

export interface Contradiccion {
  /** El concepto en el que chocan, para poder nombrarlo al médico. */
  readonly concepto: string
  /** Lo que dice la afirmación sobre ese concepto. */
  readonly enLaAfirmacion: Polaridad
  /** Lo que dice el pasaje que la respalda. */
  readonly enElPasaje: Polaridad
}

/**
 * ¿Chocan la afirmación y su pasaje en algún concepto que este motor sepa leer?
 *
 * Devuelve **todos** los conceptos en los que chocan, no el primero: una
 * afirmación puede citar mal dos cosas a la vez, y enseñar una escondería la
 * otra.
 */
export function contradiccionesEntre(afirmacion: string, pasaje: string): Contradiccion[] {
  const out: Contradiccion[] = []
  for (const e of EFECTOS) {
    const enLaAfirmacion = polaridadDe(afirmacion, e.raices)
    const enElPasaje = polaridadDe(pasaje, e.raices)
    if (enLaAfirmacion === 'no_aparece' || enElPasaje === 'no_aparece') continue
    if (enLaAfirmacion === 'mixta' || enElPasaje === 'mixta') continue
    if (enLaAfirmacion === enElPasaje) continue
    out.push({ concepto: e.concepto, enLaAfirmacion, enElPasaje })
  }
  return out
}

/** Cómo se le dice al médico, sin decidir quién tiene razón. */
export function comoSeDice(c: Contradiccion): string {
  return c.enLaAfirmacion === 'afirma'
    ? `la afirmación sostiene que hubo ${c.concepto} y el pasaje citado la niega`
    : `la afirmación niega ${c.concepto} y el pasaje citado la afirma`
}

export const POR_QUE_NO_ES_UN_EVALUADOR_DE_ENTAILMENT =
  'Juzgar si un pasaje SIGNIFICA lo que la afirmación dice exige un modelo, su ' +
  'conjunto de referencia y un umbral que fija un médico. Esto sólo compara ' +
  'POLARIDAD: si una asevera un efecto y la otra lo niega, no hace falta ' +
  'entender ninguna de las dos para saber que algo está mal.'

export const POR_QUE_SOLO_SI_TODAS_ESTAN_NEGADAS =
  'Un pasaje que dice «did not increase adverse events and reduced mortality» ' +
  'tiene «reduc» AFIRMADO. Marcar ahí una afirmación sobre reducción sería ' +
  'señalar de más, y un aviso que salta cuando no debe se deja de leer — y ' +
  'entonces no sirve el día que acierta. Con una sola aparición afirmada, se calla.'

export const POR_QUE_NO_SE_REUSA_EL_MOTOR_DE_NEGACIONES =
  '`expediente/negaciones.ts` detecta lo que EL PACIENTE niega en un dictado en ' +
  'español, para que una enfermedad negada no acabe de diagnóstico. Aquí se lee ' +
  'la polaridad de un resumen científico en INGLÉS sobre un verbo de efecto. ' +
  'Distinto idioma, distinto vocabulario y distinta consecuencia: compartir el ' +
  'detector obligaría a que cada uno arrastrara los patrones del otro.'

export const RAICES_QUE_SE_DESCARTARON =
  'Tres candidatas se quitaron al releer el módulo contra sí mismo, y quedan ' +
  'escritas para que nadie las vuelva a meter: «lower» es «lower extremity» y ' +
  '«lower limb» —anatomía, no reducción—; «superior» es «vena cava superior»; y ' +
  'una negación «no» a secas marcaría «there was no change in weight but reduced ' +
  'mortality», donde la reducción está afirmada. Las tres habrían señalado de más ' +
  'justo en el idioma de un resumen clínico.'

export const EL_VOCABULARIO_NO_ES_CRITERIO =
  'EFECTOS no es la lista de los efectos que importan: es la de los que este ' +
  'motor sabe leer. Un verbo que falte significa que ese caso NO SE VIGILA, no ' +
  'que esté bien.'
