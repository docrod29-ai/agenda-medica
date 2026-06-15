/**
 * POST /api/payment/create-checkout
 *
 * Crea una sesión de pago de Stripe Checkout para que el paciente pague
 * anticipo o consulta completa. La política de cancelación/reembolso se
 * gestiona desde el dashboard del médico.
 *
 * NO procesa pagos directamente: redirige al paciente al Checkout de Stripe.
 *
 * Body: { clinicId, citaId, descripcion, montoMXN, currency? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { verificarTokenPaciente } from '@/lib/patient-token'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { token, citaId, descripcion, montoMXN, currency = 'mxn' } = await req.json()

    // AUTORIZACIÓN: token del portal del paciente (antes era público → cualquiera podía
    // mutar cualquier cita a 'pendiente-pago'). El clinicId sale del token, no del body.
    const sesion = verificarTokenPaciente(token)
    if (!sesion) return NextResponse.json({ ok: false, error: 'Enlace inválido o vencido' }, { status: 401 })
    const { clinicId, patientId } = sesion

    // TODO(pago fase 2): el monto debe venir de la config del servidor, NO del cliente.
    if (!citaId || !descripcion || !montoMXN || montoMXN < 10) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }

    const citaRef = adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId)
    const citaSnap = await citaRef.get()
    if (!citaSnap.exists) return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    // La cita debe pertenecer al paciente del token (evita pagar/mutar citas ajenas)
    if (citaSnap.data()?.pacienteId !== patientId) {
      return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    }

    const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
    const clinicNombre = clinicSnap.data()?.nombreClinica ?? 'Consultorio'

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

    // Marcar la cita como pendiente-pago para tracking
    await citaRef.update({
      estado: 'pendiente-pago',
      pagoStripeSessionId: session.id,
      pagoMonto: montoMXN,
      pagoMoneda: currency,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err) {
    console.error('[payment/create-checkout]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
