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
  /** Tipo de estudio para jerarquía de evidencia: 'Meta-análisis' | 'Guía' | 'ECA' | 'Revisión' | '' */
  tipo?: string
}

const conKey = (u: string) => (API_KEY ? `${u}&api_key=${API_KEY}` : u)

// Jerarquía de evidencia: menor rank = mayor peso (flota arriba en los resultados).
const RANK: Record<string, number> = { 'Meta-análisis': 0, 'Guía': 1, 'ECA': 2, 'Revisión': 3, '': 4 }
function tipoDeEstudio(bloque: string): string {
  const tipos = [...bloque.matchAll(/<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/gi)].map(m => desescapar(m[1]).toLowerCase())
  if (tipos.some(t => t.includes('meta-analysis') || t.includes('systematic review'))) return 'Meta-análisis'
  if (tipos.some(t => t.includes('guideline'))) return 'Guía'
  if (tipos.some(t => t.includes('randomized controlled trial') || t.includes('clinical trial'))) return 'ECA'
  if (tipos.some(t => t.includes('review'))) return 'Revisión'
  return ''
}

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
/** esearch: un término → lista de PMIDs (por relevancia). */
async function esearch(term: string, max: number, signal?: AbortSignal): Promise<string[]> {
  const url = conKey(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${max}&term=${encodeURIComponent(term)}`)
  try {
    const r = await fetch(url, { signal })
    if (!r.ok) return []
    const d = await r.json()
    return d?.esearchresult?.idlist ?? []
  } catch { return [] }
}

/** efetch: PMIDs → artículos con abstract y tipo de estudio. */
async function efetchArts(ids: string[], signal?: AbortSignal): Promise<ArticuloPubMed[]> {
  if (ids.length === 0) return []
  const efetch = conKey(`${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=${ids.join(',')}`)
  let xml = ''
  try {
    const r = await fetch(efetch, { signal })
    if (!r.ok) return []
    xml = await r.text()
  } catch { return [] }
  const bloques = xml.split('<PubmedArticle>').slice(1)
  const arts: ArticuloPubMed[] = []
  for (const b of bloques) {
    const pmid = extraerTag(b, 'PMID')
    const titulo = extraerTag(b, 'ArticleTitle')
    const revista = extraerTag(b, 'Title') || extraerTag(b, 'ISOAbbreviation')
    const anio = extraerTag(b, 'Year')
    const partes = [...b.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi)].map(m => desescapar(m[1]))
    const resumen = partes.join(' ').slice(0, 1200)
    if (pmid && titulo) arts.push({ pmid, titulo, revista, anio, resumen, tipo: tipoDeEstudio(b), url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` })
  }
  // Reordena por jerarquía de evidencia (meta-análisis/guías arriba), conservando
  // el orden de relevancia de PubMed dentro de cada nivel.
  return arts.map((a, i) => ({ a, i })).sort((x, y) => (RANK[x.a.tipo ?? ''] - RANK[y.a.tipo ?? '']) || (x.i - y.i)).map(o => o.a)
}

export async function buscarEvidencia(
  termino: string,
  opts: { max?: number; aniosRecientes?: number; signal?: AbortSignal } = {},
): Promise<ArticuloPubMed[]> {
  const max = Math.min(Math.max(opts.max ?? 6, 1), 20)
  const term = termino.trim()
  if (!term) return []
  const intentos = [
    opts.aniosRecientes ? `(${term}) AND ("last ${opts.aniosRecientes} years"[PDat])` : term,
    term,
  ]
  let ids: string[] = []
  for (const t of intentos) { ids = await esearch(t, max, opts.signal); if (ids.length > 0) break }
  return efetchArts(ids, opts.signal)
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
  opts: { max?: number; aniosRecientes?: number; signal?: AbortSignal } = {},
): Promise<ArticuloPubMed[]> {
  const qs = [...new Set(queries.map(q => q.trim()).filter(Boolean))].slice(0, 4)
  if (qs.length === 0) return []
  const max = Math.min(Math.max(opts.max ?? 8, 1), 20)
  const ventana = opts.aniosRecientes ? ` AND ("last ${opts.aniosRecientes} years"[PDat])` : ''

  // Por sub-query: alta calidad primero, luego general (ambas en paralelo).
  const porQuery = await Promise.all(qs.map(async q => {
    const [hq, gen, landmark] = await Promise.all([
      esearch(`(${q}) AND ${FILTRO_HQ}${ventana}`, 5, opts.signal),
      esearch(`(${q})${ventana}`, 5, opts.signal),
      esearch(`(${q}) AND ${FILTRO_HQ}`, 3, opts.signal), // SIN ventana: no perder landmark trials viejos
    ])
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
  return efetchArts(orden.slice(0, max), opts.signal)
}
