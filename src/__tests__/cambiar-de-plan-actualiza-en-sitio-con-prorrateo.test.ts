/**
 * CAMBIAR DE PLAN CON SUSCRIPCIÓN VIVA ACTUALIZA EN SITIO, CON PRORRATEO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `/api/stripe/checkout` abría SIEMPRE un Checkout nuevo, aunque el consultorio
 * ya tuviera `stripeSubscriptionId` vivo. El plan nuevo se cobraba entero y el
 * webhook cancelaba el anterior sin abono: diez meses anuales pagados
 * desaparecían sin nota en ninguna parte.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Panel de Lujo 2026-09, auditor N-negocio, hallazgo N-001 (P0); el equipo rojo
 * confirmó que el único `proration_behavior` del repositorio vivía en el ajuste
 * de asientos. La reproducción REP-002 mide el webhook; ésta mide la ruta que
 * el auditor pedía en su propuesta (a): que el checkout no abra sesión nueva
 * cuando ya hay suscripción.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El cambio de plan se implementó como alta nueva + cancelación, en vez de
 * `subscriptions.update(..., { proration_behavior: 'create_prorations' })`.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * Decisión por omisión PL-D2: prorrateo nativo. Con suscripción viva →
 * `update` con prorrateo y constancia en la clínica; sin ella → Checkout.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * Pura sobre `lib/finanzas/cambio-de-plan` + comportamiento sobre la ruta real
 * con Stripe, Firebase Admin y la autorización dobladas.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No comprueba que Stripe ACEPTE el `update` (el dato tiene que llegar: eso es
 * contra el proveedor real). No cubre el texto de la pantalla de configuración
 * (archivo de UI-CONFIG; ver handoff-DINERO). No mide cuánto se abona.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { elegirItemDelPlan, decidirCambioDePlan } from '@/lib/finanzas/cambio-de-plan'

const { llamadasStripe, respuestasStripe, escrituras, datosFirestore } = vi.hoisted(() => ({
  llamadasStripe: [] as { ruta: string; args: unknown[] }[],
  respuestasStripe: {} as Record<string, (...a: unknown[]) => unknown>,
  escrituras: [] as { ruta: string; op: string; datos: unknown }[],
  datosFirestore: {} as Record<string, Record<string, unknown>>,
}))

vi.mock('@/lib/stripe', () => {
  const doble = (prefijo: string): unknown => new Proxy(function () {}, {
    get: (_t, prop) => {
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      return doble(prefijo ? `${prefijo}.${String(prop)}` : String(prop))
    },
    apply: (_t, _este, args: unknown[]) => {
      llamadasStripe.push({ ruta: prefijo, args })
      const r = respuestasStripe[prefijo]
      return r ? r(...args) : Promise.resolve({})
    },
  })
  const STRIPE_PRICES = { agenda: 'price_agenda', clinica: 'price_clinica', premium: 'price_premium', hospital: 'price_hospital' }
  const STRIPE_PRICES_ANUAL = { agenda: 'price_agenda_anual', clinica: 'price_clinica_anual', premium: 'price_premium_anual', hospital: 'price_hospital_anual' }
  return {
    stripe: doble(''),
    STRIPE_PRICES, STRIPE_PRICES_ANUAL,
    priceIdDe: (plan: keyof typeof STRIPE_PRICES, ciclo: string) => ciclo === 'anual' ? STRIPE_PRICES_ANUAL[plan] : STRIPE_PRICES[plan],
  }
})
vi.mock('@/lib/firebase-admin', () => {
  const snapshot = (ruta: string) => ({ exists: ruta in datosFirestore, id: ruta.split('/').pop(), data: () => datosFirestore[ruta] })
  const documento = (ruta: string): unknown => ({
    id: ruta.split('/').pop(),
    get: async () => snapshot(ruta),
    update: async (d: unknown) => { escrituras.push({ ruta, op: 'update', datos: d }) },
    set: async (d: unknown) => { escrituras.push({ ruta, op: 'set', datos: d }) },
    collection: (sub: string) => coleccion(`${ruta}/${sub}`),
  })
  const coleccion = (ruta: string): unknown => ({ doc: (id: string) => documento(`${ruta}/${id}`) })
  return { adminDb: { collection: (top: string) => coleccion(top) } }
})
vi.mock('@/lib/authz/verificar', () => ({ verificarCapacidad: async () => ({ ok: true, uid: 'u1', role: 'admin' }) }))

import { POST } from '@/app/api/stripe/checkout/route'

const CLINICA = 'clinica-sintetica-cambio'
const SUB = 'sub_sintetica_viva'
const peticion = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0]
const llamadasA = (ruta: string) => llamadasStripe.filter(l => l.ruta === ruta)

beforeEach(() => {
  llamadasStripe.length = 0
  escrituras.length = 0
  for (const k of Object.keys(respuestasStripe)) delete respuestasStripe[k]
  for (const k of Object.keys(datosFirestore)) delete datosFirestore[k]
  datosFirestore[`clinics/${CLINICA}`] = {
    plan: 'clinica', ciclo: 'anual', status: 'active',
    stripeCustomerId: 'cus_sintetico', stripeSubscriptionId: SUB,
  }
  respuestasStripe['subscriptions.retrieve'] = () => Promise.resolve({
    id: SUB, status: 'active', metadata: { clinicId: CLINICA, plan: 'clinica' },
    items: { data: [
      { id: 'si_medico', price: { id: 'price_medico', nickname: 'Medico adicional' }, quantity: 2 },
      { id: 'si_plan', price: { id: 'price_clinica_anual', nickname: 'Clinica anual' }, quantity: 1 },
    ] },
  })
  respuestasStripe['subscriptions.list'] = () => Promise.resolve({ data: [] })
  respuestasStripe['checkout.sessions.create'] = () => Promise.resolve({ id: 'cs_nueva', url: 'https://checkout.stripe.test/cs_nueva' })
})

describe('decidirCambioDePlan (puro)', () => {
  const conocidos = { price_clinica: 'clinica', price_premium: 'premium', price_clinica_anual: 'clinica' } as const
  const items = [
    { id: 'si_medico', priceId: 'price_medico', quantity: 2, nickname: 'Medico adicional' },
    { id: 'si_plan', priceId: 'price_clinica_anual', quantity: 1, nickname: 'Clinica' },
  ]

  it('elige el ítem del PLAN aunque no sea el primero de la lista', () => {
    expect(elegirItemDelPlan(items, conocidos)?.id).toBe('si_plan')
  })

  it('sin precio conocido, cae al ítem de cantidad 1 que no es de médico', () => {
    expect(elegirItemDelPlan(items, {})?.id).toBe('si_plan')
  })

  it('con suscripción viva y precio distinto → actualizar en sitio', () => {
    const d = decidirCambioDePlan({ status: 'active', itemPlan: items[1], priceNuevo: 'price_premium' })
    expect(d.que).toBe('actualizar')
    if (d.que === 'actualizar') expect(d.itemId).toBe('si_plan')
  })

  it('con el mismo precio → sin cambio (no se cobra nada)', () => {
    expect(decidirCambioDePlan({ status: 'trialing', itemPlan: items[1], priceNuevo: 'price_clinica_anual' }).que).toBe('sin-cambio')
  })

  it('con la suscripción cancelada → alta nueva por Checkout', () => {
    expect(decidirCambioDePlan({ status: 'canceled', itemPlan: items[1], priceNuevo: 'price_premium' }).que).toBe('alta-nueva')
    expect(decidirCambioDePlan({ status: undefined, itemPlan: items[1], priceNuevo: 'price_premium' }).que).toBe('alta-nueva')
  })

  it('viva pero sin ítem reconocible → alta nueva, no se adivina', () => {
    expect(decidirCambioDePlan({ status: 'active', itemPlan: undefined, priceNuevo: 'price_premium' }).que).toBe('alta-nueva')
  })
})

describe('la ruta /api/stripe/checkout con suscripción viva', () => {
  it('actualiza el ítem del plan con proration_behavior y NO abre un Checkout nuevo', async () => {
    const res = await POST(peticion({ clinicId: CLINICA, plan: 'premium', email: 'x@sintetico.test', ciclo: 'anual' }))
    expect(res.status).toBe(200)
    const cuerpo = await res.json() as { cambioEnSitio?: boolean; url?: string }
    expect(cuerpo.cambioEnSitio).toBe(true)
    expect(cuerpo.url).toContain('/dashboard?checkout=success')

    const updates = llamadasA('subscriptions.update')
    expect(updates).toHaveLength(1)
    expect(updates[0].args[0]).toBe(SUB)
    const params = updates[0].args[1] as { items: { id: string; price: string }[]; proration_behavior: string }
    expect(params.proration_behavior).toBe('create_prorations')
    expect(params.items).toEqual([{ id: 'si_plan', price: 'price_premium_anual' }])
    expect(llamadasA('checkout.sessions.create')).toHaveLength(0)
  })

  it('deja constancia del cambio y del crédito en clinics/{id}', async () => {
    await POST(peticion({ clinicId: CLINICA, plan: 'premium', email: 'x@sintetico.test', ciclo: 'anual' }))
    const constancia = escrituras.find(e => e.ruta === `clinics/${CLINICA}` && /cambioDePlan/.test(JSON.stringify(e.datos)))
    expect(constancia, 'no quedó constancia del cambio de plan').toBeTruthy()
    expect(JSON.stringify(constancia?.datos)).toMatch(/cr[eé]dito|prorrate/i)
  })

  it('con el mismo precio no cobra ni actualiza nada', async () => {
    const res = await POST(peticion({ clinicId: CLINICA, plan: 'clinica', email: 'x@sintetico.test', ciclo: 'anual' }))
    expect((await res.json() as { sinCambio?: boolean }).sinCambio).toBe(true)
    expect(llamadasA('subscriptions.update')).toHaveLength(0)
    expect(llamadasA('checkout.sessions.create')).toHaveLength(0)
  })

  it('probado al revés: con la suscripción guardada CANCELADA, sí abre el Checkout (alta nueva)', async () => {
    respuestasStripe['subscriptions.retrieve'] = () => Promise.resolve({ id: SUB, status: 'canceled', metadata: {}, items: { data: [] } })
    const res = await POST(peticion({ clinicId: CLINICA, plan: 'premium', email: 'x@sintetico.test' }))
    expect(res.status).toBe(200)
    expect(llamadasA('subscriptions.update')).toHaveLength(0)
    expect(llamadasA('checkout.sessions.create')).toHaveLength(1)
  })

  it('sin stripeSubscriptionId no se pregunta a Stripe por ninguna suscripción: alta por Checkout', async () => {
    datosFirestore[`clinics/${CLINICA}`] = { plan: 'trial', status: 'trial', stripeCustomerId: 'cus_sintetico' }
    const res = await POST(peticion({ clinicId: CLINICA, plan: 'clinica', email: 'x@sintetico.test' }))
    expect(res.status).toBe(200)
    expect(llamadasA('subscriptions.retrieve')).toHaveLength(0)
    expect(llamadasA('checkout.sessions.create')).toHaveLength(1)
  })
})
