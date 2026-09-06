/**
 * REP-002 — N-001 · Cambiar de plan cancela la suscripción anterior SIN
 * prorrateo, sin nota de crédito y sin dejar constancia del saldo perdido.
 *
 * TIPO DE PRUEBA: **de comportamiento**. Se importa la ruta real
 * `src/app/api/stripe/webhook/route.ts` con Stripe y Firebase Admin doblados,
 * se le entrega un `checkout.session.completed` sintético y se observa QUÉ le
 * pide a Stripe y QUÉ escribe en la clínica. No es un `readFileSync` + regex.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 *
 * Consultorio sintético en Clínica ANUAL, pagada entera en enero. En marzo
 * pulsa «Elegir Plan Pro»: el checkout abre una suscripción NUEVA y la cobra
 * completa. Al llegar `checkout.session.completed`, `cancelarOtrasSuscripciones`
 * hace `stripe.subscriptions.cancel(s.id)` a secas (route.ts:216): sin
 * `prorate`, sin `invoice_now`, sin nota de crédito, sin escribir nada en
 * `clinics/{id}`. Diez meses pagados desaparecen y ninguna pantalla lo dice.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09, auditor N-negocio, hallazgo N-001 (P0, severidad 4).
 * Confirmado por el equipo rojo (R-N-negocio): el ÚNICO `proration_behavior`
 * del repo vive en el ajuste de asientos, nunca en el cambio de plan. Ver
 * `crudos/N-negocio.json` y `crudos/R-N-negocio.json`. El comentario de
 * `configuracion/page.tsx:1782` describe este daño y sólo se reparó la mitad
 * (el ciclo viaja; el dinero no vuelve).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * El cambio de plan se implementó como «alta nueva + cancelación de lo demás»
 * en vez de `subscriptions.update(..., { proration_behavior })`. Y la
 * cancelación que compensa el empalme no pide a Stripe el prorrateo que Stripe
 * SÍ sabe hacer (`cancel(id, { prorate: true, invoice_now: true })`).
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Cualquiera de estas tres deja de hacer fallar la prueba, y las tres son
 * defendibles (la decisión entre ellas es del dueño):
 *   (a) `subscriptions.cancel(id, { prorate: true … })` o `invoice_now`;
 *   (b) `subscriptions.update(id, { …, proration_behavior: 'create_prorations' })`
 *       en lugar de cancelar;
 *   (c) un abono explícito (`creditNotes.create`, `customers.createBalanceTransaction`)
 *       o una escritura en `clinics/{id}` que deje constancia del crédito.
 * Lo que no es defendible es el estado actual: ninguna de las tres.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 *   · La propuesta (a) del auditor —que `/api/stripe/checkout` no abra una
 *     sesión nueva cuando ya hay `stripeSubscriptionId`— vive en OTRA ruta.
 *     Esta prueba mide el webhook: aunque se arregle el checkout, dos
 *     suscripciones activas siguen pudiendo coexistir (portal de Stripe,
 *     carrera) y el webhook debe compensar bien.
 *   · No comprueba que Stripe ACEPTE los parámetros («el dato tiene que
 *     LLEGAR»): eso exige mirar la respuesta real del proveedor, fuera de CI.
 *   · No cubre mensual→anual ni el cambio hecho desde el portal de Stripe.
 *   · No mide cuánto se abona: no hay cifra que verificar sin inventarla.
 *
 * Estado al escribirla (6-sep-2026): FALLA con el código tal cual está.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ── Doble de Stripe que GRABA cualquier llamada, por su ruta ─────────────────
 * Un mock con métodos fijos sólo ve el arreglo que uno imaginó. Éste registra
 * `subscriptions.cancel`, `subscriptions.update`, `creditNotes.create`,
 * `customers.createBalanceTransaction`… lo que sea, con sus argumentos. */
const { llamadasStripe, respuestasStripe, escriturasClinica, datosFirestore } = vi.hoisted(() => ({
  llamadasStripe: [] as { ruta: string; args: unknown[] }[],
  respuestasStripe: {} as Record<string, (...a: unknown[]) => unknown>,
  escriturasClinica: [] as { ruta: string; op: string; datos: unknown }[],
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
  return {
    stripe: doble(''),
    nivelDePlan: () => 'premium',
    STRIPE_PRICES: { agenda: 'price_agenda', clinica: 'price_clinica', premium: 'price_premium', hospital: 'price_hospital' },
    STRIPE_PRICES_ANUAL: { agenda: 'price_agenda_anual', clinica: 'price_clinica_anual', premium: 'price_premium_anual', hospital: 'price_hospital_anual' },
  }
})

/* ── Doble de Firestore Admin: lecturas desde `datosFirestore`, escrituras grabadas ── */
vi.mock('@/lib/firebase-admin', () => {
  const snapshot = (ruta: string) => ({
    exists: ruta in datosFirestore,
    id: ruta.split('/').pop(),
    data: () => datosFirestore[ruta],
    get: (k: string) => datosFirestore[ruta]?.[k],
  })
  const documento = (ruta: string): unknown => ({
    id: ruta.split('/').pop(),
    get: async () => snapshot(ruta),
    update: async (d: unknown) => { escriturasClinica.push({ ruta, op: 'update', datos: d }) },
    set: async (d: unknown) => { escriturasClinica.push({ ruta, op: 'set', datos: d }) },
    create: async (d: unknown) => { escriturasClinica.push({ ruta, op: 'create', datos: d }) },
    delete: async () => { escriturasClinica.push({ ruta, op: 'delete', datos: null }) },
    collection: (sub: string) => coleccion(`${ruta}/${sub}`),
  })
  const coleccion = (ruta: string): unknown => ({
    doc: (id: string) => documento(`${ruta}/${id}`),
    add: async (d: unknown) => { escriturasClinica.push({ ruta, op: 'add', datos: d }); return { id: 'nuevo' } },
    where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
  })
  return {
    default: { firestore: { FieldValue: { increment: (n: number) => n } } },
    adminDb: { collection: (top: string) => coleccion(top) },
  }
})

vi.mock('@/lib/ai-keys', () => ({
  guardarNivelIA: async () => undefined,
  agregarCreditosExtra: async () => undefined,
}))

import { POST } from '@/app/api/stripe/webhook/route'

const CLINICA = 'clinica-sintetica-n001'
const CLIENTE = 'cus_sintetico_n001'
const SUB_ANUAL_ANTERIOR = 'sub_sintetica_clinica_anual'
const SUB_NUEVA = 'sub_sintetica_pro_anual'

function eventoCheckoutCompletado() {
  return {
    id: 'evt_sintetico_n001',
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        id: 'cs_sintetico_n001',
        mode: 'subscription',
        customer: CLIENTE,
        subscription: SUB_NUEVA,
        metadata: { clinicId: CLINICA, plan: 'premium', ciclo: 'anual' },
      },
    },
  }
}

