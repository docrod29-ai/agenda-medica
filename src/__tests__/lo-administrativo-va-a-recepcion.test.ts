/**
 * LO ADMINISTRATIVO VA A RECEPCIÓN, Y EL CAMBIO DE ÚLTIMA HORA SE PIDE DESDE EL
 * PORTAL — D-055 y D-056.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * 1. Dentro de las 12 h el portal decía «Llama al consultorio» en un 422, DESPUÉS
 *    de que el paciente tocara Reagendar o Cancelar. El teléfono no es un
 *    producto, y el consultorio no se enteraba de que alguien quería cambiar.
 * 2. Una pregunta administrativa («¿cuánto cuesta?», «¿dónde queda?») recibía un
 *    texto enlatado con `avisarAlConsultorio: false`: no abría tarea, no avisaba
 *    a nadie. La decisión del dueño (9-sep-2026): administrativo → recepción;
 *    clínico → médico.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría del 10-sep-2026 de las ocho decisiones de agenda/portal contra el
 * código: D «parcial» (falta la mitad de «solicita el cambio»), G «parcial» (lo
 * administrativo nunca llega a recepción).
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * - El servidor dice por cada cita si `cambioEnLinea` (≥ 12 h en la zona del
 *   consultorio). La pantalla ofrece «pedir un cambio» cuando es `false`.
 * - `solicitar-cambio` NO toca la cita: escribe una pregunta administrativa del
 *   paciente (con `citaId`) y una tarea de RECEPCIÓN colgada de esa cita.
 * - Toda pregunta `ADMINISTRATIVE_ACTION` abre tarea de recepción con prioridad
 *   normal y queda `escalada`, para que el portal enseñe «pendiente / revisada».
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la ruta anterior: `solicitar-cambio` cae al `default` (acción desconocida),
 * `cambioEnLinea` no existe en la sesión, y la administrativa deja
 * `tareasEscritas` vacío (el caso 3 del worklist lo afirmaba así).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - La pantalla del portal (`/mi/[token]`): se comprueba en fuente que ofrece la
 *   acción cuando `cambioEnLinea === false`, no se ejecuta en navegador.
 * - Que recepción CIERRE la tarea: `/api/expediente/pregunta-atendida` ya tiene
 *   su prueba (`la-pregunta-atendida-se-ve-en-el-portal`).
 * - El reparto por rol dentro de `/pendientes`: hoy la tarea lleva `area` y la
 *   pantalla la etiqueta «Recepción»; no hay bandeja separada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

vi.hoisted(() => {
  process.env.PORTAL_PACIENTE_SECRET ??= 'secreto-sintetico-de-pruebas-32-caracteres'
})
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: async () => null, limitarEstricto: async () => null }))
vi.mock('@/lib/whatsapp/ofrecer-hueco', () => ({ ofrecerHuecoLiberado: vi.fn(async () => undefined) }))
vi.mock('@/lib/calendario/sincronizar-servidor', () => ({
  sincronizarCitaDelPortal: vi.fn(async () => undefined), estadoDeSync: () => 'ok',
}))
const avisarAlConsultorio = vi.fn(async (..._a: unknown[]) => true)
vi.mock('@/lib/whatsapp/avisar-consultorio', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/whatsapp/avisar-consultorio')>()
  return { ...real, avisarAlConsultorio: (...a: unknown[]) => avisarAlConsultorio(...a) }
})

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'
const TZ = 'America/Mexico_City'

let config: Record<string, unknown> = { zonaHoraria: TZ, whatsappConsultorio: '5215550000000' }
const citas = new Map<string, Record<string, unknown>>()
const citasEscritas: Record<string, unknown>[] = []
const tareasEscritas = new Map<string, { datos: Record<string, unknown>; opciones: unknown }>()
const preguntasEscritas: Record<string, unknown>[] = []

vi.mock('@/lib/firebase-admin', () => ({
  default: { firestore: { FieldValue: { increment: () => 'inc' } } },
  adminDb: {
    collection: (top: string) => {
      if (top !== 'clinics') throw new Error(`colección superior inesperada: ${top}`)
      return {
        doc: (clinicId: string) => ({
          get: async () => ({ exists: true, data: () => ({ nombreClinica: 'Clínica Ficticia' }) }),
          collection: (sub: string) => {
            if (sub === 'patients') {
              return {
                doc: (patientId: string) => ({
                  get: async () => ({
                    exists: clinicId === CLINICA && patientId === PACIENTE,
                    data: () => ({ nombre: 'Paciente Ficticio', portalTokenVersion: 0 }),
                  }),
                  collection: (s2: string) => {
                    if (s2 === 'paquetes_visita') return { get: async () => ({ docs: [] }) }
                    if (s2 === 'formularios_previos') return { doc: () => ({ get: async () => ({ exists: false }) }) }
                    if (s2 === 'preguntas_paciente') {
                      return {
                        add: async (doc: Record<string, unknown>) => { preguntasEscritas.push(doc); return { id: `preg-${preguntasEscritas.length}` } },
                        get: async () => ({ docs: [] }),
                      }
                    }
                    return { get: async () => ({ docs: [], empty: true }) }
                  },
                }),
              }
            }
            if (sub === 'config') return { doc: () => ({ get: async () => ({ exists: true, data: () => config }) }) }
            if (sub === 'appointments') {
              const docs = () => [...citas.entries()].map(([id, d]) => ({ id, data: () => d }))
              return {
                doc: (id: string) => ({
                  get: async () => ({ exists: citas.has(id), id, data: () => citas.get(id) }),
                  update: async (d: Record<string, unknown>) => { citasEscritas.push({ id, ...d }) },
                }),
                where: () => ({ get: async () => ({ docs: docs().filter(d => d.data().pacienteId === PACIENTE), empty: false }) }),
              }
            }
            if (sub === 'tareas_clinicas') {
              return { doc: (id: string) => ({ set: async (datos: Record<string, unknown>, opciones: unknown) => { tareasEscritas.set(id, { datos, opciones }) } }) }
            }
            if (sub === 'time_blocks' || sub === 'bloqueos') return { where: () => ({ get: async () => ({ docs: [], empty: true }) }), get: async () => ({ docs: [], empty: true }) }
            return { doc: () => ({ get: async () => ({ exists: false }) }), where: () => ({ get: async () => ({ docs: [], empty: true }) }), get: async () => ({ docs: [], empty: true }) }
          },
        }),
      }
    },
  },
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'
import { idDeTareaDePregunta, ORIGEN_SOLICITUD_DE_CAMBIO } from '@/lib/tareas-clinicas/de-una-pregunta'
import { HORAS_CAMBIO_PACIENTE } from '@/lib/portal/estados'

function llamar(action: string, extra: Record<string, unknown> = {}, alcance: 'agenda' | 'clinico' = 'clinico') {
  const token = crearTokenPaciente(CLINICA, PACIENTE, 7, alcance, 0)
  const req = { json: async () => ({ action, token, ...extra }), headers: new Headers({ 'x-forwarded-for': '203.0.113.9' }) }
  return POST(req as unknown as Parameters<typeof POST>[0])
}

/** Hora de pared del consultorio, `horas` horas a partir de ahora. */
function fechaHoraEn(horas: number): string {
  const d = new Date(Date.now() + horas * 3_600_000)
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const g = (t: string) => f.find(p => p.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`
}

beforeEach(() => {
  config = { zonaHoraria: TZ, whatsappConsultorio: '5215550000000' }
  citas.clear(); citasEscritas.length = 0; tareasEscritas.clear(); preguntasEscritas.length = 0
  avisarAlConsultorio.mockClear()
  citas.set('cita-pronto', { pacienteId: PACIENTE, fechaHora: fechaHoraEn(3), duracion: 30, tipo: 'seguimiento', estado: 'confirmada', medicoNombre: 'Dra.' })
  citas.set('cita-lejos', { pacienteId: PACIENTE, fechaHora: fechaHoraEn(HORAS_CAMBIO_PACIENTE + 30), duracion: 30, tipo: 'seguimiento', estado: 'confirmada', medicoNombre: 'Dra.' })
})

describe('D-055 · la sesión dice qué cita se puede cambiar en línea', () => {
  it('a 3 h → cambioEnLinea false; a más de 12 h → true', async () => {
    const res = await llamar('session', {}, 'agenda')
    expect(res.status).toBe(200)
    const cuerpo = await res.json()
    const porId = Object.fromEntries((cuerpo.citas as { id: string; cambioEnLinea: boolean }[]).map(c => [c.id, c.cambioEnLinea]))
    expect(porId).toEqual({ 'cita-pronto': false, 'cita-lejos': true })
    expect(cuerpo.minHoras).toBe(HORAS_CAMBIO_PACIENTE)
  })

  it('cancelar dentro de la ventana sigue negándose, y el mensaje ya no manda a llamar: manda a pedir el cambio aquí', async () => {
    const res = await llamar('cancelar', { citaId: 'cita-pronto' }, 'agenda')
    expect(res.status).toBe(422)
    const { error } = await res.json()
    expect(error).toMatch(/desde aquí/)
    expect(error).not.toMatch(/Llama/)
    expect(citasEscritas).toHaveLength(0)
  })
})

describe('D-055 · solicitar-cambio', () => {
  it('EL CASO: escribe la pregunta con la cita, abre tarea de RECEPCIÓN colgada de la cita, avisa, y NO toca la cita', async () => {
    const res = await llamar('solicitar-cambio', { citaId: 'cita-pronto', texto: 'No llego a las 10, ¿a las 12?' }, 'agenda')
    expect(res.status).toBe(200)
    const cuerpo = await res.json()
    expect(cuerpo.ok).toBe(true)
    expect(cuerpo.texto).toMatch(/tu cita sigue como estaba/)

    expect(preguntasEscritas).toHaveLength(1)
    expect(preguntasEscritas[0]).toMatchObject({
      clase: 'ADMINISTRATIVE_ACTION', escalada: true, respondida: false, citaId: 'cita-pronto', origen: ORIGEN_SOLICITUD_DE_CAMBIO,
    })
    expect(String(preguntasEscritas[0].texto)).toContain('No llego a las 10')

    const t = tareasEscritas.get(idDeTareaDePregunta('preg-1'))
    expect(t, 'la solicitud se guardó y nadie del consultorio tiene dónde verla').toBeDefined()
    expect(t!.datos).toMatchObject({
      clinicId: CLINICA, patientId: PACIENTE, patientNombre: 'Paciente Ficticio',
      tipo: 'pregunta_paciente', area: 'recepcion', prioridad: 'normal', estado: 'solicitada',
      citaId: 'cita-pronto', preguntaId: 'preg-1', origen: ORIGEN_SOLICITUD_DE_CAMBIO,
    })
    expect(String(t!.datos.detalle)).toContain('No llego a las 10')
    expect(avisarAlConsultorio).toHaveBeenCalledTimes(1)
    expect(String(avisarAlConsultorio.mock.calls[0][2])).toMatch(/pide cambiar su cita/)
    // La cita no se mueve ni se cancela: decide el consultorio.
    expect(citasEscritas).toHaveLength(0)
  })

  it('una cita ajena o inexistente → 404, y no se escribe nada', async () => {
    citas.set('cita-de-otro', { pacienteId: 'otro-paciente', fechaHora: fechaHoraEn(3), estado: 'confirmada' })
    expect((await llamar('solicitar-cambio', { citaId: 'cita-de-otro' }, 'agenda')).status).toBe(404)
    expect((await llamar('solicitar-cambio', { citaId: 'no-existe' }, 'agenda')).status).toBe(404)
    expect(preguntasEscritas).toHaveLength(0)
    expect(tareasEscritas.size).toBe(0)
  })

  it('una cita ya terminal (cancelada) → 409: no hay nada que cambiar', async () => {
    citas.set('cita-cancelada', { pacienteId: PACIENTE, fechaHora: fechaHoraEn(3), estado: 'cancelada' })
    expect((await llamar('solicitar-cambio', { citaId: 'cita-cancelada' }, 'agenda')).status).toBe(409)
    expect(tareasEscritas.size).toBe(0)
  })

  it('sin teléfono del consultorio la tarea se escribe igual: el worklist es el rastro, el WhatsApp es el aviso', async () => {
    config = { zonaHoraria: TZ }
    const res = await llamar('solicitar-cambio', { citaId: 'cita-pronto', texto: 'x' }, 'agenda')
    expect(res.status).toBe(200)
    expect(tareasEscritas.size).toBe(1)
    expect(avisarAlConsultorio).not.toHaveBeenCalled()
  })
})

describe('D-056 · una pregunta administrativa llega a recepción', () => {
  it('EL CASO: «¿cuánto cuesta la consulta?» → tarea de recepción, prioridad normal, escalada, y el paciente sabe que la verán', async () => {
    const res = await llamar('preguntar', { texto: '¿Cuánto cuesta la consulta?' })
    expect(res.status).toBe(200)
    const cuerpo = await res.json()
    expect(cuerpo.clase).toBe('ADMINISTRATIVE_ACTION')
    expect(cuerpo.escalada).toBe(true)
    expect(String(cuerpo.texto)).toMatch(/Tu consultorio también lo verá/)
    expect(preguntasEscritas[0]).toMatchObject({ escalada: true })
    const t = tareasEscritas.get(idDeTareaDePregunta('preg-1'))
    expect(t).toBeDefined()
    expect(t!.datos).toMatchObject({ area: 'recepcion', prioridad: 'normal', tipo: 'pregunta_paciente', preguntaId: 'preg-1' })
    expect(avisarAlConsultorio).toHaveBeenCalledTimes(1)
  })

  it('lo clínico sigue siendo del MÉDICO: la tarea no lleva área de recepción', async () => {
    await llamar('preguntar', { texto: 'Cámbiame la receta.' })
    const t = tareasEscritas.get(idDeTareaDePregunta('preg-1'))
    expect(t).toBeDefined()
    expect(t!.datos.area).toBeUndefined()
    expect(t!.datos.prioridad).toBe('alta')
  })
})

describe('la pantalla del portal ofrece pedir el cambio (fuente)', () => {
  const src = readFileSync('src/app/mi/[token]/page.tsx', 'utf8')
  it('cuando cambioEnLinea es false no enseña Reagendar/Cancelar y sí «Pedir un cambio al consultorio»', () => {
    expect(src).toMatch(/c\.cambioEnLinea !== false \? \(/)
    expect(src).toMatch(/Pedir un cambio al consultorio/)
    expect(src).toMatch(/accionCita\('solicitar-cambio'/)
  })
  it('y el formulario tiene etiqueta accesible', () => {
    expect(src).toMatch(/aria-label="Pedir un cambio de cita al consultorio"/)
    expect(src).toMatch(/htmlFor=\{`solicitud-\$\{c\.id\}`\}/)
  })
})
