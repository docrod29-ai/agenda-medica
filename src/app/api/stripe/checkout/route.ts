/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for subscribing to a plan.
 * Requires the user to be authenticated (passes their clinicId + email).
 *
 * Body: { clinicId: string, plan: 'basico' | 'pro' | 'clinica', email: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_PRICES, PlanKey } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { clinicId, plan, email } = (await req.json()) as {
      clinicId: string
      plan: PlanKey
      email: string
    }

    if (!clinicId || !plan || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const acceso = await verificarMiembro(req, clinicId)
    if (!acceso.ok) return acceso.response

    const priceId = STRIPE_PRICES[plan]
    if (!priceId) {
      return NextResponse.json({ error: `No price configured for plan: ${plan}` }, { status: 400 })
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
        trial_period_days: 0, // Trial is managed by us (14-day free period already started)
        metadata: { clinicId, plan },
      },
      success_url: `${APP_URL}/dashboard?checkout=success&plan=${plan}`,
      cancel_url:  `${APP_URL}/dashboard?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: { clinicId, plan },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[Stripe Checkout] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
