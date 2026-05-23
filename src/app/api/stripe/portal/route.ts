/**
 * POST /api/stripe/portal
 *
 * Opens the Stripe Customer Portal so the user can manage their subscription.
 * Body: { clinicId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { clinicId } = (await req.json()) as { clinicId: string }

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
    }

    const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
    if (!clinicSnap.exists) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const { stripeCustomerId } = clinicSnap.data()!
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer for this clinic' }, { status: 400 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${APP_URL}/dashboard/configuracion`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[Stripe Portal] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
