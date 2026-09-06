/**
 * REP-058 · PI-004 (P-interna) — con el cupo clínico compartido agotado (cinco
 * recargas del portal en 10 minutos), «me duele el pecho y me falta el aire»
 * recibe «Demasiadas consultas a tus documentos»: la urgencia no se registra
 * ni avisa a nadie.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/api/portal/route.ts:56`
 *   `ACCIONES_CLINICAS = new Set(['documentos', 'paquetes', 'preguntar', 'preguntas'])`
 * y `:330-334` `limitarEstricto('portal:clinico:…', 15, 600, 'Demasiadas
 * consultas a tus documentos…')` se cobra ANTES del `switch`, también a
 * `preguntar` — que tiene su propio freno (`:58-71`, `:336-340`) y nunca llega
 * a cobrarlo. Cada carga de `src/app/mi/[token]/page.tsx` dispara documentos +
 * paquetes + preguntas (:258, :276, :289) = 3 del cupo de 15 → a la 6.ª carga
 * todo lo clínico y Preguntar devuelven 429. Con 429 la ruta no llega a :798:
 * no corre `clasificarPregunta`, no se escribe la tarea crítica (:905-920) ni
 * el WhatsApp (:930).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Recorrido del paciente P-interna, observado EN VIVO con pac-001 (enlace
 * clínico): `rate_limits/portal:clinico:…:pac-001` conteo 31 sobre 15, las
 * cuatro preguntas rechazadas. Equipo rojo confirmado P1 verificando el orden
 * literal de los frenos y las tres peticiones por carga.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El freno de «descargar el recetario» se aplica al canal de urgencia. El
 * código se contradice: declara que preguntar «tiene su propio freno» y lo
 * pone detrás del compartido.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * patient-facing-ai §6: la urgencia gana a todo lo demás; «un aviso urgente que
 * llega en el tercer párrafo no llegó» — aquí no llega a ningún párrafo.
 * el-dato-tiene-que-llegar: el dato acababa en un 429.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre la ruta real (`POST` de api/portal), con los dobles de
 * `src/__tests__/la-pregunta-escalada-llega-al-worklist.test.ts` (REG-521) y el
 * limitador doblado para que SÓLO `portal:clinico:*` esté agotado. Es la
 * prueba que el hallazgo pide: «15 lecturas clínicas agotadas → preguntar con
 * texto urgente sigue devolviendo URGENT_REVIEW_REQUIRED y creando la tarea».
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No mide `limitar()` real (nucleo/rate-limit.test.ts). No cubre el cupo por
 * IP (120/10 min) detrás de CGNAT. No decide si el arreglo saca `preguntar`
 * del cupo clínico o cobra un solo tique por carga: exige el resultado. No
 * prueba que la pantalla repita la vía de urgencia junto al error (JSX).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.PORTAL_PACIENTE_SECRET ??= 'secreto-sintetico-de-pruebas-32-caracteres'
})

/** Qué prefijos de clave están AGOTADOS en este caso. */
const agotados: string[] = []
const r429 = () => new Response(JSON.stringify({ ok: false }), { status: 429 }) as unknown
vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: async () => null,
  limitarEstricto: async (clave: string) => (agotados.some(p => clave.startsWith(p)) ? r429() : null),
}))
vi.mock('@/lib/whatsapp/ofrecer-hueco', () => ({ ofrecerHuecoLiberado: vi.fn(async () => undefined) }))
const avisarAlConsultorio = vi.fn(async (..._a: unknown[]) => true)
vi.mock('@/lib/whatsapp/avisar-consultorio', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/whatsapp/avisar-consultorio')>()
  return { ...real, avisarAlConsultorio: (...a: unknown[]) => avisarAlConsultorio(...a) }
})

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'
const tareasEscritas = new Map<string, Record<string, unknown>>()
const preguntasEscritas: Record<string, unknown>[] = []
const notasLeidas = vi.fn(async () => ({ docs: [] }))

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
                    if (s2 === 'preguntas_paciente') {
                      return {
                        add: async (doc: Record<string, unknown>) => {
                          preguntasEscritas.push(doc)
                          return { id: `preg-${preguntasEscritas.length}` }
                        },
                      }
                    }
                    return { where: () => ({ get: notasLeidas }) }
                  },
                }),
              }
            }
            if (sub === 'config') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({}) }) }) }
            if (sub === 'tareas_clinicas') {
              return { doc: (id: string) => ({ set: async (datos: Record<string, unknown>) => { tareasEscritas.set(id, datos) } }) }
            }
            throw new Error(`subcolección inesperada: ${sub}`)
          },
        }),
      }
    },
  },
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'

const URGENTE = 'me duele el pecho y me falta el aire'

function pedir(body: Record<string, unknown>) {
  const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico', 0)
  const req = { json: async () => ({ ...body, token }), headers: new Headers({ 'x-forwarded-for': '203.0.113.9' }) }
  return POST(req as unknown as Parameters<typeof POST>[0])
}

beforeEach(() => {
  agotados.length = 0
  tareasEscritas.clear()
  preguntasEscritas.length = 0
  avisarAlConsultorio.mockClear()
  notasLeidas.mockClear()
})

describe('REP-058 · el cupo clínico agotado no tumba la pregunta urgente', () => {
  it('control: con cupo, la urgencia se clasifica y abre tarea crítica (REG-521 sigue en pie)', async () => {
    const res = await pedir({ action: 'preguntar', texto: URGENTE })
    expect(res.status).toBe(200)
    expect((await res.json()).clase).toBe('URGENT_REVIEW_REQUIRED')
    expect(tareasEscritas.size).toBe(1)
  })

  it('EL CASO: portal:clinico agotado → «preguntar» urgente NO devuelve 429 (hoy: 429 «Demasiadas consultas a tus documentos»)', async () => {
    agotados.push(`portal:clinico:${CLINICA}:${PACIENTE}`)
    const res = await pedir({ action: 'preguntar', texto: URGENTE })
    expect(res.status, 'el freno de documentos se cobró a la urgencia').not.toBe(429)
    expect(res.status).toBe(200)
    expect((await res.json()).clase).toBe('URGENT_REVIEW_REQUIRED')
  })

  it('… y la tarea crítica queda escrita: el consultorio se entera', async () => {
    agotados.push(`portal:clinico:${CLINICA}:${PACIENTE}`)
    await pedir({ action: 'preguntar', texto: URGENTE })
    expect(preguntasEscritas, 'la pregunta ni siquiera se guardó').toHaveLength(1)
    const tareas = [...tareasEscritas.values()]
    expect(tareas, 'sin tarea: nadie del consultorio la ve').toHaveLength(1)
    expect(tareas[0]).toMatchObject({ tipo: 'pregunta_paciente', prioridad: 'critica' })
  })

  it('control AL REVÉS: el cupo clínico agotado SÍ sigue frenando «documentos» (el arreglo no debe abrir el recetario)', async () => {
    agotados.push(`portal:clinico:${CLINICA}:${PACIENTE}`)
    const res = await pedir({ action: 'documentos' })
    expect(res.status).toBe(429)
    expect(notasLeidas).not.toHaveBeenCalled()
  })

  it('control: el freno PROPIO de preguntar agotado sí frena preguntar (8/10 min sigue existiendo)', async () => {
    agotados.push(`portal:pregunta:${CLINICA}:${PACIENTE}`)
    const res = await pedir({ action: 'preguntar', texto: 'Cámbiame la receta.' })
    expect(res.status).toBe(429)
  })
})
