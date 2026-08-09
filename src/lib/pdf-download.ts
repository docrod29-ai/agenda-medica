'use client'
/**
 * Descarga directa de PDF (sin pasar por el diálogo de impresión).
 *
 * Usa html2pdf.js (carga dinámica para no inflar el bundle).
 * Funciona en desktop y móvil: en iOS Safari descarga al "Files".
 */

interface PdfOptions {
  filename: string
  margin?: number          // mm
  /** 'a4' | 'letter' | 'a5' | tupla [width, height] en mm para tamaños custom (media carta, oficio, etc.) */
  format?: 'a4' | 'letter' | 'a5' | [number, number]
  orientation?: 'portrait' | 'landscape'
}

/**
 * PDF LIMPIO hoja-por-hoja (nota membretada, receta/orden con diseño).
 *
 * POR QUÉ existe (quejas del Dr, 2026-07-25):
 *  - Enrutar el PDF por el diálogo de impresión (v618) metía el ENCABEZADO del
 *    navegador ("about:blank" + la fecha) dentro del PDF → inaceptable.
 *  - html2pdf.js rebana un lienzo alto en páginas por altura: con márgenes o
 *    sub-píxeles metía HOJAS EN BLANCO y a veces perdía el membrete.
 *
 * CÓMO: se rasteriza CADA hoja por separado (html2canvas) y cada lienzo se pone
 * como UNA página del PDF a sangre (0,0 → ancho×alto completos). Resultado:
 *  · nº de páginas EXACTO (una hoja = una página, cero blancos),
 *  · membrete y firma incluidos (se captura el DOM tal cual se ve),
 *  · SIN encabezados/pies del navegador (jsPDF directo, no hay diálogo).
 *
 * `paginas` son los elementos de cada hoja (p. ej. los `.nota-sheet`, o el host
 * de la receta). `anchoMm`/`altoMm` = tamaño físico de cada página.
 */
