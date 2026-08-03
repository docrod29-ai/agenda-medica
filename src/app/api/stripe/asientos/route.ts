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
import { planVigentePorNivel } from '@/lib/finanzas/catalogo-servidor'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { verificarCapacidad } from '@/lib/authz/verificar'
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
  // El precio base sale del catálogo VIGENTE: la consola decía $949 y esta
  // cuenta se hacía con los $899 de fábrica.
  const base = (await planVigentePorNivel(nivel)).precioMXN
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
  // E0-07: declarada como `administrar` en REGISTRO_RUTAS, pero SIN activar todavía:
  // cerrar el estado de asientos a medico/admin estrecha el acceso de usuarios
  // reales y eso lo decide el médico dueño, no esta unidad.
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso.response
  return NextResponse.json({ ok: true, ...(await estado(clinicId)) })
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const clinicId = body.clinicId ?? ''
  if (!clinicId) return NextResponse.json({ ok: false, error: 'Falta clinicId' }, { status: 400 })
  // E0-07: era `verificarMedico`; `administrar` es el mismo conjunto {medico, admin}.
  const acceso = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acceso.ok) return acceso.response

  try {
    const st = await estado(clinicId)
    if (!st.conAsientos) return NextResponse.json({ ok: true, ...st, aviso: 'Este plan no cobra por asiento.' })

    const extras = Math.max(0, st.medicos - 1)
    const seatPrice = priceMedicoDe(st.plan as PlanKey)

    /**
     * SI STRIPE NO SE PUEDE AJUSTAR, NO SE MARCA COMO CONTRATADO.
     *
     * `medicosContratados` se escribía SIEMPRE, fuera del `if`. Tres caminos
     * llevaban a «contratado sin cobrar»:
     *
     *  · sin `stripeSubscriptionId` (justo lo que provocaba la cancelación
     *    indebida al cambiar de plan) → se marcaban 5 médicos y Stripe cobraba 1;
     *  · sin `STRIPE_PRICE_*_MEDICO` configurado → `seatPrice` vacío, misma marca;
     *  · sin extras y sin ítem previo → no se llama a Stripe y aun así se escribía.
     *
     * Y como `requiereActualizar` es la única señal de desajuste, en cuanto se
     * escribía el número el aviso desaparecía: el desfase quedaba invisible y
     * nadie volvía a mirarlo.
     */
    let ajustadoEnStripe = false

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
      // Sin ítems que enviar (ni extras ni asiento previo) el estado en Stripe
      // ya es el correcto: no hay nada que cobrar y nada que quitar.
      ajustadoEnStripe = true
    }

    if (!ajustadoEnStripe) {
      const porQue = !st.stripeSubscriptionId
        ? 'este consultorio no tiene una suscripción activa en Stripe'
        : 'no hay precio de médico adicional configurado para este plan'
      return NextResponse.json({
        ok: false,
        error: `No se pudo actualizar el cobro de médicos adicionales: ${porQue}. No se marcan como contratados para no dejar médicos habilitados sin cobrar.`,
        ...(await estado(clinicId)),
      }, { status: 409 })
    }

    await adminDb.collection('clinics').doc(clinicId).set({ medicosContratados: st.medicos }, { merge: true })
    return NextResponse.json({ ok: true, ...(await estado(clinicId)) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 220) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30
