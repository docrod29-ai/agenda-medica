import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * PATIENT-PORTAL-001 — `/api/portal`, `/api/public/resena` y
 * `/api/payment/create-checkout` no tenían ningún `limitar*`.
 *
 * CÓMO SE ENCONTRÓ: auditoría del producto real (PATIENT-UX-TRUTH-001, V9,
 * 8-ago-2026). El token del portal viaja por WhatsApp — se reenvía, se filtra
 * con un teléfono perdido o reciclado — y con él se lee, cancela y reagenda
 * la agenda entera de un paciente sin ningún freno de tasa. `resena` y
 * `create-checkout` tampoco lo tenían: el primero es adivinable por fuerza
 * bruta del token (doc id), el segundo crea una sesión real de Stripe por
 * llamada (cuesta dinero por petición).
 *
 * CAUSA RAÍZ: `telesalud/sala` y `public/booking` sí llaman `limitarOResponder`
 * desde que se cerró el agujero de abuso ahí; estas tres rutas se quedaron
 * fuera porque nadie las revisó con el mismo criterio.
 *
 * REGLA QUE LO HACE SEGURO: las tres llaman `limitarOResponder` ANTES de
 * tocar Firestore o Stripe — si el cupo se agotó, la ruta corta ahí y no
 * gasta ni lee nada.
 *
 * QUÉ NO CUBRE: no mide el comportamiento del límite en sí (ventana, cupo,
 * fail-open) — eso ya está en `nucleo/rate-limit.test.ts`. Esto sólo prueba
 * que las tres rutas están CABLEADAS al limitador y que un 429 corta antes
 * de la escritura. Probado al revés: quitar la llamada a `limitarOResponder`
 * de cualquiera de las tres rutas hace fallar su prueba aquí (dejaría de
 * llamarse, o la ruta seguiría hasta Firestore/Stripe con el cupo agotado).
 */

const limitarOResponder = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: (...a: unknown[]) => limitarOResponder(...a),
}))

// ── /api/portal ──────────────────────────────────────────────────────────
const getPatient = vi.fn()
const getCitasPortal = vi.fn()
vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: (sub: string) => {
          if (sub === 'appointments') return { where: () => ({ get: getCitasPortal }) }
          if (sub === 'config') return { doc: () => ({ get: vi.fn().mockResolvedValue({ exists: false }) }) }
          if (sub === 'patients') return { doc: () => ({ get: getPatient }) }
          throw new Error(`subcolección inesperada en el test: ${sub}`)
        },
      }),
    }),
  },
}))

import { POST as portalPOST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'

function reqPortal(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof portalPOST>[0]
}

function snap(docs: Record<string, unknown>[]) {
  return { docs: docs.map((d, i) => ({ id: `doc${i}`, data: () => d })) }
}

describe('PATIENT-PORTAL-001 · /api/portal está cableado al limitador', () => {
  beforeEach(() => {
    limitarOResponder.mockReset()
    getCitasPortal.mockReset()
    getPatient.mockReset()
    getCitasPortal.mockResolvedValue(snap([]))
    getPatient.mockResolvedValue({ exists: false, data: () => undefined })
  })

  it('con cupo, la clave lleva la sesión del paciente (no la IP: el token viaja por WhatsApp)', async () => {
    limitarOResponder.mockResolvedValue(null)
    const token = crearTokenPaciente('clinica-1', 'pac-1', 30, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(200)
    expect(limitarOResponder).toHaveBeenCalledWith(
      'portal:clinica-1:pac-1', expect.any(Number), expect.any(Number), expect.any(String),
    )
  })

  it('sin cupo, corta con el 429 del limitador y NO llega a leer Firestore', async () => {
    const bloqueado = new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes' }), { status: 429 })
    limitarOResponder.mockResolvedValue(bloqueado)
    const token = crearTokenPaciente('clinica-1', 'pac-1', 30, 'agenda')
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(429)
    expect(getCitasPortal).not.toHaveBeenCalled()
    expect(getPatient).not.toHaveBeenCalled()
  })
})

// ── /api/public/resena ──────────────────────────────────────────────────
describe('PATIENT-PORTAL-001 · /api/public/resena está cableado al limitador', () => {
  it('sin cupo, corta con 429 antes de tocar la transacción de Firestore', async () => {
    vi.resetModules()
    limitarOResponder.mockReset()
    const bloqueado = new Response(JSON.stringify({ ok: false, motivo: 'Demasiadas solicitudes' }), { status: 429 })
    limitarOResponder.mockResolvedValue(bloqueado)

    const runTransaction = vi.fn()
    vi.doMock('@/lib/firebase-admin', () => ({
      adminDb: { collection: () => ({ doc: () => ({}) }), runTransaction },
    }))
    vi.doMock('@/lib/rate-limit', () => ({
      limitarOResponder: (...a: unknown[]) => limitarOResponder(...a),
    }))
    const { POST: resenaPOST } = await import('@/app/api/public/resena/route')

    const res = await resenaPOST({
      json: async () => ({ token: 'tok-1', rating: 5, texto: 'bien' }),
      headers: new Headers(),
    } as unknown as Parameters<typeof resenaPOST>[0])

    expect(res.status).toBe(429)
    expect(runTransaction).not.toHaveBeenCalled()
    vi.resetModules()
  })
})

// ── /api/payment/create-checkout ────────────────────────────────────────
describe('PATIENT-PORTAL-001 · /api/payment/create-checkout está cableado al limitador', () => {
  it('sin cupo, corta con 429 antes de crear la sesión de Stripe', async () => {
    vi.resetModules()
    limitarOResponder.mockReset()
    const bloqueado = new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes' }), { status: 429 })
    limitarOResponder.mockResolvedValue(bloqueado)

    const stripeCreate = vi.fn()
    vi.doMock('@/lib/stripe', () => ({ stripe: { checkout: { sessions: { create: stripeCreate } } } }))
    vi.doMock('@/lib/firebase-admin', () => ({
      adminDb: { collection: () => ({ doc: () => ({ get: vi.fn(), update: vi.fn() }) }) },
    }))
    vi.doMock('@/lib/rate-limit', () => ({
      limitarOResponder: (...a: unknown[]) => limitarOResponder(...a),
    }))
    const token = crearTokenPaciente('clinica-1', 'pac-1', 30, 'agenda')
    const { POST: checkoutPOST } = await import('@/app/api/payment/create-checkout/route')

    const res = await checkoutPOST({
      json: async () => ({ token, citaId: 'cita-1' }),
    } as unknown as Parameters<typeof checkoutPOST>[0])

    expect(res.status).toBe(429)
    expect(stripeCreate).not.toHaveBeenCalled()
    vi.resetModules()
  })
})
