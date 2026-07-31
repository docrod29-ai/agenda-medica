import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * E0-01 / REG-025 — CRITERIO DE ACEPTACIÓN de la unidad:
 * "un body con cédula/folio arbitrarios no produce certificado válido".
 *
 * Antes, `/api/receta/verificacion-url` firmaba con HMAC lo que el cliente le
 * dictara. Un POST a mano con una cédula ajena y un notaId inventado devolvía
 * una URL que la página pública `/verificar` presenta como "Integridad
 * verificada": NexusMED certificaba un documento que nunca existió.
 *
 * Este archivo prueba la ruta REAL (no un mock de ella) con dobles del Admin SDK
 * y de la frontera de autenticación. Datos 100% ficticios.
 */

// ── Dobles ────────────────────────────────────────────────────────────────
const getNota = vi.fn()
const docPath = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    doc: (p: string) => { docPath(p); return { get: getNota } },
  },
}))

/**
 * E0-07: la ruta pasó de `verificarMedico` a `verificarCapacidad(..., 'firmar')`.
 * `rolesCon('firmar')` es {medico, admin} — exactamente el conjunto que autorizaba
 * `verificarMedico` — así que el doble cambia de módulo pero las propiedades que
 * este archivo defiende (se corta antes de tocar Firestore, y el clinicId que llega
 * al guardián es el de la clínica verificada) son las mismas.
 */
const verificarCapacidad = vi.fn()
vi.mock('@/lib/authz/verificar', () => ({ verificarCapacidad: (...a: unknown[]) => verificarCapacidad(...a) }))

import { POST } from '@/app/api/receta/verificacion-url/route'
import { verificarTokenReceta } from '@/lib/receta-token'
import { folioDeNota } from '@/lib/receta-folio'
import type { NotaMedica } from '@/types/expediente'

/** NextRequest mínimo: a la ruta le bastan json(), headers y nextUrl.origin. */
function req(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers({ origin: 'https://app.ejemplo.mx' }),
    nextUrl: { origin: 'https://app.ejemplo.mx' },
  } as never
}

const NOTA_ID = 'nota-abc123def456'

/** Nota sintética FIRMADA por una médica ficticia. */
function notaFirmada(over: Partial<NotaMedica> = {}): NotaMedica {
  return {
    id: NOTA_ID,
    clinicId: 'clinicA',
    pacienteId: 'pac1',
    pacienteNombre: 'Paciente Sintético',
    tipo: 'seguimiento',
    metadata: {
      id: NOTA_ID, tipoNota: 'seguimiento', clinicId: 'clinicA', pacienteId: 'pac1',
      medicoId: 'uid-ana', cedulaProfesional: '1111111', especialidad: 'Medicina Interna',
      establecimiento: 'Consultorio de prueba', fechaCreacion: '2026-01-01T00:00:00.000Z',
      fechaModificacion: '2026-01-01T00:00:00.000Z', hashIntegridad: 'x', version: 1,
      estado: 'firmada', fuenteGeneracion: 'manual',
    },
    secciones: [],
    diagnosticos: [],
    medicamentos: [{ nombre: 'Fármaco ficticio', dosis: '1 unidad', via: 'oral', frecuencia: 'cada 8 h', duracion: '5 días' }],
    alergias: [],
    firma: {
      nombreMedico: 'Dra. Ana Ficticia', cedulaProfesional: '1111111',
      especialidad: 'Medicina Interna', timestamp: '2026-01-01T00:00:00.000Z', hashFirma: 'abc',
    },
    estado: 'firmada',
    fechaConsulta: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    creadoPor: 'uid-ana',
    ...over,
  }
}

const snap = (data: NotaMedica | null) => ({ exists: data !== null, id: NOTA_ID, data: () => data })

const BODY_OK = { clinicId: 'clinicA', patientId: 'pac1', notaId: NOTA_ID }

beforeEach(() => {
  getNota.mockReset()
  docPath.mockReset()
  verificarCapacidad.mockReset()
  verificarCapacidad.mockResolvedValue({ ok: true, uid: 'uid-ana', clinicId: 'clinicA', role: 'medico' })
})

