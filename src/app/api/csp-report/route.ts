/**
 * Buzón de reportes de la CSP (política de seguridad de contenido).
 *
 * La política va en modo AVISO (`Content-Security-Policy-Report-Only`, ver
 * `next.config.ts`): no bloquea nada, sólo avisa aquí cada vez que algo se
 * saldría de ella. Pasar a bloquear de verdad sin ese dato es lo que rompe
 * pantallas legítimas de golpe.
 *
 * ── LO QUE CAMBIÓ, Y POR QUÉ NO ERA UN DETALLE ───────────────────────────────
 *
 * Antes esto escribía una línea en el log del servidor y ya está. Nadie lee ese
 * log y además caduca, así que la «semana de observación» no podía terminar — ni
 * empezar: una semana después no habría nada que mirar. La CSP se quedaba en
 * modo aviso para siempre, que es la seguridad de la que todo el mundo habla y
 * nadie enciende.
 *
 * Ahora se ACUMULA, agrupado por directiva + recurso + día, con un contador. Mil
 * violaciones iguales son un renglón que dice «mil veces», no mil renglones.
 *
 * ── ESTE BUZÓN ES PÚBLICO ────────────────────────────────────────────────────
 *
 * Lo llama el navegador sin autenticación: tiene que ser así. Las defensas
 * —agrupar, descartar lo ajeno, recortar, tope por petición— viven en
 * `csp-observacion.ts`, que es puro y está probado. Aquí sólo se escribe.
 *
 * PRIVACIDAD: nunca se guarda una dirección completa. En esta aplicación la URL
 * de la página ES un dato sensible (el portal del paciente lleva su token en la
 * ruta, el expediente lleva el id del paciente), así que se recorta a origen +
 * primer segmento antes de tocar nada.
 */
import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { gruposDeReporte, idDocumento } from '@/lib/security/csp-observacion'

export const runtime = 'nodejs'

/** Dónde se acumula. Sin PHI: sólo directivas, orígenes y contadores. */
export const COLECCION_CSP = 'platform_csp'

/**
 * Los orígenes de esta aplicación, para descartar los reportes ajenos.
 *
 * `VERCEL_URL` no trae el esquema; `NEXT_PUBLIC_APP_URL` sí cuando está puesta.
 * Si no hay ninguna la lista queda vacía y NO se filtra: perder la observación
 * entera por una variable sin configurar sería peor que aceptar algo de ruido.
 */
function origenesPropios(): string[] {
  const l: string[] = []
  const publica = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (publica) l.push(publica.replace(/\/+$/, ''))
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) l.push(`https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`)
  return l
}

export async function POST(req: NextRequest) {
  try {
    const cuerpo = await req.json().catch(() => null)
    if (!cuerpo) return new NextResponse(null, { status: 204 })

    const ahora = new Date()
    const dia = ahora.toISOString().slice(0, 10)
    const grupos = gruposDeReporte(cuerpo, dia, origenesPropios())
    if (grupos.length === 0) return new NextResponse(null, { status: 204 })

    /**
     * Un `set(merge)` por grupo, con id determinista.
     *
     * El id sale del contenido, así que dos reportes iguales del mismo día caen
     * en el MISMO documento y sólo mueven el contador. Eso es lo que acota
     * cuánto puede crecer esta colección: violaciones DISTINTAS por día, no
     * número de reportes — y es la diferencia entre una estadística y una puerta
     * abierta para inflar la factura desde internet.
     *
     * Sin `await` a propósito: el navegador no espera la respuesta de un buzón
     * de reportes, y pagar latencia por escribir una estadística sería pagarla
     * para nada.
     */
    for (const g of grupos) {
      void adminDb.collection(COLECCION_CSP).doc(idDocumento(g.clave)).set({
        directiva: g.directiva,
        bloqueado: g.bloqueado,
        pagina: g.pagina,
        dia: g.dia,
        veces: admin.firestore.FieldValue.increment(1),
        ultimaVez: ahora.toISOString(),
      }, { merge: true }).catch(e => safeLog.warn('[CSP] no se pudo acumular:', String(e).slice(0, 120)))
      safeLog.warn(`[CSP-RO] ${g.directiva} · ${g.bloqueado} · en ${g.pagina}`)
    }
  } catch {
    // Un reporte mal formado NUNCA puede tumbar el buzón: dejaría de llegar el
    // resto y la observación se quedaría muda sin que nadie se enterara.
  }
  return new NextResponse(null, { status: 204 })
}
