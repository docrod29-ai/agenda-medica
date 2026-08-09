/**
 * GOLDEN — PATIENT-PORTAL-001: rate-limit en las acciones sensibles del portal
 * del paciente, y en las dos rutas públicas hermanas que tampoco lo tenían.
 *
 * CÓMO SE ENCONTRÓ — auditoría del producto real de V9 (PATIENT-UX-TRUTH-001,
 * 8-ago-2026), backlog `PATIENT-PORTAL-001`: `confirmar`, `cancelar`,
 * `reagendar`, `formulario` y `documentos` en `/api/portal` mutaban datos o
 * devolvían secreto médico (diagnósticos, medicamentos de notas firmadas) sin
 * ningún `limitar*`, a diferencia de telesalud/sala (12/600s) y de
 * public/booking (8/h por IP). Un token de paciente filtrado —enlace
 * reenviado, teléfono perdido— podía usarse para enumerar y mover la agenda
 * del consultorio sin freno. Lo mismo en `/api/public/resena` (barrer tokens
 * de reseña por fuerza bruta) y en `/api/payment/create-checkout` (crear
 * sesiones de Stripe sin límite con un token válido).
 *
 * CAUSA RAÍZ — estas tres rutas se escribieron en momentos distintos y ninguna
 * copió el patrón `limitarOResponder` que ya usan telesalud/sala,
 * public/booking, inmuno/redactar y ayuda-bot.
 *
 * LA REGLA QUE LO HACE SEGURO — el primer bloque de esta suite reproduce el
 * defecto AL REVÉS (regla `.claude/rules/testing-gates.md`): con
 * `limitarOResponder` devolviendo el 429, la ruta del portal debe devolverlo
 * SIN tocar Firestore. Si alguien borra la llamada al límite, esta prueba
 * deja de ver el 429 y falla — no puede pasar en falso.
 *
 * QUÉ NO CUBRE — no mide el comportamiento real de `limitar()` contra
 * Firestore (eso vive en `nucleo/rate-limit.test.ts`); tampoco decide si la
 * comprobación de revocación del token (route.ts, "si la lectura falla se
 * deja pasar") debe fallar cerrado — ese es un cambio de política, declarado
 * en `agent-state/OWNER_DECISIONS_REQUIRED.md`, no de código, y esta unidad
 * no lo toca.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

// ── Comportamiento: /api/portal, acción `documentos` ───────────────────────
const getCitas = vi.fn()
const getConfig = vi.fn()
const getNotas = vi.fn()
const limitarOResponder = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: (sub: string) => {
          if (sub === 'appointments') return { where: () => ({ get: getCitas }) }
          if (sub === 'config') return { doc: () => ({ get: getConfig }) }
          if (sub === 'patients') {
            return { doc: () => ({ collection: () => ({ where: () => ({ get: getNotas }) }) }) }
          }
          throw new Error(`subcolección inesperada en el test: ${sub}`)
        },
      }),
    }),
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: (...a: unknown[]) => limitarOResponder(...a),
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0]
}

function snap(docs: Record<string, unknown>[]) {
  return { docs: docs.map((d, i) => ({ id: `doc${i}`, data: () => d })) }
}

beforeEach(() => {
  getCitas.mockReset()
  getConfig.mockReset()
  getNotas.mockReset()
  limitarOResponder.mockReset()
  limitarOResponder.mockResolvedValue(null) // por omisión, cupo libre
  getCitas.mockResolvedValue(snap([]))
  getConfig.mockResolvedValue({ exists: false })
  getNotas.mockResolvedValue(snap([
    {
      estado: 'firmada',
      fechaConsulta: '2026-01-15',
      firma: { nombreMedico: 'Dra. Ficticia' },
      diagnosticos: [{ descripcion: 'Diagnóstico de prueba' }],
      medicamentos: [{ nombre: 'Medicamento ficticio' }],
    },
  ]))
})

describe('PATIENT-PORTAL-001 · /api/portal aplica el límite ANTES de tocar Firestore', () => {
  it('AL REVÉS: si el límite dice que no hay cupo, `documentos` devuelve el 429 y NO lee las notas', async () => {
    limitarOResponder.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes.' }), { status: 429 }),
    )
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    const res = await POST(req({ action: 'documentos', token }))
    expect(res.status).toBe(429)
    expect(getNotas).not.toHaveBeenCalled()
  })

  it('con cupo libre, `documentos` sigue funcionando como antes', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    const res = await POST(req({ action: 'documentos', token }))
    expect(res.status).toBe(200)
    expect(getNotas).toHaveBeenCalled()
  })

  it('la clave del límite ata clinicId + patientId + acción, no la IP', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    await POST(req({ action: 'documentos', token }))
    expect(limitarOResponder).toHaveBeenCalledWith(
      `portal:documentos:${CLINICA}:${PACIENTE}`,
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
    )
  })

  it('`session` no se limita: es la llamada que dispara sola la pantalla al abrir el enlace', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda')
    limitarOResponder.mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 429 }),
    )
    const res = await POST(req({ action: 'session', token }))
    // Si `session` estuviera en la lista limitada, este 429 la habría bloqueado.
    expect(res.status).toBe(200)
  })
})

// ── Estructura: las cinco acciones sensibles, y sólo ésas ──────────────────
describe('PATIENT-PORTAL-001 · qué acciones quedan detrás del límite', () => {
  const portal = leer('src', 'app', 'api', 'portal', 'route.ts')
  const i = portal.indexOf('ACCIONES_CON_LIMITE')
  const bloque = portal.slice(i, i + 400)

  it('confirmar, cancelar, reagendar, formulario y documentos sí', () => {
    for (const accion of ['confirmar', 'cancelar', 'reagendar', 'formulario', 'documentos']) {
      expect(bloque).toContain(`'${accion}'`)
    }
  })

  it('session, slots y paquetes NO — son las que dispara sola la pantalla', () => {
    for (const accion of ['session', 'slots', 'paquetes']) {
      expect(bloque).not.toContain(`'${accion}'`)
    }
  })

  it('el límite se aplica ANTES del switch de acciones, no dentro de un caso', () => {
    const iLimite = portal.indexOf('ACCIONES_CON_LIMITE.has(body.action)')
    const iSwitch = portal.indexOf('switch (body.action)')
    expect(iLimite).toBeGreaterThan(0)
    expect(iSwitch).toBeGreaterThan(iLimite)
  })
})

// ── Las dos rutas hermanas: mismo patrón, verificado en el texto fuente ────
describe('PATIENT-PORTAL-001 · /api/public/resena y /api/payment/create-checkout', () => {
  it('resena limita por IP antes de tocar la transacción de Firestore', () => {
    const src = leer('src', 'app', 'api', 'public', 'resena', 'route.ts')
    expect(src).toContain("from '@/lib/rate-limit'")
    const iLimite = src.indexOf('limitarOResponder(')
    const iTx = src.indexOf('runTransaction')
    expect(iLimite).toBeGreaterThan(0)
    expect(iTx).toBeGreaterThan(iLimite)
  })

  it('create-checkout limita por clinicId+patientId antes de llamar a Stripe', () => {
    const src = leer('src', 'app', 'api', 'payment', 'create-checkout', 'route.ts')
    expect(src).toContain("from '@/lib/rate-limit'")
    const iLimite = src.indexOf('limitarOResponder(')
    const iStripe = src.indexOf('stripe.checkout.sessions.create')
    expect(iLimite).toBeGreaterThan(0)
    expect(iStripe).toBeGreaterThan(iLimite)
  })
})