describe('POST /api/receta/verificacion-url — el certificado sale de la nota, no del body', () => {
  it('ACEPTACIÓN: un body con cédula, nombre y folio arbitrarios NO llega al certificado', async () => {
    getNota.mockResolvedValue(snap(notaFirmada()))

    const res = await POST(req({
      ...BODY_OK,
      // Todo esto es lo que un atacante metería a mano. Ni siquiera debe leerse.
      cedula: '9999999',
      doctorNombre: 'Dr. Impostor',
      folio: 'RX-FALSO',
    }))
    expect(res.status).toBe(200)
    const j = await res.json()

    const token = String(j.url).split('/verificar/')[1]
    const v = verificarTokenReceta(token)
    expect(v).not.toBeNull()
    expect(v!.cedula).toBe('1111111')                  // la de la nota firmada
    expect(v!.doctorNombre).toBe('Dra. Ana Ficticia')  // la de la nota firmada
    expect(v!.folio).toBe(folioDeNota(NOTA_ID))        // derivado del notaId
    // Y nada del body sobrevivió:
    expect(v!.cedula).not.toBe('9999999')
    expect(v!.doctorNombre).not.toBe('Dr. Impostor')
    expect(v!.folio).not.toBe('RX-FALSO')
    expect(j.origenEmisor).toBe('firma')
  })

  it('notaId inexistente → 404 y NO devuelve url (mata el certificado de un documento inventado)', async () => {
    getNota.mockResolvedValue(snap(null))
    const res = await POST(req({ ...BODY_OK, notaId: 'no-existe' }))
    expect(res.status).toBe(404)
    const j = await res.json()
    expect(j.url).toBeUndefined()
  })

  it('sin patientId → 400 (el path de la nota no puede adivinarse)', async () => {
    const res = await POST(req({ clinicId: 'clinicA', notaId: NOTA_ID }))
    expect(res.status).toBe(400)
    expect(getNota).not.toHaveBeenCalled()
  })

  it('nota en borrador → 409: no se certifica lo que no está firmado', async () => {
    getNota.mockResolvedValue(snap(notaFirmada({ estado: 'borrador', firma: undefined })))
    const res = await POST(req(BODY_OK))
    expect(res.status).toBe(409)
    expect((await res.json()).url).toBeUndefined()
  })

  it('nota cancelada → 409', async () => {
    getNota.mockResolvedValue(snap(notaFirmada({ estado: 'cancelada' })))
    expect((await POST(req(BODY_OK))).status).toBe(409)
  })

  it('rol sin la capacidad `firmar` → se corta antes de tocar Firestore', async () => {
    const { NextResponse } = await import('next/server')
    verificarCapacidad.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Tu rol no tiene permiso para esta acción (requiere: firmar).' }, { status: 403 }) })
    const res = await POST(req(BODY_OK))
    expect(res.status).toBe(403)
    expect(getNota).not.toHaveBeenCalled()
  })

  it('lee el path de la clínica verificada, nunca uno cruzado de otro tenant', async () => {
    getNota.mockResolvedValue(snap(notaFirmada()))
    await POST(req(BODY_OK))
    expect(docPath).toHaveBeenCalledWith(`clinics/clinicA/patients/pac1/notas/${NOTA_ID}`)
    // clinicId llega al guardián, que lo contrasta contra clinic_members.
    expect(verificarCapacidad).toHaveBeenCalledWith(expect.anything(), 'clinicA', 'firmar')
  })

  it('camino feliz sin campos de identidad en el body → 200 con certificado correcto', async () => {
    getNota.mockResolvedValue(snap(notaFirmada()))
    const res = await POST(req(BODY_OK))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.url).toContain('https://app.ejemplo.mx/verificar/')
    expect(j.cedula).toBe('1111111')
    const v = verificarTokenReceta(String(j.url).split('/verificar/')[1])!
    expect(v.clinicId).toBe('clinicA')
    expect(v.notaId).toBe(NOTA_ID)
    // Huella de los medicamentos de la NOTA, calculada en el servidor.
    expect(v.huellaNota).toMatch(/^[0-9a-f]{8}$/)
    expect(v.firmaVersion).toBe(2)
  })

  it('nota legada firmada sin bloque de firma → emisor de metadata, jamás del body', async () => {
    getNota.mockResolvedValue(snap(notaFirmada({ firma: undefined })))
    const res = await POST(req({ ...BODY_OK, cedula: '9999999', doctorNombre: 'Dr. Impostor' }))
    const j = await res.json()
    expect(j.origenEmisor).toBe('metadata')
    expect(j.cedula).toBe('1111111')
    expect(j.doctorNombre).toBe('')   // metadata no guarda nombre: se deja vacío, no se inventa
  })

  it('contenidoHash con forma inválida se descarta (no se firma basura)', async () => {
    getNota.mockResolvedValue(snap(notaFirmada()))
    const res = await POST(req({ ...BODY_OK, contenidoHash: '<script>alert(1)</script>' }))
    const j = await res.json()
    const v = verificarTokenReceta(String(j.url).split('/verificar/')[1])!
    expect(v.contenidoHash).toBeUndefined()
  })

  it('fallo de lectura de Firestore → 503 fail-CERRADO, no se acuña certificado', async () => {
    getNota.mockRejectedValue(new Error('firestore caído'))
    const res = await POST(req(BODY_OK))
    expect(res.status).toBe(503)
    expect((await res.json()).url).toBeUndefined()
  })

  it('body no-JSON → 400', async () => {
    const malo = {
      json: async () => { throw new Error('no es json') },
      headers: new Headers(),
      nextUrl: { origin: 'https://app.ejemplo.mx' },
    } as never
    expect((await POST(malo)).status).toBe(400)
  })
})
