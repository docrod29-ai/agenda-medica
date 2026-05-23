/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events:
 *   - checkout.session.completed       → activate subscription on clinic
 *   - customer.subscription.updated    → update plan/status
 *   - customer.subscription.deleted    → suspend clinic
 *   - invoice.payment_failed           → mark payment overdue
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import type { PlanKey } from '@/lib/stripe'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

/* ── Helper: update clinic status/plan ────────────────────── */
async function updateClinic(clinicId: string, data: Record<string, unknown>) {
  await adminDb.collection('clinics').doc(clinicId).update({
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

async function getClinicIdByCustomer(customerId: string): Promise<string | null> {
  const snap = await adminDb
    .collection('clinics')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get()
  return snap.empty ? null : snap.docs[0].id
}

/* ── Stripe → our plan key mapping ────────────────────────── */
function planFromInterval(interval: string, amount: number): PlanKey {
  // Map by price amount (MXN cents): 29900=basico, 49900=pro, 99900=clinica
  if (amount <= 30000) return 'basico'
  if (amount <= 50000) return 'pro'
  return 'clinica'
}

/* ── Route handler ─────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: import('stripe').Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[Stripe Webhook] ${event.type}`)

  try {
    switch (event.type) {

      /* ── Checkout completed → subscription created ─── */
      case 'checkout.session.completed': {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session
        const clinicId = (session.metadata?.clinicId ?? '') as string
        const plan     = (session.metadata?.plan ?? 'pro') as PlanKey

        if (!clinicId) break

        await updateClinic(clinicId, {
          plan,
          status: 'active',
          stripeSubscriptionId: session.subscription ?? '',
        })
        break
      }

      /* ── Subscription updated (upgrade/downgrade/renew) ── */
      case 'customer.subscription.updated': {
        const sub = event.data.object as import('stripe').Stripe.Subscription
        const clinicId = sub.metadata?.clinicId
          ?? await getClinicIdByCustomer(sub.customer as string)

        if (!clinicId) break

        const item   = sub.items.data[0]
        const plan   = planFromInterval(
          item.price.recurring?.interval ?? 'month',
          item.price.unit_amount ?? 0,
        )
        const status = sub.status === 'active' || sub.status === 'trialing'
          ? 'active'
          : sub.status === 'canceled'
            ? 'cancelled'
            : 'suspended'

        await updateClinic(clinicId, {
          plan,
          status,
          stripeSubscriptionId: sub.id,
          stripeSubscriptionStatus: sub.status,
        })
        break
      }

      /* ── Subscription deleted (cancelled by user or overdue) ── */
      case 'customer.subscription.deleted': {
        const sub = event.data.object as import('stripe').Stripe.Subscription
        const clinicId = sub.metadata?.clinicId
          ?? await getClinicIdByCustomer(sub.customer as string)

        if (!clinicId) break

        await updateClinic(clinicId, {
          status: 'cancelled',
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: 'canceled',
        })
        break
      }

      /* ── Payment failed ────────────────────────────── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as import('stripe').Stripe.Invoice
        const clinicId = await getClinicIdByCustomer(invoice.customer as string)
        if (!clinicId) break

        await updateClinic(clinicId, { status: 'suspended' })
        break
      }

      default:
        // Unhandled event — that's fine
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(`[Stripe Webhook] Handler error for ${event.type}:`, err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/* Stripe webhooks send raw body — disable Next.js body parsing */
export const runtime = 'nodejs'
