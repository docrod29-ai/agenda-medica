import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * PATIENT-PORTAL-001 (P1) · REG-331 — ERROR DE REVOCACIÓN ≠ AUTORIZACIÓN
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `/api/portal` comprobaba la revocación del magic-link leyendo
 * `patients/{id}.portalTokenVersion`, y envolvía esa lectura en un `try` con el
 * `catch` VACÍO: si Firestore no respondía, se dejaba pasar. Un enlace ya
 * revocado —teléfono perdido, número reciclado, mensaje reenviado a un grupo—
 * volvía a valer justo durante la incidencia, que es cuando nadie mira.
 *
 * `/api/payment/create-checkout` acepta el MISMO token y no comprobaba la
 * revocación en absoluto: el enlace revocado seguía abriendo sesiones de cobro
 * a nombre del paciente hasta que caducaba.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * El propio `catch` lo decía en voz alta («si la lectura falla se deja pasar»),
 * y `agent-state/BACKLOG.json` lo dejó abierto como decisión de política:
 * «Para la revocación, decidir si falla cerrado — es un cambio de política, no
 * sólo de código». El dueño la decidió el 27-ago-2026 y ésta es la prueba.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Dos estados donde hacen falta TRES. «Vale» y «no vale» no tienen sitio para
 * «no lo sé», así que el `no lo sé` se repartía al montón equivocado. El
 * argumento escrito para repartirlo hacia «vale» era la disponibilidad del
 * paciente, y es medible que NO se sostiene: si Firestore no responde, las
 * acciones del portal fallan igual unas líneas más abajo (todas leen o
 * escriben). El fail-open no le devolvía la agenda a ningún paciente legítimo:
 * sólo se la devolvía a los enlaces revocados, que son los únicos a los que el
 * `catch` le cambiaba el resultado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `lib/portal/vigencia-del-enlace.ts` decide entre `vigente` · `revocado` ·
 * `indeterminado`, y el `indeterminado` sale como **503 con `Retry-After`**, no
 * como 401 y no como 200. El 503 importa tanto como el bloqueo: el enlace NO se
 * quema, y en cuanto Firestore vuelve el mismo token del mismo paciente
 * funciona sin que nadie tenga que reemitirlo (caso 10).
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No corre Firestore ni las `firestore.rules`: el aislamiento entre
 *   consultorios que se prueba aquí es el de la CAPA DE RUTA (de dónde salen
 *   `clinicId` y `patientId`). El de las reglas vive en el job del emulador.
 * · No mide el limitador de verdad —eso es `nucleo/rate-limit.test.ts`— ni qué
 *   ventanas invoca la ruta —eso es `portal-limite-de-tasa.test.ts`—: aquí el
 *   limitador está doblado para que no tape lo que se quiere ver.
 * · No prueba que Vercel no guarde el cuerpo de la petición por su cuenta. Lo
 *   que se comprueba es que ESTA ruta no escriba PHI en consola ni en el JSON
 *   de error.
 * · No prueba el flujo del navegador (`/mi/[token]`): la pantalla no se toca.
 *
 * Datos 100 % ficticios: ningún paciente real, aquí ni en ningún fixture.
 */

// ── El limitador se dobla para que NO tape lo que este archivo quiere ver ────
vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: async () => null,
  limitarEstricto: async () => null,
}))

vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: { create: vi.fn(async () => ({ id: 'cs_ficticia', url: 'https://stripe.example/ficticia' })) } } },
}))

vi.mock('@/lib/whatsapp/ofrecer-hueco', () => ({ ofrecerHuecoLiberado: vi.fn(async () => undefined) }))
vi.mock('@/lib/whatsapp/avisar-consultorio', () => ({
  avisarAlConsultorio: vi.fn(async () => undefined),
  telefonoDelConsultorio: () => '',
}))

/**
 * EL EXPEDIENTE FICTICIO, POR CONSULTORIO.
 *
 * La clave es `${clinicId}/${patientId}` a propósito: así el doble NO puede
 * «encontrar» un paciente en un consultorio que no es el suyo, que es justo lo
 * que el caso 6 tiene que poder distinguir.
 */
