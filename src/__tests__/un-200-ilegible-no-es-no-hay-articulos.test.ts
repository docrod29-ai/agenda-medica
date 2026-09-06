/**
 * GOLDEN — NCBI contestaba 200 con un cuerpo que no era la respuesta, y el médico leía «no hay literatura».
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `pubmed.ts` marca `TestigoPubMed.fallo` —lo que separa «no se pudo preguntar»
 * de «no hay literatura»— en tres sitios: circuito abierto, respuesta no `ok`, y
 * `fetch` que lanza.
 *
 * Faltaba el cuarto, y es el único que **no parece un fallo**:
 *
 *  · `esearch` devuelve `{"esearchresult":{"ERROR":"Invalid db name"}}` con
 *    estado 200. Es JSON válido, `r.json()` no lanza, y
 *    `d?.esearchresult?.idlist ?? []` daba `[]`.
 *  · `efetch` devuelve una página de error HTML o un XML cortado. `r.text()`
 *    **nunca lanza** sobre eso, y `xml.split('<PubmedArticle>')` daba cero
 *    bloques.
 *
 * Las dos son conductas reales de E-utilities bajo carga.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo el `queFalta` de `WS-04.inyeccion-de-fallos` contra el árbol. El censo
 * decía que la inyección de fallos de Evidence «sigue sin medirse» y era
 * **falso**: `una-fuente-caida-no-cuelga-la-consulta` inyecta 5xx, tiempo
 * agotado, 429 y circuito abierto en las dos fuentes. Al comparar clase por
 * clase contra las que sí tiene el gateway de IA apareció la que no estaba.
 *
 * Se confirmó **ejecutándolo**, no leyéndolo: con NCBI contestando 200 y basura,
 * `buscarEvidencia` devolvía `0 artículos · testigo.fallo: false`.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Las tres defensas miraban el **transporte** —el código de estado, la
 * excepción—. Un cuerpo ilegible llega con el transporte impecable, y sólo se
 * detecta preguntándole al cuerpo si es la respuesta que se pidió. Eso no lo
 * hacía nadie.
 *
 * ── LA REGLA CLÍNICA QUE ESTO PROTEGE ───────────────────────────────────────
 *
 * **Ausencia de dato no es dato de ausencia**, la regla 4. La ruta ya tenía las
 * dos frases escritas y bien escritas —«NO SE PUDO CONSULTAR PubMed […] no digas
 * que no existe evidencia» frente a «PubMed no devolvió artículos»— y elegía la
 * segunda. El médico, y el modelo que le redacta el análisis, leían «no hay
 * literatura sobre esto» de una búsqueda que nunca obtuvo respuesta.
 *
 * El aparato para decirlo bien existía entero. Sólo no se disparaba.
 *
 * ── SEÑALAR DE MENOS, NUNCA DE MÁS ──────────────────────────────────────────
 *
 * Una búsqueda legítima **sin resultados** es un dato clínico:
 * `{"esearchresult":{"count":"0","idlist":[]}}` es una respuesta que dice cero.
 * Marcarla como caída sería este mismo defecto con el signo cambiado, y le
 * quitaría al médico una respuesta que sí tiene. Por eso se exige la FORMA de la
 * respuesta, no que traiga algo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Las respuestas parciales de `efetch`**: tres registros de cinco pasan como
 *   legibles. Distinguir un truncamiento de un registro retirado por NCBI exige
 *   mirar cuáles faltan, y marcar de más convertiría cualquier respuesta
 *   incompleta en una caída.
 * · **No mira si el contenido es CORRECTO.** Un XML bien formado con datos
 *   equivocados pasa, y debe pasar.
 * · **No cubre openFDA**, que tiene otra forma de contestar y otro cuello de
 *   botella. Declarado y no hecho.
 * · **No abre el circuito.** Un cuerpo ilegible marca el testigo; no cuenta como
 *   «el proveedor no está», porque contestó. Si eso debe abrirlo es otra
 *   decisión y no se tomó aquí.
 * · **No es una prueba de navegador**: comprueba el testigo, no que el médico
 *   lea la frase.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  leerEsearch, leerEfetch, LO_QUE_NO_SE_VIGILA,
  POR_QUE_UNA_LISTA_VACIA_ES_LEGIBLE, POR_QUE_ESTE_FALLO_NO_PARECE_UN_FALLO,
} from '@/lib/evidencia/una-respuesta-ilegible-no-es-una-respuesta'
import { olvidarCircuitos } from '@/lib/red/interruptor'

describe('leer un esearch: la forma, no el contenido', () => {
  it('una lista de identificadores es una respuesta', () => {
    expect(leerEsearch({ esearchresult: { idlist: ['1', '2'] } }).legible).toBe(true)
  })

  it('y una lista VACÍA también — «busqué y no hay» es un dato clínico', () => {
    /* Si esto se marcara como caída, el defecto sería el mismo con el signo
       cambiado: se le quitaría al médico una respuesta que sí tiene. */
    expect(leerEsearch({ esearchresult: { count: '0', idlist: [] } }).legible).toBe(true)
  })

  it('un ERROR dentro del 200 NO es una respuesta', () => {
    const l = leerEsearch({ esearchresult: { ERROR: 'Invalid db name' } })
    expect(l.legible).toBe(false)
    expect(l.legible === false && l.porQue).toMatch(/Invalid db name/)
  })

  it('ni un ERROR arriba del todo', () => {
    expect(leerEsearch({ ERROR: 'Search Backend failed' }).legible).toBe(false)
  })

  it('ni un cuerpo sin `esearchresult`, ni uno que no sea un objeto', () => {
    expect(leerEsearch({ algo: 1 }).legible).toBe(false)
    expect(leerEsearch('<html>').legible).toBe(false)
    expect(leerEsearch(null).legible).toBe(false)
  })

  it('ni un `idlist` que no sea una lista', () => {
    expect(leerEsearch({ esearchresult: { idlist: 'PMC1' } }).legible).toBe(false)
  })
})

