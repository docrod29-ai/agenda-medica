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
import { decidirPrueba } from '@/lib/finanzas/prueba-gratis'

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
    /**
     * `priceIdDe` ahora LANZA si falta el precio anual, en vez de abrir una
     * suscripción mensual con los metadatos diciendo «anual». Se traduce a un
     * mensaje que el médico pueda entender: el problema es de configuración del
     * consultorio, no suyo.
     */
    let priceId: string
    try {
      priceId = priceIdDe(plan, cicloEfectivo)
    } catch {
      return NextResponse.json({
        error: `El cobro anual del plan ${plan} todavía no está configurado. Elige el cobro mensual, o avísanos para habilitarlo.`,
      }, { status: 409 })
    }
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

    /**
     * LA PRUEBA GRATIS SE ESTRENA UNA VEZ.
     *
     * Aquí iba `trial_period_days: 14` incondicional, así que cancelar el día 13
     * y volver a suscribirse renovaba la prueba: repetido, el producto entero
     * gratis para siempre con dos clics cada dos semanas. Y no salta ninguna
     * alarma, porque desde dentro se ve como un cliente que se suscribe.
     *
     * Se pregunta a Stripe por TODAS las suscripciones del cliente —las
     * canceladas son justo las que interesan— y, si la consulta falla, se cae a
     * la marca local que escribe el webhook.
     */
    let suscripcionesPrevias = 0
    let historialConsultado = false
    try {
      const previas = await stripe.subscriptions.list({
        customer: stripeCustomerId, status: 'all', limit: 1,
      })
      suscripcionesPrevias = previas.data.length
      historialConsultado = true
    } catch (e) {
      safeLog.error('[Stripe Checkout] no se pudo consultar el historial de suscripciones', e)
    }
    const prueba = decidirPrueba({
      suscripcionesPrevias,
      pruebaEstrenadaEn: clinicData.pruebaEstrenadaEn ?? null,
      historialConsultado,
    })
    safeLog.info(`[Stripe Checkout] prueba para ${clinicId}: ${prueba.dias ?? 'sin prueba'} — ${prueba.porQue}`)

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        // Modelo B: con prueba, la tarjeta se captura HOY y el primer cargo es al
        // terminar. Sin prueba, se cobra desde hoy — que es lo que el médico
        // espera al volver después de haberse dado de baja.
        ...(prueba.dias !== undefined ? { trial_period_days: prueba.dias } : {}),
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
