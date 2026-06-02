'use client'
/**
 * Renderiza la PRIMERA página de un PDF a un data URL (PNG/JPEG).
 *
 * Carga pdfjs-dist dinámicamente para no inflar el bundle.
 * Útil para que el médico pueda subir su receta en formato PDF y la usemos
 * como fondo en el generador.
 */

interface PdfToImageOptions {
  /** DPI efectivo. 96 = pantalla, 150 = bueno para imprimir, 200 = alta calidad */
  dpi?: number
  /** Calidad JPEG 0..1 */
  quality?: number
  /** Tipo de salida */
  type?: 'image/jpeg' | 'image/png'
}

export async function pdfFileToImageDataUrl(
  file: File,
  options: PdfToImageOptions = {},
): Promise<{ dataUrl: string; widthPx: number; heightPx: number; sizeBytes: number }> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('El archivo no es un PDF')
  }
  const dpi = options.dpi ?? 150
  const quality = options.quality ?? 0.85
  const type = options.type ?? 'image/jpeg'

  // Cargar pdfjs dinámicamente y configurar el worker desde CDN (más sencillo en Next.js)
  const pdfjs = await import('pdfjs-dist')
  // El worker debe coincidir con la versión instalada. Usamos cdnjs como fuente confiable.
  if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  if (pdf.numPages === 0) throw new Error('El PDF está vacío')

  const page = await pdf.getPage(1)
  // El viewport default está en "user units" (72 dpi). Escalamos a dpi deseado.
  const scale = dpi / 72
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el canvas')

  // Fondo blanco para JPEG (no soporta transparencia)
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise

  const dataUrl = canvas.toDataURL(type, quality)
  const base64 = dataUrl.split(',')[1] ?? ''
  const sizeBytes = Math.ceil((base64.length * 3) / 4)

  return { dataUrl, widthPx: canvas.width, heightPx: canvas.height, sizeBytes }
}
