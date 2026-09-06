/**
 * UN 200 CON EL CUERPO ILEGIBLE NO ES «NO HAY ARTÍCULOS».
 *
 * ── QUÉ FALLABA (WS-04 · inyección de fallos) ───────────────────────────────
 *
 * `pubmed.ts` marca el testigo —`TestigoPubMed.fallo`, lo que separa «no se pudo
 * preguntar» de «no hay literatura»— en tres sitios: cuando el circuito está
 * abierto, cuando la respuesta no es `ok`, y cuando el `fetch` lanza.
 *
 * Falta el cuarto, y es el único que **no parece un fallo**: NCBI contesta
 * `200 OK` con un cuerpo que no es la respuesta.
 *
 *   · `esearch` devuelve `{"esearchresult":{"ERROR":"Invalid db name"}}`. Es
 *     JSON válido, `r.json()` no lanza, y `d?.esearchresult?.idlist ?? []` da
 *     `[]`. Cero artículos, testigo en `false`.
 *   · `efetch` devuelve una página de error HTML, o un XML cortado a la mitad.
 *     `r.text()` nunca lanza sobre eso; `xml.split('<PubmedArticle>')` da cero
 *     bloques. Cero artículos, testigo en `false`.
 *
 * Las dos son conductas reales de E-utilities bajo carga, no hipótesis.
 *
 * ── LO QUE COSTABA ──────────────────────────────────────────────────────────
 *
 * La ruta usa el testigo para elegir entre dos frases, y las dos están bien
 * escritas: *«NO SE PUDO CONSULTAR PubMed […] no digas que no existe
 * evidencia»* frente a *«PubMed no devolvió artículos para estos términos»*.
 *
 * Con el testigo en `false` salía la segunda. El médico —y el modelo que redacta
 * su análisis— leían **«no hay literatura sobre esto»** de una búsqueda que
 * nunca obtuvo respuesta. Es la regla 4 al revés: ausencia de dato presentada
 * como dato de ausencia, en el sitio donde el producto se juega su credibilidad.
 *
 * El aparato para decirlo bien ya existía entero. Sólo no se disparaba.
 *
 * ── SEÑALAR DE MENOS, NUNCA DE MÁS ──────────────────────────────────────────
 *
 * Una búsqueda legítima **sin resultados** es un dato clínico y no se puede
 * confundir con una caída: `{"esearchresult":{"count":"0","idlist":[]}}` es una
 * respuesta perfectamente legible que dice cero. Por eso lo que se exige es la
 * FORMA de la respuesta —que `idlist` sea una lista— y no que traiga algo.
 *
 * Módulo PURO.
 */

/**
 * De quién es el problema cuando el cuerpo no sirve (REG-583).
 *
 * La distinción decide si el interruptor cuenta un fallo o no, y por eso no es
 * cosmética:
 *
 *  · `del_proveedor` — el cuerpo **no es de este protocolo**: HTML donde se
 *    esperaba JSON, un XML cortado, un objeto que no tiene la forma de la API.
 *    Eso es un balanceador o una CDN contestando por un origen caído.
 *  · `de_quien_llama` — el cuerpo **sí es la respuesta de la API**, y dentro
 *    trae un error nuestro: `{"esearchresult":{"ERROR":"Invalid db name"}}` es
 *    una consulta mal formada por nosotros.
 *
 * Contar lo segundo como caída sería apagar la evidencia de todos los médicos
 * por un defecto de nuestra propia consulta, que además sería CONSTANTE — el
 * circuito no volvería a cerrarse nunca. Es la misma razón por la que un 401 no
 * abre el circuito de WhatsApp.
 */
export type DeQuien = 'del_proveedor' | 'de_quien_llama'

/** Lo que se puede decir de un cuerpo que llegó con 200. */
export type Lectura =
  | { readonly legible: true }
  | { readonly legible: false; readonly porQue: string; readonly deQuien: DeQuien }

const LEGIBLE: Lectura = { legible: true }

/**
 * ¿El cuerpo de un `esearch` es una respuesta de E-utilities?
 *
 * Legible cuando trae `esearchresult.idlist` **y es una lista** — vacía incluida,
 * porque una búsqueda sin resultados es una respuesta.
 */
