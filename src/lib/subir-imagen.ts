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
  const res = await fetchAutenticado('/api/config/imagen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl: valor, key }),
  })
  const data = await res.json().catch(() => null)
  if (data?.ok && data.url) return data.url as string
  throw new Error(data?.error || 'No se pudo subir la imagen a Storage')
}
