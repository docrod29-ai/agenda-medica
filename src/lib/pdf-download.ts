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
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format, orientation },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    })
    .from(elemento)
    .save()
}
