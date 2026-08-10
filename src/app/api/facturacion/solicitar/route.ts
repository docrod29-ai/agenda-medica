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
import { verificarCapacidad } from '@/lib/authz/verificar'
import { emitirCFDI, facturamaConfigurada, type DatosReceptor } from '@/lib/facturama'
import { MARCA } from '@/lib/marca'

type Any = Record<string, unknown>

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; pagoId?: string; receptor?: DatosReceptor }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { clinicId, pagoId, receptor } = body
  if (!clinicId || !pagoId || !receptor) return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 })

  const acceso = await verificarCapacidad(req, clinicId, 'facturar')
  if (!acceso.ok) return acceso.response

  if (!facturamaConfigurada()) {
    return NextResponse.json({ ok: false, error: 'Facturación no configurada. Contacta al proveedor.' }, { status: 503 })
  }

  /**
   * DATOS FISCALES: PRESENTES **Y** CON FORMA VÁLIDA.
   *
   * Antes sólo se comprobaba que no estuvieran vacíos — y nunca lo estaban,
   * porque el formulario los nacía pre-llenados con régimen 612 (persona
   * FÍSICA) y uso G03. Una persona moral que no tocaba los desplegables se
   * facturaba con el régimen de una persona física: el PAC lo rechaza, o peor,
   * timbra y hay que cancelar.
   *
   * `formaPago` entra a la validación porque hasta ahora iba QUEMADA como '04'
   * (tarjeta de crédito) en todas las facturas, se hubiera pagado por SPEI o
   * por débito. Eso descuadra contra el estado de cuenta y es motivo habitual
   * de cancelación.
   *
   * La validación es de FORMA, no fiscal: qué régimen o qué uso corresponde a
   * cada contribuyente lo decide su contador, no este archivo.
   */
  const faltan = (['rfc', 'nombre', 'regimenFiscal', 'usoCfdi', 'cp', 'formaPago'] as const)
    .filter(k => !String(receptor[k] ?? '').trim())
  if (faltan.length) return NextResponse.json({ ok: false, error: `Faltan datos fiscales: ${faltan.join(', ')}` }, { status: 400 })

  const rfc = String(receptor.rfc).trim().toUpperCase()
  // Física 13 caracteres, moral 12. Es el formato oficial; no valida existencia.
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(rfc)) {
    return NextResponse.json({ ok: false, error: 'El RFC no tiene un formato válido (12 caracteres para persona moral, 13 para física).' }, { status: 400 })
  }
  if (!/^\d{5}$/.test(String(receptor.cp).trim())) {
    return NextResponse.json({ ok: false, error: 'El código postal debe tener 5 dígitos.' }, { status: 400 })
  }
  // Longitud vs régimen: un régimen de persona física con un RFC de 12 (moral)
  // —o al revés— es el error que produce el rechazo CFDI40157 del SAT.
  const esMoral = rfc.length === 12
  const REGIMENES_MORALES = new Set(['601', '603', '609', '620', '622', '623', '624', '628'])
  const REGIMENES_FISICAS = new Set(['605', '606', '607', '608', '610', '611', '612', '614', '615', '616', '621', '625', '626'])
  const reg = String(receptor.regimenFiscal).trim()
  if (esMoral && REGIMENES_FISICAS.has(reg)) {
    return NextResponse.json({ ok: false, error: `El RFC es de persona moral (12 caracteres) y el régimen ${reg} es de persona física. Revísalo con tu contador.` }, { status: 400 })
  }
  if (!esMoral && REGIMENES_MORALES.has(reg)) {
    return NextResponse.json({ ok: false, error: `El RFC es de persona física (13 caracteres) y el régimen ${reg} es de persona moral. Revísalo con tu contador.` }, { status: 400 })
  }

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

    /**
     * NI REEMBOLSOS NI CONTRACARGOS NI PRUEBAS.
     *
     * La lista ya no los ofrece, pero esta ruta acepta un `pagoId` cualquiera:
     * el candado tiene que estar también aquí, no sólo en la pantalla. Un CFDI
     * de ingreso por dinero devuelto es un problema fiscal, no un detalle.
     */
    const tipoPago = String(pago.tipo ?? '')
    if (tipoPago === 'reembolso' || tipoPago === 'contracargo') {
      return NextResponse.json({ ok: false, error: 'Un reembolso o un contracargo no se factura como ingreso.' }, { status: 400 })
    }
    if (pago.livemode === false) {
      return NextResponse.json({ ok: false, error: 'Ese movimiento es de prueba: no corresponde a dinero real y no se puede facturar.' }, { status: 400 })
    }

    const monto = Number(pago.monto ?? 0)
    if (!(monto > 0)) return NextResponse.json({ ok: false, error: 'El pago no tiene monto válido' }, { status: 400 })
    const descripcion = String(pago.descripcion || `Suscripción ${MARCA}`)

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
      cfdi = await emitirCFDI(monto, descripcion, receptor, String(receptor.formaPago).trim())
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
