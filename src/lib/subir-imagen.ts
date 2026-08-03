import { fetchAutenticado } from '@/lib/auth-client'

/**
 * Sube una imagen (data URL base64) a Firebase Storage a través del SERVIDOR
 * (/api/config/imagen, Admin SDK) y devuelve una URL proxeada same-origin.
 *
 * Por qué por el servidor: la subida desde el navegador (uploadBytes +
 * getDownloadURL) dependía de reglas/CORS y fallaba en silencio → las imágenes
 * caían a base64 e inflaban el documento de config (tope 1MB de Firestore). El
 * Admin SDK no depende de reglas ni CORS.
 *
 * - Si `valor` ya es una URL (no data:), lo devuelve igual.
 * - Si falla, LANZA (para que el guardado muestre la causa real, no un 1MB mudo).
 */
export async function subirImagen(valor: string | undefined, key: string): Promise<string | undefined> {
  if (!valor || !valor.startsWith('data:')) return valor

  /**
   * ÚLTIMA RED: si algo llega demasiado grande, se dice ANTES de mandarlo.
   *
   * El cuerpo de la petición viaja por una función serverless con un tope duro
   * de ~4.5 MB, y base64 infla el binario un 33 %. Por encima de eso la petición
   * NO LLEGA, y lo que se veía era una subida que «no hacía nada» — sin error,
   * sin causa, sin nada que probar.
   *
   * Quien llama ya debería haber reducido la imagen (`reducirDataUrlSiPesa`);
   * esto es para que, si alguien añade un camino nuevo y se le olvida, el fallo
   * salga con su nombre en vez de en silencio.
   */
  const bytes = Math.ceil((((valor.split(',')[1] ?? '').length) * 3) / 4)
  if (bytes > 3_500_000) {
    throw new Error(
      `La imagen pesa ${Math.round(bytes / 1_000_000)} MB y el límite de subida es ~3.5 MB. ` +
      'Si viene de un PDF, exporta sólo la zona de la firma o súbela como PNG recortado.',
    )
  }
  const res = await fetchAutenticado('/api/config/imagen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl: valor, key }),
  })
  const data = await res.json().catch(() => null)
  if (data?.ok && data.url) return data.url as string
  throw new Error(data?.error || 'No se pudo subir la imagen a Storage')
}
