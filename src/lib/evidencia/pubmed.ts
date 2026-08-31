/**
 * Cliente de PubMed (NCBI E-utilities) — API pública y GRATUITA.
 *
 * PubMed indexa NEJM, JAMA, Cochrane, Lancet, BMJ… (37M+ citas). Aquí buscamos
 * los estudios más relevantes/recientes para un tema clínico y traemos su
 * metadato + RESUMEN (abstract). El texto completo de revistas de paga NO se
 * descarga ni se reproduce (derechos de autor) — solo cita + resumen público,
 * que es lo que la ley permite y lo que basta para el análisis de evidencia.
 *
 * Sin llave funciona (límite ~3 req/s). Con NCBI_API_KEY (gratis en
 * https://www.ncbi.nlm.nih.gov/account/) sube a ~10 req/s.
 */

import { fetchConTimeout, TIMEOUT } from '@/lib/fetch-con-timeout'
import { permiteLlamar, anotarVeredicto } from '@/lib/red/interruptor'
import {
  claveCircuitoEvidencia, veredictoDeRespuestaEvidencia, veredictoDeExcepcionEvidencia,
  FuenteNoConsultada,
} from '@/lib/evidencia/fallo-del-proveedor'

import { licenciaDePmc } from '@/lib/evidencia/licencia-pmc'
import { leerEsearch, leerEfetch } from '@/lib/evidencia/una-respuesta-ilegible-no-es-una-respuesta'
import { exigeQueSeBaje } from '@/lib/evidence-integrations/de-donde-se-baja'

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const API_KEY = process.env.NCBI_API_KEY ?? ''

export interface ArticuloPubMed {
  pmid: string
  titulo: string
  revista: string
  /**
   * Abreviatura ISO de la revista, si PubMed la dio. `undefined` = no la dio,
   * **no** «no tiene».
   */
  revistaAbrev?: string
  /**
   * Las partes del resumen estructurado con su etiqueta original (REG-400).
   *
   * Ausente = el resumen no venía estructurado. Sirve para saber de qué parte
   * del artículo sale una cita: los antecedentes de un estudio no son sus
   * hallazgos. Ver `de-donde-sale-el-pasaje.ts`.
   */
  secciones?: { etiqueta: string; texto: string }[]
  anio: string
  resumen: string
  url: string
  /** Tipo de estudio para jerarquía de evidencia: 'Meta-análisis' | 'Guía' | 'ECA' | 'Revisión' | '' */
  tipo?: string
  /** DOI del artículo (si PubMed lo reporta), para citarlo/verificarlo. */
  doi?: string
}

/** Extrae el DOI del bloque XML de un artículo (ELocationID o ArticleId). */
function extraerDoi(b: string): string | undefined {
  const m = b.match(/<ELocationID[^>]*EIdType="doi"[^>]*>([\s\S]*?)<\/ELocationID>/i)
    || b.match(/<ArticleId[^>]*IdType="doi"[^>]*>([\s\S]*?)<\/ArticleId>/i)
  const doi = m ? desescapar(m[1]).trim() : ''
  return doi && /^10\./.test(doi) ? doi : undefined
}

const conKey = (u: string) => (API_KEY ? `${u}&api_key=${API_KEY}` : u)

