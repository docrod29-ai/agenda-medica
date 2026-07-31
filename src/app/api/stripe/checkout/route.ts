/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for subscribing to a plan.
 * Requires the user to be authenticated (passes their clinicId + email).
 *
 * Body: { clinicId: string, plan: 'basico' | 'pro' | 'clinica', email: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { stripe, priceIdDe, PlanKey, type Ciclo } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { planSeVende, loQueFrena, productoDe } from '@/lib/finanzas/estado-producto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { clinicId, plan, email, ciclo } = (await req.json()) as {
      clinicId: string
      plan: PlanKey
      email: string
      ciclo?: Ciclo
    }

    if (!clinicId || !plan || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const acceso = await verificarCapacidad(req, clinicId, 'administrar')
    if (!acceso.ok) return acceso.response

    // No se cobra un plan que entrega módulos en construcción (§BH).
    //
    // Este gate va en el SERVIDOR y no en la página de precios a propósito: la
    // página ya dejó de enseñar «Hospital + UCI», pero esconder una tarjeta no
    // cierra una ruta HTTP — este endpoint acepta el `plan` que venga en el
    // cuerpo, y basta un POST para comprar lo que la interfaz no ofrece.
    if (!planSeVende(plan)) {
      const frenan = loQueFrena(plan).map(c => productoDe(c)?.nombre ?? c)
      return NextResponse.json({
        error: frenan.length
          ? `El plan ${plan} todavía no está a la venta: ${frenan.join(' y ')} en desarrollo.`
          : `El plan ${plan} no está a la venta.`,
        enDesarrollo: frenan,
      }, { status: 409 })
    }

    const cicloEfectivo: Ciclo = ciclo === 'anual' ? 'anual' : 'mensual'
    const priceId = priceIdDe(plan, cicloEfectivo)
    if (!priceId) {
      return NextResponse.json({ error: `No price configured for plan: ${plan} (${cicloEfectivo})` }, { status: 400 })
    }

    // Get or create Stripe customer for this clinic
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const clinicSnap = await clinicRef.get()

    if (!clinicSnap.exists) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const clinicData = clinicSnap.data()!
    let stripeCustomerId: string = clinicData.stripeCustomerId ?? ''

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { clinicId, nombreClinica: clinicData.nombreClinica ?? '' },
      })
      stripeCustomerId = customer.id
      await clinicRef.update({ stripeCustomerId })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        // Modelo B: la tarjeta se captura HOY pero el primer cargo es hasta el día 15.
        // Stripe gestiona el trial y el cobro automático; si falla → invoice.payment_failed.
        trial_period_days: 14,
        metadata: { clinicId, plan, ciclo: cicloEfectivo },
      },
      // Requerir tarjeta aunque haya trial (sin esto Stripe podría omitirla).
      payment_method_collection: 'always',
      success_url: `${APP_URL}/dashboard?checkout=success&plan=${plan}`,
      cancel_url:  `${APP_URL}/dashboard?checkout=cancelled`,
      allow_promotion_codes: true,   // el médico puede meter el código FUNDADOR aquí
      billing_address_collection: 'auto',
      metadata: { clinicId, plan, ciclo: cicloEfectivo },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    safeLog.error('[Stripe Checkout] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
