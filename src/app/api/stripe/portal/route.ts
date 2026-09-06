/**
 * POST /api/stripe/portal
 *
 * Opens the Stripe Customer Portal so the user can manage their subscription.
 * Body: { clinicId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { safeLog } from '@/lib/security/sanitize'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { clinicId } = (await req.json()) as { clinicId: string }

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId required' }, { status: 400 })
    }
    const acceso = await verificarCapacidad(req, clinicId, 'administrar')
    if (!acceso.ok) return acceso.response

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
      // (dashboard) es un route GROUP de Next: NO aparece en la URL. Con
      // /dashboard/configuracion el usuario aterrizaba en un 404 al volver del
      // portal de facturación de Stripe. La ruta real es /configuracion.
      return_url: `${APP_URL}/configuracion`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    safeLog.error('[Stripe Portal] Error:', err)
    return errorAlCliente()
  }
}
