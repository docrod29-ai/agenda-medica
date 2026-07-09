import { NextRequest } from 'next/server'
import admin from '@/lib/firebase-admin'

/**
 * Proxy SAME-ORIGIN del formato de receta guardado en Firebase Storage.
 *
 * Por qué existe: el diseño del médico se sube a Storage en alta resolución
 * (sin el límite de ~1MB de un documento Firestore → sin pixelación). Pero la
 * URL de descarga de Storage es de OTRO origen (firebasestorage.googleapis.com),
 * y al generar el PDF (html2canvas) una imagen cross-origin "ensucia" el canvas
 * → el fondo sale en blanco. Sirviéndola desde ESTE origen, el navegador la trata
 * como propia y el PDF queda nítido.
 *
 * Seguridad (anti-SSRF): SOLO descarga URLs de descarga de NUESTRO bucket de
 * Firebase Storage. Cualquier otra URL → 403.
 */
export const runtime = 'nodejs'

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? ''

export async function GET(req: NextRequest) {
  // Camino nuevo: por PATH del bucket (lo suben las imágenes vía /api/config/imagen
  // con Admin SDK). Se lee con Admin SDK — no depende de reglas ni tokens.
  const path = req.nextUrl.searchParams.get('path')
  if (path) {
    // Anti-traversal: solo la carpeta permitida.
    if (!/^receta-diseno\/[^./][^:]*$/.test(path) || path.includes('..')) {
      return new Response('Ruta no permitida', { status: 403 })
    }
    try {
      const file = admin.storage().bucket(BUCKET).file(path)
      const [buf] = await file.download()
      const [meta] = await file.getMetadata().catch(() => [{ contentType: 'image/jpeg' } as { contentType?: string }])
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: { 'content-type': meta?.contentType ?? 'image/jpeg', 'cache-control': 'public, max-age=86400, immutable' },
      })
    } catch {
      return new Response('Imagen no encontrada', { status: 404 })
    }
  }

  const u = req.nextUrl.searchParams.get('u')
  if (!u) return new Response('Falta el parámetro u o path', { status: 400 })

  const esFirebaseStorage = u.startsWith('https://firebasestorage.googleapis.com/v0/b/')
  const esNuestroBucket = BUCKET ? u.includes(`/b/${BUCKET}/`) : true
  if (!esFirebaseStorage || !esNuestroBucket) {
    return new Response('Origen no permitido', { status: 403 })
  }

  try {
    const r = await fetch(u, { cache: 'no-store' })
    if (!r.ok) return new Response('Diseño no encontrado', { status: 404 })
    const contentType = r.headers.get('content-type') ?? 'image/png'
    const buf = await r.arrayBuffer()
    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': contentType,
        // El navegador lo cachea → html2canvas no re-descarga en cada hoja del PDF.
        'cache-control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return new Response('No se pudo obtener el diseño', { status: 502 })
  }
}