function peticion() {
  return {
    text: async () => '{}',
    headers: new Headers({ 'stripe-signature': 'firma-sintetica' }),
  } as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  llamadasStripe.length = 0
  escriturasClinica.length = 0
  for (const k of Object.keys(respuestasStripe)) delete respuestasStripe[k]
  for (const k of Object.keys(datosFirestore)) delete datosFirestore[k]

  datosFirestore[`clinics/${CLINICA}`] = {
    plan: 'clinica', ciclo: 'anual', status: 'active',
    stripeCustomerId: CLIENTE, stripeSubscriptionId: SUB_ANUAL_ANTERIOR,
    pruebaEstrenadaEn: '2026-01-05T00:00:00.000Z',
  }
  respuestasStripe['webhooks.constructEvent'] = () => eventoCheckoutCompletado()
  respuestasStripe['subscriptions.list'] = (params: unknown) => {
    const p = params as { status?: string }
    return Promise.resolve({
      data: p.status === 'active'
        ? [
            { id: SUB_ANUAL_ANTERIOR, status: 'active', customer: CLIENTE },
            { id: SUB_NUEVA, status: 'active', customer: CLIENTE },
          ]
        : [],
    })
  }
  respuestasStripe['subscriptions.retrieve'] = () =>
    Promise.resolve({ id: SUB_NUEVA, trial_start: null, trial_end: null })
  respuestasStripe['subscriptions.cancel'] = (id: unknown) =>
    Promise.resolve({ id, status: 'canceled' })
})

const llamadasA = (ruta: string) => llamadasStripe.filter(l => l.ruta === ruta)

describe('REP-002 · N-001 — al cambiar de plan, la suscripción anterior no se cancela sin abono', () => {
  it('control: el webhook activa el plan nuevo y cancela la suscripción anterior (el camino se recorre)', async () => {
    const res = await POST(peticion())
    expect(res.status).toBe(200)
    expect(escriturasClinica.some(e => e.ruta === `clinics/${CLINICA}` && (e.datos as { plan?: string })?.plan === 'premium')).toBe(true)
    const cancelaciones = llamadasA('subscriptions.cancel')
    expect(cancelaciones.map(c => c.args[0])).toContain(SUB_ANUAL_ANTERIOR)
    expect(cancelaciones.map(c => c.args[0])).not.toContain(SUB_NUEVA)
  })

  it('FALLA HOY · la cancelación lleva prorrateo, o se sustituye por un update con proration_behavior, o se asienta un abono', async () => {
    await POST(peticion())

    const cancelaciones = llamadasA('subscriptions.cancel').filter(c => c.args[0] === SUB_ANUAL_ANTERIOR)
    const cancelaConProrrateo = cancelaciones.some(c => {
      const opciones = c.args[1] as { prorate?: boolean; invoice_now?: boolean } | undefined
      return opciones?.prorate === true || opciones?.invoice_now === true
    })

    const actualizaEnVezDeCancelar = llamadasA('subscriptions.update').some(c =>
      c.args[0] === SUB_ANUAL_ANTERIOR &&
      typeof (c.args[1] as { proration_behavior?: string } | undefined)?.proration_behavior === 'string' &&
      (c.args[1] as { proration_behavior?: string }).proration_behavior !== 'none',
    )

    const abonoEnStripe = llamadasStripe.some(l =>
      /^(creditNotes|customers\.createBalanceTransaction|invoiceItems)/.test(l.ruta),
    )

    const constanciaEnClinica = escriturasClinica.some(e =>
      e.ruta.startsWith(`clinics/${CLINICA}`) &&
      /cr[eé]dito|abono|prorrate|saldoAFavor/i.test(JSON.stringify(e.datos ?? {})),
    )

    // Lo que se vio, para que el rojo explique solo:
    const visto = { cancelaConProrrateo, actualizaEnVezDeCancelar, abonoEnStripe, constanciaEnClinica }
    expect(visto, `hoy: ${JSON.stringify(visto)} · cancel se llamó con ${JSON.stringify(cancelaciones.map(c => c.args))}`)
      .toSatisfy((v: typeof visto) => v.cancelaConProrrateo || v.actualizaEnVezDeCancelar || v.abonoEnStripe || v.constanciaEnClinica)
  })
})
