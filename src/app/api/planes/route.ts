/**
 * GET /api/planes — el catálogo vigente, PÚBLICO.
 *
 * Existe porque el catálogo editable nacía desconectado: se podía cambiar un
 * precio en la consola del dueño y no lo veía nadie más. Ni la página pública de
 * precios, ni el gate de pago dentro de la aplicación — los dos leían la
 * constante del código. Un ajuste que no llega al cliente no es un ajuste.
 *
 * Es público a propósito: un precio de lista no es un secreto, está impreso en
 * la página de precios y se le dice a cualquiera que pregunte. Lo que NO sale de
 * aquí son los internos —`incluye`, `modulos`, `nivelIA`—, no por secreto sino
 * porque el cliente no los necesita y todo campo que se expone es un campo del
 * que luego alguien depende.
 */
import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { catalogoEfectivo, type CatalogoGuardado } from '@/lib/finanzas/catalogo-planes'
import { PLANES_ORDEN } from '@/lib/planes-ia'

export const runtime = 'nodejs'
/**
 * Se revalida cada 60 s.
 *
 * Un precio no cambia cada minuto, y servirlo desde caché evita una lectura de
 * base por cada visita a la página de precios. El minuto es el retraso máximo
 * entre que el dueño guarda y el mundo lo ve — que para un precio es nada.
 */
export const revalidate = 60

export async function GET() {
  try {
    const snap = await adminDb.collection('platform_config').doc('catalogo_planes').get()
    const efectivo = catalogoEfectivo(snap.exists ? (snap.data() as CatalogoGuardado) : null)
    return NextResponse.json({
      ok: true,
      version: efectivo.version,
      planes: PLANES_ORDEN.map(c => ({
        clave: c,
        nombre: efectivo.planes[c].nombre,
        precioMXN: efectivo.planes[c].precioMXN,
        creditos: efectivo.planes[c].creditos,
      })),
    })
  } catch (e) {
    /**
     * Si la base no responde NO se rompe la página de precios: se sirven los
     * valores de fábrica. Es la respuesta menos mala — un precio de hace un mes
     * es mucho mejor que una página de precios en blanco para quien está a punto
     * de comprar.
     */
    safeLog.warn('[api/planes] cayendo a fábrica:', String(e).slice(0, 120))
    const efectivo = catalogoEfectivo(null)
    return NextResponse.json({
      ok: true,
      version: 0,
      deFabrica: true,
      planes: PLANES_ORDEN.map(c => ({
        clave: c,
        nombre: efectivo.planes[c].nombre,
        precioMXN: efectivo.planes[c].precioMXN,
        creditos: efectivo.planes[c].creditos,
      })),
    })
  }
}