// ── Regulador de velocidad (throttle) para NCBI E-utilities ──────────────────
// Sin API key PubMed permite ~3 req/s; con key ~10/s. La búsqueda multi dispara
// muchas esearch en paralelo → sin throttle, PubMed devuelve 429 y la mitad de
// las búsquedas volvían VACÍAS de forma intermitente (bug de "a veces no hay citas").
// Serializamos las llamadas con un espaciado mínimo para nunca exceder el límite.
const MIN_GAP_MS = API_KEY ? 120 : 340
let _ultima = 0
let _cola: Promise<unknown> = Promise.resolve()
function ncbiFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const p = _cola.then(async () => {
    /**
     * REG-391 · el interruptor, y un tiempo máximo aunque nadie pase `signal`.
     *
     * Dos defectos vivían aquí. Uno: `expediente/evidencia` llama sin `signal`,
     * así que un socket colgado de NCBI inmovilizaba una función de 300 s. Dos:
     * sin interruptor, cada búsqueda de cada médico volvía a pagar esa espera
     * entera contra un índice que llevaba minutos sin contestar.
     *
     * Al abrirse el circuito se LANZA (no se devuelve vacío): el `catch` de
     * quien llama marca el testigo, y el testigo es lo que separa «no hay
     * artículos» de «no se pudo preguntar».
     */
    /* WS-06 — antes que nada: que el host esté declarado como fuente que se
       baja. Falla cerrado, y cuesta una búsqueda en un conjunto. */
    exigeQueSeBaje(url)
    const clave = claveCircuitoEvidencia('ncbi')
    if (!permiteLlamar(clave).pasa) throw new FuenteNoConsultada('PubMed')
    const espera = Math.max(0, MIN_GAP_MS - (Date.now() - _ultima))
    if (espera) await new Promise(r => setTimeout(r, espera))
    _ultima = Date.now()
    try {
      const r = await fetchConTimeout(url, { signal }, TIMEOUT.evidencia)
      anotarVeredicto(clave, r.ok ? 'contesto' : veredictoDeRespuestaEvidencia(r.status))
      return r
    } catch (e) {
      anotarVeredicto(clave, veredictoDeExcepcionEvidencia(e))
      throw e
    }
  })
  _cola = p.then(() => undefined, () => undefined)   // la cola nunca se rompe por un error
  return p
}

/**
 * LA ETIQUETA DICE LO QUE DIJO PUBMED, NI UNA PALABRA MÁS (REG-401).
 *
 * ── QUÉ DECÍA DE MÁS ────────────────────────────────────────────────────────
 *
 * El clasificador **colapsaba dos pares de diseños distintos**:
 *
 *   · `meta-analysis` y `systematic review` salían los dos como «Meta-análisis».
 *     Una revisión sistemática sin metaanálisis no combina resultados: los
 *     resume. No es lo mismo.
 *   · `randomized controlled trial` y `clinical trial` a secas salían los dos
 *     como «ECA». El tipo `Clinical Trial` de PubMed incluye ensayos **no
 *     aleatorizados** —fase I, de un solo brazo—, y llamarlos ECA es afirmar un
 *     diseño que la fuente no afirmó.
 *
 * ── POR QUÉ IMPORTA, Y DÓNDE LLEGABA ────────────────────────────────────────
 *
 * El repositorio ya sabía que esta etiqueta colapsa: `desde-pubmed.ts` se niega
 * en redondo a traducirla a `DisenoDeEstudio` —«traducir esas cubetas
 * inventaría un dato metodológico que la fuente no dio»— y tiene su caso en
 * `evidence-model.test.ts`.
 *
 * Pero esa defensa está en el borde del MODELO, y la etiqueta se consume en
 * otros dos sitios que no pasan por ahí: el prompt del consultor la mete como
 * `[ECA]` delante del resumen, y `articulosMin` la manda a la pantalla del
 * médico. O sea: se decidió que el dato no era de fiar y se seguía entregando a
 * las dos personas que deciden con él.
 *
 * ── LO QUE **NO** SE TOCA: EL ORDEN ─────────────────────────────────────────
 *
 * Los rangos de los diseños recién separados son **los mismos** que tenían
 * cuando iban juntos. Cambiar el orden sería inventar una jerarquía
 * metodológica nueva, que es exactamente lo que `seleccion.ts` se prohíbe a sí
 * mismo y lo que la regla 1 llama inventar una cifra clínica.
 *
 * Aquí cambia **lo que se dice**, no lo que se prefiere.
 */
const RANK: Record<string, number> = {
  'Meta-análisis': 0,
  /* Mismo rango que el metaanálisis: es donde estaba antes de separarse. */
  'Revisión sistemática': 0,
  'Guía': 1,
  'ECA': 2,
  /* Mismo rango que el ECA, por lo mismo. */
  'Ensayo clínico': 2,
  'Revisión': 3,
  '': 4,
}

