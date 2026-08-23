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
/**
 * opts.formato:
 *   · 'sangre' (default) → hoja sin márgenes; para RECETAS con membrete propio.
 *   · 'carta'            → hoja tamaño carta con márgenes bien definidos (~16 mm);
 *                          para DOCUMENTOS de texto (notas, cartas de referencia).
 */
// Marca de la última impresión disparada (anti-rebote de doble clic).
let ultimaImpresion = 0

export function imprimirElemento(
  el: HTMLElement | null,
  titulo = 'Documento',
  opts?: {
    formato?: 'sangre' | 'carta' | 'membrete'; anchoMm?: number; altoMm?: number
    /** Zona segura del membrete (mm) que debe respetarse en TODAS las hojas. */
    margenesMembrete?: { top: number; right: number; bottom: number; left: number }
    /**
     * Margen de PÁGINA (mm) en modo 'sangre'. Default 0 (recetas a sangre).
     * La NOTA membretada lo usa (~6 mm) para que la hoja quede DENTRO del área
     * imprimible física de cualquier impresora → el membrete "no se sale" ni
     * empuja hojas en blanco (el Dr: "el logo solo quede en una hoja carta que
     * no se salga"). El contenido de #doc ya viene dimensionado a ese neto.
     */
    margenMm?: number
    /**
     * Solo RECETA y ORDEN MÉDICA. Fija html/body al tamaño exacto de la hoja y
     * fuerza la impresión de fondos/colores, para que el papel salga a su medida
     * real al 100 % (ver el bloque de CSS más abajo).
     *
     * Es opt-in a propósito: las NOTAS (evolución, ingreso, egreso) comparten
     * este mismo modo 'sangre' con su membrete carta, y su paginación está
     * calibrada. No se toca lo que ya imprime bien.
     */
    hojaExacta?: boolean
    /**
     * Aviso de error (popup bloqueado / documento no encontrado). Si se pasa, se
     * usa en vez del window.alert nativo — así la app lo muestra con su sistema de
     * toasts. La decisión de NO imprimir basura se mantiene; solo cambia el canal.
     */
    onError?: (mensaje: string) => void
  },
): void {
  if (typeof window === 'undefined') return

  // Auditoría papelería 2026-07 (P3): anti-rebote. Un doble clic (o el toque doble
  // habitual en tablet) abría DOS ventanas de impresión y disparaba dos diálogos.
  // Un candado de módulo con ventana corta ignora la segunda llamada.
  const ahora = performance.now()
  if (ahora - ultimaImpresion < 1200) return
  ultimaImpresion = ahora

  /**
   * EL RESPALDO `window.print()` IMPRIMÍA BASURA.
   *
   * Cuando la ventana emergente está bloqueada —o no se encuentra el elemento— se
   * caía a imprimir la página actual. Pero el documento vive dentro de la vista
   * previa, que le aplica `transform: scale(0.42)` y `overflow: hidden`: la receta
   * salía al ~40 % del tamaño, pegada a una esquina y recortada. Y el médico ya
   * había pulsado Imprimir, así que el papel salía igual.
   *
   * Es mejor decirle que desbloquee las ventanas emergentes que entregarle una
   * receta ilegible al paciente.
   */
  const avisar = (motivo: string) => {
    const msg = `No se pudo abrir la ventana de impresión (${motivo}). Permite las ventanas emergentes de este sitio y vuelve a intentarlo, o usa "Descargar PDF". No se imprimió nada.`
    if (opts?.onError) { opts.onError(msg); return }
    // eslint-disable-next-line no-alert
    window.alert(msg)
  }
  if (!el) { avisar('no se encontró el documento'); return }

  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) { avisar('el navegador la bloqueó'); return }

  // Copiamos SOLO las hojas de estilo globales (<link>), NO los <style> de página:
  // esas páginas inyectan su propio "@media print { #doc{…}; @page{margin} }" del
  // método de impresión anterior, que peleaba con los márgenes de aquí. Como los
  // documentos usan estilos EN LÍNEA, con los <link> globales basta.
  const estilos = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(n => n.outerHTML)
    .join('\n')

  // Selector del documento para neutralizar su padding/centrado en modo carta
  // (los márgenes los pone @page, no el elemento).
  const sel = el.id ? `#${el.id}` : 'body > *'
  // Modo 'sangre' (receta): si nos pasan el tamaño físico de la receta, fijamos la
  // HOJA a ese tamaño exacto → la receta cae 1:1, centrada y sin partirse por no
  // coincidir con el papel del diálogo (A5/carta/etc.).
  const tamano = (opts?.anchoMm && opts?.altoMm) ? `${opts.anchoMm}mm ${opts.altoMm}mm` : 'auto'
  // Medidas de la hoja para dimensionar también html/body (ver comentario abajo).
  // Solo con hojaExacta: receta y orden. Las notas conservan su comportamiento.
  const hoja = (opts?.hojaExacta && opts?.anchoMm && opts?.altoMm) ? { w: opts.anchoMm, h: opts.altoMm } : null
  // Zona segura del membrete (mm): el texto NO debe entrar aquí en NINGUNA hoja.
  const mm = opts?.margenesMembrete ?? { top: 42, right: 22, bottom: 28, left: 22 }
  const pageCss = opts?.formato === 'membrete'
    /**
     * Hoja membretada MULTIPÁGINA. El membrete de fondo (position:fixed) ya se
     * repetía bien en cada hoja, PERO el texto solo respetaba el margen superior
     * en la hoja 1 (era padding del #doc): en la hoja 2+ arrancaba pegado arriba y
     * se ENCIMABA con el encabezado membretado repetido.
     *
     * Solución robusta y sin re-paginar (cero riesgo de perder texto): el
     * contenido se envuelve en una tabla con `thead`/`tfoot` espaciadores. Los
     * navegadores REPITEN thead/tfoot en cada página impresa, así que reservan la
     * banda superior e inferior del membrete en TODAS las hojas, no solo en la 1ª.
     * El padding del #doc se anula (lo sustituye la tabla). La página va a sangre
     * (margin:0) para que el membrete de fondo cubra la hoja completa.
     */
    ? `@page{size:letter;margin:0}
       html,body{margin:0;padding:0;background:#fff}
       ${sel}{max-width:none!important;width:auto!important;margin:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important;aspect-ratio:auto!important}
       .membrete-bg{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;z-index:-1!important}
       .print-frame{width:100%;border-collapse:collapse}
       .print-frame > tbody > tr > td{padding:0 ${mm.right}mm 0 ${mm.left}mm}
       .print-frame .espaciador-top{height:${mm.top}mm}
       .print-frame .espaciador-bottom{height:${mm.bottom}mm}`
    : opts?.formato === 'carta'
    ? `@page{size:letter;margin:18mm}
       html,body{margin:0;padding:0;background:#fff}
       ${sel}{max-width:none!important;width:auto!important;margin:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important}`
    /**
     * Modo "a sangre" (receta / orden médica): la hoja ES el documento.
     *
     * `@page{size:<ancho>mm <alto>mm; margin:0}` fija el tamaño de página al del
     * papel real. Se añade el mismo tamaño a html/body porque, sin él, el cuerpo
     * conserva el ancho por defecto del navegador y el diálogo del sistema puede
     * mostrar (e imprimir) una hoja de otro tamaño con el documento pequeño
     * dentro — el defecto clásico de "sale chiquita en una hoja vertical". Con
     * los tres alineados, la vista previa sale LLENA y al 100 %, sin escalar.
     * La altura va como `min-height`, NO fija: una receta con muchos fármacos
     * pagina en varias hojas, y una altura dura recortaría de la segunda en
     * adelante.
     *
     * `print-color-adjust:exact` obliga al navegador a imprimir fondos y colores
     * (el membrete es una imagen de fondo: sin esto puede salir en blanco).
     */
    : `@page{size:${tamano};margin:0}
       html,body{margin:0;padding:0;background:#fff${hoja ? `;width:${hoja.w}mm;min-height:${hoja.h}mm` : ''}}
       ${hoja ? `*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}` : ''}
       ${sel}{margin:0 auto!important;box-shadow:none!important;border-radius:0!important}`

  // En membrete el contenido se envuelve en la tabla espaciadora (thead/tfoot que
  // se repiten por página y reservan la banda del membrete en TODAS las hojas).
  const cuerpo = opts?.formato === 'membrete'
    ? `<table class="print-frame">`
      + `<thead><tr><td><div class="espaciador-top"></div></td></tr></thead>`
      + `<tfoot><tr><td><div class="espaciador-bottom"></div></td></tr></tfoot>`
      + `<tbody><tr><td>${el.outerHTML}</td></tr></tbody>`
      + `</table>`
    : el.outerHTML

  win.document.open()
  win.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">` +
    // Base de URL: la ventana de impresión se abre en blanco; sin esto las rutas
    // RELATIVAS (el membrete servido como /api/receta/diseno, el CSS de _next) no
    // cargarían → no se vería el membrete. Con la base, resuelven al mismo origen.
    `<base href="${location.origin}/">` +
    `<title>${titulo}</title>` +
    estilos +
    // Auditoría papelería 2026-07 (P2): en el popup, los <link> globales copian el
    // CSS, pero .no-print vive en un @media print del bundle que no siempre aplica
    // al documento clonado → los avisos marcados no-print (aclaraciones, banners)
    // podían salir impresos. Se fuerza la regla aquí para las tres variantes.
    `<style>.no-print{display:none!important}${pageCss}</style>` +
    `</head><body>${cuerpo}</body></html>`,
  )
  win.document.close()

  let yaImprimio = false
  const imprimir = () => {
    if (yaImprimio) return
    yaImprimio = true
    try { win.focus(); win.print() } catch { /* */ }
  }
  win.onafterprint = () => { try { win.close() } catch { /* */ } }

  const esperarImagenesEImprimir = () => {
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
      setTimeout(imprimir, 8000) // respaldo si una imagen se atora
    }
  }

  // R-06 / #350 — CAPACIDAD LIGADA, A PRUEBA DE FALLOS: antes de esperar la
  // carga, se cambian las <img> del membrete/firma a su versión con capacidad
  // acuñada (helper compartido con el camino de PDF), incluidas las que traen una
  // capacidad por vencer. Si algo falla o tarda, se imprime con las URLs que
  // hubiera: el acuñado nunca puede romper el resto de la receta.
  void import('@/lib/receta-diseno-client')
    .then(m => m.firmarImagenesDiseno(Array.from(win.document.images), { esperarRecargaMs: 0 }))
    .catch(() => 0)
    .finally(esperarImagenesEImprimir)
}
