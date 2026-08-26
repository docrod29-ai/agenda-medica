import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * PATIENT-PORTAL-001 — `/api/portal`, `/api/public/resena` y
 * `/api/payment/create-checkout` no tenían NINGÚN `limitar*`, a diferencia de
 * sus hermanas (`telesalud/sala`: 12/600s, `public/booking`: 8/h por IP).
 *
 * ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────
 *
 * Un enlace filtrado —reenviado por WhatsApp, capturado de una URL
 * compartida, o un token de reseña adivinado por fuerza bruta— podía usarse
 * sin ningún freno: enumerar citas, mover la agenda del consultorio,
 * generar sesiones de Checkout de Stripe sin límite, o probar tokens de
 * reseña al azar.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────
 *
 * `grep -n "limitar" src/app/api/portal/route.ts` no devolvía nada, pese a
 * que la ruta hermana (`telesalud/sala`) sí lo usa desde REG-xxx. El
 * hallazgo estaba registrado en `agent-state/BACKLOG.json` (PATIENT-PORTAL-001,
 * origen: auditoría PATIENT-UX-TRUTH-001 del 8-ago-2026) y seguía `pendiente`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────
 *
 * Las tres rutas llaman a `limitarOResponder` ANTES de tocar Firestore o
 * Stripe. `/api/portal` además distingue lecturas (40/600s por paciente) de
 * mutaciones de agenda —confirmar/cancelar/reagendar— (10/600s), porque es
 * ahí donde vive el riesgo que describe el hallazgo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────
 *
 * No mide el comportamiento real de `limitar()` bajo concurrencia —eso ya
 * lo cubre `nucleo/rate-limit.test.ts`—, sólo que estas tres rutas lo
 * INVOCAN con la clave y la ventana correctas, y que un 429 corta el flujo
 * antes de escribir nada. Los umbrales (40, 10, 8, 10) son criterio, no una
 * cifra clínica: si se ajustan, este archivo no necesita cambiar salvo que
 * cambie también el número que afirma.
 */

const limitarOResponderMock = vi.fn(async (_clave: string, _max: number, _ventanaSeg: number, _mensaje?: string) => null as unknown)
vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: (...args: [string, number, number, string?]) => limitarOResponderMock(...args),
}))

// ── Dobles del Admin SDK — sólo lo que cada ruta necesita para llegar hasta
//    el punto donde se decide si hay cupo ──────────────────────────────────
const getPatient = vi.fn()
const getCitas = vi.fn()
const getConfig = vi.fn()
const getClinicDoc = vi.fn()
const updateCita = vi.fn()
const runTransactionMock = vi.fn()
const getResenaRequest = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: { firestore: { FieldValue: { increment: () => 'inc' } } },
  adminDb: {
    runTransaction: (fn: (tx: unknown) => unknown) => runTransactionMock(fn),
    collection: (top: string) => {
      if (top === 'clinic_review_requests') {
        return { doc: (id: string) => ({ __ref: 'resena', id }) }
      }
      return {
        doc: () => ({
          get: getClinicDoc,
          collection: (sub: string) => {
            if (sub === 'appointments') {
              return {
                where: () => ({ get: getCitas }),
                doc: () => ({ get: getCitas, update: updateCita }),
              }
            }
            if (sub === 'config') return { doc: () => ({ get: getConfig }) }
            if (sub === 'patients') {
              return { doc: () => ({ get: getPatient, collection: () => ({ where: () => ({ get: getCitas }) }) }) }
            }
            if (sub === 'reviews') return { doc: () => ({ __ref: 'review' }) }
            throw new Error(`subcolección inesperada en el test: ${sub}`)
          },
        }),
      }
    },
  },
}))

vi.mock('@/lib/stripe', () => ({ stripe: { checkout: { sessions: { create: vi.fn() } } } }))

import { POST as portalPOST } from '@/app/api/portal/route'
import { POST as pagoPOST } from '@/app/api/payment/create-checkout/route'
import { POST as resenaPOST } from '@/app/api/public/resena/route'
import { crearTokenPaciente } from '@/lib/patient-token'

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'

function reqPortal(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof portalPOST>[0]
}
function reqPago(body: unknown, ip = '203.0.113.9') {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as Parameters<typeof pagoPOST>[0]
}
function reqResena(body: unknown, ip = '203.0.113.9') {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as Parameters<typeof resenaPOST>[0]
}

beforeEach(() => {
  limitarOResponderMock.mockReset()
  limitarOResponderMock.mockResolvedValue(null) // cupo disponible por defecto
  getPatient.mockReset().mockResolvedValue({ exists: true, data: () => ({}) })
  getCitas.mockReset().mockResolvedValue({ docs: [] })
  getConfig.mockReset().mockResolvedValue({ exists: false })
  getClinicDoc.mockReset().mockResolvedValue({ exists: true, data: () => ({ nombreClinica: 'Clínica Ficticia' }) })
  updateCita.mockReset().mockResolvedValue(undefined)
  runTransactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    get: async () => ({ exists: true, data: () => ({ used: false, clinicId: CLINICA }) }),
    set: vi.fn(),
    update: vi.fn(),
  }))
  getResenaRequest.mockReset()
})

