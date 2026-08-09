import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * REG-291 — PATIENT-PORTAL-001: ninguna acción de `/api/portal` tenía freno
 * de tasa. `confirmar`, `cancelar`, `reagendar`, `formulario` y `documentos`
 * iban sin límite.
 *
 * CÓMO SE DESCUBRIÓ: auditoría PATIENT-UX-TRUTH-001 (V9), 8-ago-2026 —
 * `agent-state/BACKLOG.json`, ítem `PATIENT-PORTAL-001`.
 *
 * CAUSA RAÍZ: la ruta nunca llamaba a `limitarOResponder`, a diferencia de
 * `telesalud/sala` y `public/booking`, que sí lo hacen. Un token filtrado
 * —no robado: reenviado, en un teléfono perdido, un número reciclado— permitía
 * enumerar y mover la agenda completa del consultorio sin freno.
 *
 * LA REGLA QUE LO HACE SEGURO: toda petición pasa por `limitarOResponder`
 * con clave `portal:${clinicId}:${patientId}` —la identidad que ya dio el
 * token verificado— antes de tocar cualquier acción. Mismo patrón que
 * `telesalud/sala` (fail-open si Firestore falla: el límite es una malla,
 * no el gate principal — la firma y la caducidad del token siguen siendo la
 * autorización real).
 *
 * QUÉ NO CUBRE: no toca el fail-open de la comprobación de revocación
 * (`portalTokenVersion`) — es una decisión de política ya documentada aparte
 * en `agent-state/OWNER_DECISIONS_REQUIRED.md` / `BLOCKERS.md`, no un
 * defecto de este cambio. Tampoco mide el umbral exacto (60 por 600s): sólo
 * que el guardián EXISTE y corta antes de leer Firestore. Probado al revés:
 * si se quita la llamada a `limitarOResponder` de la ruta, el segundo y
 * tercer caso de abajo dejan de pasar porque `getCitas` sí se invoca.
 */

const limitarOResponder = vi.fn()
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: (...a: unknown[]) => limitarOResponder(...a) }))

const getCitas = vi.fn()
const getConfig = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: (sub: string) => {
          if (sub === 'appointments') return { where: () => ({ get: getCitas }) }
          if (sub === 'config') return { doc: () => ({ get: getConfig }) }
          if (sub === 'patients') return { doc: () => ({ collection: () => ({ where: () => ({ get: vi.fn() }) }) }) }
          throw new Error(`subcolección inesperada en el test: ${sub}`)
        },
      }),
    }),
  },
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'

/** Datos 100% ficticios. Sin red, sin emulador. */
const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0]
}

function snap(docs: Record<string, unknown>[]) {
  return { docs: docs.map((d, i) => ({ id: `doc${i}`, data: () => d })) }
}

beforeEach(() => {
  limitarOResponder.mockReset()
  getCitas.mockReset()
  getConfig.mockReset()
  limitarOResponder.mockResolvedValue(null) // por defecto: hay cupo
  getCitas.mockResolvedValue(snap([]))
  getConfig.mockResolvedValue({ exists: false })
})

describe('PATIENT-PORTAL-001 · /api/portal frena por sesión antes de tocar Firestore', () => {
  it('con cupo, la acción sigue normal — el guardián está conectado con la clave correcta', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda')
    const res = await POST(req({ action: 'session', token }))
    expect(res.status).toBe(200)
    expect(limitarOResponder).toHaveBeenCalledWith(
      `portal:${CLINICA}:${PACIENTE}`, 60, 600, expect.any(String),
    )
  })

  it('sin cupo, la ruta devuelve 429 y NO llega a leer las citas del paciente', async () => {
    limitarOResponder.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes' }), { status: 429 }),
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda')
    const res = await POST(req({ action: 'session', token }))
    expect(res.status).toBe(429)
    expect(getCitas).not.toHaveBeenCalled()
  })

  it('sin cupo, tampoco se puede cancelar ni reagendar con un token filtrado', async () => {
    limitarOResponder.mockResolvedValue(new Response(null, { status: 429 }))
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda')
    const res = await POST(req({ action: 'cancelar', citaId: 'cita-1', token }))
    expect(res.status).toBe(429)
  })

  it('la clave de límite ata clínica+paciente — dos pacientes no comparten cupo', async () => {
    const t1 = crearTokenPaciente(CLINICA, 'pac-A', 1, 'agenda')
    await POST(req({ action: 'session', token: t1 }))
    const t2 = crearTokenPaciente(CLINICA, 'pac-B', 1, 'agenda')
    await POST(req({ action: 'session', token: t2 }))
    expect(limitarOResponder).toHaveBeenNthCalledWith(1, `portal:${CLINICA}:pac-A`, 60, 600, expect.any(String))
    expect(limitarOResponder).toHaveBeenNthCalledWith(2, `portal:${CLINICA}:pac-B`, 60, 600, expect.any(String))
  })

  it('sin token válido, ni siquiera se consulta el límite de tasa (401 antes)', async () => {
    const res = await POST(req({ action: 'session', token: 'basura' }))
    expect(res.status).toBe(401)
    expect(limitarOResponder).not.toHaveBeenCalled()
  })
})