const CLINICA = 'clinica-ficticia'
const OTRA_CLINICA = 'clinica-ficticia-vecina'
const PACIENTE = 'pac-ficticio-001'
const OTRO_PACIENTE = 'pac-ficticio-002'

const expedientes = new Map<string, { portalTokenVersion?: number }>()
let fallaLecturaDelExpediente = false
const citasPorClinica = new Map<string, Record<string, unknown>[]>()
const notasPorPaciente = new Map<string, Record<string, unknown>[]>()

const updateCita = vi.fn(async () => undefined)
const setFormulario = vi.fn(async () => undefined)
const addAuditoria = vi.fn(async () => undefined)

function snapDocs(docs: Record<string, unknown>[]) {
  return { docs: docs.map((d, i) => ({ id: String(d.id ?? `doc${i}`), data: () => d })) }
}

/**
 * EL DOBLE APLICA EL `where` DE VERDAD.
 *
 * Un doble que devuelve la colección entera pase lo que pase convierte los
 * casos 5 y 6 en tautologías: darían verde aunque la ruta hubiera dejado de
 * filtrar por paciente. Aquí se acumulan los filtros y `get()` los aplica, así
 * que si alguien quita el `.where('pacienteId','==',patientId)` de la ruta,
 * estas pruebas se ponen rojas — que es el único motivo por el que existen.
 */
function consulta(lista: () => Record<string, unknown>[], filtros: Array<[string, string, unknown]> = []) {
  const q = {
    where: (campo: string, op: string, valor: unknown) => consulta(lista, [...filtros, [campo, op, valor]]),
    get: async () => snapDocs(lista().filter(d => filtros.every(([campo, op, valor]) => {
      const v = d[campo]
      if (op === '==') return v === valor
      if (op === '>=') return String(v) >= String(valor)
      if (op === '<=') return String(v) <= String(valor)
      throw new Error(`operador no soportado en el test: ${op}`)
    }))),
  }
  return q
}

vi.mock('@/lib/firebase-admin', () => ({
  default: { firestore: { FieldValue: { increment: () => 'inc' } } },
  adminDb: {
    runTransaction: async (fn: (tx: unknown) => unknown) => fn({
      get: async () => snapDocs([]), set: vi.fn(), update: vi.fn(),
    }),
    collection: (top: string) => {
      if (top !== 'clinics') throw new Error(`colección superior inesperada en el test: ${top}`)
      return {
        doc: (clinicId: string) => ({
          get: async () => ({ exists: true, data: () => ({ nombreClinica: 'Clínica Ficticia' }) }),
          collection: (sub: string) => {
            if (sub === 'patients') {
              return {
                doc: (patientId: string) => ({
                  get: async () => {
                    if (fallaLecturaDelExpediente) throw new Error('firestore caído')
                    const e = expedientes.get(`${clinicId}/${patientId}`)
                    return { exists: e !== undefined, data: () => e }
                  },
                  update: vi.fn(async () => undefined),
                  collection: (s2: string) => {
                    if (s2 === 'notas') {
                      return consulta(() => notasPorPaciente.get(`${clinicId}/${patientId}`) ?? [])
                    }
                    if (s2 === 'paquetes_visita') return { get: async () => snapDocs([]) }
                    if (s2 === 'formularios_previos') return { doc: () => ({ set: setFormulario }) }
                    throw new Error(`subcolección de paciente inesperada: ${s2}`)
                  },
                }),
              }
            }
            if (sub === 'appointments') {
              const lista = () => citasPorClinica.get(clinicId) ?? []
              return {
                where: (campo: string, op: string, valor: unknown) => consulta(lista).where(campo, op, valor),
                doc: (citaId: string) => ({
                  get: async () => {
                    const c = lista().find(x => x.id === citaId)
                    return { exists: c !== undefined, id: citaId, data: () => c }
                  },
                  update: updateCita,
                }),
              }
            }
            if (sub === 'config') return { doc: () => ({ get: async () => ({ exists: false }) }) }
            if (sub === 'time_blocks') return { get: async () => snapDocs([]) }
            if (sub === 'audit_log') return { add: addAuditoria }
            if (sub === 'slot_locks') return { doc: () => ({}) }
            throw new Error(`subcolección inesperada en el test: ${sub}`)
          },
        }),
      }
    },
  },
}))

