/**
 * GET /api/facturacion/pagos?clinicId=...
 *
 * Lista los pagos del consultorio (suscripción + recargas) con su estado de
 * factura, para que el cliente elija cuál facturar. Miembro del consultorio.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { facturamaConfigurada } from '@/lib/facturama'

type Any = Record<string, unknown>

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ ok: false, error: 'Falta clinicId' }, { status: 400 })
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso.response

  try {
    const snap = await adminDb.collection('platform_payments').where('clinicId', '==', clinicId).get()
    const pagos = snap.docs.filter(d => {
      /**
       * SÓLO SE PUEDE FACTURAR LO QUE ENTRÓ.
       *
       * `platform_payments` guarda en la MISMA colección los cobros, los
       * reembolsos (`refund_*`) y los contracargos (`dispute_*`), todos con
       * `monto` positivo. Esta lista no filtraba nada, así que el consultorio
       * veía su propio reembolso entre los «pagos» y podía timbrar un CFDI de
       * INGRESO por dinero que se le devolvió. Es el mismo hueco que la consola
       * ya había cerrado para sus reportes, abierto en la puerta fiscal.
       *
       * Y los pagos de PRUEBA de Stripe (`livemode: false`) tampoco son
       * facturables: no existió el dinero.
       */
      const p = d.data() as Any
      const tipo = String(p.tipo ?? '')
      if (tipo === 'reembolso' || tipo === 'contracargo') return false
      if (p.livemode === false) return false
      return true
    }).map(d => {
      const p = d.data() as Any
      return {
        id: d.id,
        monto: Number(p.monto ?? 0),
        moneda: String(p.moneda ?? 'MXN'),
        fecha: String(p.fecha ?? p.createdAt ?? ''),
        descripcion: String(p.descripcion ?? 'Suscripción'),
        facturado: Boolean(p.cfdiUuid),
        cfdiUuid: p.cfdiUuid ? String(p.cfdiUuid) : null,
        cfdiId: p.cfdiId ? String(p.cfdiId) : null,
      }
    }).sort((a, b) => b.fecha.localeCompare(a.fecha))

    // Datos fiscales guardados del consultorio (para pre-llenar el formulario).
    const clinic = (await adminDb.collection('clinics').doc(clinicId).get()).data() as Any | undefined
    const datosFiscales = (clinic?.datosFiscales as Any) ?? null

    return NextResponse.json({ ok: true, pagos, datosFiscales, disponible: facturamaConfigurada() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 160) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
