'use client'
/**
 * Acuñado A PRUEBA DE FALLOS de las capacidades de las imágenes del diseño de
 * receta (membrete / firma / sello) — R-06 / #350, lado cliente.
 *
 * Cambia las <img> servidas por /api/receta/diseno?path=… a su versión con
 * CAPACIDAD LIGADA Y CADUCA (POST /api/receta/diseno-url). Contrato duro: NUNCA
 * rompe el documento — si el endpoint falla, tarda más de `timeoutMs` o no hay
 * sesión, las imágenes se quedan con su URL original (que el proxy ya rechaza:
 * se verá rota, pero el resto del documento sale).
 *
 * La usan los TRES caminos: la vista previa (FirmadorDisenos), la impresión
 * (print-element) y el "Descargar PDF" (pdf-download, html2canvas rasteriza el
 * DOM tal cual).
 */

/**
 * Margen con el que una capacidad se considera «por vencer» y se vuelve a
 * acuñar. Se declara aquí y no se importa del módulo del servidor a propósito:
 * ése usa `crypto` y arrastrarlo al bundle del navegador sería peor que repetir
 * un número (holgado frente al TTL de minutos del servidor).
 */
const MARGEN_REACUNADO_MS = 120_000

const ES_PROXY = (src: string): boolean =>
  src.includes('/api/receta/diseno?path=') || src.includes('/api/receta/diseno?u=')

/**
 * ¿Esta <img> necesita capacidad? Sí cuando no la trae, y TAMBIÉN cuando la que
 * trae está por vencer.
 *
 * Lo segundo importa desde que la capacidad dura minutos y no un día: una
 * pantalla abierta un rato conserva `<img>` con capacidad caduca, y sin este
 * chequeo la impresión saldría sin membrete porque el detector antiguo —«¿tiene
 * sig?»— las daba por buenas para siempre.
 */
const NECESITA_CAPACIDAD = (src: string): boolean => {
  if (!ES_PROXY(src)) return false
  try {
    const sp = new URL(src, window.location.origin).searchParams
    if (!sp.get('sig')) return true
    const exp = Number(sp.get('exp'))
    if (!Number.isFinite(exp)) return true
    return exp * 1000 - Date.now() < MARGEN_REACUNADO_MS
  } catch { return true }
}

/**
 * Path del bucket detrás de una URL del proxy. Cubre las DOS formas:
 *  · nueva:   /api/receta/diseno?path=receta-diseno%2F…
 *  · LEGADA:  /api/receta/diseno?u=https://firebasestorage…/o/receta-diseno%252F…
 *    (configs viejas guardan la URL de descarga completa; el object path viene
 *    codificado dentro de `/o/…`). Si el objeto vive en receta-diseno/ se puede
 *    MIGRAR AL VUELO a la forma firmable ?path=. Si no, se devuelve '' y esa
 *    imagen se queda como está (el fallback de siempre).
 */
const pathDe = (src: string): string => {
  try {
    const sp = new URL(src, window.location.origin).searchParams
    const p = sp.get('path')
    if (p) return p
    const u = sp.get('u')
    if (u) {
      const m = new URL(u).pathname.match(/\/o\/(.+)$/)
      const obj = m ? decodeURIComponent(m[1]) : ''
      if (/^receta-diseno\//.test(obj)) return obj
    }
    return ''
  } catch { return '' }
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
 * Acuña la capacidad de las imágenes dadas y espera su recarga. Devuelve
 * cuántas se cambiaron. Jamás lanza.
 */
export async function firmarImagenesDiseno(imgs: HTMLImageElement[], opts?: { timeoutMs?: number; esperarRecargaMs?: number }): Promise<number> {
  const timeoutMs = opts?.timeoutMs ?? 1500
  try {
    const porFirmar = imgs.filter(img => NECESITA_CAPACIDAD(img.src))
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
