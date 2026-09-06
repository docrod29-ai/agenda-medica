import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * GOLDEN — a las 2 a.m., «me duele el pecho y me falta el aire» recibió
 * «Demasiadas consultas a tus documentos».
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `/api/portal` pedía cupo ANTES de mirar qué había escrito el paciente:
 *
 *     limitarOResponder(portal:{clinic}:{paciente}, 40/10min)   ← general
 *     limitarEstricto(portal:clinico:…, 15/10min)               ← documentos
 *     limitarEstricto(portal:pregunta:…, 8/10min)               ← preguntar
 *     …y sólo después: clasificarPregunta()
 *
 * Cada apertura del portal gastaba varias de esas quince llamadas clínicas
 * (sesión + documentos + paquetes + preguntas). Un paciente asustado que recarga
 * cinco veces agotaba la ventana, y la urgencia que escribía después **no se
 * clasificaba, no se registraba y no avisaba a nadie**: el 429 salía antes.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Panel de Lujo (sep-2026), hallazgo PI-004 del auditor P-interna, P1; el equipo
 * rojo lo confirmó siguiendo el orden real de la ruta. Hermanos: PC-006, PO-008,
 * PP-010 (el gasto de llamadas por apertura).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * Un fallo de ORDEN, el mismo que `urgencia.ts` dejó escrito en su cabecera para
 * el detector de preguntas frecuentes: «el fallo no era de detección: era de
 * ORDEN». Aquí, un piso más abajo: un freno de tasa preguntado antes que la
 * urgencia decide antes de que nadie mire si el paciente se está muriendo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `patient-facing-ai.md` §6: «la urgencia gana a todo lo demás»,
 * `URGENT_REVIEW_REQUIRED` ANTES de cualquier otra clasificación. Un cupo es
 * otra clasificación.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **No abre el freno por IP**, y este archivo lo prueba al revés: con la IP
 *   sin cupo, ni siquiera una urgencia pasa. Ese freno no protege al consultorio
 *   de un paciente angustiado; protege la ruta de una ráfaga automatizada, y
 *   saltárselo daría un camino sin cupo a base de escribir «me duele el pecho»
 *   en cada petición.
 * · No mide el comportamiento de `limitar*` (eso es `nucleo/rate-limit.test.ts`).
 * · No cubre el canal de WhatsApp, que tiene su propio orden y su propia suite.
 * · No cubre qué se le PINTA al paciente: eso es la pantalla del portal.
 */

/** El limitador se dobla: cada clave decide si hay cupo o si devuelve 429. */
const sinCupo = new Set<string>()
vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: async (clave: string) =>
    sinCupo.has(clave) ? new Response(JSON.stringify({ error: 'sin cupo' }), { status: 429 }) : null,
  limitarEstricto: async (clave: string) =>
    sinCupo.has(clave) ? new Response(JSON.stringify({ error: 'sin cupo' }), { status: 429 }) : null,
}))

const getPaciente = vi.fn()
const getPaquetes = vi.fn()
const getConfig = vi.fn()
const addPregunta = vi.fn()
const setTarea = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: (sub: string) => {
          if (sub === 'config') return { doc: () => ({ get: getConfig }) }
          if (sub === 'tareas_clinicas') return { doc: () => ({ set: setTarea }) }
          if (sub === 'patients') {
            return {
              doc: () => ({
                get: getPaciente,
                collection: (s2: string) => {
                  if (s2 === 'paquetes_visita') return { get: getPaquetes }
                  if (s2 === 'preguntas_paciente') return { add: addPregunta }
                  return { where: () => ({ get: async () => ({ docs: [] }) }) }
                },
              }),
            }
          }
          if (sub === 'appointments') return { where: () => ({ get: async () => ({ docs: [] }) }) }
          throw new Error(`subcolección inesperada en el test: ${sub}`)
        },
      }),
    }),
  },
}))

