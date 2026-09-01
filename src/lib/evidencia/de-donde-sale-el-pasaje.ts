/**
 * ¿DE QUÉ PARTE DEL RESUMEN SALE LA CITA? — la mitad determinista de WS-12.
 *
 * ── LO QUE YA ESTABA RESUELTO, Y LO QUE NO ──────────────────────────────────
 *
 * REG-359 ancla el pasaje **carácter a carácter** contra el texto del artículo,
 * así que el modelo no puede inventarse el respaldo: si la frase no está, no hay
 * cita. Eso cierra la invención.
 *
 * No cierra la **interpretación**. Un pasaje que existe puede citarse fuera de
 * contexto, y hay una forma de hacerlo que es a la vez la más común y la más
 * fácil de detectar:
 *
 *     citar los ANTECEDENTES de un estudio como si fueran sus hallazgos.
 *
 * Un resumen estructurado de PubMed empieza casi siempre con
 * «BACKGROUND: Se cree que la terapia corta es equivalente…». Esa frase **no es
 * un resultado de ese estudio**: es lo que se creía antes de hacerlo, y a veces
 * es justo lo que el estudio vino a refutar. Anclada como cita, se lee
 * exactamente igual que una conclusión.
 *
 * Lo mismo con el OBJETIVO («este ensayo evalúa si…») y con los MÉTODOS
 * («se aleatorizaron 400 pacientes a 7 días»): describen lo que se hizo, no lo
 * que se encontró.
 *
 * ── POR QUÉ ESTO SE PUEDE DECIDIR SIN UN MODELO ─────────────────────────────
 *
 * Porque **PubMed lo dice**. Los resúmenes estructurados traen la sección
 * escrita en el XML:
 *
 *     <AbstractText Label="BACKGROUND">…</AbstractText>
 *     <AbstractText Label="RESULTS">…</AbstractText>
 *
 * Y el producto lo tiraba: la expresión que extraía el resumen se comía el
 * atributo (`<AbstractText[^>]*>`) y unía todas las partes en un texto plano.
 * El dato estaba, se calculaba y se perdía en la misma función.
 *
 * ── LO QUE ESTE MÓDULO **NO** ES ────────────────────────────────────────────
 *
 * **No es un evaluador de entailment.** No juzga si el pasaje significa lo que
 * la afirmación dice: eso exige un modelo, su conjunto de referencia y un umbral
 * que tiene que fijar un médico (ver `ia/contratos-de-evaluacion.ts`). Llamar a
 * esto «entailment» sería el atajo que este repositorio persigue por todas
 * partes.
 *
 * Es la **precondición** de la interpretación: de dónde sale la frase. Un pasaje
 * de los resultados todavía puede citarse mal; uno de los antecedentes casi
 * siempre está mal citado.
 *
 * ── Y NO SE BORRA NADA ──────────────────────────────────────────────────────
 *
 * Igual que en `verificar-la-cita.ts`: se **marca**. Una afirmación apoyada en
 * los antecedentes puede seguir siendo cierta —y el artículo puede seguir siendo
 * el correcto—; lo que no puede es parecer que el estudio la demostró. El médico
 * decide.
 *
 * Módulo PURO, sin dependencias.
 */

/** Las partes de un resumen estructurado, ya normalizadas. */
export type SeccionDeResumen =
  | 'antecedentes'
  | 'objetivo'
  | 'metodos'
  | 'resultados'
  | 'conclusiones'
  /** El resumen no venía estructurado, o la etiqueta no se reconoce. */
  | 'sin_etiqueta'

export interface ParteDelResumen {
  readonly seccion: SeccionDeResumen
  /** La etiqueta tal cual la escribió la revista, para poder enseñarla. */
  readonly etiqueta: string
  readonly texto: string
}

/**
 * Las etiquetas de verdad, que son muchas más de las cuatro del manual.
 *
 * PubMed no impone un vocabulario: cada revista escribe la suya. `FINDINGS` es
 * de Lancet, `INTERPRETATION` también; `PURPOSE` es de las de radiología;
 * `PATIENTS AND METHODS` es de las quirúrgicas. Reconocer sólo las cuatro
 * canónicas dejaría media literatura en `sin_etiqueta`, que es precisamente el
 * estado en el que este módulo no puede ayudar.
 */
const ETIQUETAS: readonly (readonly [RegExp, SeccionDeResumen])[] = Object.freeze([
  [/^(background|introduction|context|antecedentes|introducci[oó]n|contexto)/i, 'antecedentes'],
  [/^(objective|objectives|purpose|aim|aims|goal|hypothesis|objetivo|objetivos|prop[oó]sito)/i, 'objetivo'],
  [/^(method|methods|methodology|design|patients and methods|materials and methods|study design|m[eé]todo|m[eé]todos|metodolog[ií]a|dise[nñ]o|material y m[eé]todos)/i, 'metodos'],
  [/^(result|results|finding|findings|outcome|outcomes|resultado|resultados|hallazgos)/i, 'resultados'],
  [/^(conclusion|conclusions|interpretation|implication|implications|summary|conclusi[oó]n|conclusiones|interpretaci[oó]n)/i, 'conclusiones'],
])

/**
 * Normaliza la etiqueta que escribió la revista.
 *
 * Sin reconocer → `sin_etiqueta`, **no** una suposición. Meterla en la sección
 * que más se le parezca sería inventar la procedencia del pasaje, que es
 * exactamente lo que este módulo existe para impedir.
 */
