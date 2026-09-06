/**
 * REP-003 — N-002 · El anticipo del paciente se cobra en la cuenta de Stripe
 * de la PLATAFORMA y el webhook lo asienta como cobro del consultorio.
 *
 * TIPO DE PRUEBA: **de comportamiento**. Se importa la ruta real
 * `src/app/api/payment/create-checkout/route.ts` con Stripe, Firebase Admin, el
 * limitador y la vigencia del enlace doblados; se le manda la petición de un
 * paciente sintético y se observa CÓMO abre la sesión de Checkout. No es un
 * `readFileSync` + regex.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 *
 * `stripe.checkout.sessions.create({ mode: 'payment', … })` (route.ts:103) se
 * llama sobre el singleton de `STRIPE_SECRET_KEY` (`src/lib/stripe.ts`), o sea
 * la cuenta de la plataforma, sin `stripeAccount` (cabecera Connect), sin
 * `transfer_data`, sin `on_behalf_of`, sin `application_fee_amount`. El dinero
 * del paciente queda en el balance de la plataforma; después el webhook lo
 * escribe en `clinics/{id}/cobros` con `metodo: 'stripe'` y el corte de caja
 * lo suma como dinero que el médico nunca recibió.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09, auditor N-negocio, hallazgo N-002 (P0, severidad 5).
 * Confirmado por el equipo rojo (R-N-negocio): grep de
 * `transfer_data|on_behalf_of|stripeAccount|application_fee|payout|transfers.create|
 * accounts.create|liquidac` en todo `src/` → cero resultados; la única mención
 * es `docs/pendientes-externos.md` («para cobrar por consultorio, Stripe
 * Connect») como pendiente externo. Ver `crudos/N-negocio.json` y
 * `crudos/R-N-negocio.json`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * Se reutilizó el cliente de Stripe de la SUSCRIPCIÓN del médico (ingreso
 * legítimo de la plataforma) para un cobro cuyo acreedor es el consultorio, sin
 * ningún mecanismo de liquidación ni bandera que lo apague mientras no exista.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Toda sesión de Checkout de tipo `paciente_anticipo` se abre EN la cuenta del
 * consultorio (`stripeAccount` en las opciones de la llamada) o CON destino al
 * consultorio (`payment_intent_data.transfer_data.destination` /
 * `on_behalf_of`); y mientras eso no exista, la ruta NO abre la sesión
 * (409 tras una bandera apagada). Connect o link propio: decisión del dueño.
 * Lo que no es defendible es cobrar dinero ajeno en cuenta propia.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 *   · El asiento del webhook (`clinics/{id}/cobros`, `metodo: 'stripe'`): es la
 *     segunda mitad del hallazgo y depende de la decisión (Connect → cobro
 *     liquidado; link propio → «declarado por el consultorio»). Se mide aquí
 *     sólo el origen: dónde se abre el cobro.
 *   · Las membresías de pacientes (`lib/membresias.ts`, ventanilla) ni la
 *     suscripción del médico (ingreso legítimo de la plataforma).
 *   · No comprueba que Stripe ACEPTE la cuenta conectada («el dato tiene que
 *     LLEGAR»): eso es contra el proveedor real, fuera de CI.
 *   · El nombre del campo de la clínica con su cuenta conectada aún no existe;
 *     el doble expone `stripeAccountId` como sugerencia, pero la prueba NO lo
 *     exige: acepta cualquier llamada que lleve `stripeAccount`, `transfer_data`
 *     u `on_behalf_of`, o un 409.
 *
 * Estado al escribirla (6-sep-2026): FALLA con el código tal cual está.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { llamadasStripe, respuestasStripe, escrituras, datosFirestore } = vi.hoisted(() => ({
  llamadasStripe: [] as { ruta: string; args: unknown[] }[],
  respuestasStripe: {} as Record<string, (...a: unknown[]) => unknown>,
  escrituras: [] as { ruta: string; op: string; datos: unknown }[],
  datosFirestore: {} as Record<string, Record<string, unknown>>,
}))

/* Doble de Stripe que graba cualquier llamada por su ruta (ver REP-002). */
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
  return { stripe: doble('') }
})

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
    update: async (d: unknown) => { escrituras.push({ ruta, op: 'update', datos: d }) },
    set: async (d: unknown) => { escrituras.push({ ruta, op: 'set', datos: d }) },
    collection: (sub: string) => coleccion(`${ruta}/${sub}`),
  })
  const coleccion = (ruta: string): unknown => ({
    doc: (id: string) => documento(`${ruta}/${id}`),
    where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
  })
  return {
    default: { firestore: { FieldValue: { increment: (n: number) => n } } },
    adminDb: { collection: (top: string) => coleccion(top) },
  }
})