import { POST as portalPOST } from '@/app/api/portal/route'
import { POST as pagoPOST } from '@/app/api/payment/create-checkout/route'
import { crearTokenPaciente } from '@/lib/patient-token'
import { decidirVigencia, REINTENTO_SEG } from '@/lib/portal/vigencia-del-enlace'

function reqPortal(body: unknown, ip = '203.0.113.9') {
  return { json: async () => body, headers: new Headers({ 'x-forwarded-for': ip }) } as unknown as Parameters<typeof portalPOST>[0]
}
function reqPago(body: unknown) {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof pagoPOST>[0]
}

const CITA_FUTURA = {
  id: 'cita-ficticia-1', pacienteId: PACIENTE, pacienteNombre: 'Paciente Ficticio',
  fechaHora: '2099-03-01 10:00', duracion: 30, tipo: 'consulta',
  estado: 'pendiente-confirmar', pagoMonto: 500,
}

beforeEach(() => {
  fallaLecturaDelExpediente = false
  expedientes.clear()
  expedientes.set(`${CLINICA}/${PACIENTE}`, { portalTokenVersion: 0 })
  citasPorClinica.clear()
  citasPorClinica.set(CLINICA, [{ ...CITA_FUTURA }])
  notasPorPaciente.clear()
  updateCita.mockClear()
  setFormulario.mockClear()
  addAuditoria.mockClear()
})

