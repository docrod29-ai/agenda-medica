import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * POSTVISIT-ENTREGA-001 (REG-296) — la hoja del paciente LLEGA al portal.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────
 *
 * `comoSeLoExplico`/`HojaParaElPaciente` existen desde REG-242 y se componían
 * bien: cada línea sale de un campo que el médico ya revisó. REG-293 cerró
 * CUÁNDO se puede entregar (`notaFirmada` obligatoria, DRAFT→RELEASED). Pero
 * los dos hallazgos coincidían en la misma frase: la hoja nunca se pintaba en
 * ninguna pantalla que el PACIENTE pudiera abrir. El único importador en
 * producción era la pantalla de consulta del médico.
 *
 * «Escrito, probado y sin conectar» en su forma más cara — la pieza mejor
 * pensada del lado del paciente. El propio REG-293 lo dejó escrito como lo
 * que NO cubría: "Cuando llegue, la compuerta tendrá que vivir en el
 * servidor — §3 de patient-facing-ai.md: la prohibición no puede vivir sólo
 * en la pantalla."
 *
 * ── LA COMPUERTA, AHORA EN EL SERVIDOR ──────────────────────────────────
 *
 * La acción `instrucciones` de `/api/portal`:
 *   1. exige alcance `clinico` — mismo gate que `documentos` (REG visto en
 *      `portal-alcance.test.ts`), porque esto también es secreto médico;
 *   2. sólo lee notas con `estado === 'firmada'` — nunca hay aquí una
 *      versión de borrador que entregar, así que `notaFirmada` viaja fijo
 *      en `true` del lado del cliente;
 *   3. excluye toda nota con `internamientoId` — nadie se lleva a casa un
 *      fármaco intravenoso de UCI. Es la MISMA regla que ya aplicaba la
 *      pantalla de consulta (`!esNotaHospital`), reescrita aquí porque el
 *      cliente no manda ese booleano: el servidor lo deriva de la nota.
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
  getCitas.mockResolvedValue(snap([]))
  getConfig.mockResolvedValue({ exists: false })
})

describe('POSTVISIT-ENTREGA-001 · /api/portal — `instrucciones` exige alcance clínico', () => {
  it('con un token de agenda responde 403 y NO consulta las notas', async () => {
    getNotas.mockResolvedValue(snap([]))
    const token = crearTokenPaciente(CLINICA, PACIENTE, 30, 'agenda')
    const res = await POST(req({ action: 'instrucciones', token }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/instrucciones/i)
    expect(body.instrucciones).toBeUndefined()
    expect(getNotas).not.toHaveBeenCalled()
  })

  it('sin token válido no se llega a la acción', async () => {
    const res = await POST(req({ action: 'instrucciones', token: 'basura' }))
    expect(res.status).toBe(401)
    expect(getNotas).not.toHaveBeenCalled()
  })
})

describe('POSTVISIT-ENTREGA-001 · devuelve sólo lo FIRMADO, nunca un borrador', () => {
  it('con alcance clínico y una nota firmada, entrega medicamentos y estudios', async () => {
    getNotas.mockResolvedValue(snap([
      {
        estado: 'firmada',
        fechaConsulta: '2026-08-01',
        medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
        estudiosOrden: ['Biometría hemática'],
      },
    ]))
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    const res = await POST(req({ action: 'instrucciones', token }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.instrucciones).toEqual({
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
      estudios: ['Biometría hemática'],
      fecha: '2026-08-01',
    })
  })

  it('sin ninguna nota firmada, responde instrucciones: null — no una hoja vacía', async () => {
    getNotas.mockResolvedValue(snap([]))
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    const res = await POST(req({ action: 'instrucciones', token }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.instrucciones).toBeNull()
  })

  it('REGRESIÓN — una nota de INTERNAMIENTO nunca sale, aunque sea la más reciente', async () => {
    // Probado al revés: si se quitara el filtro `!n.internamientoId`, esta
    // prueba pasaría a devolver la nota de UCI (la más reciente por fecha) en
    // vez de la ambulatoria, y el `expect` de abajo fallaría.
    getNotas.mockResolvedValue(snap([
      {
        estado: 'firmada',
        fechaConsulta: '2026-06-01',
        medicamentos: [{ nombre: 'Paracetamol', dosis: '500 mg' }],
        estudiosOrden: [],
      },
      {
        estado: 'firmada',
        fechaConsulta: '2026-08-05', // más reciente
        internamientoId: 'internamiento-uci-01',
        medicamentos: [{ nombre: 'Norepinefrina', dosis: '0.1 mcg/kg/min' }],
        estudiosOrden: [],
      },
    ]))
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    const res = await POST(req({ action: 'instrucciones', token }))
    const body = await res.json()
    expect(body.instrucciones.medicamentos).toEqual([{ nombre: 'Paracetamol', dosis: '500 mg' }])
    expect(body.instrucciones.fecha).toBe('2026-06-01')
  })

  it('con varias notas firmadas ambulatorias, se queda con la MÁS RECIENTE', async () => {
    getNotas.mockResolvedValue(snap([
      { estado: 'firmada', fechaConsulta: '2026-01-15', medicamentos: [{ nombre: 'Viejo' }], estudiosOrden: [] },
      { estado: 'firmada', fechaConsulta: '2026-07-20', medicamentos: [{ nombre: 'Reciente' }], estudiosOrden: [] },
      { estado: 'firmada', fechaConsulta: '2026-03-10', medicamentos: [{ nombre: 'Intermedio' }], estudiosOrden: [] },
    ]))
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'clinico')
    const res = await POST(req({ action: 'instrucciones', token }))
    const body = await res.json()
    expect(body.instrucciones.medicamentos).toEqual([{ nombre: 'Reciente' }])
  })

  it('REGRESIÓN — el token de agenda SIGUE sirviendo para las citas', async () => {
    // El fix no puede romper el trabajo real de la sesión del portal.
    getNotas.mockResolvedValue(snap([]))
    const token = crearTokenPaciente(CLINICA, PACIENTE, 30, 'agenda')
    const res = await POST(req({ action: 'session', token }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('citas')
  })
})