/* Cupo disponible y enlace vigente: no es lo que se mide aquí. */
vi.mock('@/lib/rate-limit', () => ({
  limitarEstricto: async () => null,
  limitarOResponder: async () => null,
}))
vi.mock('@/lib/portal/vigencia-del-enlace', () => ({
  bloquearSiNoVigente: async () => null,
}))

import { POST } from '@/app/api/payment/create-checkout/route'
import { crearTokenPaciente } from '@/lib/patient-token'

const CLINICA = 'clinica-sintetica-n002'
const PACIENTE = 'pac-sintetico-n002'
const CITA = 'cita-sintetica-n002'

function peticion(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': '203.0.113.42' }),
  } as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  llamadasStripe.length = 0
  escrituras.length = 0
  for (const k of Object.keys(respuestasStripe)) delete respuestasStripe[k]
  for (const k of Object.keys(datosFirestore)) delete datosFirestore[k]

  datosFirestore[`clinics/${CLINICA}`] = {
    nombreClinica: 'Consultorio Sintético',
    // Sugerencia de dónde viviría la cuenta conectada; la prueba no exige el nombre.
    stripeAccountId: 'acct_sintetico_consultorio',
  }
  datosFirestore[`clinics/${CLINICA}/config/main`] = { anticipoMonto: 200, anticipoLink: 'https://buy.stripe.test/link-del-consultorio' }
  datosFirestore[`clinics/${CLINICA}/appointments/${CITA}`] = { pacienteId: PACIENTE, pagoMonto: 800, estado: 'confirmada' }

  respuestasStripe['checkout.sessions.create'] = () =>
    Promise.resolve({ id: 'cs_sintetico_n002', url: 'https://checkout.stripe.test/cs_sintetico_n002' })
})

describe('REP-003 · N-002 — el anticipo del paciente no se cobra en la cuenta de la plataforma', () => {
  it('control: con token válido y monto configurado, la ruta llega a abrir la sesión de Checkout', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await POST(peticion({ token, citaId: CITA }))
    const sesiones = llamadasStripe.filter(l => l.ruta === 'checkout.sessions.create')
    // O abre la sesión (200) o la rechaza a propósito (409). Cualquier otra cosa es
    // un import roto o un doble mal armado, no el hallazgo.
    expect([200, 409]).toContain(res.status)
    if (res.status === 200) {
      expect(sesiones.length).toBe(1)
      expect((sesiones[0].args[0] as { metadata?: { tipo?: string } })?.metadata?.tipo).toBe('paciente_anticipo')
    }
  })

  it('FALLA HOY · la sesión se abre en la cuenta del consultorio, con destino al consultorio, o no se abre (409)', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await POST(peticion({ token, citaId: CITA }))

    const rechazadaPorBandera = res.status === 409

    const sesiones = llamadasStripe.filter(l => l.ruta === 'checkout.sessions.create')
    const enCuentaDelConsultorio = sesiones.some(s => {
      const params = s.args[0] as {
        payment_intent_data?: { transfer_data?: { destination?: string }; on_behalf_of?: string; application_fee_amount?: number }
        on_behalf_of?: string
      } | undefined
      const opciones = s.args[1] as { stripeAccount?: string } | undefined
      return Boolean(
        opciones?.stripeAccount ||
        params?.payment_intent_data?.transfer_data?.destination ||
        params?.payment_intent_data?.on_behalf_of ||
        params?.on_behalf_of,
      )
    })

    const visto = { status: res.status, rechazadaPorBandera, enCuentaDelConsultorio, sesionesAbiertas: sesiones.length }
    expect(visto, `hoy: ${JSON.stringify(visto)} · create se llamó con ${JSON.stringify(sesiones.map(s => s.args))}`)
      .toSatisfy((v: typeof visto) => v.rechazadaPorBandera || v.enCuentaDelConsultorio)
  })
})
