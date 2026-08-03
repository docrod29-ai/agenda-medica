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

export interface PdfRenderResult {
  dataUrl: string
  widthPx: number
  heightPx: number
  /** Ancho real de la página en mm (calculado desde el viewport del PDF) */
  widthMm: number
  /** Alto real de la página en mm */
  heightMm: number
  sizeBytes: number
}

export async function pdfFileToImageDataUrl(
  file: File,
  options: PdfToImageOptions = {},
): Promise<PdfRenderResult> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('El archivo no es un PDF')
  }
  const dpi = options.dpi ?? 240          // ALTA CALIDAD (antes 150)
  const quality = options.quality ?? 0.95
  const type = options.type ?? 'image/png' // PNG por default (preserva texto y líneas, sin JPEG artifacts)
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
): Promise<PdfRenderResult> {
  opts.progress('Cargando librería PDF…')

  // Import dinámico (primera vez puede tardar varios segundos en conexiones lentas)
  const pdfjs = await import('pdfjs-dist')

  /**
   * EL WORKER SE SIRVE DESDE AQUÍ, NO DESDE UNA CDN AJENA.
   *
   * ── POR QUÉ ──────────────────────────────────────────────────────────────
   *
   * Antes se armaba una URL a `unpkg.com` con la versión ADIVINADA
   * (`pdfjs.version || '6.0.227'`). Eso hacía que subir un PDF —la firma del
   * médico, el membrete— dependiera de:
   *
   *  · que unpkg estuviera arriba y respondiera rápido;
   *  · que esa versión exacta existiera en esa ruta exacta;
   *  · que la red del consultorio no bloqueara CDNs, cosa habitual en hospitales.
   *
   * Y cuando fallaba no se veía un error claro: pdf.js se quedaba esperando al
   * worker y lo único que salía era «Tiempo agotado (60s)», que suena a «tu PDF
   * es muy pesado». El médico probaba con otro PDF más chico y volvía a fallar.
   *
   * El archivo viene DENTRO de `pdfjs-dist`, así que se copia a `public/` en cada
   * build (`npm run pdf-worker`) y se sirve del mismo origen: sin red externa,
   * sin adivinar versiones, y la versión del worker no puede desincronizarse de
   * la de la librería.
   *
   * La CDN queda como respaldo por si el archivo no estuviera desplegado.
   */
  if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
    const ver = (pdfjs as unknown as { version?: string }).version || '6.0.227'
    const local = '/pdf.worker.min.mjs'
    let servible = false
    try {
      const r = await fetch(local, { method: 'HEAD' })
      servible = r.ok
    } catch { /* sin red al propio origen: se intenta igual con el respaldo */ }
    pdfjs.GlobalWorkerOptions.workerSrc = servible
      ? local
      : `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`
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

  // Dimensiones reales del PDF en mm (sin escalar). 1pt = 1/72 inch = 25.4/72 mm
  const viewportNatural = page.getViewport({ scale: 1 })
  const widthMm = (viewportNatural.width * 25.4) / 72
  const heightMm = (viewportNatural.height * 25.4) / 72

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

  return {
    dataUrl,
    widthPx: canvas.width || Math.floor(viewport.width),
    heightPx: canvas.height || Math.floor(viewport.height),
    widthMm,
    heightMm,
    sizeBytes,
  }
}
