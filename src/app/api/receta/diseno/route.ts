import { NextRequest } from 'next/server'
import admin from '@/lib/firebase-admin'
import {
  PATH_DISENO_OK,
  compatibilidadSinCapacidad,
  verificarCapacidadDiseno,
  type VerificacionDiseno,
} from '@/lib/receta-diseno-token'

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
 * Seguridad (anti-SSRF): SOLO descarga objetos de NUESTRO bucket, y sólo de la
 * carpeta `receta-diseno/`.
 *
 * AUTORIZACIÓN (R-06 / #350): esta ruta descarga con **Admin SDK**, que ignora
 * las reglas de Storage. Antes bastaba el `?path=` para llegar hasta ahí — y un
 * path NO es una autorización. Ahora se exige una CAPACIDAD FIRMADA Y LIGADA a
 * `version + path + ownerUid + clinicId + exp` (ver lib/receta-diseno-token),
 * que sólo acuña la aplicación autenticada en POST /api/receta/diseno-url tras
 * verificar membresía canónica del consultorio. Tocar cualquier campo rompe el
 * HMAC y falla CERRADO; la capacidad caduca en minutos.
 *
 * Una `<img src>` no manda `Authorization`, así que la ligadura viaja en la URL.
 * Eso NO debilita la descarga: la URL sólo existe porque una petición
 * AUTENTICADA la pidió, sólo sirve para ese objeto, ese dueño y ese
 * consultorio, y muere pronto. Se conserva `cache-control: private` para que
 * ninguna caché compartida guarde la firma del médico.
 *
 * Compatibilidad: las URLs sin capacidad guardadas en la configuración de los
 * médicos sólo pasan bajo `RECETA_DISENO_COMPAT_SIN_FIRMA=1`, que está muerto
 * en cualquier entorno equivalente a producción. Por defecto: 403.
 */
export const runtime = 'nodejs'

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? ''

/** Motivo legible del rechazo. Nunca revela el secreto ni el valor esperado. */
function motivo(v: VerificacionDiseno): string {
  switch (v) {
    case 'vencida': return 'Enlace vencido; vuelve a abrir la impresión'
    case 'sin_capacidad': return 'Este enlace requiere una capacidad firmada (ábrelo desde la aplicación)'
    case 'sin_secreto': return 'Capacidad no verificable en este servidor'
    case 'version_desconocida': return 'Formato de capacidad no soportado'
    case 'dueno_no_coincide': return 'La capacidad no corresponde al dueño de esta imagen'
    default: return 'Capacidad no válida'
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const path = sp.get('path')
  if (path) {
    // Anti-traversal: sólo la carpeta permitida.
    if (!PATH_DISENO_OK.test(path) || path.includes('..')) {
      return new Response('Ruta no permitida', { status: 403 })
    }
    const verif = verificarCapacidadDiseno(
      path,
      { v: sp.get('v'), own: sp.get('own'), cid: sp.get('cid'), exp: sp.get('exp'), sig: sp.get('sig') },
      Date.now(),
    )
    // Sólo 'valida' autoriza. 'sin_capacidad' pasa únicamente bajo la
    // compatibilidad explícita y acotada; el resto (firma rota, vencida,
    // versión vieja, dueño cruzado, secreto ausente) es 403 SIEMPRE — nunca se
    // degrada a "sin capacidad" para volver a caer en el camino permisivo.
    if (verif !== 'valida' && !(verif === 'sin_capacidad' && compatibilidadSinCapacidad())) {
      return new Response(motivo(verif), { status: 403 })
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

  const u = sp.get('u')
  if (!u) return new Response('Falta el parámetro u o path', { status: 400 })
  /**
   * Rama LEGADA `?u=`: una URL de descarga completa guardada en configuraciones
   * viejas. No puede ligarse a dueño ni a consultorio (la capacidad liga un path
   * del bucket), así que queda cerrada salvo bajo la misma compatibilidad
   * acotada — y por tanto cerrada del todo en producción. El cliente reescribe
   * al vuelo estas URLs a la forma `?path=` cuando el objeto vive en
   * `receta-diseno/` (ver lib/receta-diseno-client), que sí es acuñable.
   */
  if (!compatibilidadSinCapacidad()) {
    return new Response('Este enlace requiere una capacidad firmada (usa ?path= acuñado)', { status: 403 })
  }

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
