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

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const API_KEY = process.env.NCBI_API_KEY ?? ''

export interface ArticuloPubMed {
  pmid: string
  titulo: string
  revista: string
  anio: string
  resumen: string
  url: string
}

const conKey = (u: string) => (API_KEY ? `${u}&api_key=${API_KEY}` : u)

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
export async function buscarEvidencia(
  termino: string,
  opts: { max?: number; aniosRecientes?: number; signal?: AbortSignal } = {},
): Promise<ArticuloPubMed[]> {
  const max = Math.min(Math.max(opts.max ?? 6, 1), 20)
  let term = termino.trim()
  if (!term) return []
  // Sesga a evidencia fuerte y humana.
  const filtros = ['humans[MeSH Terms]']
  if (opts.aniosRecientes) filtros.push(`"last ${opts.aniosRecientes} years"[PDat]`)
  const termFull = `(${term}) AND ${filtros.join(' AND ')}`

  // 1) esearch → PMIDs
  const esearch = conKey(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${max}&term=${encodeURIComponent(termFull)}`)
  let ids: string[] = []
  try {
    const r = await fetch(esearch, { signal: opts.signal })
    if (!r.ok) return []
    const d = await r.json()
    ids = d?.esearchresult?.idlist ?? []
  } catch { return [] }
  if (ids.length === 0) return []

  // 2) efetch → título, revista, año, abstract (XML)
  const efetch = conKey(`${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=${ids.join(',')}`)
  let xml = ''
  try {
    const r = await fetch(efetch, { signal: opts.signal })
    if (!r.ok) return []
    xml = await r.text()
  } catch { return [] }

  // Un artículo por bloque <PubmedArticle>…</PubmedArticle>
  const bloques = xml.split('<PubmedArticle>').slice(1)
  const arts: ArticuloPubMed[] = []
  for (const b of bloques) {
    const pmid = extraerTag(b, 'PMID')
    const titulo = extraerTag(b, 'ArticleTitle')
    const revista = extraerTag(b, 'Title') || extraerTag(b, 'ISOAbbreviation')
    const anio = extraerTag(b, 'Year')
    // El abstract puede venir en varios <AbstractText> (Background/Methods/…)
    const partes = [...b.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi)].map(m => desescapar(m[1]))
    const resumen = partes.join(' ').slice(0, 1200)
    if (pmid && titulo) {
      arts.push({ pmid, titulo, revista, anio, resumen, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` })
    }
  }
  return arts
}
