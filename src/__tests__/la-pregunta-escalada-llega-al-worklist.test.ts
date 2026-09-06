import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * LA PREGUNTA ESCALADA LLEGA AL WORKLIST, HAYA TELÉFONO O NO — REG-521.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * PATIENT-AI-001 (REG-446) abrió «Preguntar» en el portal. La pregunta se
 * clasifica sin modelo, se guarda en `preguntas_paciente` ANTES de contestar,
 * y si el motor la escala sale un WhatsApp al consultorio. El checkpoint lo
 * declaró: «no hay pantalla del médico para lo que se escaló».
 *
 * El hueco era mayor que una pantalla que falta. El WhatsApp sólo se intentaba
 * si había `whatsappConsultorio` o `telefonoAdmin`; sin ellos —el estado de un
 * consultorio recién abierto en su prueba de 14 días— no se intentaba nada, no
 * corría `registrarNoEntregado`, y ninguna pantalla lee `preguntas_paciente`.
 * «Me falta el aire desde anoche» → `URGENT_REVIEW_REQUIRED` → documento
 * escrito, cero avisos, cero rastro en el producto, y en la pantalla del
 * paciente: «el consultorio la va a ver».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Dos auditorías read-only independientes del 5-sep-2026 (experiencia del
 * paciente y seguridad) llegaron a la misma línea:
 * `if (r.avisarAlConsultorio && telConsultorio)`. Siguiendo el dato de punta
 * a punta: paciente → API → Firestore → **nadie** → paciente.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Un solo canal, condicional, hacia un chat sin estado. «El dato tiene que
 * LLEGAR»: el dato acababa en la función que lo escribe. El producto ya tenía
 * el sitio donde un humano del consultorio mira lo que espera decisión
 * (`tareas_clinicas`, `/pendientes`), y la pregunta no entraba ahí.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Toda pregunta que el motor escala (o marca urgente) abre una
 * `TareaClinica` de tipo `pregunta_paciente`, escrita por el servidor, ANTES
 * del WhatsApp y SIN condicionarla al teléfono. El WhatsApp es el aviso; el
 * worklist es el rastro. Urgente → `critica`; escalada → `alta`. Id derivado
 * de la pregunta: un reintento no abre dos.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la ruta como estaba, los casos 1, 2, 4 y 5 se ponen rojos: el doble de
 * `tareas_clinicas` no recibe ninguna escritura (medido: 4 rojos, 4 verdes).
 * El caso 3 (administrativa) y los de la función pura estaban verdes antes y
 * siguen verdes: el arreglo sólo AÑADE.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Cerrar la tarea todavía NO marca `atendidaEn` en la pregunta: el portal
 *   del paciente sigue diciendo «pendiente de revisar» aunque el médico la
 *   haya contestado por teléfono. `preguntaId` va en la tarea para eso; el
 *   cierre exige una ruta de servidor (las reglas cierran la colección al
 *   navegador) y es la unidad siguiente, declarada.
 * - No cambia el texto que ve el paciente. «El consultorio la va a ver» es
 *   verdad desde hoy porque el worklist existe; que además se le AVISE en
 *   tiempo real sigue dependiendo del teléfono, y el aviso urgente ya le dice
 *   que llame.
 * - No mira `/pendientes` en un navegador: comprueba que la tarea quede
 *   escrita con la forma que esa pantalla lee (tipo, prioridad,
 *   `pesoUrgencia`, `estado`), no que se pinte.
 */

vi.hoisted(() => {
  process.env.PORTAL_PACIENTE_SECRET ??= 'secreto-sintetico-de-pruebas-32-caracteres'
})

vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder: async () => null,
  limitarEstricto: async () => null,
}))
vi.mock('@/lib/whatsapp/ofrecer-hueco', () => ({ ofrecerHuecoLiberado: vi.fn(async () => undefined) }))

