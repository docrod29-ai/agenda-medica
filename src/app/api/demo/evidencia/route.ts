/**
 * GET /api/demo/evidencia  —  RECUPERACIÓN DE EVIDENCIA EN VIVO (público, demo)
 *
 * Enciende los pasos 8-9 del razonamiento (Recupera evidencia · Verifica el PMID)
 * DE VERDAD y en público: busca en PubMed (E-utilities, API pública y gratuita)
 * artículos reales para el caso sembrado del demo (la "triple whammy": AINE +
 * IECA + ERC → daño renal). Devuelve PMID/DOI REALES — nada inventado. Cada PMID
 * es verificable con un clic contra pubmed.ncbi.nlm.nih.gov.
 *
 * Es SEGURO como público:
 *  - Consulta FIJA (no hay input del usuario → sin inyección ni abuso de términos).
 *  - Solo lectura de datos públicos (metadatos + resumen, no full-text de paga).
 *  - Cache en memoria (TTL) → PubMed se golpea como mucho 1 vez cada 6 h por
 *    instancia, aunque la página reciba muchas visitas.
 *  - Timeout corto + degradación honesta: si PubMed falla, ok:false y el cliente
 *    muestra el estado "pendiente", nunca datos inventados.
 */
import { NextResponse } from 'next/server'
import { buscarEvidenciaMulti } from '@/lib/evidencia/pubmed'

export const runtime = 'nodejs'
export const maxDuration = 20

// Consultas fijas del caso del demo (mujer 68a, ERC + AINE + IECA + diurético).
const QUERIES = [
  'NSAID chronic kidney disease acute kidney injury',
  'triple whammy nephrotoxicity ACE inhibitor diuretic NSAID',
]

interface ArtDemo {
  pmid: string
  titulo: string
  revista: string
  anio: string
  tipo: string
  doi: string | null
  url: string
}

// Cache en memoria (por instancia). 6 h: la evidencia de fondo no cambia por hora.
const TTL_MS = 6 * 60 * 60 * 1000
let cache: { ts: number; arts: ArtDemo[] } | null = null

export async function GET() {
  // Sirve del cache si está fresco (protege a PubMed de visitas repetidas).
  if (cache && Date.now() - cache.ts < TTL_MS) {
    return NextResponse.json({ ok: true, articulos: cache.arts, cacheado: true })
  }

  try {
    const encontrados = await buscarEvidenciaMulti(QUERIES, {
      max: 5,
      signal: AbortSignal.timeout(15000),
    })
    const arts: ArtDemo[] = encontrados.slice(0, 5).map(a => ({
      pmid: a.pmid,
      titulo: a.titulo,
      revista: a.revista,
      anio: a.anio,
      tipo: a.tipo || '',
      doi: a.doi ?? null,
      url: a.url,
    }))

    if (arts.length === 0) {
      // Sin resultados (429 intermitente o términos sin match): honesto, no inventa.
      return NextResponse.json(
        { ok: false, articulos: [], error: 'PubMed no devolvió artículos en este momento (reintenta en un momento).' },
        { status: 200 },
      )
    }

    cache = { ts: Date.now(), arts }
    return NextResponse.json({ ok: true, articulos: arts, cacheado: false })
  } catch (e) {
    return NextResponse.json(
      { ok: false, articulos: [], error: `No se pudo recuperar evidencia en vivo: ${String(e).slice(0, 120)}` },
      { status: 200 },
    )
  }
}
