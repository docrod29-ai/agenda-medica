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
 *
 * LÍMITE CONOCIDO, ANOTADO A PROPÓSITO: este GET no lleva autenticación, y no
 * puede llevarla tal como está construido — el navegador pide estas imágenes con
 * <img src>, que NO manda la cabecera Authorization. Por eso lo que se sirve aquí
 * (membrete, firma y sello del médico, y hoy también fotos clínicas, porque
 * /api/config/imagen borra las diagonales de la key y todo acaba en esta misma
 * carpeta) queda tras una URL sin sesión. Las rutas llevan el uid de Firebase, 28
 * caracteres aleatorios, así que no son enumerables a ciegas; el riesgo real es
 * que la URL se filtre (un PDF compartido, un historial, una caché intermedia) y
 * el acceso sea entonces indefinido.
 *
 * Mientras tanto se endurece lo que sí se puede sin romper la impresión:
 * `cache-control: private` para que ninguna caché COMPARTIDA (CDN, proxy, el edge
 * de Vercel) guarde la firma del médico, y validación estricta del parámetro `u`.
 *
 * La solución de fondo es un token firmado y con caducidad en la URL, como ya se
 * hace en patient-token / receta-token. Toca el camino de impresión, así que se
 * hace aparte y con prueba en producción, no de pasada.
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
        headers: { 'content-type': meta?.contentType ?? 'image/jpeg', 'cache-control': 'private, max-age=86400, immutable' },
      })
    } catch {
      return new Response('Imagen no encontrada', { status: 404 })
    }
  }

  const u = req.nextUrl.searchParams.get('u')
  if (!u) return new Response('Falta el parámetro u o path', { status: 400 })

  /**
   * El chequeo era `u.includes('/b/' + BUCKET + '/')`, que se satisface con que la
   * cadena aparezca en CUALQUIER parte de la URL — incluida la query. Es decir,
   * `https://firebasestorage.googleapis.com/v0/b/BUCKET-AJENO/o/x?z=/b/NUESTRO/`
   * pasaba, y el servidor descargaba de un bucket ajeno. Y si la variable de
   * entorno del bucket faltaba, el `: true` aceptaba cualquiera: fallo ABIERTO.
   * Ahora se parsea la URL y se compara el segmento de ruta exacto, y sin bucket
   * configurado no se acepta nada.
   */
  if (!BUCKET) return new Response('Bucket no configurado', { status: 500 })
  let permitida = false
  try {
    const url = new URL(u)
    const segmentos = url.pathname.split('/')      // ['', 'v0', 'b', '<bucket>', 'o', …]
    permitida = url.protocol === 'https:' &&
      url.hostname === 'firebasestorage.googleapis.com' &&
      segmentos[1] === 'v0' && segmentos[2] === 'b' && segmentos[3] === BUCKET
  } catch { permitida = false }
  if (!permitida) return new Response('Origen no permitido', { status: 403 })

  try {
    const r = await fetch(u, { cache: 'no-store' })
    if (!r.ok) return new Response('Diseño no encontrado', { status: 404 })
    const contentType = r.headers.get('content-type') ?? 'image/png'
    const buf = await r.arrayBuffer()
    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': contentType,
        // `private`: lo cachea el navegador (html2canvas no re-descarga en cada
        // hoja del PDF) pero NO las cachés compartidas — ahí va la firma del médico.
        'cache-control': 'private, max-age=86400, immutable',
      },
    })
  } catch {
    return new Response('No se pudo obtener el diseño', { status: 502 })
  }
}