export function leerEsearch(cuerpo: unknown): Lectura {
  if (!cuerpo || typeof cuerpo !== 'object') {
    return { legible: false, deQuien: 'del_proveedor', porQue: 'La respuesta de esearch no era un objeto JSON.' }
  }
  const c = cuerpo as Record<string, unknown>
  /* NCBI pone el error DENTRO del 200, tanto arriba como en `esearchresult`. */
  if (typeof c.ERROR === 'string' && c.ERROR) {
    return { legible: false, deQuien: 'de_quien_llama', porQue: `esearch contestó 200 con un error dentro: ${c.ERROR}` }
  }
  const res = c.esearchresult
  if (!res || typeof res !== 'object') {
    return { legible: false, deQuien: 'del_proveedor', porQue: 'La respuesta de esearch no traía `esearchresult`.' }
  }
  const r = res as Record<string, unknown>
  if (typeof r.ERROR === 'string' && r.ERROR) {
    return { legible: false, deQuien: 'de_quien_llama', porQue: `esearch contestó 200 con un error dentro: ${r.ERROR}` }
  }
  if (!Array.isArray(r.idlist)) {
    return { legible: false, deQuien: 'del_proveedor', porQue: 'La respuesta de esearch no traía la lista de identificadores.' }
  }
  /* Una lista vacía es una RESPUESTA: «busqué y no hay». No se toca. */
  return LEGIBLE
}

/**
 * ¿El cuerpo de un `efetch` trae los registros que se pidieron?
 *
 * Se marca sólo el caso inequívoco: **se pidieron N y no vino ninguno**. Una
 * respuesta parcial —tres de cinco— no se marca, y eso está declarado en
 * `LO_QUE_NO_SE_VIGILA`: distinguir un truncamiento de un registro retirado por
 * NCBI necesita mirar cuáles faltan, y marcar de más aquí convertiría cualquier
 * respuesta incompleta en una caída.
 *
 * A `efetch` sólo se le piden identificadores que `esearch` acaba de devolver,
 * así que «cero de N» no tiene lectura inocente.
 */
export function leerEfetch(xml: string, idsPedidos: number): Lectura {
  if (idsPedidos <= 0) return LEGIBLE          // no se pidió nada: no falta nada
  const t = String(xml ?? '')
  if (/<PubmedArticle[\s>]/i.test(t)) return LEGIBLE
  return {
    legible: false,
    deQuien: 'del_proveedor',
    porQue: `Se pidieron ${idsPedidos} registros a efetch y el cuerpo no traía ninguno (página de error o XML cortado).`,
  }
}

export const LO_QUE_NO_SE_VIGILA: readonly string[] = [
  'Las respuestas PARCIALES de efetch: tres registros de cinco pasan como legibles. Distinguir un truncamiento de un registro que NCBI retiró exige mirar cuáles faltan, y marcar de más convertiría cualquier respuesta incompleta en una caída.',
  'Que el contenido sea CORRECTO. Esto mira la forma: un XML bien formado con datos equivocados pasa, y debe pasar — no es este el instrumento que lo detectaría.',
  'Las otras fuentes. openFDA tiene su propia forma de contestar y su propio cuello de botella; extenderlo ahí es otro trabajo, declarado y no hecho.',
]

export const POR_QUE_IMPORTA_DE_QUIEN_ES =
  'Porque decide si el interruptor cuenta un fallo. Un cuerpo que no es de este '
  + 'protocolo —HTML donde iba JSON, un XML cortado— es un origen caído y debe '
  + 'contar. Un `{"esearchresult":{"ERROR":"Invalid db name"}}` es una consulta '
  + 'mal formada por NOSOTROS: contarla como caída apagaría la evidencia de todos '
  + 'los médicos por un defecto propio, y además sería constante, así que el '
  + 'circuito no volvería a cerrarse nunca. Misma razón por la que un 401 no abre '
  + 'el circuito de WhatsApp.'

export const POR_QUE_UNA_LISTA_VACIA_ES_LEGIBLE =
  'Porque una búsqueda sin resultados es un DATO CLÍNICO: se preguntó y no hay. '
  + 'Confundirla con una caída sería el mismo error de este defecto, con el signo '
  + 'cambiado — y le quitaría al médico una respuesta que sí tiene. Lo que se '
  + 'exige es la FORMA de la respuesta, no que traiga algo.'

export const POR_QUE_ESTE_FALLO_NO_PARECE_UN_FALLO =
  'Porque llega con 200 y con un cuerpo que se parsea. Ni el código de estado ni '
  + 'una excepción lo delatan, y las tres defensas que ya existían miran justo '
  + 'eso. Un cuerpo ilegible sólo se detecta preguntándole si es la respuesta que '
  + 'se pidió, que es lo que nadie hacía.'
