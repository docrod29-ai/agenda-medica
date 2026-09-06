/**
 * GOLDEN — un proveedor degradado que contesta 200 con basura reseteaba su propio interruptor.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-391 puso un interruptor de circuito en PubMed y en openFDA para que, con
 * la fuente caída, cada búsqueda de cada médico no volviera a pagar la espera
 * entera para llegar a la misma conclusión. Funciona: con un 503, tres
 * peticiones y el circuito abierto.
 *
 * Los dos clientes anotaban el éxito así:
 *
 *     anotarVeredicto(clave, r.ok ? 'contesto' : veredictoDeRespuesta(r.status))
 *
 * `'contesto'` en la máquina de estados es `return CERRADO`: **cierra el
 * circuito y olvida los fallos anteriores**. Un proveedor degradado que contesta
 * `200` con una página de error —lo que hace un balanceador o una CDN cuando el
 * origen se cae— reseteaba su interruptor en cada intento y no llegaba nunca a
 * los tres fallos seguidos que hacen falta para abrir.
 *
 * Medido antes de tocar nada:
 *
 *     openFDA · 503        → 3 peticiones · circuito ABIERTO
 *     openFDA · 200 + HTML → 40 peticiones · ningún circuito
 *     PubMed  · 200 + HTML → 16 peticiones · ningún circuito
 *
 * El interruptor estaba derrotado por el ORDEN de dos líneas.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Yendo a cerrar la salida ilegible de openFDA, que REG-537 dejó declarada como
 * lo que faltaba. Buscando dónde ponerla apareció que openFDA ya devolvía `null`
 * para todo —y su cabecera lo argumenta bien: quien llama trata la ausencia de
 * etiqueta como «no hay dosis oficial» y el prompt manda verificar en el Cuadro
 * Básico sin inventar cifras—. O sea: **el defecto que yo iba a arreglar no
 * estaba ahí.** El que sí estaba era otro, en el interruptor, y en las DOS
 * fuentes.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Anotar el éxito al ver el código de estado es afirmar que el proveedor está
 * bien porque contestó **algo**. La función que lo anotaba no había visto el
 * cuerpo: en PubMed ni siquiera podía, porque `ncbiFetch` devuelve la `Response`
 * y quien parsea es otro.
 *
 * Es «ausencia de dato no es dato de ausencia» del lado contrario: **presencia
 * de respuesta no es presencia de respuesta útil.**
 *
 * ── SEÑALAR DE MENOS, NUNCA DE MÁS ──────────────────────────────────────────
 *
 * El arreglo tiene dos mitades y la primera es una RESTA: no se anota el éxito
 * hasta que alguien ha leído el cuerpo y le sirve.
 *
 * La segunda mitad sí añade un fallo, y por eso distingue de quién es:
 *
 *  · Un cuerpo que **no es de este protocolo** —HTML donde iba JSON, un XML
 *    cortado, un objeto sin la forma de la API— es un origen caído. Cuenta.
 *  · Un cuerpo que **sí es la respuesta de la API** con un error nuestro dentro
 *    —`{"esearchresult":{"ERROR":"Invalid db name"}}`— es una consulta mal
 *    formada por nosotros. NO cuenta: apagaría la evidencia de todos los
 *    médicos por un defecto propio y, siendo constante, el circuito no volvería
 *    a cerrarse nunca. Misma razón por la que un 401 no abre el de WhatsApp.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Sólo PubMed y openFDA.** El gateway de IA y WhatsApp anotan su éxito en
 *   otro sitio y con otra forma; no se tocaron, y si tienen el mismo orden es
 *   otra unidad.
 * · **No mide el tiempo real ahorrado**, sólo cuántas peticiones se hacen.
 * · **No dice qué pasa con un cuerpo válido y CONTENIDO equivocado**: un XML
 *   bien formado con datos malos cuenta como que el proveedor está bien, y debe.
 * · **No es una prueba contra la red real.** El proveedor está simulado; lo que
 *   se prueba es la máquina de estados y el orden de las anotaciones.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { olvidarCircuitos, circuitosAbiertos } from '@/lib/red/interruptor'
import {
  leerEsearch, leerEfetch, POR_QUE_IMPORTA_DE_QUIEN_ES,
} from '@/lib/evidencia/una-respuesta-ilegible-no-es-una-respuesta'
import { POR_QUE_EL_EXITO_SE_ANOTA_DESPUES } from '@/lib/evidencia/fallo-del-proveedor'

const HTML_DE_BALANCEADOR = '<html><body>502 Bad Gateway</body></html>'

describe('de quién es el cuerpo que no sirve', () => {
  it('HTML donde iba JSON es del PROVEEDOR', () => {
    const l = leerEsearch('<html>')
    expect(l.legible === false && l.deQuien).toBe('del_proveedor')
  })

  it('un objeto sin la forma de la API, también', () => {
    const l = leerEsearch({ algo: 1 })
    expect(l.legible === false && l.deQuien).toBe('del_proveedor')
  })

  it('un XML cortado, también', () => {
    const l = leerEfetch('<?xml version="1.0"?><PubmedArticleSet><PubmedArt', 3)
    expect(l.legible === false && l.deQuien).toBe('del_proveedor')
  })

  it('pero un ERROR dentro de una respuesta válida es de QUIEN LLAMA', () => {
    /* «Invalid db name» es un defecto NUESTRO. Contarlo como caída apagaría la
       evidencia de todos los médicos, y siendo constante no se recuperaría. */
    const l = leerEsearch({ esearchresult: { ERROR: 'Invalid db name' } })
    expect(l.legible === false && l.deQuien).toBe('de_quien_llama')
  })

  it('y el módulo declara por qué la distinción no es cosmética', () => {
    expect(POR_QUE_IMPORTA_DE_QUIEN_ES).toMatch(/401/)
    expect(POR_QUE_EL_EXITO_SE_ANOTA_DESPUES).toMatch(/borra los fallos anteriores/)
  })
})

