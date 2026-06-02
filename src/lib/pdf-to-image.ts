'use client'
/**
 * Renderiza la PRIMERA página de un PDF a un data URL (PNG/JPEG).
 *
 * Carga pdfjs-dist dinámicamente para no inflar el bundle.
 * Acepta callback de progreso para que la UI no se vea "colgada".
 * Tiene timeout duro (60s) para que nunca quede esperando indefinidamente.
 */

interface PdfToImageOptions {
  /** DPI efectivo. 96 = pantalla, 150 = bueno para imprimir, 200 = alta calidad */
  dpi?: number
  /** Calidad JPEG 0..1 */
  quality?: number
  /** Tipo de salida */
  type?: 'image/jpeg' | 'image/png'
  /** Callback de progreso para que el usuario vea qué está pasando */
  onProgress?: (etapa: string) => void
  /** Timeout total en ms (default 60s) */
  timeoutMs?: number
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
  const timeoutMs = options.timeoutMs ?? 60_000
  const progress = options.onProgress ?? (() => {})

  // Race contra timeout — si pdfjs nunca resuelve (worker no carga, etc.),
  // no dejamos al usuario colgado esperando para siempre.
  return await Promise.race([
    procesarPdf(file, { dpi, quality, type, progress }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(
        `Tiempo agotado (${timeoutMs / 1000}s). Tu PDF puede ser muy pesado o complejo. ` +
        `Intenta exportarlo como imagen PNG/JPG desde tu visor de PDF y vuelve a subirlo.`
      )), timeoutMs)
    ),
  ])
}

async function procesarPdf(
  file: File,
  opts: { dpi: number; quality: number; type: 'image/jpeg' | 'image/png'; progress: (etapa: string) => void },
): Promise<{ dataUrl: string; widthPx: number; heightPx: number; sizeBytes: number }> {
  opts.progress('Cargando librería PDF…')

  // Import dinámico (primera vez puede tardar varios segundos en conexiones lentas)
  const pdfjs = await import('pdfjs-dist')

  // Configurar worker. Usamos unpkg con la versión exacta porque cdnjs a veces
  // tarda en publicar versiones nuevas o no tiene el .mjs.
  if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
    // pdfjs.version puede estar en distintas formas según el build; intentamos varias.
    const ver = (pdfjs as unknown as { version?: string }).version || '6.0.227'
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`
  }

  opts.progress('Leyendo archivo…')
  const arrayBuffer = await file.arrayBuffer()

  opts.progress('Abriendo PDF…')
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  if (pdf.numPages === 0) throw new Error('El PDF está vacío')

  opts.progress('Renderizando página…')
  const page = await pdf.getPage(1)
  const scale = opts.dpi / 72
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el canvas')

  if (opts.type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // pdfjs-dist v6: render acepta `{ canvasContext, viewport }`. Algunas versiones
  // toleran también `canvas`; lo pasamos opcional vía cast.
  const renderTask = page.render({ canvasContext: ctx, viewport } as Parameters<typeof page.render>[0])
  await renderTask.promise

  opts.progress('Optimizando…')
  const dataUrl = canvas.toDataURL(opts.type, opts.quality)
  const base64 = dataUrl.split(',')[1] ?? ''
  const sizeBytes = Math.ceil((base64.length * 3) / 4)

  // Liberar memoria del canvas. El PDFDocumentProxy se libera al salir del scope.
  canvas.width = 0
  canvas.height = 0

  return { dataUrl, widthPx: canvas.width || Math.floor(viewport.width), heightPx: canvas.height || Math.floor(viewport.height), sizeBytes }
}
