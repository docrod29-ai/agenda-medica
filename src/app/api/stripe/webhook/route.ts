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

/**
 * Estado interno del consultorio a partir del estado de la suscripción de Stripe.
 *
 * La clave está en `past_due`: Stripe emite ese estado —y un
 * `invoice.payment_failed`— en el PRIMER intento fallido del ciclo, no al agotar
 * los reintentos (reintenta a los 3, 5 y 7 días). El manejo anterior suspendía la
 * clínica en ese instante, así que un rechazo transitorio de tarjeta le quitaba
 * al médico el acceso a TODOS los expedientes de sus pacientes el mismo día,
 * aunque el cobro se recuperara 48 h después. Ese es el caso "pierde acceso
 * pagando".
 *
 * Durante el dunning se mantiene el acceso (estado 'active'); solo se corta
 * cuando Stripe da el cobro por definitivamente perdido (`unpaid`) o cancela la
 * suscripción (`canceled`).
 */
function estadoDeSuscripcion(status: string): 'active' | 'suspended' | 'cancelled' {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':      // en reintentos: NO cortar todavía
      return 'active'
    case 'canceled':
      return 'cancelled'
    default:              // unpaid, incomplete_expired, incomplete → sin acceso
      return 'suspended'
  }
}

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
          if (n > 0) {
            // Candado ATÓMICO: create() falla si el doc ya existe. Antes era
            // get()+set() (no atómico) → dos entregas simultáneas del mismo
            // session.id leían "no procesada" y ambas abonaban (doble crédito).
            const marca = adminDb.collection('recargas_procesadas').doc(session.id)
            try {
              await marca.create({ clinicId, creditos: n, fecha: new Date().toISOString() })
            } catch {
              break  // ya procesada (o carrera perdida) → NO abonar de nuevo
            }
            await agregarCreditosExtra(clinicId, n)
          }
          break
        }

        /**
         * ANTICIPO DEL PACIENTE (pago único desde el portal).
         *
         * Antes NO tenía rama propia, y como el desvío de arriba solo mira
         * `tipo === 'recarga'`, caía en la rama de SUSCRIPCIÓN de abajo. El daño
         * era doble y silencioso:
         *
         *  1. `activarPlan(clinicId, 'clinica')` reescribía el plan del
         *     consultorio. Una clínica en plan Hospital perdía los módulos que
         *     paga, y `stripeSubscriptionId` quedaba en '' porque un pago único no
         *     trae suscripción — rompiendo el vínculo con la suscripción real que
         *     Stripe sigue cobrando. En el otro sentido, una cuenta de prueba se
         *     quedaba con plan Clínica activo para siempre por el importe de un
         *     anticipo.
         *  2. El dinero del paciente no generaba NINGÚN cobro, así que no existía
         *     en Finanzas ni en el corte de caja: la cita salía en "cuentas por
         *     cobrar" ya pagada y la asistente la cobraba otra vez en ventanilla.
         *
         * Se registra el cobro con candado atómico por `session.id` —el mismo
         * patrón que ya usaba la recarga— porque Stripe reintenta el webhook.
         */
        if (session.mode === 'payment' && session.metadata?.tipo === 'paciente_anticipo') {
          const citaId = String(session.metadata?.citaId ?? '')
          const marca = adminDb.collection('anticipos_procesados').doc(session.id)
          try {
            await marca.create({ clinicId, citaId, fecha: new Date().toISOString() })
          } catch {
            break  // ya procesado (o carrera perdida) → NO registrar de nuevo
          }
          const ahora = new Date()
          const iso = ahora.toISOString()
          const dia = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(ahora)
          const monto = (session.amount_total ?? 0) / 100
          const citaRef = citaId ? adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId) : null
          const cita = citaRef ? (await citaRef.get()).data() as Record<string, unknown> | undefined : undefined
          await adminDb.collection('clinics').doc(clinicId).collection('cobros').add({
            fecha: iso, dia, mes: dia.slice(0, 7),
            monto, metodo: 'tarjeta', concepto: 'consulta',
            descripcion: 'Anticipo pagado en línea por el paciente',
            citaId: citaId || undefined,
            patientId: (cita?.pacienteId as string) || undefined,
            patientNombre: (cita?.pacienteNombre as string) || undefined,
            medicoId: (cita?.medicoId as string) || undefined,
            medicoNombre: (cita?.medicoNombre as string) || undefined,
            folio: `CB-${session.id.slice(-7).toUpperCase()}`,
            referenciaExterna: session.id,
            createdAt: iso, creadoPor: 'stripe:anticipo', cancelado: false,
          })
          // La cita deja de estar 'pendiente-pago': ya se pagó.
          if (citaRef) await citaRef.update({ estado: 'pagada', pagadoEn: iso, updatedAt: iso })
          break
        }

        /**
         * SUSCRIPCIÓN: activa el plan + enciende el nivel de IA.
         *
         * La guarda por `mode` es deliberada: cualquier pago único FUTURO que se
         * añada al portal y no tenga rama propia arriba se descartaría aquí en vez
         * de reescribir el plan del consultorio, que es lo que pasó con el
         * anticipo del paciente.
         */
        if (session.mode !== 'subscription') break
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
        const status = estadoDeSuscripcion(sub.status)

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
        /**
         * Se RESTAURA el acceso al cobrar. Antes `invoice.paid` no tocaba el
         * estado, así que si la clínica había quedado suspendida por un fallo
         * previo, recuperarse del cobro no la reactivaba: el médico se quedaba
         * fuera hasta que llegara —si llegaba— un `subscription.updated`. Solo se
         * sube a 'active' desde un estado de impago, para no pisar una cancelación
         * en curso.
         */
        if (clinicId) {
          try {
            const snap = await adminDb.collection('clinics').doc(clinicId).get()
            if (snap.get('status') === 'suspended') {
              await updateClinic(clinicId, { status: 'active', pagoVencido: false })
            }
          } catch { /* no-bloqueante: el pago ya quedó registrado */ }
        }
        break
      }

      /* ── Payment failed ────────────────────────────── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as import('stripe').Stripe.Invoice
        const clinicId = await getClinicIdByCustomer(invoice.customer as string)
        if (!clinicId) break

        /**
         * NO se suspende aquí. Stripe emite este evento en el primer intento
         * fallido del ciclo y sigue reintentando durante días; suspender ya
         * cortaba el acceso por un rechazo transitorio de tarjeta. Se marca el
         * pago como vencido —para poder avisarle al médico— y la suspensión real
         * queda en manos de `subscription.updated` (cuando pase a `unpaid`) o de
         * `subscription.deleted`, que son los estados terminales del dunning.
         */
        await updateClinic(clinicId, { pagoVencido: true })
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
