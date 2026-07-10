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

/**
 * Guarda un parche de config DESDE EL SERVIDOR (Admin SDK) COMPACTANDO el
 * documento (saca a Storage cualquier base64 pesado que lo esté inflando). Úsalo
 * para guardados que fallaban con el tope de 1 MB (hoja membretada, receta,
 * firma). Devuelve cuántas imágenes se migraron. LANZA con la causa real si falla.
 */
export async function guardarConfigCompactando(
  clinicId: string,
  patch: Record<string, unknown>,
): Promise<{ migradas: number }> {
  const res = await fetchAutenticado('/api/config/guardar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, patch }),
  })
  const data = await res.json().catch(() => null)
  if (data?.ok) return { migradas: Number(data.migradas ?? 0) }
  throw new Error(data?.error || 'No se pudo guardar la configuración')
}