function tipoDeEstudio(bloque: string): string {
  const tipos = [...bloque.matchAll(/<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/gi)].map(m => desescapar(m[1]).toLowerCase())
  /* El orden importa: un artículo puede traer varios tipos, y se responde con
     el más específico que PubMed haya declarado. */
  if (tipos.some(t => t.includes('meta-analysis'))) return 'Meta-análisis'
  if (tipos.some(t => t.includes('systematic review'))) return 'Revisión sistemática'
  if (tipos.some(t => t.includes('guideline'))) return 'Guía'
  if (tipos.some(t => t.includes('randomized controlled trial'))) return 'ECA'
  /* `Clinical Trial` incluye NO aleatorizados. Se dice así, no «ECA». */
  if (tipos.some(t => t.includes('clinical trial'))) return 'Ensayo clínico'
  if (tipos.some(t => t.includes('review'))) return 'Revisión'
  return ''
}

/**
 * Qué NO se sabe de un diseño con esta etiqueta, para poder decirlo.
 *
 * «Ensayo clínico» a secas es el caso que importa: la etiqueta es correcta y
 * aun así el lector puede dar por hecha una aleatorización que nadie declaró.
 */
export const LO_QUE_LA_ETIQUETA_NO_DICE: Readonly<Record<string, string>> = Object.freeze({
  'Ensayo clínico': 'PubMed no lo declaró aleatorizado: puede ser de un solo brazo o de fase temprana.',
  'Revisión sistemática': 'Revisión sistemática sin metaanálisis declarado: resume los estudios, no combina sus resultados.',
  'Revisión': 'Revisión no sistemática: no declara método de búsqueda ni de selección.',
})

export const POR_QUE_NO_CAMBIA_EL_ORDEN =
  'Los diseños recién separados conservan el rango que tenían cuando iban ' +
  'juntos. Cambiarlo sería inventar una jerarquía metodológica nueva — lo mismo ' +
  'que `seleccion.ts` se prohíbe a sí mismo, y lo que la regla 1 llama inventar ' +
  'una cifra clínica. Aquí cambia lo que se DICE, no lo que se prefiere.'

export const LA_REVISTA_NO_ORDENA =
  'Ni el nombre de la revista, ni su abreviatura, ni su DOI entran en el orden ' +
  'de los artículos. Un ensayo bien hecho en una revista pequeña no vale menos ' +
  'que un reporte de caso en una grande, y desde REG-398 la identidad de la ' +
  'revista está a mano — que es justo cuando conviene que haya un guardián.'

