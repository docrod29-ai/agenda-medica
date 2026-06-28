import { NextRequest } from 'next/server'

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
  const u = req.nextUrl.searchParams.get('u')
  if (!u) return new Response('Falta el parámetro u', { status: 400 })

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
