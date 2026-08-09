/**
 * POST /api/payment/create-checkout
 *
 * Crea una sesión de pago de Stripe Checkout para que el paciente pague
 * anticipo o consulta completa. La política de cancelación/reembolso se
 * gestiona desde el dashboard del médico.
 *
 * NO procesa pagos directamente: redirige al paciente al Checkout de Stripe.
 *
 * Body: { token, citaId, currency? }
 * SEGURIDAD (L1 auditoría maestra 2026-07): el MONTO NO se acepta del cliente —
 * se lee de la config del consultorio en el servidor (config.anticipoMonto). Antes
 * el navegador del paciente mandaba `montoMXN` y el webhook marcaba la cita
 * 'pagada' con lo que fuera (podía pagar el mínimo de $10 por una consulta cara).
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { verificarTokenPaciente } from '@/lib/patient-token'
import { limitarOResponder } from '@/lib/rate-limit'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { token, citaId } = await req.json()
    // MONEDA FIJA EN EL SERVIDOR (auditoría P0): el monto se calcula en MXN, así que
    // la moneda DEBE ser 'mxn'. Antes se tomaba `currency` del body → con 'cop'/'ars'
    // Stripe cobraba ~USD0.12 por el mismo número y el webhook (que compara solo el
    // número, no la moneda) marcaba la cita 'pagada'. Nunca del cliente.
    const currency = 'mxn'

    // AUTORIZACIÓN: token del portal del paciente (antes era público → cualquiera podía
    // mutar cualquier cita a 'pendiente-pago'). El clinicId sale del token, no del body.
    const sesion = verificarTokenPaciente(token)
    if (!sesion) return NextResponse.json({ ok: false, error: 'Enlace inválido o vencido' }, { status: 401 })
    const { clinicId, patientId } = sesion

    if (!citaId) return NextResponse.json({ ok: false, error: 'Falta la cita' }, { status: 400 })

    // RATE-LIMIT: cada llamada crea una sesión real en Stripe (cuesta una
    // petición a un tercero). Por cita, igual que telesalud/sala.
    const limite = await limitarOResponder(`checkout:${clinicId}:${citaId}`, 12, 600,
      'Demasiados intentos de pago. Espera un momento e inténtalo de nuevo.')
    if (limite) return limite

    const citaRef = adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId)
    const citaSnap = await citaRef.get()
    if (!citaSnap.exists) return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    // La cita debe pertenecer al paciente del token (evita pagar/mutar citas ajenas)
    if (citaSnap.data()?.pacienteId !== patientId) {
      return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    }

    const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
    const clinicNombre = clinicSnap.data()?.nombreClinica ?? 'Consultorio'

    // MONTO DESDE EL SERVIDOR: la tarifa de la cita si el médico la fijó, si no el
    // anticipo configurado del consultorio. NUNCA del cliente. Sin monto → no se cobra.
    const cfgSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const cfg = cfgSnap.data() ?? {}
    const montoServidor = Number(citaSnap.data()?.pagoMonto) > 0
      ? Number(citaSnap.data()?.pagoMonto)
      : Number(cfg.anticipoMonto)
    if (!Number.isFinite(montoServidor) || montoServidor < 10) {
      return NextResponse.json({ ok: false, error: 'Este consultorio no tiene configurado un monto de anticipo.' }, { status: 400 })
    }
    const montoMXN = Math.round(montoServidor * 100) / 100
    const descripcion = `Anticipo de cita · ${clinicNombre}`

    // Stripe espera el monto en centavos del moneda local
    const unit_amount = Math.round(montoMXN * 100)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency,
          product_data: { name: descripcion, description: `Cita en ${clinicNombre}` },
          unit_amount,
        },
        quantity: 1,
      }],
      success_url: `${APP_URL}/pago/exito?cita=${citaId}`,
      cancel_url:  `${APP_URL}/pago/cancelado?cita=${citaId}`,
      metadata: { clinicId, citaId, tipo: 'paciente_anticipo' },
    })

    /**
     * NO SE PISA LA TARIFA CON EL ANTICIPO.
     *
     * Aquí se escribía `pagoMonto: montoMXN`, y `montoMXN` es lo que se va a
     * cobrar AHORA (la tarifa si existe, si no el anticipo del consultorio).
     * Después el webhook decide si el pago salda la cita comparando contra ese
     * mismo campo:
     *
     *     const esperado = Number(cita?.pagoMonto) || 0
     *     const cubre = esperado <= 0 || monto + 0.01 >= esperado
     *
     * Como el campo acababa de reescribirse con lo cobrado, `cubre` salía
     * SIEMPRE true y la rama de abono era inalcanzable por construcción.
     *
     * En la práctica: consulta de $800 con anticipo de $200 → cobro de $200
     * registrado como 'consulta', cita 'pagada', botón «Cobrar» oculto y fuera
     * de cuentas por cobrar. Los $600 desaparecían sin que nadie los viera.
     *
     * Ahora la tarifa esperada se conserva y lo cobrado va en su propio campo.
     */
    const yaHabiaTarifa = Number(citaSnap.data()?.pagoMonto) > 0
    await citaRef.update({
      estado: 'pendiente-pago',
      pagoStripeSessionId: session.id,
      // Sólo se escribe si NO había tarifa: en ese caso el importe cobrado es lo
      // único que este sistema sabe, y el webhook lo declarará como tal.
      ...(yaHabiaTarifa ? {} : { pagoMonto: montoMXN, pagoMontoEsAnticipoSinTarifa: true }),
      pagoCobrado: montoMXN,
      pagoMoneda: currency,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err) {
    safeLog.error('[payment/create-checkout]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