// ═══════════════════════════════════════════════════════════════════════════
describe('REG-331 · 1-2 · el enlace vigente sirve, el revocado no', () => {
  it('1 · token válido y vigente → la sesión funciona (el arreglo no rompe el flujo real)', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(200)
    expect((await res.json()).citas).toHaveLength(1)
  })

  it('2 · token revocado (el expediente subió la versión) → 401, y no se lee ninguna cita', async () => {
    expedientes.set(`${CLINICA}/${PACIENTE}`, { portalTokenVersion: 3 })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(401)
    expect(await res.json()).not.toHaveProperty('citas')
  })

  it('2b · revocar corta TAMBIÉN las mutaciones, no sólo la lectura', async () => {
    expedientes.set(`${CLINICA}/${PACIENTE}`, { portalTokenVersion: 3 })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'confirmar', token, citaId: CITA_FUTURA.id }))
    expect(res.status).toBe(401)
    expect(updateCita).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('REG-331 · 3 · EL INVARIANTE: no poder comprobar la vigencia NO autoriza', () => {
  it('el fallo al leer `portalTokenVersion` NO deja pasar: 503, nunca 200', async () => {
    fallaLecturaDelExpediente = true
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(503)
    expect(res.status).not.toBe(200)
  })

  it('y tampoco escribe: durante la incidencia no se mueve la agenda del consultorio', async () => {
    fallaLecturaDelExpediente = true
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    for (const action of ['confirmar', 'cancelar', 'reagendar'] as const) {
      const res = await portalPOST(reqPortal({ action, token, citaId: CITA_FUTURA.id, nuevaFechaHora: '2099-03-02 11:00' }))
      expect(res.status).toBe(503)
    }
    expect(updateCita).not.toHaveBeenCalled()
  })

  it('ni entrega secreto médico: `documentos` con alcance clínico también cae', async () => {
    fallaLecturaDelExpediente = true
    notasPorPaciente.set(`${CLINICA}/${PACIENTE}`, [{
      estado: 'firmada', fechaConsulta: '2099-01-15',
      diagnosticos: [{ descripcion: 'Diagnóstico ficticio' }],
      medicamentos: [{ nombre: 'Medicamento ficticio' }],
    }])
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico', 0)
    const res = await portalPOST(reqPortal({ action: 'documentos', token }))
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toContain('Medicamento ficticio')
  })

  it('el 503 es RETRYABLE y lo dice: trae `Retry-After`, y no es un 401 que queme el enlace', async () => {
    fallaLecturaDelExpediente = true
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.headers.get('Retry-After')).toBe(String(REINTENTO_SEG))
    expect(res.status).not.toBe(401)
  })

  it('`/api/payment/create-checkout` —que no comprobaba NADA— también cae cerrado', async () => {
    fallaLecturaDelExpediente = true
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await pagoPOST(reqPago({ token, citaId: CITA_FUTURA.id }))
    expect(res.status).toBe(503)
  })

  it('y un enlace REVOCADO ya no abre una sesión de cobro a nombre del paciente', async () => {
    expedientes.set(`${CLINICA}/${PACIENTE}`, { portalTokenVersion: 9 })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await pagoPOST(reqPago({ token, citaId: CITA_FUTURA.id }))
    expect(res.status).toBe(401)
  })

  /**
   * PROBADO AL REVÉS. Se reinserta el defecto —la política vieja, «si la lectura
   * falla se deja pasar»— y se comprueba que la tabla de decisión da otra cosa.
   * Sin esto, un `decidirVigencia` que devolviera siempre `vigente` pasaría los
   * casos 1 y 10 y nadie se enteraría.
   */
  it('AL REVÉS: la política vieja habría dicho «vigente» exactamente donde ésta dice «indeterminado»', () => {
    const politicaVieja = (_v: number, lectura: { ok: boolean }) => lectura.ok ? 'vigente' : 'vigente'
    expect(politicaVieja(0, { ok: false })).toBe('vigente')
    expect(decidirVigencia(0, { ok: false })).toBe('indeterminado')
    expect(decidirVigencia(0, { ok: false })).not.toBe('vigente')
  })

  it('la tabla de decisión, entera y sin red', () => {
    expect(decidirVigencia(0, { ok: true, existe: true, version: 0 })).toBe('vigente')
    expect(decidirVigencia(2, { ok: true, existe: true, version: 2 })).toBe('vigente')
    expect(decidirVigencia(0, { ok: true, existe: true, version: undefined })).toBe('vigente')
    expect(decidirVigencia(0, { ok: true, existe: true, version: 1 })).toBe('revocado')
    expect(decidirVigencia(0, { ok: true, existe: false, version: undefined })).toBe('revocado')
    expect(decidirVigencia(0, { ok: false })).toBe('indeterminado')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('REG-331 · 4-6 · la identidad sale del token firmado y de ningún otro sitio', () => {
  it('4 · token manipulado (se le cambia el paciente al payload) → 401, la firma no cuadra', async () => {
    const bueno = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const [payloadB64, firma] = bueno.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    payload.p = OTRO_PACIENTE
    const falsificado = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${firma}`
    const res = await portalPOST(reqPortal({ action: 'session', token: falsificado }))
    expect(res.status).toBe(401)
  })

  it('4b · y subirse el alcance a `clinico` a mano tampoco cuela', async () => {
    const bueno = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const [payloadB64, firma] = bueno.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    payload.a = 'clinico'
    const falsificado = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${firma}`
    const res = await portalPOST(reqPortal({ action: 'documentos', token: falsificado }))
    expect(res.status).toBe(401)
  })

  it('5 · otro `patientId` en el cuerpo se IGNORA: manda el del token', async () => {
    expedientes.set(`${CLINICA}/${OTRO_PACIENTE}`, { portalTokenVersion: 0 })
    citasPorClinica.set(CLINICA, [
      { ...CITA_FUTURA },
      { id: 'cita-ajena', pacienteId: OTRO_PACIENTE, pacienteNombre: 'Otro Paciente Ficticio', fechaHora: '2099-03-05 09:00', duracion: 30, tipo: 'consulta', estado: 'confirmada' },
    ])
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'session', token, patientId: OTRO_PACIENTE, clinicId: OTRA_CLINICA }))
    expect(res.status).toBe(200)
    const cuerpo = JSON.stringify(await res.json())
    expect(cuerpo).not.toContain('Otro Paciente Ficticio')
  })

  it('5b · y una cita AJENA del mismo consultorio no se puede confirmar por id', async () => {
    citasPorClinica.set(CLINICA, [{ id: 'cita-ajena', pacienteId: OTRO_PACIENTE, fechaHora: '2099-03-05 09:00', duracion: 30, tipo: 'consulta', estado: 'pendiente-confirmar' }])
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'confirmar', token, citaId: 'cita-ajena' }))
    expect(res.status).toBe(404)
    expect(updateCita).not.toHaveBeenCalled()
  })

  it('6 · un token que nombra OTRO consultorio no encuentra expediente → bloqueado en la puerta', async () => {
    // El paciente existe en `CLINICA`, no en `OTRA_CLINICA`. El aislamiento se
    // decide en la autorización, no confiando en que la consulta de después
    // devuelva vacío.
    citasPorClinica.set(OTRA_CLINICA, [{ id: 'cita-vecina', pacienteId: PACIENTE, pacienteNombre: 'Paciente De La Vecina', fechaHora: '2099-04-01 10:00', duracion: 30, tipo: 'consulta', estado: 'confirmada' }])
    const token = crearTokenPaciente(OTRA_CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(401)
    expect(JSON.stringify(await res.json())).not.toContain('Paciente De La Vecina')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('REG-331 · 9 · ni el error ni el log llevan PHI', () => {
  let escrito: string[] = []
  const espias: Array<() => void> = []

  beforeEach(() => {
    escrito = []
    for (const nivel of ['error', 'warn', 'log', 'info'] as const) {
      const s = vi.spyOn(console, nivel).mockImplementation((...args: unknown[]) => {
        escrito.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
      })
      espias.push(() => s.mockRestore())
    }
  })
  afterEach(() => { espias.splice(0).forEach(r => r()) })

  it('el 503 de vigencia no dice de qué paciente es, ni devuelve el token', async () => {
    fallaLecturaDelExpediente = true
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    const cuerpo = JSON.stringify(await res.json())
    expect(cuerpo).not.toContain(PACIENTE)
    expect(cuerpo).not.toContain(token)
  })

  it('y lo que se escribe en consola no lleva el identificador del expediente ni el token', async () => {
    fallaLecturaDelExpediente = true
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    await portalPOST(reqPortal({ action: 'session', token }))
    const todo = escrito.join('\n')
    expect(todo).not.toContain(PACIENTE)
    expect(todo).not.toContain(token)
    // El consultorio SÍ, y a propósito: sin el inquilino la incidencia no se
    // puede localizar, y un clinicId no identifica a ninguna persona.
    expect(todo).toContain(CLINICA)
  })

  it('el 401 del enlace revocado no explica por qué ni de quién', async () => {
    expedientes.set(`${CLINICA}/${PACIENTE}`, { portalTokenVersion: 7 })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    const cuerpo = JSON.stringify(await res.json())
    expect(cuerpo).not.toContain(PACIENTE)
    expect(cuerpo).not.toContain('portalTokenVersion')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('REG-331 · 10 · el enlace legítimo NO se quema por una incidencia', () => {
  it('falla la comprobación, se reintenta cuando Firestore vuelve, y el MISMO token sirve', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)

    fallaLecturaDelExpediente = true
    expect((await portalPOST(reqPortal({ action: 'session', token }))).status).toBe(503)

    fallaLecturaDelExpediente = false
    const res = await portalPOST(reqPortal({ action: 'session', token }))
    expect(res.status).toBe(200)
    expect((await res.json()).citas).toHaveLength(1)
  })

  it('y la mutación que se cayó se puede rehacer: confirmar funciona al volver', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda', 0)

    fallaLecturaDelExpediente = true
    expect((await portalPOST(reqPortal({ action: 'confirmar', token, citaId: CITA_FUTURA.id }))).status).toBe(503)
    expect(updateCita).not.toHaveBeenCalled()

    fallaLecturaDelExpediente = false
    expect((await portalPOST(reqPortal({ action: 'confirmar', token, citaId: CITA_FUTURA.id }))).status).toBe(200)
    expect(updateCita).toHaveBeenCalledTimes(1)
  })
})
