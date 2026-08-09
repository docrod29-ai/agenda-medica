import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * REG-291 — PATIENT-PORTAL-001: `/api/payment/create-checkout` no tenía
 * freno de tasa. Crear una sesión de Stripe Checkout cuesta —llamada externa
 * y escritura en Firestore— y con un token filtrado se podía repetir sin
 * límite.
 *
 * CÓMO SE DESCUBRIÓ: auditoría PATIENT-UX-TRUTH-001 (V9), 8-ago-2026 —
 * `agent-state/BACKLOG.json`, ítem `PATIENT-PORTAL-001`.
 *
 * LA REGLA QUE LO HACE SEGURO: `limitarOResponder` con clave
 * `checkout:${clinicId}:${patientId}`, mismo patrón que `telesalud/sala`,
 * evaluado justo después de verificar el token y antes de tocar Stripe o
 * Firestore.
 *
 * QUÉ NO CUBRE: no mide el umbral exacto (10 por 600s); sólo que el
 * guardián EXISTE y corta antes de crear la sesión de Stripe. Probado al
 * revés: sin la llamada a `limitarOResponder`, el segundo caso dejaría de
 * devolver 429 y `sessions.create` se invocaría igual.
 */

const limitarOResponder = vi.fn()
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: (...a: unknown[]) => limitarOResponder(...a) }))

const verificarTokenPaciente = vi.fn()
vi.mock('@/lib/patient-token', () => ({
  verificarTokenPaciente: (...a: unknown[]) => verificarTokenPaciente(...a),
}))

const sessionsCreate = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: { create: (...a: unknown[]) => sessionsCreate(...a) } } },
}))

const getCita = vi.fn()
const updateCita = vi.fn()
const getClinic = vi.fn()
const getConfig = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: getClinic,
        collection: (sub: string) => {
          if (sub === 'appointments') return { doc: () => ({ get: getCita, update: updateCita }) }
          if (sub === 'config') return { doc: () => ({ get: getConfig }) }
          throw new Error(`subcolección inesperada en el test: ${sub}`)
        },
      }),
    }),
  },
}))

import { POST } from '@/app/api/payment/create-checkout/route'

/** Datos 100% ficticios. Sin red, sin emulador. */
const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  limitarOResponder.mockReset()
  verificarTokenPaciente.mockReset()
  sessionsCreate.mockReset()
  getCita.mockReset()
  updateCita.mockReset()
  getClinic.mockReset()
  getConfig.mockReset()

  limitarOResponder.mockResolvedValue(null)
  verificarTokenPaciente.mockReturnValue({ clinicId: CLINICA, patientId: PACIENTE })
  getCita.mockResolvedValue({ exists: true, data: () => ({ pacienteId: PACIENTE, pagoMonto: 200 }) })
  updateCita.mockResolvedValue(undefined)
  getClinic.mockResolvedValue({ data: () => ({ nombreClinica: 'Consultorio ficticio' }) })
  getConfig.mockResolvedValue({ data: () => ({ anticipoMonto: 200 }) })
  sessionsCreate.mockResolvedValue({ id: 'sess_1', url: 'https://checkout.stripe.test/sess_1' })
})

describe('PATIENT-PORTAL-001 · /api/payment/create-checkout frena por sesión antes de llamar a Stripe', () => {
  it('con cupo, crea la sesión — la clave usa clínica+paciente del token', async () => {
    const res = await POST(req({ token: 'tk', citaId: 'cita-1' }))
    expect(res.status).toBe(200)
    expect(limitarOResponder).toHaveBeenCalledWith(
      `checkout:${CLINICA}:${PACIENTE}`, 10, 600, expect.any(String),
    )
    expect(sessionsCreate).toHaveBeenCalled()
  })

  it('sin cupo, devuelve 429 y NO llama a Stripe ni actualiza la cita', async () => {
    limitarOResponder.mockResolvedValue(new Response(null, { status: 429 }))
    const res = await POST(req({ token: 'tk', citaId: 'cita-1' }))
    expect(res.status).toBe(429)
    expect(sessionsCreate).not.toHaveBeenCalled()
    expect(updateCita).not.toHaveBeenCalled()
  })

  it('sin token válido, ni siquiera se consulta el límite de tasa (401 antes)', async () => {
    verificarTokenPaciente.mockReturnValue(null)
    const res = await POST(req({ token: 'basura', citaId: 'cita-1' }))
    expect(res.status).toBe(401)
    expect(limitarOResponder).not.toHaveBeenCalled()
  })
})
