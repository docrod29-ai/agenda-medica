'use client'
/**
 * Firma A PRUEBA DE FALLOS de las imágenes del diseño de receta (membrete /
 * firma / sello) — NEXUS-QUALITY-010 fase 2, lado cliente.
 *
 * Cambia las <img> servidas por /api/receta/diseno?path=… (sin firma) a su
 * versión FIRMADA con caducidad (POST /api/receta/diseno-url). Contrato duro:
 * NUNCA rompe el documento — si el endpoint falla, tarda más de `timeoutMs` o no
 * hay sesión, las imágenes se quedan con su URL original (que sigue siendo
 * válida mientras RECETA_DISENO_FIRMA no esté en 'obligatoria').
 *
 * La usan los DOS caminos de papelería: la impresión (print-element) y el
 * "Descargar PDF" (pdf-download, html2canvas rasteriza el DOM tal cual).
 */

const ES_PROXY_SIN_FIRMA = (src: string): boolean =>
  src.includes('/api/receta/diseno?path=') && !src.includes('&sig=')

const pathDe = (src: string): string => {
  try { return new URL(src, window.location.origin).searchParams.get('path') ?? '' } catch { return '' }
}

/** Espera a que una imagen (re)cargue, con tope. Nunca rechaza. */
const esperarCarga = (img: HTMLImageElement, ms: number): Promise<void> =>
  new Promise(resolve => {
    if (img.complete) return resolve()
    const fin = () => { clearTimeout(t); resolve() }
    const t = setTimeout(fin, ms)
    img.addEventListener('load', fin, { once: true })
    img.addEventListener('error', fin, { once: true })
  })

/**
 * Firma las imágenes dadas y espera su recarga. Devuelve cuántas se firmaron.
 * Jamás lanza.
 */
export async function firmarImagenesDiseno(imgs: HTMLImageElement[], opts?: { timeoutMs?: number; esperarRecargaMs?: number }): Promise<number> {
  const timeoutMs = opts?.timeoutMs ?? 1500
  try {
    const porFirmar = imgs.filter(img => ES_PROXY_SIN_FIRMA(img.src))
    if (porFirmar.length === 0) return 0
    const paths = [...new Set(porFirmar.map(img => pathDe(img.src)).filter(Boolean))]
    if (paths.length === 0) return 0

    const { fetchAutenticado } = await import('@/lib/auth-client')
    const res = await Promise.race([
      fetchAutenticado('/api/receta/diseno-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths }),
      }),
      new Promise<null>(r => setTimeout(() => r(null), timeoutMs)),
    ])
    if (!res || !res.ok) return 0
    const data = await res.json().catch(() => null) as { urls?: Record<string, string> } | null
    if (!data?.urls) return 0

    let firmadas = 0
    const recargas: Promise<void>[] = []
    for (const img of porFirmar) {
      const firmada = data.urls[pathDe(img.src)]
      if (firmada && firmada.includes('sig=')) {
        img.src = firmada
        firmadas++
        recargas.push(esperarCarga(img, opts?.esperarRecargaMs ?? 4000))
      }
    }
    await Promise.all(recargas)
    return firmadas
  } catch {
    return 0   // sin firma: el documento sale igual que siempre
  }
}
