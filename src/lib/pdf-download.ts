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

  const orientation = opts.anchoMm > opts.altoMm ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ unit: 'mm', format: [opts.anchoMm, opts.altoMm], orientation, compress: true })

  /**
   * Render a ESCALA 1 neutralizando el `transform` de los ANCESTROS.
   *
   * POR QUÉ: la receta/orden viven dentro de una vista previa con
   * `transform: scale(0.42)`. html2canvas, al capturar un elemento bajo un
   * ancestro escalado, MIDE MAL el ancho de las letras y las ENCIMA (el texto
   * salía ilegible — bug real que el Dr detectó en el PDF de la receta). La nota
   * no sufría esto porque se dibuja a tamaño real.
   *
   * Se pone a 'none' el transform de los ancestros ESCALADOS (el elemento REAL,
   * con sus imágenes ya cargadas — clonar colgaba html2canvas re-descargando el
   * membrete), se rasteriza, y se restaura. Un tope de tiempo evita que se quede
   * "Generando…" para siempre si html2canvas se atora.
   */
  const restaurar: Array<() => void> = []
  let n = paginas[0].parentElement
  while (n && n !== document.body) {
    const t = getComputedStyle(n).transform
    if (t && t !== 'none') {
      const el = n as HTMLElement
      const prev = el.style.transform
      el.style.transform = 'none'
      restaurar.push(() => { el.style.transform = prev })
    }
    n = n.parentElement
  }

  const conTope = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('html2canvas timeout')), ms))])

  try {
    for (let i = 0; i < paginas.length; i++) {
      const canvas = await conTope(html2canvas(paginas[i], {
        scale: 3,                    // nitidez de texto e imagen
        useCORS: true,
        backgroundColor: '#ffffff',
        imageTimeout: 12000,         // espera al membrete/firma (no 30s: colgaba)
        logging: false,
      }), 25000)
      const img = canvas.toDataURL('image/jpeg', 0.95)
      if (i > 0) pdf.addPage([opts.anchoMm, opts.altoMm], orientation)
      // A sangre: la hoja ya trae su propio margen/membrete; el PDF no añade ninguno.
      pdf.addImage(img, 'JPEG', 0, 0, opts.anchoMm, opts.altoMm, undefined, 'FAST')
    }
  } finally {
    restaurar.forEach(f => f())
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
