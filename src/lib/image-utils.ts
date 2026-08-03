'use client'

/**
 * Utilidades para redimensionar imágenes en el cliente antes de subirlas.
 *
 * Las imágenes de membretes se guardan en Firestore como data URLs base64 dentro
 * del documento config/main. Firestore limita docs a 1 MB total, así que
 * reducimos a un ancho máximo razonable y comprimimos a JPEG calidad ~85%.
 */

export interface ImageResizeOptions {
  maxWidth?: number   // ancho máximo en px
  maxHeight?: number  // alto máximo en px
  quality?: number    // 0..1 para JPEG
  type?: 'image/jpeg' | 'image/png' | 'image/webp'
}

const DEFAULTS: Required<ImageResizeOptions> = {
  maxWidth: 1400,
  maxHeight: 800,
  quality: 0.85,
  type: 'image/jpeg',
}

/**
 * Lee un File (de un <input type="file">) y devuelve un data URL redimensionado.
 * Si la imagen ya es más chica, no la agranda.
 */
export async function resizeImageFile(
  file: File,
  options: ImageResizeOptions = {},
): Promise<{ dataUrl: string; width: number; height: number; sizeBytes: number }> {
  const opts = { ...DEFAULTS, ...options }
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen')
  }
  const dataUrlOriginal = await fileToDataUrl(file)
  const img = await loadImage(dataUrlOriginal)

  // Calcular nuevas dimensiones manteniendo aspecto
  let w = img.naturalWidth
  let h = img.naturalHeight
  const ratio = Math.min(opts.maxWidth / w, opts.maxHeight / h, 1)
  w = Math.round(w * ratio)
  h = Math.round(h * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el canvas para redimensionar')

  // Fondo blanco si el destino es JPEG (no soporta transparencia)
  if (opts.type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }

  ctx.drawImage(img, 0, 0, w, h)
  const dataUrl = canvas.toDataURL(opts.type, opts.quality)
  // Tamaño aproximado del data URL (sin el prefijo "data:...;base64,")
  const base64 = dataUrl.split(',')[1] ?? ''
  const sizeBytes = Math.ceil((base64.length * 3) / 4)

  return { dataUrl, width: w, height: h, sizeBytes }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

/** Helper humano: convierte bytes a un string legible (e.g., "245 KB") */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * EL TOPE QUE FALTABA: el cuerpo de la petición, no el disco.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * Al subir la firma o el membrete **en PDF**, la página se rasterizaba a 220-300
 * DPI y se mandaba TAL CUAL. La reducción de tamaño estaba condicionada a que NO
 * hubiera Storage, con este razonamiento escrito: «con Storage el peso no
 * importa».
 *
 * **Sí importa.** La imagen no viaja directo a Storage: va en base64 dentro de un
 * JSON, por una función serverless que tiene un tope duro de request de ~4.5 MB.
 * Una hoja carta a 300 DPI en PNG pesa varios MB, y base64 la infla otro 33 %.
 * O sea que la petición **moría antes de llegar al servidor**, sin un error que
 * explicara nada: el médico veía que «no se subía» y no había a qué agarrarse.
 *
 * Este helper reduce el data URL hasta que quepa, redibujándolo en un canvas. Se
 * usa ANTES de subir, en todos los caminos que rasterizan un PDF.
 *
 * @param maxBytes tope del binario. Por defecto 3 MB: deja margen para el 33 %
 *   de base64 y para el resto del JSON dentro del límite de la función.
 */
export async function reducirDataUrlSiPesa(
  dataUrl: string,
  maxBytes = 3_000_000,
  tipo: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<{ dataUrl: string; sizeBytes: number; seRedujo: boolean }> {
  const pesa = (u: string) => Math.ceil(((u.split(',')[1] ?? '').length * 3) / 4)
  let size = pesa(dataUrl)
  if (!dataUrl.startsWith('data:') || size <= maxBytes) {
    return { dataUrl, sizeBytes: size, seRedujo: false }
  }

  const img = await loadImage(dataUrl)
  let escala = 1
  let salida = dataUrl

  // Se baja de escala hasta caber. Seis intentos llegan a ~1/8 del original, que
  // es más que suficiente para pasar de una hoja a 300 DPI a algo servible.
  for (let i = 0; i < 6 && size > maxBytes; i++) {
    escala *= 0.75
    const w = Math.max(1, Math.round(img.naturalWidth * escala))
    const h = Math.max(1, Math.round(img.naturalHeight * escala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) break
    if (tipo === 'image/jpeg') {
      // JPEG no tiene transparencia: sin esto el fondo sale negro.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(img, 0, 0, w, h)
    salida = canvas.toDataURL(tipo, 0.92)
    size = pesa(salida)
  }

  return { dataUrl: salida, sizeBytes: size, seRedujo: true }
}