const avisarAlConsultorio = vi.fn(async (..._a: unknown[]) => true)
vi.mock('@/lib/whatsapp/avisar-consultorio', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/whatsapp/avisar-consultorio')>()
  // `telefonoDelConsultorio` es el REAL: el caso 1 depende de que con la
  // configuración vacía devuelva ''. Sólo se dobla el envío.
  return { ...real, avisarAlConsultorio: (...a: unknown[]) => avisarAlConsultorio(...a) }
})

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'

/** Configuración del consultorio, mutable por caso. Sin teléfono por omisión. */
let config: Record<string, unknown> = {}
/** Lo que se escribió en `tareas_clinicas`: id → { datos, opciones }. */
const tareasEscritas = new Map<string, { datos: Record<string, unknown>; opciones: unknown }>()
const preguntasEscritas: Record<string, unknown>[] = []

vi.mock('@/lib/firebase-admin', () => ({
  default: { firestore: { FieldValue: { increment: () => 'inc' } } },
  adminDb: {
    collection: (top: string) => {
      if (top !== 'clinics') throw new Error(`colección superior inesperada en el test: ${top}`)
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
                    throw new Error(`subcolección de paciente inesperada: ${s2}`)
                  },
                }),
              }
            }
            if (sub === 'config') return { doc: () => ({ get: async () => ({ exists: true, data: () => config }) }) }
            if (sub === 'tareas_clinicas') {
              return {
                doc: (id: string) => ({
                  set: async (datos: Record<string, unknown>, opciones: unknown) => {
                    tareasEscritas.set(id, { datos, opciones })
                  },
                }),
              }
            }
            throw new Error(`subcolección inesperada en el test: ${sub}`)
          },
        }),
      }
    },
  },
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'
import { pesoDeUrgencia } from '@/lib/tareas-clinicas/modelo'
import { estadoDeAccion } from '@/lib/tareas-clinicas/estado-de-accion'
import { idDeTareaDePregunta, tareaDeUnaPregunta, prioridadDeUnaPregunta } from '@/lib/tareas-clinicas/de-una-pregunta'

function preguntar(texto: string) {
  const token = crearTokenPaciente(CLINICA, PACIENTE, 7, 'clinico', 0)
  const req = { json: async () => ({ action: 'preguntar', token, texto }), headers: new Headers({ 'x-forwarded-for': '203.0.113.9' }) }
  return POST(req as unknown as Parameters<typeof POST>[0])
}

beforeEach(() => {
  config = {}
  tareasEscritas.clear()
  preguntasEscritas.length = 0
  avisarAlConsultorio.mockClear()
})

