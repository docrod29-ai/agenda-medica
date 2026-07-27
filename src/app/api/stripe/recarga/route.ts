/**
 * POST /api/stripe/recarga
 *
 * Compra de RECARGA de créditos (pago ÚNICO, no suscripción). Cuando el médico
 * agota sus créditos del mes, compra un paquete extra que se suma al cupo del mes
 * en curso vía el webhook (checkout.session.completed → agregarCreditosExtra).
 *
 * Body: { clinicId: string, email?: string }
 * Resp: { url } (Stripe Checkout) | { error }
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { stripe, STRIPE_PRICE_RECARGA } from '@/lib/stripe'
import { RECARGA } from '@/lib/planes-ia'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMedico } from '@/lib/auth-server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { clinicId, email } = (await req.json()) as { clinicId: string; email?: string }
    if (!clinicId) return NextResponse.json({ error: 'Falta clinicId' }, { status: 400 })

    const acceso = await verificarMedico(req, clinicId)
    if (!acceso.ok) return acceso.response

    if (!STRIPE_PRICE_RECARGA) {
      return NextResponse.json({ error: 'Recarga no configurada (falta STRIPE_PRICE_RECARGA en Vercel).' }, { status: 503 })
    }

    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const clinicSnap = await clinicRef.get()
    if (!clinicSnap.exists) return NextResponse.json({ error: 'Consultorio no encontrado' }, { status: 404 })

    const clinicData = clinicSnap.data()!
    let stripeCustomerId: string = clinicData.stripeCustomerId ?? ''
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email ?? clinicData.email ?? undefined,
        metadata: { clinicId, nombreClinica: clinicData.nombreClinica ?? '' },
      })
      stripeCustomerId = customer.id
      await clinicRef.update({ stripeCustomerId })
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',   // pago ÚNICO (no suscripción)
      line_items: [{ price: STRIPE_PRICE_RECARGA, quantity: 1 }],
      // El webhook lee esto para saber CUÁNTOS créditos sumar y a qué consultorio.
      metadata: { clinicId, tipo: 'recarga', creditos: String(RECARGA.creditos) },
      payment_intent_data: { metadata: { clinicId, tipo: 'recarga', creditos: String(RECARGA.creditos) } },
      // /consulta sin paciente NO existe (solo /consulta/[patientId]): al volver
      // de pagar la recarga se caía en un 404. Se manda al panel, que es donde
      // se ven los créditos ya sumados por el webhook.
      success_url: `${APP_URL}/?recarga=success`,
      cancel_url:  `${APP_URL}/?recarga=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    safeLog.error('[Stripe Recarga] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