describe('el interruptor, contra un proveedor degradado', () => {
  beforeEach(() => { olvidarCircuitos(); vi.restoreAllMocks() })
  afterEach(() => { vi.unstubAllGlobals(); olvidarCircuitos() })

  it('openFDA con 503 deja de llamar a las tres — la referencia', async () => {
    const { dosisFDA } = await import('@/lib/evidencia/openfda')
    const ll = vi.fn(async () => new Response('', { status: 503 }))
    vi.stubGlobal('fetch', ll)
    for (let i = 0; i < 20; i++) await dosisFDA('amoxicillin')
    expect({ peticiones: ll.mock.calls.length, abiertos: circuitosAbiertos() })
      .toEqual({ peticiones: 3, abiertos: ['ev:openfda:plataforma'] })
  })

  it('AL REVÉS — así era: con 200 y HTML no abría NUNCA (40 peticiones de 40)', async () => {
    const { dosisFDA } = await import('@/lib/evidencia/openfda')
    const ll = vi.fn(async () => new Response(HTML_DE_BALANCEADOR, { status: 200 }))
    vi.stubGlobal('fetch', ll)
    for (let i = 0; i < 20; i++) await dosisFDA('amoxicillin')
    /* Ahora se comporta igual que el 503 honesto: un origen caído es un origen
       caído, conteste 503 o conteste 200 con la página del balanceador. */
    expect({ peticiones: ll.mock.calls.length, abiertos: circuitosAbiertos() })
      .toEqual({ peticiones: 3, abiertos: ['ev:openfda:plataforma'] })
  })

  it('y lo mismo en PubMed, donde el parseo vive fuera de `ncbiFetch`', async () => {
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    const ll = vi.fn(async () => new Response(HTML_DE_BALANCEADOR, { status: 200 }))
    vi.stubGlobal('fetch', ll)
    for (let i = 0; i < 8; i++) await buscarEvidencia('sepsis', {})
    expect({ peticiones: ll.mock.calls.length, abiertos: circuitosAbiertos() })
      .toEqual({ peticiones: 3, abiertos: ['ev:ncbi:plataforma'] })
  }, 30_000)

  it('un ERROR NUESTRO no apaga la evidencia de nadie', async () => {
    /**
     * El caso que impide que este arreglo se pase de frenada. Si contara, un
     * defecto en nuestra propia consulta dejaría sin PubMed a todos los médicos
     * del producto — y como el defecto sería constante, para siempre.
     */
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    const ll = vi.fn(async () =>
      new Response(JSON.stringify({ esearchresult: { ERROR: 'Invalid db name' } }), { status: 200 }))
    vi.stubGlobal('fetch', ll)
    for (let i = 0; i < 8; i++) await buscarEvidencia('sepsis', {})
    expect({ peticiones: ll.mock.calls.length, abiertos: circuitosAbiertos() })
      .toEqual({ peticiones: 16, abiertos: [] })
  }, 30_000)

  it('dos respuestas rotas y luego sanas: no queda ningún circuito abierto', async () => {
    /* El éxito bien anotado sigue cerrando el circuito. Sin esto, el arreglo
       convertiría cualquier tropiezo en una apertura acumulativa. */
    const { buscarEvidencia } = await import('@/lib/evidencia/pubmed')
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      if (++n <= 2) return new Response(HTML_DE_BALANCEADOR, { status: 200 })
      return new Response(
        String(u).includes('esearch')
          ? JSON.stringify({ esearchresult: { idlist: ['1'] } })
          : '<PubmedArticleSet><PubmedArticle><PMID>1</PMID><ArticleTitle>T</ArticleTitle>'
            + '<Title>J</Title><Year>2020</Year><AbstractText>a</AbstractText></PubmedArticle></PubmedArticleSet>',
        { status: 200 })
    }))
    for (let i = 0; i < 6; i++) await buscarEvidencia('sepsis', {})
    expect(circuitosAbiertos()).toEqual([])
  }, 30_000)
})
