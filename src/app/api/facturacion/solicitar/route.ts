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

    /**
     * RESERVA ATÓMICA DEL TIMBRADO (anti-doble-CFDI).
     *
     * El check de `cfdiUuid` de arriba y la escritura del UUID (más abajo) NO eran
     * atómicos: dos solicitudes concurrentes del mismo pago pasaban ambas el check
     * antes de que cualquiera escribiera → se timbraban DOS CFDI para un solo pago
     * (problema fiscal). `emitirCFDI` es una llamada externa (no cabe en la
     * transacción), así que se reserva un lock breve: la transacción marca
     * `cfdiLockAt` solo si no hay UUID ni lock vigente; el perdedor recibe 409.
     */
    const LOCK_MS = 60_000
    const claim = await adminDb.runTransaction(async (tx) => {
      const s = await tx.get(pagoRef)
      const d = (s.data() ?? {}) as Any
      if (d.cfdiUuid) return { estado: 'ya' as const, uuid: String(d.cfdiUuid), cfdiId: String(d.cfdiId ?? '') }
      const lockAt = d.cfdiLockAt ? Date.parse(String(d.cfdiLockAt)) : 0
      if (lockAt && (Date.now() - lockAt) < LOCK_MS) return { estado: 'enProceso' as const }
      tx.set(pagoRef, { cfdiLockAt: new Date().toISOString() }, { merge: true })
      return { estado: 'claim' as const }
    })
    if (claim.estado === 'ya') return NextResponse.json({ ok: true, yaFacturado: true, uuid: claim.uuid, cfdiId: claim.cfdiId })
    if (claim.estado === 'enProceso') return NextResponse.json({ ok: false, error: 'Ya hay un timbrado en curso para este pago. Intenta de nuevo en un momento.' }, { status: 409 })

    let cfdi
    try {
      cfdi = await emitirCFDI(monto, descripcion, receptor)
    } catch (e) {
      // Liberar el lock para permitir reintento; si no, el pago quedaría bloqueado 60s.
      await pagoRef.set({ cfdiLockAt: '' }, { merge: true }).catch(() => {})
      throw e
    }

    // Guarda el UUID en el pago + los datos fiscales en el consultorio (para reusar).
    await pagoRef.set({ cfdiUuid: cfdi.uuid, cfdiId: cfdi.id, cfdiFecha: cfdi.fecha, cfdiLockAt: '' }, { merge: true })
    await adminDb.collection('clinics').doc(clinicId).set({ datosFiscales: receptor }, { merge: true })

    return NextResponse.json({ ok: true, uuid: cfdi.uuid, cfdiId: cfdi.id })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 240) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30
