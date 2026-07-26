/**
 * Cobro POR ASIENTO (por médico).
 *   GET  ?clinicId=  → estado: # médicos, extras, precio por médico, si falta actualizar
 *   POST { clinicId } → sincroniza: ajusta la cantidad de "médico extra" en la
 *                        suscripción de Stripe (prorratea) y guarda medicosContratados
 *
 * El plan incluye 1 médico; cada médico adicional (rol medico/admin en
 * clinic_members) se cobra con el precio por asiento. Miembro del consultorio.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro, verificarMedico } from '@/lib/auth-server'
import { stripe, priceMedicoDe, nivelDePlan, type PlanKey } from '@/lib/stripe'
import { contarMedicos } from '@/lib/ai-keys'
import { MEDICO_EXTRA, planPorNivel } from '@/lib/planes-ia'

type Any = Record<string, unknown>
const ES_PLAN_ASIENTOS = (p: string): p is 'clinica' | 'premium' => p === 'clinica' || p === 'premium'

async function estado(clinicId: string) {
  const clinic = (await adminDb.collection('clinics').doc(clinicId).get()).data() as Any | undefined
  const plan = String(clinic?.plan ?? '')
  const medicos = await contarMedicos(clinicId)
  const contratados = Number(clinic?.medicosContratados ?? 1)
  const conAsientos = ES_PLAN_ASIENTOS(plan)
  const nivel = conAsientos ? nivelDePlan(plan as PlanKey) : 'pro'
  const me = MEDICO_EXTRA[nivel]
  const base = planPorNivel(nivel).precioMXN
  const extras = Math.max(0, medicos - 1)
  return {
    plan, conAsientos, medicos, contratados,
    precioMedicoExtra: me.precioMXN,
    mensualTotal: base + extras * me.precioMXN,
    requiereActualizar: conAsientos && medicos !== contratados,
    stripeSubscriptionId: String(clinic?.stripeSubscriptionId ?? ''),
  }
}

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ ok: false, error: 'Falta clinicId' }, { status: 400 })
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso.response
  return NextResponse.json({ ok: true, ...(await estado(clinicId)) })
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const clinicId = body.clinicId ?? ''
  if (!clinicId) return NextResponse.json({ ok: false, error: 'Falta clinicId' }, { status: 400 })
  const acceso = await verificarMedico(req, clinicId)
  if (!acceso.ok) return acceso.response

  try {
    const st = await estado(clinicId)
    if (!st.conAsientos) return NextResponse.json({ ok: true, ...st, aviso: 'Este plan no cobra por asiento.' })

    const extras = Math.max(0, st.medicos - 1)
    const seatPrice = priceMedicoDe(st.plan as PlanKey)

    // Ajusta la suscripción en Stripe (si existe y hay precio de asiento configurado).
    if (st.stripeSubscriptionId && seatPrice) {
      const sub = await stripe.subscriptions.retrieve(st.stripeSubscriptionId)
      const seatItem = sub.items.data.find(i => i.price.id === seatPrice)
      const items: { id?: string; price?: string; quantity?: number; deleted?: boolean }[] = []
      if (extras > 0) {
        items.push(seatItem ? { id: seatItem.id, quantity: extras } : { price: seatPrice, quantity: extras })
      } else if (seatItem) {
        items.push({ id: seatItem.id, deleted: true })
      }
      if (items.length) {
        await stripe.subscriptions.update(st.stripeSubscriptionId, { items, proration_behavior: 'create_prorations' })
      }
    }

    await adminDb.collection('clinics').doc(clinicId).set({ medicosContratados: st.medicos }, { merge: true })
    return NextResponse.json({ ok: true, ...(await estado(clinicId)) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 220) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30