describe('PATIENT-PORTAL-001 · `/api/portal` llama al limitador antes de todo', () => {
  it('con cupo disponible, la sesión sigue funcionando (no rompe el flujo real)', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(200)
    expect(limitarOResponderMock).toHaveBeenCalledWith(
      `portal:${CLINICA}:${PACIENTE}`, 40, 600, expect.any(String),
    )
  })

  it('AL REVÉS: si el limitador dice que no hay cupo, la ruta devuelve 429 y no llega a leer citas', async () => {
    limitarOResponderMock.mockImplementation(async (clave: string) =>
      clave === `portal:${CLINICA}:${PACIENTE}`
        ? new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown
        : null,
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(429)
    expect(getCitas).not.toHaveBeenCalled()
  })

  it('confirmar/cancelar/reagendar pasan además por el límite ESTRECHO de mutación', async () => {
    getCitas.mockResolvedValueOnce({ exists: true, data: () => ({ pacienteId: PACIENTE, estado: 'pendiente-confirmar' }) })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    await portalPOST(reqPortal({ action: 'confirmar', token, citaId: 'c1' }))
    const claves = limitarOResponderMock.mock.calls.map(c => c[0])
    expect(claves).toContain(`portal:${CLINICA}:${PACIENTE}`)
    expect(claves).toContain(`portal:mutacion:${CLINICA}:${PACIENTE}`)
    const llamadaMutacion = limitarOResponderMock.mock.calls.find(c => c[0] === `portal:mutacion:${CLINICA}:${PACIENTE}`)
    expect(llamadaMutacion?.[1]).toBe(10)
    expect(llamadaMutacion?.[2]).toBe(600)
  })

  it('una lectura simple (`session`) NO consume el cupo estrecho de mutación', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    await portalPOST(reqPortal({ action: 'session', token }))
    const claves = limitarOResponderMock.mock.calls.map(c => c[0])
    expect(claves).not.toContain(`portal:mutacion:${CLINICA}:${PACIENTE}`)
  })

  it('AL REVÉS: si el límite de mutación se agota, cancelar NO escribe en Firestore', async () => {
    getCitas.mockResolvedValueOnce({ exists: true, data: () => ({ pacienteId: PACIENTE, estado: 'pendiente-confirmar', fechaHora: '2099-01-01 10:00' }) })
    limitarOResponderMock.mockImplementation(async (clave: string) =>
      clave === `portal:mutacion:${CLINICA}:${PACIENTE}`
        ? new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown
        : null,
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'cancelar', token, citaId: 'c1' }))
    expect(res.status).toBe(429)
    expect(updateCita).not.toHaveBeenCalled()
  })
})

describe('PATIENT-PORTAL-001 · `/api/payment/create-checkout` llama al limitador', () => {
  it('con cupo disponible sigue creando la sesión de pago', async () => {
    getCitas.mockResolvedValueOnce({ exists: true, data: () => ({ pacienteId: PACIENTE, pagoMonto: 200 }) })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    await pagoPOST(reqPago({ token, citaId: 'c1' }))
    expect(limitarOResponderMock).toHaveBeenCalledWith(
      `pago:${CLINICA}:${PACIENTE}`, 8, 600, expect.any(String),
    )
  })

  it('AL REVÉS: sin cupo, no se llega a crear la cita en `pendiente-pago`', async () => {
    limitarOResponderMock.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown)
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await pagoPOST(reqPago({ token, citaId: 'c1' }))
    expect(res.status).toBe(429)
    expect(getCitas).not.toHaveBeenCalled()
  })
})

describe('PATIENT-PORTAL-001 · `/api/public/resena` limita por IP (endpoint sin sesión)', () => {
  it('con cupo disponible, la reseña se sigue creando (no rompe el flujo real)', async () => {
    const res = await resenaPOST(reqResena({ token: 'tok-valido', rating: 5, texto: 'excelente' }))
    expect(res.status).toBe(200)
    expect(limitarOResponderMock).toHaveBeenCalledWith(
      'resena:ip:203.0.113.9', 10, 3600, expect.any(String),
    )
  })

  it('AL REVÉS: sin cupo por IP, no se abre ninguna transacción de Firestore', async () => {
    limitarOResponderMock.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown)
    const res = await resenaPOST(reqResena({ token: 'tok-valido', rating: 5, texto: 'excelente' }))
    expect(res.status).toBe(429)
    expect(runTransactionMock).not.toHaveBeenCalled()
  })

  it('la clave de límite es por IP, no por token: dos tokens desde la misma IP comparten cupo', async () => {
    await resenaPOST(reqResena({ token: 'tok-a', rating: 4, texto: '' }))
    await resenaPOST(reqResena({ token: 'tok-b', rating: 5, texto: '' }))
    const claves = limitarOResponderMock.mock.calls.map(c => c[0])
    expect(claves).toEqual(['resena:ip:203.0.113.9', 'resena:ip:203.0.113.9'])
  })
})
