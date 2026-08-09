import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * POSTVISIT-ENTREGA-001 (REG-308) — la acción del servidor, sin llamador A PROPÓSITO.
 *
 * ── EL HUECO ORIGINAL ────────────────────────────────────────────────────
 *
 * `comoSeLoExplico`/`HojaParaElPaciente` existen desde REG-242 y se componían
 * bien: cada línea sale de un campo que el médico ya revisó. REG-307 cerró
 * CUÁNDO se puede entregar (`notaFirmada` obligatoria, DRAFT→RELEASED). Pero
 * los dos hallazgos coincidían en la misma frase: la hoja nunca se pintaba en
 * ninguna pantalla que el PACIENTE pudiera abrir. El único importador en
 * producción era la pantalla de consulta del médico.
 *
 * ── POR QUÉ ESTA ACCIÓN NO TIENE LLAMADOR — Y NO ES UN OLVIDO ────────────
 *
 * Esta unidad SÍ conectó `/mi/[token]` a esta acción, y se DESCONECTÓ antes
 * de fusionar con `main`. Ahí apareció `lib/paciente/paquete-de-visita.ts`
 * (V9 · `PATIENT-COMPANION-001`), que construye el `PatientVisitPackage` de
 * la especificación con más rigor: nace DRAFT y sólo pasa a RELEASED con un
 * acto de aprobación aparte de la firma (`approvedAt`/`approvedBy`). Su
 * pestaña «Cuidado» en `/mi/[token]` ya enseña, a propósito, un estado vacío
 * honesto hasta que exista `POSTVISIT-001` (la pantalla del médico que
 * libera). Conectar esta acción habría hecho que la sola firma bastara para
 * mostrarle algo al paciente — exactamente lo que prohíbe la regla 4 de
 * `.claude/rules/patient-facing-ai.md`: *"Que el médico haya firmado la nota
 * no libera el paquete: son dos actos."*
 *
 * Por eso esta prueba llama a la acción DIRECTAMENTE, por HTTP simulado —
 * igual que `portal-alcance.test.ts` prueba `documentos` — y ninguno de sus
 * casos depende de que exista una pantalla que la use. Es el mismo patrón
 * que `validarCorreccion` en `OWNER_DECISIONS_REQUIRED.md`: motor escrito,
 * probado y sellado, bloqueado por una decisión que no le toca a este
 * programa. La pregunta —¿basta el estándar de `documentos` (firma sola,
 * sin liberación aparte) o hace falta el nivel de `PatientVisitPackage`?—
 * está en `OWNER_DECISIONS_REQUIRED.md`.
 *
 * ── LA COMPUERTA QUE SÍ ESTÁ ACTIVA HOY, EN EL SERVIDOR ──────────────────
 *
 * La acción `instrucciones` de `/api/portal`:
 *   1. exige alcance `clinico` — mismo gate que `documentos` (REG visto en
 *      `portal-alcance.test.ts`), porque esto también es secreto médico;
 *   2. sólo lee notas con `estado === 'firmada'` — nunca hay aquí una
 *      versión de borrador que entregar;
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