describe('REG-521 · la escalación abre una tarea en el worklist', () => {
  it('1 · EL CASO: urgente, consultorio SIN teléfono → tarea crítica escrita, y ningún WhatsApp intentado', async () => {
    const res = await preguntar('Me falta el aire desde anoche.')
    expect(res.status).toBe(200)
    const cuerpo = await res.json()
    expect(cuerpo.clase).toBe('URGENT_REVIEW_REQUIRED')
    expect(cuerpo.escalada).toBe(true)

    // Antes del arreglo: `preguntasEscritas` tenía 1 y `tareasEscritas` 0.
    expect(preguntasEscritas).toHaveLength(1)
    const id = idDeTareaDePregunta('preg-1')
    const t = tareasEscritas.get(id)
    expect(t, 'la pregunta se guardó y NADIE del consultorio tiene dónde verla').toBeDefined()
    expect(t!.datos).toMatchObject({
      clinicId: CLINICA,
      patientId: PACIENTE,
      patientNombre: 'Paciente Ficticio',
      tipo: 'pregunta_paciente',
      prioridad: 'critica',
      pesoUrgencia: pesoDeUrgencia('critica'),
      estado: 'solicitada',
      origen: 'portal:pregunta',
      preguntaId: 'preg-1',
      detalle: 'Me falta el aire desde anoche.',
    })
    expect(String(t!.datos.titulo)).toMatch(/^Pregunta del paciente: /)
    expect(t!.opciones).toEqual({ merge: true })
    // Sin teléfono no había a quién avisar — y eso ya no significa que nadie se entere.
    expect(avisarAlConsultorio).not.toHaveBeenCalled()
  })

  it('2 · escalada (no urgente) → prioridad alta, y el worklist la agrupa como «necesita revisión»', async () => {
    const res = await preguntar('Cámbiame la receta.')
    expect((await res.json()).clase).toBe('ESCALATE_TO_CLINICIAN')
    const t = tareasEscritas.get(idDeTareaDePregunta('preg-1'))
    expect(t).toBeDefined()
    expect(t!.datos.prioridad).toBe('alta')
    expect(t!.datos.pesoUrgencia).toBe(pesoDeUrgencia('alta'))
    expect(estadoDeAccion(t!.datos as never, Date.now())).toBe('necesita_revision')
  })

  it('3 · una pregunta administrativa NO abre tarea: el worklist no se llena de lo que el paciente resuelve solo', async () => {
    const res = await preguntar('¿Cuándo es mi cita?')
    const cuerpo = await res.json()
    expect(cuerpo.clase).toBe('ADMINISTRATIVE_ACTION')
    expect(cuerpo.escalada).toBe(false)
    expect(preguntasEscritas).toHaveLength(1)
    expect(tareasEscritas.size).toBe(0)
  })

  it('4 · la tarea se escribe ANTES de intentar el WhatsApp, y con teléfono se escriben las dos cosas', async () => {
    config = { whatsappConsultorio: '5215550000000' }
    const orden: string[] = []
    avisarAlConsultorio.mockImplementation(async () => { orden.push('whatsapp'); return true })
    const escribirOriginal = tareasEscritas.set.bind(tareasEscritas)
    tareasEscritas.set = (k, v) => { orden.push('tarea'); return escribirOriginal(k, v) }
    try {
      await preguntar('Me falta el aire desde anoche.')
    } finally {
      tareasEscritas.set = escribirOriginal
    }
    expect(orden).toEqual(['tarea', 'whatsapp'])
    expect(avisarAlConsultorio).toHaveBeenCalledTimes(1)
  })

  it('5 · el id se deriva de la pregunta: dos preguntas son dos tareas, y la misma pregunta nunca dos', async () => {
    await preguntar('Cámbiame la receta.')
    await preguntar('Ya dejé de tomarlo.')
    expect([...tareasEscritas.keys()].sort()).toEqual([idDeTareaDePregunta('preg-1'), idDeTareaDePregunta('preg-2')])
  })
})

describe('REG-521 · la función pura que arma la tarea', () => {
  const base = {
    clinicId: CLINICA, patientId: PACIENTE, preguntaId: 'preg-x',
    clase: 'ESCALATE_TO_CLINICIAN' as const, motivo: 'cambio_de_dosis' as const,
    texto: '¿Puedo tomarme el doble?', ahoraIso: '2026-09-05T12:00:00.000Z',
  }

  it('urgente es crítica; escalada es alta — no hay tercera opción para algo que un humano espera', () => {
    expect(prioridadDeUnaPregunta('URGENT_REVIEW_REQUIRED')).toBe('critica')
    expect(prioridadDeUnaPregunta('ESCALATE_TO_CLINICIAN')).toBe('alta')
  })

  it('el título dice POR QUÉ llegó, sin diagnóstico ni opinión', () => {
    expect(tareaDeUnaPregunta(base).titulo).toBe('Pregunta del paciente: pregunta por cambiar una dosis')
    expect(tareaDeUnaPregunta({ ...base, clase: 'URGENT_REVIEW_REQUIRED', motivo: 'dificultad_respiratoria' }).titulo)
      .toBe('Pregunta del paciente: dificultad para respirar')
    expect(tareaDeUnaPregunta({ ...base, motivo: null }).titulo).toMatch(/no se pudo contestar desde el plan/)
  })

  it('no pone `venceEn` ni ningún campo en `undefined`: la fecha sería inventada y el undefined revienta en Firestore', () => {
    const t = tareaDeUnaPregunta(base)
    expect('venceEn' in t).toBe(false)
    expect(Object.values(t).some(v => v === undefined)).toBe(false)
    expect(tareaDeUnaPregunta({ ...base, patientNombre: 'Ficticio' }).patientNombre).toBe('Ficticio')
  })
})
