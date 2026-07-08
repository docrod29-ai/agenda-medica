'use client'
/**
 * Imprime SOLO un elemento (el documento) en una ventana limpia.
 *
 * Por qué: llamar window.print() sobre la app completa obliga al navegador a
 * preparar la vista de impresión de TODA la SPA (layout + rasterizado de todo el
 * DOM, estilos y la imagen de membrete en alta resolución) → el diálogo tarda
 * mucho en aparecer. Abriendo una ventana mínima que contiene únicamente el
 * documento, el navegador rasteriza casi nada y el diálogo aparece de inmediato.
 *
 * Copia los <style>/<link> del documento para que respete tanto los estilos en
 * línea como las clases. Si el navegador bloquea la ventana emergente, cae al
 * window.print() de siempre (no se rompe nada).
 */
export function imprimirElemento(el: HTMLElement | null, titulo = 'Documento'): void {
  if (typeof window === 'undefined') return
  if (!el) { window.print(); return }

  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) { window.print(); return } // ventana emergente bloqueada → respaldo

  const estilos = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(n => n.outerHTML)
    .join('\n')

  win.document.open()
  win.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>` +
    estilos +
    `<style>@page{margin:0} html,body{margin:0;padding:0;background:#fff}</style>` +
    `</head><body>${el.outerHTML}</body></html>`,
  )
  win.document.close()

  let yaImprimio = false
  const imprimir = () => {
    if (yaImprimio) return
    yaImprimio = true
    try { win.focus(); win.print() } catch { /* */ }
  }
  win.onafterprint = () => { try { win.close() } catch { /* */ } }

  // Espera a que carguen las imágenes (membrete/firma) antes de imprimir.
  const imgs = Array.from(win.document.images)
  if (imgs.length === 0) {
    setTimeout(imprimir, 120)
  } else {
    let pendientes = imgs.length
    const listo = () => { if (--pendientes <= 0) imprimir() }
    imgs.forEach(img => {
      if (img.complete) listo()
      else { img.addEventListener('load', listo); img.addEventListener('error', listo) }
    })
    setTimeout(imprimir, 2500) // respaldo si una imagen se atora
  }
}
