import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

/**
 * Unidad Nexus OS E0-06 — ALCANCE del magic-link del paciente.
 *
 * El agujero que cierra (y que este archivo reproduce): `/api/portal/link` exige
 * solo `verificarMiembro`, así que la ASISTENTE podía pedir el enlace «para
 * mandárselo al paciente por WhatsApp» y quedarse con un token HMAC de 30 días que
 * `/api/portal` aceptaba en la acción `documentos` — la que devuelve diagnósticos y
 * medicamentos de las notas FIRMADAS. Secreto médico por API, saltándose el gate
 * `isMedico` de firestore.rules. Es el mismo vector que ya se cerró en
 * `/api/telesalud/token`.
 *
 * Datos 100% ficticios. Sin red, sin emulador.
 */

// ── Dobles del Admin SDK ──────────────────────────────────────────────────
const getCitas = vi.fn()
const getConfig = vi.fn()
const getNotas = vi.fn()

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

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente, verificarTokenPaciente, linkPortalPaciente } from '@/lib/patient-token'

/** El mismo fallback de desarrollo que usa `patient-token.ts` fuera de producción. */
const SECRETO_DEV = 'dev-portal-secret-no-usar-en-produccion-0123456789'
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

describe('E0-06 · el alcance viaja en el token y falla-cerrado', () => {
  it('un token sin alcance declarado se degrada a `agenda`', () => {
    // Simula un token EMITIDO ANTES de esta unidad: el payload no trae el campo.
    const viejo = crearTokenPaciente(CLINICA, PACIENTE)
    const [payloadB64, firma] = viejo.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    delete payload.a
    // Se re-firma con el mismo secreto para que sea un token legítimo... salvo que
    // no declara alcance. Se firma con la misma función que usa la librería.
    const nuevoPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const secreto = SECRETO_DEV
    const nuevaFirma = createHmac('sha256', secreto).update(nuevoPayload).digest('base64url')
    expect(firma).not.toBe(nuevaFirma) // el payload cambió de verdad

    const v = verificarTokenPaciente(`${nuevoPayload}.${nuevaFirma}`)
    expect(v).not.toBeNull()
    expect(v!.alcance).toBe('agenda')
  })

  it('un alcance desconocido en el payload NO se acepta: cae a `agenda`', () => {
    const secreto = SECRETO_DEV
    const payload = { c: CLINICA, p: PACIENTE, e: Math.floor(Date.now() / 1000) + 3600, a: 'superusuario' }
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const firma = createHmac('sha256', secreto).update(b64).digest('base64url')
    expect(verificarTokenPaciente(`${b64}.${firma}`)!.alcance).toBe('agenda')
  })

  it('el enlace que arma cualquier miembro nace con alcance `agenda`', () => {
    const url = linkPortalPaciente('https://app.ejemplo.mx', CLINICA, PACIENTE)
    const token = url.split('/mi/')[1]
    expect(verificarTokenPaciente(token)!.alcance).toBe('agenda')
  })

  it('un token emitido con alcance `clinico` lo conserva', () => {
    const t = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    expect(verificarTokenPaciente(t)).toEqual({ clinicId: CLINICA, patientId: PACIENTE, alcance: 'clinico', version: 0 })
  })

  it('manipular el alcance rompe la firma', () => {
    const t = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda')
    const [b64, firma] = t.split('.')
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
    payload.a = 'clinico'
    const forjado = Buffer.from(JSON.stringify(payload)).toString('base64url')
    expect(verificarTokenPaciente(`${forjado}.${firma}`)).toBeNull()
  })
})

describe('E0-06 · /api/portal — `documentos` exige alcance clínico', () => {
  it('con un token de agenda responde 403 y NO consulta las notas', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 30, 'agenda')
    const res = await POST(req({ action: 'documentos', token }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/receta/i)
    expect(body.documentos).toBeUndefined()
    // Lo importante: ni siquiera se leyó la subcolección de notas.
    expect(getNotas).not.toHaveBeenCalled()
  })

  it('con un token clínico devuelve los documentos', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    const res = await POST(req({ action: 'documentos', token }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.documentos).toHaveLength(1)
    expect(body.documentos[0].diagnostico).toBe('Diagnóstico de prueba')
  })

  it('REGRESIÓN: el token de agenda SIGUE sirviendo para las citas', async () => {
    // El fix no puede romper el trabajo real: el enlace que manda la asistente
    // tiene que seguir abriendo la sesión del paciente y sus citas.
    const token = crearTokenPaciente(CLINICA, PACIENTE, 30, 'agenda')
    const res = await POST(req({ action: 'session', token }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('citas')
  })

  it('sin token válido no se llega a ninguna acción', async () => {
    const res = await POST(req({ action: 'documentos', token: 'basura' }))
    expect(res.status).toBe(401)
  })
})
