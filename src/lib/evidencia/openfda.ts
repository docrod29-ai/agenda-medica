/**
 * Cliente openFDA (api.fda.gov) — ficha técnica de fármacos, GRATIS y sin llave.
 *
 * Da la DOSIS oficial etiquetada (dosage_and_administration) de un fármaco, para
 * que la app dé dosis AUTORITATIVA (de la etiqueta aprobada) y no una inventada
 * por la IA. Es etiquetado de EE.UU. (FDA); la farmacología/dosis coincide en su
 * mayoría con la práctica mexicana, pero SIEMPRE debe verificarse contra la GPC
 * local / el Cuadro Básico. Rate limit ~40 req/min sin llave.
 */
const FDA = 'https://api.fda.gov/drug/label.json'

export interface DosisFDA {
  farmaco: string
  dosis: string          // texto de dosificación (recortado)
  url: string            // enlace a openFDA para el fármaco
}

async function pedir(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

/**
 * Dosis etiquetada de un fármaco (nombre genérico en INGLÉS: 'amoxicillin').
 * Prefiere la etiqueta de ingrediente único (evita combinaciones). null si no hay.
 */
export async function dosisFDA(farmacoEn: string): Promise<DosisFDA | null> {
  const drug = farmacoEn.trim().toLowerCase()
  if (!drug || /[^a-z0-9 -]/.test(drug)) return null

  // 1) Búsqueda exacta por genérico (mayúsculas = campo .exact de openFDA).
  const exact = await pedir(`${FDA}?search=openfda.generic_name.exact:"${encodeURIComponent(drug.toUpperCase())}"&limit=5`)
  // 2) Respaldo: búsqueda amplia.
  const amplio = exact?.results ? exact : await pedir(`${FDA}?search=openfda.generic_name:"${encodeURIComponent(drug)}"&limit=5`)

  const results = (amplio?.results as Array<Record<string, unknown>> | undefined) ?? []
  if (results.length === 0) return null

  // Prefiere la etiqueta cuyo genérico sea SOLO este fármaco (no combinación).
  const esUnico = (r: Record<string, unknown>) => {
    const g = (r.openfda as { generic_name?: string[] } | undefined)?.generic_name ?? []
    return g.length === 1 && g[0].toLowerCase().includes(drug)
  }
  const elegido = results.find(esUnico) ?? results[0]
  const da = (elegido.dosage_and_administration as string[] | undefined)
  if (!Array.isArray(da) || da.length === 0) return null

  // Limpia el encabezado numérico ("2 DOSAGE AND ADMINISTRATION …") y recorta.
  const dosis = da.join(' ').replace(/^\s*\d+(\.\d+)?\s+DOSAGE AND ADMINISTRATION\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 900)
  if (!dosis) return null

  return { farmaco: drug, dosis, url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=BasicSearch.process&searchTerm=${encodeURIComponent(drug)}` }
}
