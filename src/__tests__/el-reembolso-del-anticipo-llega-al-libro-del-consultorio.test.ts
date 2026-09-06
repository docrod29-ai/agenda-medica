/**
 * EL REEMBOLSO EN STRIPE DE UN ANTICIPO LLEGA AL LIBRO DEL CONSULTORIO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `charge.refunded` buscaba la clínica por `stripeCustomerId` —que un Checkout
 * de anticipo no tiene— y escribía en `platform_payments`. El cobro del
 * paciente en `clinics/{id}/cobros` seguía vivo como PAYMENT y la cita seguía
 * «pagada»: el corte sumaba dinero ya devuelto.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Panel de Lujo 2026-09, auditor AS-cobros, hallazgo ASC-005 (P2); el equipo
 * rojo siguió el webhook entero y comprobó que la rama de reembolso no escribe
 * en `cobros` ni en la cita.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El manejador de reembolsos se escribió para la suscripción del médico (dinero
 * de la plataforma) antes de que existiera el anticipo del paciente, y nadie lo
 * bifurcó cuando el anticipo empezó a asentarse en el libro del consultorio.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * Un cargo con `metadata.tipo = 'paciente_anticipo'` es dinero del consultorio:
 * su devolución se asienta como `tipo: 'REFUND'` con `cobroOriginalId`,
 * idempotente por cargo; una devolución total libera la cita. REG-015 dejó
 * declarado el REFUND tipado; ésta es su primera pieza, la automática.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * Pura sobre `decidirReembolsoDelAnticipo` + comportamiento sobre el webhook
 * real con Stripe y Firebase Admin doblados (el doble sabe responder una
 * consulta `where` sobre `cobros`).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No comprueba que Stripe copie los metadatos del PaymentIntent al cargo (el
 * dato tiene que llegar: se mira contra el proveedor real). No cubre el
 * reembolso de ventanilla (`registrarReembolso`, probado aparte).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decidirReembolsoDelAnticipo } from '@/lib/finanzas/reembolso-del-anticipo'

const { llamadasStripe, respuestasStripe, escrituras, datosFirestore } = vi.hoisted(() => ({
  llamadasStripe: [] as { ruta: string; args: unknown[] }[],
  respuestasStripe: {} as Record<string, (...a: unknown[]) => unknown>,
  escrituras: [] as { ruta: string; op: string; datos: Record<string, unknown> }[],
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
    STRIPE_PRICES: { agenda: '', clinica: '', premium: '', hospital: '' },
    STRIPE_PRICES_ANUAL: { agenda: '', clinica: '', premium: '', hospital: '' },
  }
})
vi.mock('@/lib/firebase-admin', () => {
  const snapshot = (ruta: string) => ({ exists: ruta in datosFirestore, id: ruta.split('/').pop(), data: () => datosFirestore[ruta], get: (k: string) => datosFirestore[ruta]?.[k] })
  const escribir = (ruta: string, op: string, d: Record<string, unknown>) => {
    escrituras.push({ ruta, op, datos: d })
    datosFirestore[ruta] = op === 'set' ? { ...(datosFirestore[ruta] ?? {}), ...d } : { ...(datosFirestore[ruta] ?? {}), ...d }
  }
  const documento = (ruta: string): unknown => ({
    id: ruta.split('/').pop(),
    get: async () => snapshot(ruta),
    update: async (d: Record<string, unknown>) => escribir(ruta, 'update', d),
    set: async (d: Record<string, unknown>) => escribir(ruta, 'set', d),
    create: async (d: Record<string, unknown>) => escribir(ruta, 'create', d),
    collection: (sub: string) => coleccion(`${ruta}/${sub}`),
  })
  const coleccion = (ruta: string): unknown => ({
    doc: (id: string) => documento(`${ruta}/${id}`),
    where: (campo: string, _op: string, valor: unknown) => ({
      limit: () => ({
        get: async () => {
          const docs = Object.entries(datosFirestore)
            .filter(([p, d]) => p.startsWith(`${ruta}/`) && !p.slice(ruta.length + 1).includes('/') && d[campo] === valor)
            .map(([p]) => snapshot(p))
          return { empty: docs.length === 0, docs }
        },
      }),
    }),
  })
  return {
    default: { firestore: { FieldValue: { increment: (n: number) => n } } },
    adminDb: { collection: (top: string) => coleccion(top) },
  }
})
vi.mock('@/lib/ai-keys', () => ({ guardarNivelIA: async () => undefined, agregarCreditosExtra: async () => undefined }))

import { POST } from '@/app/api/stripe/webhook/route'

const CLINICA = 'clinica-sintetica-refund'
const CITA = 'cita-sintetica-refund'
const SESION = 'cs_sintetica_refund'
const PI = 'pi_sintetico_refund'
const CARGO = 'ch_sintetico_refund'

function eventoReembolso(extra: Record<string, unknown> = {}) {
  return {
    id: 'evt_refund', type: 'charge.refunded', livemode: false, created: 1_790_000_000,
    data: { object: {
      id: CARGO, amount: 20000, amount_refunded: 20000, refunded: true, currency: 'mxn',
      payment_intent: PI, customer: null,
      metadata: { clinicId: CLINICA, citaId: CITA, tipo: 'paciente_anticipo' },
      refunds: { data: [{ created: 1_790_000_100 }] },
      created: 1_789_000_000,
      ...extra,
    } },
  }
}
const peticion = () => ({ text: async () => '{}', headers: new Headers({ 'stripe-signature': 'x' }) }) as unknown as Parameters<typeof POST>[0]

beforeEach(() => {
  llamadasStripe.length = 0
  escrituras.length = 0
  for (const k of Object.keys(respuestasStripe)) delete respuestasStripe[k]
  for (const k of Object.keys(datosFirestore)) delete datosFirestore[k]
  datosFirestore[`clinics/${CLINICA}`] = { zonaHoraria: 'America/Mexico_City' }
  datosFirestore[`clinics/${CLINICA}/cobros/stripe_${SESION}`] = {
    tipo: 'PAYMENT', monto: 200, metodo: 'stripe', concepto: 'consulta', citaId: CITA,
    patientId: 'pac-1', patientNombre: 'Paciente Sintético', medicoId: 'd1', medicoNombre: 'Dra. Sintética',
    stripePaymentIntentId: PI, cancelado: false,
  }
  datosFirestore[`clinics/${CLINICA}/appointments/${CITA}`] = { estado: 'pagada', cobroId: `stripe_${SESION}`, cobradoEn: 'x' }
  respuestasStripe['webhooks.constructEvent'] = () => eventoReembolso()
})

describe('decidirReembolsoDelAnticipo (puro)', () => {
  it('sin metadata de anticipo no es del consultorio', () => {
    expect(decidirReembolsoDelAnticipo({ metadata: {} }).esAnticipo).toBe(false)
    expect(decidirReembolsoDelAnticipo({ metadata: { tipo: 'recarga', clinicId: 'C' } }).esAnticipo).toBe(false)
  })
  it('anticipo sin clinicId se declara, no se adivina', () => {
    expect(decidirReembolsoDelAnticipo({ metadata: { tipo: 'paciente_anticipo' } }).esAnticipo).toBe(false)
  })
  it('devolución total: monto en MXN y total=true', () => {
    const d = decidirReembolsoDelAnticipo({ metadata: { tipo: 'paciente_anticipo', clinicId: 'C', citaId: 'A' }, amount: 20000, amountRefunded: 20000, refunded: true })
    expect(d).toMatchObject({ esAnticipo: true, clinicId: 'C', citaId: 'A', monto: 200, total: true })
  })
  it('devolución parcial: total=false', () => {
    const d = decidirReembolsoDelAnticipo({ metadata: { tipo: 'paciente_anticipo', clinicId: 'C' }, amount: 20000, amountRefunded: 5000, refunded: false })
    expect(d).toMatchObject({ esAnticipo: true, monto: 50, total: false })
  })
})

describe('el webhook asienta el REFUND del anticipo en clinics/{id}/cobros', () => {
  it('escribe refund_<cargo> con tipo REFUND y traza al cobro original', async () => {
    const res = await POST(peticion())
    expect(res.status).toBe(200)
    const refund = escrituras.find(e => e.ruta === `clinics/${CLINICA}/cobros/refund_${CARGO}`)
    expect(refund, 'no se escribió el REFUND en el libro del consultorio').toBeTruthy()
    expect(refund?.datos).toMatchObject({
      tipo: 'REFUND', cobroOriginalId: `stripe_${SESION}`, monto: 200, metodo: 'stripe',
      concepto: 'reembolso', citaId: CITA, patientId: 'pac-1', medicoId: 'd1', reembolsoTotal: true, cancelado: false,
    })
    // Y NO va al libro de la plataforma.
    expect(escrituras.some(e => e.ruta.startsWith('platform_payments/'))).toBe(false)
  })

  it('la devolución TOTAL libera la cita que ese cobro tenía tomada', async () => {
    await POST(peticion())
    const cita = escrituras.find(e => e.ruta === `clinics/${CLINICA}/appointments/${CITA}`)
    expect(cita?.datos).toMatchObject({ cobroId: '', cobradoEn: '' })
    expect(String(cita?.datos.reembolsadoEn)).toMatch(/^\d{4}-/)
  })

  it('la devolución PARCIAL asienta el REFUND y conserva el cobro de la cita', async () => {
    respuestasStripe['webhooks.constructEvent'] = () => eventoReembolso({ amount_refunded: 5000, refunded: false })
    await POST(peticion())
    const refund = escrituras.find(e => e.ruta === `clinics/${CLINICA}/cobros/refund_${CARGO}`)
    expect(refund?.datos).toMatchObject({ tipo: 'REFUND', monto: 50, reembolsoTotal: false })
    expect(escrituras.some(e => e.ruta === `clinics/${CLINICA}/appointments/${CITA}`)).toBe(false)
  })

  it('si el cobro no tiene el PaymentIntent guardado, se resuelve por la sesión de Checkout en Stripe', async () => {
    delete (datosFirestore[`clinics/${CLINICA}/cobros/stripe_${SESION}`] as Record<string, unknown>).stripePaymentIntentId
    respuestasStripe['checkout.sessions.list'] = () => Promise.resolve({ data: [{ id: SESION }] })
    await POST(peticion())
    expect(llamadasStripe.some(l => l.ruta === 'checkout.sessions.list')).toBe(true)
    const refund = escrituras.find(e => e.ruta === `clinics/${CLINICA}/cobros/refund_${CARGO}`)
    expect(refund?.datos).toMatchObject({ cobroOriginalId: `stripe_${SESION}`, huerfano: false })
  })

  it('sin cobro original localizable, el REFUND queda en el libro del consultorio marcado huérfano (visible, no perdido)', async () => {
    delete datosFirestore[`clinics/${CLINICA}/cobros/stripe_${SESION}`]
    respuestasStripe['checkout.sessions.list'] = () => Promise.resolve({ data: [] })
    await POST(peticion())
    const refund = escrituras.find(e => e.ruta === `clinics/${CLINICA}/cobros/refund_${CARGO}`)
    expect(refund?.datos).toMatchObject({ tipo: 'REFUND', huerfano: true, cobroOriginalId: '' })
    expect(escrituras.some(e => e.ruta === `clinics/${CLINICA}/appointments/${CITA}`)).toBe(false)
  })

  it('probado al revés: un reembolso SIN metadata de anticipo sigue yendo a platform_payments', async () => {
    respuestasStripe['webhooks.constructEvent'] = () => eventoReembolso({ metadata: {}, customer: 'cus_medico' })
    await POST(peticion())
    expect(escrituras.some(e => e.ruta === `platform_payments/refund_${CARGO}`)).toBe(true)
    expect(escrituras.some(e => e.ruta.includes('/cobros/'))).toBe(false)
  })
})