describe('leer un efetch: se pidieron N y no vino ninguno', () => {
  it('un XML con registros es una respuesta', () => {
    expect(leerEfetch('<PubmedArticleSet><PubmedArticle><PMID>1</PMID></PubmedArticle>', 1).legible).toBe(true)
  })

  it('una página de error HTML no lo es', () => {
    const l = leerEfetch('<html><body>Service temporarily unavailable</body></html>', 3)
    expect(l.legible).toBe(false)
    expect(l.legible === false && l.porQue).toMatch(/3 registros/)
  })

  it('ni un XML cortado a la mitad', () => {
    expect(leerEfetch('<?xml version="1.0"?><PubmedArticleSet><PubmedArt', 2).legible).toBe(false)
  })

  it('no se pidió nada: no falta nada', () => {
    /* Sin esto, el camino en que `esearch` devuelve cero ids legítimamente
       marcaría el testigo, que es exactamente lo contrario de lo que hace falta. */
    expect(leerEfetch('', 0).legible).toBe(true)
  })

  it('una respuesta PARCIAL pasa, y está declarado', () => {
    expect(leerEfetch('<PubmedArticleSet><PubmedArticle><PMID>1</PMID></PubmedArticle>', 5).legible).toBe(true)
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toMatch(/PARCIALES/)
  })

  it('el módulo declara por qué esto no parecía un fallo', () => {
    expect(POR_QUE_ESTE_FALLO_NO_PARECE_UN_FALLO).toMatch(/200/)
    expect(POR_QUE_UNA_LISTA_VACIA_ES_LEGIBLE).toMatch(/DATO CLÍNICO/i)
  })
})

describe('inyectado de verdad en `buscarEvidencia`', () => {
  beforeEach(() => { olvidarCircuitos(); vi.restoreAllMocks() })
  afterEach(() => { vi.unstubAllGlobals(); olvidarCircuitos() })

  /** NCBI contestando 200 con lo que se le diga, sin tocar la red. */
  function ncbiContesta(esearch: string, efetch: string) {
    vi.stubGlobal('fetch', vi.fn(async (u: string) =>
      new Response(String(u).includes('esearch') ? esearch : efetch, { status: 200 })))
  }

  it('AL REVÉS — así pasaba antes: 200 con basura y el médico leía «no hay artículos»', async () => {
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    /* Con el arreglo quitado, esto devuelve `{articulos: 0, fallo: false}`: cero
       artículos indistinguibles de una búsqueda sin resultados. Se comprobó
       ejecutándolo antes de escribir el arreglo. */
    ncbiContesta(JSON.stringify({ esearchresult: { ERROR: 'Invalid db name' } }), '')
    const testigo = { fallo: false }
    const arts = await buscarEvidencia('sepsis', { testigo })
    expect({ articulos: arts.length, fallo: testigo.fallo }).toEqual({ articulos: 0, fallo: true })
  })

  it('y por el otro lado: ids buenos, efetch ilegible', async () => {
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    ncbiContesta(
      JSON.stringify({ esearchresult: { idlist: ['111', '222'] } }),
      '<html><body>Service temporarily unavailable</body></html>',
    )
    const testigo = { fallo: false }
    const arts = await buscarEvidencia('sepsis', { testigo })
    expect({ articulos: arts.length, fallo: testigo.fallo }).toEqual({ articulos: 0, fallo: true })
  })

  it('una búsqueda LEGÍTIMAMENTE vacía NO marca el testigo', async () => {
    /**
     * El caso que impide que este arreglo se pase de frenada. «Busqué y no hay»
     * tiene que seguir llegando como lo que es: cero artículos y ningún fallo.
     */
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    ncbiContesta(JSON.stringify({ esearchresult: { count: '0', idlist: [] } }), '')
    const testigo = { fallo: false }
    const arts = await buscarEvidencia('xyzzy-sin-literatura', { testigo })
    expect({ articulos: arts.length, fallo: testigo.fallo }).toEqual({ articulos: 0, fallo: false })
  })

  it('y una búsqueda que sí trae artículos sigue trayéndolos', async () => {
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    ncbiContesta(
      JSON.stringify({ esearchresult: { idlist: ['33333'] } }),
      '<PubmedArticleSet><PubmedArticle><PMID>33333</PMID>'
      + '<ArticleTitle>Sepsis bundles</ArticleTitle><Title>Crit Care Med</Title>'
      + '<ISOAbbreviation>Crit Care Med</ISOAbbreviation><Year>2021</Year>'
      + '<AbstractText>Cosas.</AbstractText></PubmedArticle></PubmedArticleSet>',
    )
    const testigo = { fallo: false }
    const arts = await buscarEvidencia('sepsis', { testigo })
    expect({ articulos: arts.length, fallo: testigo.fallo }).toEqual({ articulos: 1, fallo: false })
  })
})
