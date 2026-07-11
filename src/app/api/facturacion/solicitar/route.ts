/**
 * POST /api/facturacion/solicitar
 *
 * El cliente PIDE factura de uno de sus pagos. Timbra un CFDI 4.0 vía Facturama
 * (emisor = dueño de la plataforma; receptor = el consultorio) y guarda el UUID
 * en el pago. Idempotente: si ese pago ya tiene factura, la regresa sin re-timbrar.
 *
 * Body: { clinicId, pagoId, receptor: { rfc, nombre, regimenFiscal, usoCfdi, cp } }
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { emitirCFDI, facturamaConfigurada, type DatosReceptor } from '@/lib/facturama'

type Any = Record<string, unknown>

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; pagoId?: string; receptor?: DatosReceptor }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { clinicId, pagoId, receptor } = body
  if (!clinicId || !pagoId || !receptor) return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 })

  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso.response

  if (!facturamaConfigurada()) {
    return NextResponse.json({ ok: false, error: 'Facturación no configurada. Contacta al proveedor.' }, { status: 503 })
  }

  // Validar datos fiscales mínimos.
  const faltan = (['rfc', 'nombre', 'regimenFiscal', 'usoCfdi', 'cp'] as const).filter(k => !String(receptor[k] ?? '').trim())
  if (faltan.length) return NextResponse.json({ ok: false, error: `Faltan datos fiscales: ${faltan.join(', ')}` }, { status: 400 })

  try {
    const pagoRef = adminDb.collection('platform_payments').doc(pagoId)
    const pagoSnap = await pagoRef.get()
    if (!pagoSnap.exists) return NextResponse.json({ ok: false, error: 'Pago no encontrado' }, { status: 404 })
    const pago = pagoSnap.data() as Any
    if (String(pago.clinicId ?? '') !== clinicId) return NextResponse.json({ ok: false, error: 'Ese pago no es de tu consultorio' }, { status: 403 })

    // Ya facturado → regresa el existente (no se timbra dos veces).
    if (pago.cfdiUuid) {
      return NextResponse.json({ ok: true, yaFacturado: true, uuid: String(pago.cfdiUuid), cfdiId: String(pago.cfdiId ?? '') })
    }

    const monto = Number(pago.monto ?? 0)
    if (!(monto > 0)) return NextResponse.json({ ok: false, error: 'El pago no tiene monto válido' }, { status: 400 })
    const descripcion = String(pago.descripcion || 'Suscripción NexusMED')

    const cfdi = await emitirCFDI(monto, descripcion, receptor)

    // Guarda el UUID en el pago + los datos fiscales en el consultorio (para reusar).
    await pagoRef.set({ cfdiUuid: cfdi.uuid, cfdiId: cfdi.id, cfdiFecha: cfdi.fecha }, { merge: true })
    await adminDb.collection('clinics').doc(clinicId).set({ datosFiscales: receptor }, { merge: true })

    return NextResponse.json({ ok: true, uuid: cfdi.uuid, cfdiId: cfdi.id })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 240) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30
