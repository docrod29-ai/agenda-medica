import { NextRequest } from 'next/server'
import admin from '@/lib/firebase-admin'
import { verificarPathDiseno, firmaObligatoria } from '@/lib/receta-diseno-token'

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
 * AUTENTICACIÓN (NEXUS-QUALITY-010): una <img src> no manda Authorization, así
 * que la protección es un TOKEN FIRMADO CON CADUCIDAD en la URL (exp+sig, HMAC —
 * ver lib/receta-diseno-token). Despliegue en dos pasos para no romper la
 * impresión: hoy una URL firmada se verifica SIEMPRE (inválida/vencida → 403) y
 * una sin firma sigue pasando (compatibilidad con las URLs guardadas en la config
 * de los médicos); cuando el camino de impresión acuñe URLs firmadas y la
 * papelería esté probada en vivo, se pone RECETA_DISENO_FIRMA=obligatoria en
 * Vercel y las URLs sin firma quedan cerradas. Mientras, siguen los otros
 * candados: rutas con uid (28 chars, no enumerables), `cache-control: private`
 * (ninguna caché compartida guarda la firma del médico), anti-traversal y
 * validación estricta del parámetro `u`.
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
    // NEXUS-QUALITY-010 — token firmado con caducidad (ver lib/receta-diseno-token):
    //  · exp+sig presentes → se verifican SIEMPRE (nunca se degrada a "sin firma").
    //  · ausentes → compatible mientras RECETA_DISENO_FIRMA !== 'obligatoria'
    //    (las URLs guardadas en la config de los médicos siguen imprimiendo).
    const verif = verificarPathDiseno(path, req.nextUrl.searchParams.get('exp'), req.nextUrl.searchParams.get('sig'), Date.now())
    if (verif === 'invalida' || verif === 'vencida') {
      return new Response(verif === 'vencida' ? 'Enlace vencido; vuelve a abrir la impresión' : 'Firma no válida', { status: 403 })
    }
    if (verif === 'sin_firma' && firmaObligatoria()) {
      return new Response('Este enlace requiere firma (RECETA_DISENO_FIRMA=obligatoria)', { status: 403 })
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
  // Modo estricto (010): la rama legacy `u` no puede firmarse (la firma liga un
  // path del bucket); con el candado activo se cierra por completo.
  if (firmaObligatoria()) return new Response('Este enlace requiere firma (usa ?path= firmado)', { status: 403 })

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