export function normalizarEtiqueta(etiqueta: string | undefined | null): SeccionDeResumen {
  const e = String(etiqueta ?? '').trim()
  if (!e) return 'sin_etiqueta'
  for (const [patron, seccion] of ETIQUETAS) if (patron.test(e)) return seccion
  return 'sin_etiqueta'
}

/**
 * ¿Una frase de esta sección puede sostener una afirmación clínica?
 *
 * Sólo los **resultados** y las **conclusiones** dicen qué encontró el estudio.
 * Los antecedentes dicen qué se creía antes; el objetivo, qué se quería
 * averiguar; los métodos, cómo. Ninguno de los tres demuestra nada.
 *
 * `sin_etiqueta` devuelve `true` **a propósito**: un resumen sin estructura no
 * es un resumen malo, y marcar por no saber convertiría la ausencia de dato en
 * dato de ausencia. Se prefiere señalar de menos, y se declara.
 */
export function puedeSostenerUnaAfirmacion(seccion: SeccionDeResumen): boolean {
  return seccion === 'resultados' || seccion === 'conclusiones' || seccion === 'sin_etiqueta'
}

/**
 * En qué parte del resumen cae un pasaje ya anclado.
 *
 * Se busca el texto literal dentro de cada parte. Si cruza dos partes se
 * devuelve la **primera** que lo contiene, y si no aparece en ninguna —porque
 * vino del texto completo de PMC, no del resumen— se devuelve `null`, que
 * significa «no se sabe», no «está mal».
 */
export function seccionDelPasaje(
  pasaje: string, partes: readonly ParteDelResumen[],
): ParteDelResumen | null {
  const p = pasaje.trim()
  if (!p) return null
  const encaja = partes.find(x => x.texto.includes(p))
  if (encaja) return encaja
  /**
   * Segundo intento con los espacios normalizados: el pasaje llega del modelo y
   * puede traer un salto de línea donde el resumen tiene un espacio. Anclarlo ya
   * lo comprobó carácter a carácter contra el texto unido; aquí sólo se busca
   * en qué trozo estaba.
   */
  const suave = (s: string) => s.replace(/\s+/g, ' ').trim()
  const ps = suave(p)
  return partes.find(x => suave(x.texto).includes(ps)) ?? null
}

/** Lo que se le puede decir al médico de una cita, sin juzgar su significado. */
export interface Procedencia {
  readonly seccion: SeccionDeResumen
  /** La etiqueta original de la revista, cuando la hubo. */
  readonly etiqueta?: string
  /** `false` sólo cuando la sección NO puede sostener una afirmación. */
  readonly sostiene: boolean
  readonly porQue: string
}

/** No se sabe de dónde salió: no es un defecto de la cita. */
export const NO_SE_SABE: Procedencia = Object.freeze({
  seccion: 'sin_etiqueta',
  sostiene: true,
  porQue: 'No se pudo situar el pasaje dentro del resumen estructurado. No se sabe de qué parte viene, y no saberlo no lo hace incorrecto.',
})

const POR_QUE: Readonly<Record<SeccionDeResumen, string>> = Object.freeze({
  antecedentes: 'La cita sale de los ANTECEDENTES: es lo que se creía antes de hacer el estudio, no lo que el estudio encontró. A veces es justo lo que vino a refutar.',
  objetivo: 'La cita sale del OBJETIVO: dice qué se quería averiguar, no qué se averiguó.',
  metodos: 'La cita sale de los MÉTODOS: describe cómo se hizo el estudio, no su resultado.',
  resultados: 'La cita sale de los RESULTADOS del estudio.',
  conclusiones: 'La cita sale de las CONCLUSIONES del estudio.',
  sin_etiqueta: 'El resumen no viene estructurado, así que no se puede decir de qué parte sale. No estructurar un resumen no lo hace peor.',
})

/** La procedencia de un pasaje anclado. */
export function procedenciaDelPasaje(
  pasaje: string, partes: readonly ParteDelResumen[],
): Procedencia {
  if (partes.length === 0) return NO_SE_SABE
  const parte = seccionDelPasaje(pasaje, partes)
  if (!parte) return NO_SE_SABE
  return {
    seccion: parte.seccion,
    ...(parte.etiqueta ? { etiqueta: parte.etiqueta } : {}),
    sostiene: puedeSostenerUnaAfirmacion(parte.seccion),
    porQue: POR_QUE[parte.seccion],
  }
}

export const POR_QUE_NO_ES_ENTAILMENT =
  'Esto no juzga si el pasaje significa lo que la afirmación dice: eso exige un ' +
  'modelo, su conjunto de referencia y un umbral que tiene que fijar un médico. ' +
  'Es la PRECONDICIÓN de la interpretación —de dónde sale la frase—, y llamarlo ' +
  'entailment sería dar por cerrado lo que sigue abierto.'

export const POR_QUE_NO_SE_MARCA_LO_QUE_NO_SE_SABE =
  'Un resumen sin estructura no es un resumen malo. Marcar por no saber de qué ' +
  'parte sale convertiría la ausencia de dato en dato de ausencia, y llenaría de ' +
  'avisos las citas correctas hasta que el médico deje de leerlos.'
