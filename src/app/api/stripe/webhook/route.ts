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
import { stripe, nivelDePlan } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { agregarCreditosExtra, guardarNivelIA } from '@/lib/ai-keys'
import { MODULOS_DE_PLAN } from '@/lib/modulos'
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

/* ── Stripe → nuestro plan (por monto MXN, respaldo si no viene en metadata) ── */
function planPorMonto(amount: number): PlanKey {
  // Precios (centavos MXN): 34900 Agenda · 89900 Clínica · 189900 Pro · 290000 Hospital
  if (amount <= 50000) return 'agenda'
  if (amount <= 120000) return 'clinica'
  if (amount <= 220000) return 'premium'
  return 'hospital'
}
const ES_PLAN = (p: unknown): p is PlanKey => p === 'agenda' || p === 'clinica' || p === 'premium' || p === 'hospital'

/** Activa el plan en el consultorio: estado + MÓDULOS (solo lo que compró) + nivel de IA. */
async function activarPlan(clinicId: string, plan: PlanKey, extra: Record<string, unknown>) {
  // modulos = EXACTAMENTE los del plan (candado "solo lo que compró"). Al cambiar
  // de plan se reescribe, así se agregan/quitan funciones según corresponda.
  const modulos = MODULOS_DE_PLAN[plan] ?? MODULOS_DE_PLAN.clinica
  await updateClinic(clinicId, { plan, status: 'active', modulos, ...extra })
  if (plan !== 'agenda') {
    try { await guardarNivelIA(clinicId, nivelDePlan(plan)) } catch { /* no-bloqueante */ }
  }
}

/**
 * Evita EMPALME de suscripciones: cancela cualquier OTRA suscripción activa del
 * mismo cliente, dejando solo la nueva. Así cambiar de plan no acumula cobros.
 */
async function cancelarOtrasSuscripciones(customerId: string, conservarSubId: string) {
  try {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 20 })
    const trials = await stripe.subscriptions.list({ customer: customerId, status: 'trialing', limit: 20 })
    const todas = [...subs.data, ...trials.data]
    for (const s of todas) {
      if (s.id !== conservarSubId) {
        await stripe.subscriptions.cancel(s.id).catch(() => { /* ya cancelada / carrera */ })
      }
    }
  } catch { /* no-bloqueante: si falla, no rompe la activación */ }
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

      /* ── Checkout completed → suscripción creada O recarga comprada ─── */
      case 'checkout.session.completed': {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session
        const clinicId = (session.metadata?.clinicId ?? '') as string
        if (!clinicId) break

        // RECARGA (pago único): suma créditos extra al mes en curso. Idempotente
        // por el id de la sesión (Stripe reintenta el webhook).
        if (session.mode === 'payment' && session.metadata?.tipo === 'recarga') {
          const n = Number(session.metadata?.creditos ?? 0)
          const marca = adminDb.collection('recargas_procesadas').doc(session.id)
          const yaHecha = (await marca.get()).exists
          if (!yaHecha && n > 0) {
            await agregarCreditosExtra(clinicId, n)
            await marca.set({ clinicId, creditos: n, fecha: new Date().toISOString() })
          }
          break
        }

        // SUSCRIPCIÓN: activa el plan + enciende el nivel de IA.
        const plan = ES_PLAN(session.metadata?.plan) ? session.metadata!.plan as PlanKey : 'clinica'
        const nuevaSubId = String(session.subscription ?? '')
        await activarPlan(clinicId, plan, { stripeSubscriptionId: nuevaSubId })
        // Evita empalme: cancela cualquier otra suscripción activa del cliente.
        if (session.customer && nuevaSubId) {
          await cancelarOtrasSuscripciones(String(session.customer), nuevaSubId)
        }
        break
      }

      /* ── Subscription updated (upgrade/downgrade/renew) ── */
      case 'customer.subscription.updated': {
        const sub = event.data.object as import('stripe').Stripe.Subscription
        const clinicId = sub.metadata?.clinicId
          ?? await getClinicIdByCustomer(sub.customer as string)

        if (!clinicId) break

        const item = sub.items.data[0]
        const plan = ES_PLAN(sub.metadata?.plan) ? sub.metadata!.plan as PlanKey : planPorMonto(item.price.unit_amount ?? 0)
        const status = sub.status === 'active' || sub.status === 'trialing'
          ? 'active'
          : sub.status === 'canceled'
            ? 'cancelled'
            : 'suspended'

        if (status === 'active') {
          await activarPlan(clinicId, plan, { stripeSubscriptionId: sub.id, stripeSubscriptionStatus: sub.status })
        } else {
          await updateClinic(clinicId, { plan, status, stripeSubscriptionId: sub.id, stripeSubscriptionStatus: sub.status })
        }
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

      /* ── Payment SUCCEEDED → registra el ingreso ────── */
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as import('stripe').Stripe.Invoice
        const clinicId = await getClinicIdByCustomer(invoice.customer as string)
        const amount = (invoice.amount_paid ?? 0) / 100  // centavos → MXN
        if (amount <= 0) break
        // Registro idempotente por invoice.id (Stripe reintenta el webhook).
        await adminDb.collection('platform_payments').doc(invoice.id ?? `pay_${event.id}`).set({
          clinicId: clinicId ?? '',
          stripeCustomerId: invoice.customer ?? '',
          invoiceId: invoice.id ?? '',
          monto: amount,
          moneda: (invoice.currency ?? 'mxn').toUpperCase(),
          fecha: new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          descripcion: invoice.lines?.data?.[0]?.description ?? 'Suscripción',
          createdAt: new Date().toISOString(),
        }, { merge: true })
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