export async function descargarPaginasComoPDF(
  paginas: HTMLElement[],
  opts: { filename: string; anchoMm: number; altoMm: number },
): Promise<void> {
  if (typeof window === 'undefined') throw new Error('PDF solo en cliente')
  if (!paginas.length) throw new Error('Sin páginas para el PDF')

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  // NEXUS-QUALITY-010 fase 2: el PDF rasteriza el DOM tal cual, así que las <img>
  // del membrete/firma se cambian a su versión FIRMADA antes de capturar (y se
  // espera su recarga). A prueba de fallos: si el endpoint falla o tarda, se
  // rasterizan las URLs originales exactamente como antes.
  try {
    const { firmarImagenesDiseno } = await import('@/lib/receta-diseno-client')
    await firmarImagenesDiseno(paginas.flatMap(p => Array.from(p.querySelectorAll('img'))))
  } catch { /* sin firma: el PDF sale igual que siempre */ }

  const orientation = opts.anchoMm > opts.altoMm ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ unit: 'mm', format: [opts.anchoMm, opts.altoMm], orientation, compress: true })

  const conTope = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('html2canvas timeout')), ms))])

  /**
   * TEMA CLARO FORZADO durante el render.
   *
   * POR QUÉ: los documentos usan `var(--text)` etc. En MODO OSCURO `--text` es
   * crema claro (#F2EFE9) → el texto salía DESVAÍDO sobre el PDF blanco (el Dr:
   * "porque salen las letras así"). Un documento impreso debe llevar texto oscuro
   * SIEMPRE. Se fuerza `data-theme="light"` en <html> durante el render (todas las
   * variables resuelven a claro) y se restaura al terminar.
   */
  const raiz = document.documentElement
  const temaPrevio = raiz.getAttribute('data-theme')
  raiz.setAttribute('data-theme', 'light')

  /**
   * LO QUE NO SE IMPRIME TAMPOCO SE DESCARGA.
   *
   * `.no-print` marca los avisos que son para el médico en pantalla y no para
   * el documento: banners, aclaraciones, el recuadro de cobertura del sello.
   * Pero la regla que los oculta vive dentro de un `@media print`, y esto **no
   * es una impresión**: html2canvas rasteriza el DOM tal como está en pantalla
   * y `@media print` nunca se activa.
   *
   * Resultado, hasta hoy: al pulsar Imprimir el aviso desaparecía, y al
   * descargar el PDF del MISMO documento salía impreso — un recuadro negro con
   * jerga interna («metadata.hashIntegridad») en medio de una nota clínica que
   * se entrega o se archiva. El médico lo vio y preguntó si tenía que salir a
   * fuerzas. No: es que este camino nunca miró la marca.
   *
   * Se ocultan aquí y se restauran en el `finally`, con la misma disciplina que
   * el tema claro de arriba: el DOM real se toca y se devuelve como estaba.
   */
  const ocultados: { el: HTMLElement; display: string }[] = []
  for (const pagina of paginas) {
    const marcados = [
      ...(pagina.matches('.no-print') ? [pagina] : []),
      ...Array.from(pagina.querySelectorAll<HTMLElement>('.no-print')),
    ]
    for (const el of marcados) {
      ocultados.push({ el, display: el.style.display })
      el.style.display = 'none'
    }
  }

  /**
   * Host fuera de pantalla SOLO para hojas dentro de un preview ESCALADO
   * (receta/orden con `transform: scale`). html2canvas mide mal las letras bajo
   * un ancestro escalado y las ENCIMA; se mueve el nodo REAL (imágenes ya
   * cargadas — clonar colgaba) a un host sin transform, se rasteriza a escala 1 y
   * se devuelve a su lugar con un marcador. La NOTA no está escalada → se
   * rasteriza EN SU SITIO (moverla cambiaba su contexto de estilo).
   */
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;margin:0;padding:0;background:#fff;transform:none;z-index:-1'
  document.body.appendChild(host)

  const tieneAncestroEscalado = (el: HTMLElement): boolean => {
    let n: HTMLElement | null = el.parentElement
    while (n && n !== document.body) {
      const t = getComputedStyle(n).transform
      if (t && t !== 'none') return true
      n = n.parentElement
    }
    return false
  }

  try {
    for (let i = 0; i < paginas.length; i++) {
      const page = paginas[i]
      const escalado = tieneAncestroEscalado(page)
      // Marcador para devolver el nodo a su POSICIÓN EXACTA (sin él, React perdería
      // el lugar y podría duplicar/borrar la hoja al re-renderizar).
      const marcador = document.createComment('pdf-page-placeholder')
      const padre = page.parentNode as Node
      const prevTransform = page.style.transform
      const prevMargin = page.style.margin
      if (escalado) {
        padre.replaceChild(marcador, page)
        page.style.transform = 'none'
        page.style.margin = '0'
        host.appendChild(page)
      }
      try {
        const canvas = await conTope(html2canvas(page, {
          scale: 3,                    // nitidez de texto e imagen
          useCORS: true,
          backgroundColor: '#ffffff',
          imageTimeout: 12000,         // espera al membrete/firma (no 30s: colgaba)
          logging: false,
        }), 25000)
        const img = canvas.toDataURL('image/jpeg', 0.95)
        if (i > 0) pdf.addPage([opts.anchoMm, opts.altoMm], orientation)
        // A sangre: la hoja ya trae su margen/membrete; el PDF no añade ninguno.
        pdf.addImage(img, 'JPEG', 0, 0, opts.anchoMm, opts.altoMm, undefined, 'FAST')
      } finally {
        // Devolver el nodo movido a su lugar SIEMPRE (aunque html2canvas falle).
        if (escalado) {
          page.style.transform = prevTransform
          page.style.margin = prevMargin
          marcador.parentNode?.replaceChild(page, marcador)
        }
      }
    }
  } finally {
    document.body.removeChild(host)
    // Devolver a la vista lo que sólo se ocultó para rasterizar.
    for (const { el, display } of ocultados) el.style.display = display
    // Restaurar el tema original de la app.
    if (temaPrevio === null) raiz.removeAttribute('data-theme')
    else raiz.setAttribute('data-theme', temaPrevio)
  }

  const filename = opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`
  pdf.save(filename)
}

export async function descargarComoPDF(elemento: HTMLElement, opts: PdfOptions): Promise<void> {
  if (typeof window === 'undefined') throw new Error('PDF solo en cliente')

  // html2pdf.js es CJS — lo cargamos dinámicamente
  const mod = await import('html2pdf.js')
  const html2pdf = (mod.default ?? mod) as unknown as () => {
    set: (o: Record<string, unknown>) => ReturnType<typeof html2pdf>
    from: (el: HTMLElement) => ReturnType<typeof html2pdf>
    save: () => Promise<void>
  }

  const filename = opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`
  const margin = opts.margin ?? 12 // mm
  const format = opts.format ?? 'letter'
  const orientation = opts.orientation ?? 'portrait'

  await html2pdf()
    .set({
      margin,
      filename,
      // Calidad máxima — JPEG q98, scale 3x para capturar texto y líneas con nitidez
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 3,                  // antes 2 — más nitidez en texto e imágenes
        useCORS: true,
        backgroundColor: '#ffffff',
        letterRendering: true,     // mejora kerning del texto
        imageTimeout: 30000,       // espera hasta 30s a que carguen imágenes (membrete, firma)
        /**
         * Lo mismo que en `descargarPaginasComoPDF`, por el otro camino.
         *
         * Aquí sí hay un clon del documento, así que basta con ocultar en él lo
         * marcado `.no-print`. La regla real vive en un `@media print` que este
         * camino nunca activa — no es una impresión, es una rasterización.
         */
        onclone: (doc: Document) => {
          doc.querySelectorAll<HTMLElement>('.no-print').forEach(el => { el.style.display = 'none' })
        },
      },
      jsPDF: {
        unit: 'mm', format, orientation,
        compress: true,            // comprime el PDF resultante (menor tamaño sin perder calidad visible)
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    })
    .from(elemento)
    .save()
}
