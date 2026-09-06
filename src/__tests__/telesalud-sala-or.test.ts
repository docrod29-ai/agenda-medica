import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * `POST /api/telesalud/sala` — el OR de autorización (unidad Nexus OS E0-07).
 *
 * POR QUÉ ESTE ARCHIVO EXISTE: esta ruta NO es un guard normal y es la más fácil de
 * romper "limpiándola". Tiene tres propiedades que se ganaron en la auditoría
 * maestra 2026-07 y que cualquier refactor —incluida la futura migración a
 * `verificarCapacidad`, hoy pendiente de decisión del médico dueño— debe conservar:
 *
 *  (a) OR REAL: entra el paciente con el token HMAC DE SU cita, o un miembro
 *      autenticado del consultorio. No es `if (!acc.ok) return acc.response`.
 *  (b) ORDEN: el token se evalúa PRIMERO; la membresía solo se consulta si el token
 *      no autoriza. Invertirlo obligaría al paciente a tener sesión de equipo.
 *  (c) 404, NO 403, cuando nada autoriza: un 403 confirmaría que el `citaId` existe
 *      (fuga de existencia ya cerrada).
 *
 * Antes de esto había un camino "legacy" SIN token que solo miraba la ventana
 * horaria: cualquiera con citaId+clinicId entraba a la sala de otro paciente.
 */

// ── Dobles ────────────────────────────────────────────────────────────────────
const getCita = vi.fn()
const verificarTokenPaciente = vi.fn()
const verificarMiembro = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ collection: () => ({ doc: () => ({ get: getCita, update: vi.fn() }) }) }),
    }),
  },
}))
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: vi.fn(async () => null) }))
/**
 * Doble PARCIAL desde REG-519: la ruta ahora consume `tokenVigente` (vía
 * `bloquearSiNoVigente`) además de `verificarTokenPaciente`. Se conserva el
 * módulo real y sólo se sustituye el verificador; el doble de Firestore de
 * arriba devuelve la cita también para el expediente, y como no trae
 * `portalTokenVersion`, la versión 0 del token sigue vigente — este archivo
 * mide el OR de autorización, no la revocación (ésa vive en
 * `el-enlace-revocado-no-abre-la-sala.test.ts`).
 */
vi.mock('@/lib/patient-token', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/patient-token')>()
  return { ...real, verificarTokenPaciente: (...a: unknown[]) => verificarTokenPaciente(...a) }
})
vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: (...a: unknown[]) => verificarMiembro(...a),
}))

import { POST } from '@/app/api/telesalud/sala/route'

/** Cita sintética. Datos FICTICIOS: nunca PHI real en tests. */
const CITA = { pacienteId: 'pac-777', fechaHora: '2030-01-01 10:00', estado: 'confirmada' }

function peticion(body: Record<string, unknown>) {
  return new NextRequest('https://ejemplo.test/api/telesalud/sala', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  getCita.mockReset()
  verificarTokenPaciente.mockReset()
  verificarMiembro.mockReset()
  getCita.mockResolvedValue({ exists: true, data: () => CITA })
  verificarTokenPaciente.mockReturnValue(null)
  verificarMiembro.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) })
  // Sin DAILY_API_KEY la ruta devuelve una sala ficticia: perfecto para probar
  // autorización sin salir a la red.
  delete process.env.DAILY_API_KEY
})

describe('E0-07 · telesalud/sala conserva el OR de autorización', () => {
  it('(a) token del paciente DE ESTA cita entra, aunque no haya sesión de equipo', async () => {
    verificarTokenPaciente.mockReturnValue({ clinicId: 'c1', patientId: 'pac-777' })
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(200)
    // No se consultó la membresía: el paciente no la tiene.
    expect(verificarMiembro).not.toHaveBeenCalled()
  })

  it('(a) el miembro del consultorio entra por la segunda rama, sin token', async () => {
    verificarMiembro.mockResolvedValue({ ok: true, uid: 'u1', clinicId: 'c1', role: 'medico' })
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1' }))
    expect(r.status).toBe(200)
  })

  it('(b) el token se evalúa ANTES de leer la membresía', async () => {
    const orden: string[] = []
    verificarTokenPaciente.mockImplementation(() => { orden.push('token'); return { clinicId: 'c1', patientId: 'pac-777' } })
    verificarMiembro.mockImplementation(async () => { orden.push('miembro'); return { ok: true, uid: 'u1' } })
    await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(orden[0]).toBe('token')
  })

  it('(c) sin token y sin membresía → 404, NUNCA 403 (no confirma que la cita exista)', async () => {
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1' }))
    expect(r.status).toBe(404)
    expect(r.status).not.toBe(403)
  })

  it('(c) token de OTRO paciente → 404, no entra a la sala ajena', async () => {
    verificarTokenPaciente.mockReturnValue({ clinicId: 'c1', patientId: 'pac-OTRO' })
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(404)
  })

  it('(c) token de OTRA clínica → 404 (aislamiento entre consultorios)', async () => {
    verificarTokenPaciente.mockReturnValue({ clinicId: 'clinica-ajena', patientId: 'pac-777' })
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(404)
  })

  it('token SIN patientId no autoriza (un token de alcance agenda no abre la sala)', async () => {
    verificarTokenPaciente.mockReturnValue({ clinicId: 'c1' })
    const r = await POST(peticion({ citaId: 'cita-1', clinicId: 'c1', token: 'tk' }))
    expect(r.status).toBe(404)
  })

  it('cita inexistente → 404 antes de autorizar nada', async () => {
    getCita.mockResolvedValue({ exists: false, data: () => undefined })
    const r = await POST(peticion({ citaId: 'no-existe', clinicId: 'c1' }))
    expect(r.status).toBe(404)
  })
})