/** El WhatsApp no se manda de verdad: aquí sólo importa que se intente. */
const avisar = vi.fn(async () => undefined)
vi.mock('@/lib/whatsapp/avisar-consultorio', () => ({
  avisarAlConsultorio: (...a: unknown[]) => avisar(...(a as [])),
  telefonoDelConsultorio: () => '5215500000000',
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'

const SECRETO_DEV = 'dev-portal-secret-no-usar-en-produccion-0123456789'
const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-004'
const IP = '203.0.113.44'

function req(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': IP }),
  } as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  vi.stubEnv('PORTAL_PACIENTE_SECRET', SECRETO_DEV)
  sinCupo.clear()
  getPaciente.mockReset()
  getPaquetes.mockReset()
  getConfig.mockReset()
  addPregunta.mockReset()
  setTarea.mockReset()
  avisar.mockReset()
  getPaciente.mockResolvedValue({ exists: true, data: () => ({ portalTokenVersion: 0, nombre: 'Paciente Sintético' }) })
  getPaquetes.mockResolvedValue({ docs: [] })
  getConfig.mockResolvedValue({ exists: false, data: () => undefined })
  addPregunta.mockResolvedValue({ id: 'preg-sintetica-1' })
  setTarea.mockResolvedValue(undefined)
})

const URGENTE = 'me duele el pecho y me falta el aire'
const TRIVIAL = '¿a qué hora abren mañana?'

/** Todas las ventanas POR PACIENTE agotadas — la situación de las 2 a.m. */
function agotarLasVentanasDelPaciente() {
  sinCupo.add(`portal:${CLINICA}:${PACIENTE}`)
  sinCupo.add(`portal:clinico:${CLINICA}:${PACIENTE}`)
  sinCupo.add(`portal:pregunta:${CLINICA}:${PACIENTE}`)
}

describe('PI-004 · con el cupo agotado, la urgencia pasa igual', () => {
  it('AL REVÉS (lo que fallaba): una pregunta NO urgente sí se corta con 429', async () => {
    // Sin este caso, el de abajo se pasaría con un limitador que no limita.
    agotarLasVentanasDelPaciente()
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    const res = await POST(req({ action: 'preguntar', token, texto: TRIVIAL }))
    expect(res.status).toBe(429)
    expect(addPregunta).not.toHaveBeenCalled()
  })

  it('la urgencia se atiende: 200, y NO el 429 que recibía', async () => {
    agotarLasVentanasDelPaciente()
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    const res = await POST(req({ action: 'preguntar', token, texto: URGENTE }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clase).toBe('URGENT_REVIEW_REQUIRED')
  })

  it('y queda escrita en el expediente, que es lo que se perdía', async () => {
    agotarLasVentanasDelPaciente()
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    await POST(req({ action: 'preguntar', token, texto: URGENTE }))
    expect(addPregunta).toHaveBeenCalledTimes(1)
    const doc = addPregunta.mock.calls[0][0] as Record<string, unknown>
    expect(doc.clase).toBe('URGENT_REVIEW_REQUIRED')
    expect(doc.texto).toBe(URGENTE)
  })

  it('y ABRE TAREA: sin eso, nadie del consultorio se entera nunca', async () => {
    agotarLasVentanasDelPaciente()
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    await POST(req({ action: 'preguntar', token, texto: URGENTE }))
    expect(setTarea, 'la urgencia tiene que llegar al worklist').toHaveBeenCalledTimes(1)
  })

  it('un enlace de AGENDA tampoco la rechaza por alcance: no devuelve ningún dato clínico', async () => {
    // Contestar «pide a tu médico el acceso» a quien dice que le falta el aire
    // es responderle que le falta un permiso.
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await POST(req({ action: 'preguntar', token, texto: URGENTE }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clase).toBe('URGENT_REVIEW_REQUIRED')
    // Y no se leyó ni un paquete liberado: la urgencia no abre el expediente.
    expect(getPaquetes).not.toHaveBeenCalled()
    expect(body.procedencia, 'una urgencia no cita el plan de nadie').toBeNull()
  })

  it('control: con alcance agenda, una pregunta NO urgente sigue cerrada con 403', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'agenda')
    const res = await POST(req({ action: 'preguntar', token, texto: TRIVIAL }))
    expect(res.status).toBe(403)
    expect(addPregunta).not.toHaveBeenCalled()
  })
})

describe('PI-004 · lo que la urgencia NO abre', () => {
  it('el freno por IP sigue por delante: ni una urgencia lo salta', async () => {
    /**
     * Probado al revés a propósito. Si la urgencia saltara también este freno,
     * cualquiera tendría un camino sin cupo contra esta ruta escribiendo «me
     * duele el pecho» en cada petición — y el coste lo pagaría el consultorio
     * entero, no quien abusa.
     */
    sinCupo.add(`portal:ip:${IP}`)
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    const res = await POST(req({ action: 'preguntar', token, texto: URGENTE }))
    expect(res.status).toBe(429)
    expect(addPregunta).not.toHaveBeenCalled()
  })

  it('y el cupo clínico sigue vivo para lo que SÍ devuelve secreto médico', async () => {
    // La excepción es de la urgencia, no de la acción: `documentos` no se
    // ablanda porque exista este camino.
    sinCupo.add(`portal:clinico:${CLINICA}:${PACIENTE}`)
    const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico')
    const res = await POST(req({ action: 'documentos', token }))
    expect(res.status).toBe(429)
  })
})