/** Decodifica entidades XML/HTML básicas de los textos de PubMed. */
function desescapar(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')          // quita etiquetas internas (<i>, <sup>…)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

function extraerTag(bloque: string, tag: string): string {
  const m = bloque.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? desescapar(m[1]) : ''
}

/**
 * Busca en PubMed y devuelve los artículos más relevantes con su resumen.
 * @param termino  Consulta (texto clínico: diagnóstico + fármaco, etc.)
 * @param opts.max Máximo de artículos (default 6)
 * @param opts.aniosRecientes Si se da, filtra a los últimos N años.
 */
/**
 * UN FALLO DE RED NO ES «NO HAY LITERATURA».
 *
 * Todas las salidas de error devolvían `[]`, igual que una búsqueda legítima sin
 * resultados. Río arriba eso se convierte en «PubMed no devolvió artículos para
 * estos términos», y el médico lee que no hay evidencia para su caso cuando lo
 * que hubo fue un 429 de NCBI o una caída de red.
 *
 * El testigo se pasa como objeto mutable en vez de cambiar el tipo de retorno:
 * los llamadores que no lo pasan siguen funcionando igual, y el que quiere decir
 * la verdad al médico puede.
 */
export interface TestigoPubMed { fallo: boolean }

/** esearch: un término → lista de PMIDs (por relevancia). */
async function esearch(term: string, max: number, signal?: AbortSignal, testigo?: TestigoPubMed): Promise<string[]> {
  const url = conKey(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${max}&term=${encodeURIComponent(term)}`)
  try {
    const r = await ncbiFetch(url, signal)
    if (!r.ok) { if (testigo) testigo.fallo = true; return [] }
    const d = await r.json()
    /**
     * REG-434 · un 200 con el cuerpo ilegible no es «no hay artículos».
     *
     * NCBI contesta `{"esearchresult":{"ERROR":"…"}}` con estado 200. Es JSON
     * válido, `r.json()` no lanza, y `?? []` lo convertía en una búsqueda sin
     * resultados. El médico leía «no hay literatura» de una pregunta que nunca
     * se respondió.
     */
    const lectura = leerEsearch(d)
    if (!lectura.legible) { if (testigo) testigo.fallo = true; return [] }
    return (d as { esearchresult: { idlist: string[] } }).esearchresult.idlist
  } catch { if (testigo) testigo.fallo = true; return [] }
}

/** efetch: PMIDs → artículos con abstract y tipo de estudio. */
async function efetchArts(ids: string[], signal?: AbortSignal, testigo?: TestigoPubMed): Promise<ArticuloPubMed[]> {
  if (ids.length === 0) return []
  const efetch = conKey(`${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=${ids.join(',')}`)
  let xml = ''
  try {
    const r = await ncbiFetch(efetch, signal)
    if (!r.ok) { if (testigo) testigo.fallo = true; return [] }
    xml = await r.text()
  } catch { if (testigo) testigo.fallo = true; return [] }
  /**
   * REG-434 · lo mismo por el otro lado, y aquí `r.text()` NUNCA lanza: una
   * página de error HTML o un XML cortado a la mitad daban cero bloques y cero
   * artículos, con el testigo intacto. A `efetch` sólo se le piden ids que
   * `esearch` acaba de devolver, así que «cero de N» no tiene lectura inocente.
   */
  const legibilidad = leerEfetch(xml, ids.length)
  if (!legibilidad.legible) { if (testigo) testigo.fallo = true; return [] }
  const bloques = xml.split('<PubmedArticle>').slice(1)
  const arts: ArticuloPubMed[] = []
  for (const b of bloques) {
    const pmid = extraerTag(b, 'PMID')
    const titulo = extraerTag(b, 'ArticleTitle')
    /**
     * LAS DOS FORMAS DEL NOMBRE, no una (REG-398).
     *
     * Aquí había `Title || ISOAbbreviation`: se quedaba con la que hubiera y
     * tiraba la otra. Son datos distintos y con usos distintos — una lista se
     * lee mejor con el nombre entero y una CITA se escribe con la abreviatura
     * ISO— y el que se tiraba no se podía recuperar sin volver a preguntar.
     */
    const revista = extraerTag(b, 'Title') || extraerTag(b, 'ISOAbbreviation')
    const revistaAbrev = extraerTag(b, 'ISOAbbreviation') || undefined
    const anio = extraerTag(b, 'Year')
    /**
     * LA ETIQUETA DE LA SECCIÓN, QUE SE TIRABA (REG-400).
     *
     * `<AbstractText[^>]*>` se comía el atributo `Label`, así que un resumen
     * estructurado —«BACKGROUND: …», «RESULTS: …»— se unía en un texto plano y
     * la sección se perdía. Con ella se puede saber si una cita sale de los
     * hallazgos del estudio o de lo que se creía ANTES de hacerlo, que es la
     * forma más común de citar fuera de contexto.
     *
     * `resumen` sigue siendo exactamente lo que era: es lo que se le enseña al
     * modelo y contra lo que se ancla la cita, y cambiarlo desalinearía el
     * anclaje de REG-359.
     */
    const trozos = [...b.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/gi)]
      .map(m => ({
        etiqueta: desescapar(/\bLabel="([^"]*)"/i.exec(m[1])?.[1] ?? '').trim(),
        texto: desescapar(m[2]),
      }))
    const partes = trozos.map(t => t.texto)
    const resumen = partes.join(' ').slice(0, 1200)
    /* Sólo las que tienen etiqueta: un resumen sin estructura no tiene secciones
       que declarar, y fabricar una sería inventar la procedencia. */
    const secciones = trozos.filter(t => t.etiqueta)
    if (pmid && titulo) arts.push({
      pmid, titulo, revista, revistaAbrev, anio, resumen,
      ...(secciones.length ? { secciones } : {}),
      tipo: tipoDeEstudio(b), doi: extraerDoi(b),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    })
  }
  // Reordena por jerarquía de evidencia (meta-análisis/guías arriba), conservando
  // el orden de relevancia de PubMed dentro de cada nivel.
  return arts.map((a, i) => ({ a, i })).sort((x, y) => (RANK[x.a.tipo ?? ''] - RANK[y.a.tipo ?? '']) || (x.i - y.i)).map(o => o.a)
}

export async function buscarEvidencia(
  termino: string,
  opts: { max?: number; aniosRecientes?: number; signal?: AbortSignal; testigo?: TestigoPubMed } = {},
): Promise<ArticuloPubMed[]> {
  const max = Math.min(Math.max(opts.max ?? 6, 1), 20)
  const term = termino.trim()
  if (!term) return []
  const intentos = [
    opts.aniosRecientes ? `(${term}) AND ("last ${opts.aniosRecientes} years"[PDat])` : term,
    term,
  ]
  let ids: string[] = []
  for (const t of intentos) { ids = await esearch(t, max, opts.signal, opts.testigo); if (ids.length > 0) break }
  return efetchArts(ids, opts.signal, opts.testigo)
}

/**
 * Texto completo de PMC. Para los PMIDs dados, mapea a PMCID (elink) y trae el
 * full-text XML (efetch db=pmc); extrae los párrafos CUANTITATIVOS (con
 * IC95%/HR/RR/OR/p/NNT/%) para razonar sobre cifras reales, no sólo el resumen.
 * Devuelve `{ pmid: extracto }`. Nunca lanza.
 *
 * ── LA LICENCIA SE LEE POR ARTÍCULO (REG-357) ───────────────────────────────
 *
 * Aquí decía «solo artículos de ACCESO ABIERTO — legal», y es una media verdad
 * peligrosa: el subconjunto Open Access de PMC **mezcla licencias**. Conviven
 * CC0 y CC-BY —que permiten reproducir— con CC-BY-NC-ND y con «OA no
 * comercial», que no. «Acceso abierto» dice que se puede LEER; no dice que se
 * pueda COPIAR dentro de un producto de pago, que es lo que hace esta función.
 *
 * El catálogo del repositorio ya lo tenía diagnosticado y sin arreglar.
 *
 * Ahora se lee la licencia del propio XML y se **falla cerrado**: sin permiso
 * explícito, no se reproduce. **No se pierde nada clínico** — se cae al resumen,
 * que es exactamente lo que ya pasaba con los artículos de pago.
 */
export async function textoCompletoPMC(
  pmids: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<Record<string, string>> {
  const r = await textoCompletoPMCConIdentidad(pmids, opts)
  return r.textos
}

/**
 * LO MISMO, PERO SIN TIRAR LO QUE YA SE AVERIGUÓ (WS-07, REG-398).
 *
 * `textoCompletoPMC` resolvía el **PMCID** y leía la **licencia** —los dos datos
 * que dicen si el texto completo existe y si se puede reproducir— y devolvía
 * sólo el texto. Los dos se perdían en la misma función que los calculó.
 *
 * Con eso, el sistema no podía distinguir tres cosas muy distintas:
 *
 *  · «este artículo sólo tiene resumen»;
 *  · «tiene texto completo abierto y no se pidió»;
 *  · «tiene texto completo y la licencia no deja reproducirlo».
 *
 * Las tres se veían igual: sin texto. Y la tercera es justamente la que hay que
 * poder explicar.
 *
 * `accesoAbierto` se pone en `true` **sólo** cuando la licencia lo dice. Tener
 * PMCID no lo implica: el subconjunto de PMC mezcla licencias, y suponerlo
 * llevaría a reproducir lo que no se puede.
 */
export interface IdentidadPMC {
  pmcid?: string
  accesoAbierto?: boolean
}

export async function textoCompletoPMCConIdentidad(
  pmids: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<{ textos: Record<string, string>; identidad: Record<string, IdentidadPMC> }> {
  const textos: Record<string, string> = {}
  const identidad: Record<string, IdentidadPMC> = {}
  await Promise.all(pmids.slice(0, 3).map(async pmid => {
    try {
      const el = await ncbiFetch(conKey(`${EUTILS}/elink.fcgi?dbfrom=pubmed&db=pmc&retmode=json&id=${pmid}`), opts.signal)
      if (!el.ok) return
      const ej = await el.json()
      const dbs = ej?.linksets?.[0]?.linksetdbs ?? []
      const pmcid = dbs.flatMap((l: { links?: string[] }) => l.links ?? [])[0]
      if (!pmcid) return
      /* Existe en PMC. Eso ya es un dato, aunque el texto no se pueda usar. */
      identidad[pmid] = { pmcid: `PMC${String(pmcid).replace(/^PMC/i, '')}` }
      const fx = await ncbiFetch(conKey(`${EUTILS}/efetch.fcgi?db=pmc&id=${pmcid}&rettype=xml`), opts.signal)
      if (!fx.ok) return
      const xml = await fx.text()
      /**
       * ANTES de extraer una sola línea. Extraer y luego decidir dejaría el
       * texto en memoria y a un `return` de distancia de acabar en un prompt.
       */
      const licencia = licenciaDePmc(xml)
      /* Sólo se afirma el acceso abierto cuando la licencia lo permite; si no,
         se deja SIN DECIR — no se escribe `false`, que sería afirmar lo
         contrario sin haberlo comprobado. */
      if (licencia.puede) identidad[pmid] = { ...identidad[pmid], accesoAbierto: true }
      if (!licencia.puede) return
      const parrafos = [...xml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => desescapar(m[1])).filter(Boolean)
      const cuant = parrafos.filter(p => /(\d{1,3}(\.\d+)?\s*%|\bCI\b|95%|\bHR\b|\bRR\b|\bOR\b|\bp\s*[=<]|\bNNT\b|hazard|confidence interval)/i.test(p))
      const texto = (cuant.length ? cuant : parrafos).join(' ').replace(/\s+/g, ' ').slice(0, 1600)
      if (texto.trim().length > 120) textos[pmid] = texto
    } catch { /* no OA / timeout: se queda con el resumen */ }
  }))
  return { textos, identidad }
}

// Filtro de evidencia de ALTA calidad (meta-análisis, revisiones sistemáticas, ECA, guías).
const FILTRO_HQ = '(systematic[sb] OR "meta-analysis"[pt] OR "randomized controlled trial"[pt] OR "practice guideline"[pt] OR guideline[pt])'

/**
 * Búsqueda multi-consulta (varias sub-preguntas en PARALELO). Por cada sub-query
 * corre DOS esearch en paralelo: una sesgada a alta calidad (meta-análisis/ECA/
 * guías) y otra general — así prioriza lo mejor sin perder cobertura. Une, dedup
 * por PMID y trae los mejores con abstract completo y tipo de estudio.
 */
export async function buscarEvidenciaMulti(
  queries: string[],
  opts: { max?: number; aniosRecientes?: number; signal?: AbortSignal; testigo?: TestigoPubMed } = {},
): Promise<ArticuloPubMed[]> {
  const qs = [...new Set(queries.map(q => q.trim()).filter(Boolean))].slice(0, 4)
  if (qs.length === 0) return []
  const max = Math.min(Math.max(opts.max ?? 8, 1), 20)
  const ventana = opts.aniosRecientes ? ` AND ("last ${opts.aniosRecientes} years"[PDat])` : ''

  // Por sub-query: alta calidad primero, luego general. El throttle (ncbiFetch) las
  // espacia para no exceder el límite de PubMed → ya no vuelven vacías por 429.
  const porQuery = await Promise.all(qs.map(async q => {
    const hq = await esearch(`(${q}) AND ${FILTRO_HQ}${ventana}`, 5, opts.signal, opts.testigo)
    const gen = await esearch(`(${q})${ventana}`, 5, opts.signal, opts.testigo)
    // "landmark" (alta calidad SIN ventana) sólo aporta algo cuando SÍ hay ventana;
    // sin ventana es idéntica a hq → se omite para no gastar una llamada.
    const landmark = ventana ? await esearch(`(${q}) AND ${FILTRO_HQ}`, 3, opts.signal, opts.testigo) : []
    return [...hq, ...gen, ...landmark]
  }))

  // Une en round-robin por sub-query (equilibra cobertura entre las sub-preguntas) + dedup.
  const seen = new Set<string>()
  const orden: string[] = []
  const maxLen = Math.max(...porQuery.map(l => l.length), 0)
  for (let i = 0; i < maxLen; i++) {
    for (const lista of porQuery) {
      const id = lista[i]
      if (id && !seen.has(id)) { seen.add(id); orden.push(id) }
    }
  }
  return efetchArts(orden.slice(0, max), opts.signal, opts.testigo)
}
