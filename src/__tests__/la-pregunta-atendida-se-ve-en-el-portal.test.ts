import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

/**
 * LA PREGUNTA ATENDIDA SE VE EN EL PORTAL — REG-519 (cierra el bucle de REG-517).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-517 hizo que toda pregunta escalada abriera una tarea en `/pendientes`.
 * El médico la atiende, la cierra con su decisión… y el portal del paciente
 * seguía diciendo «Tu consultorio la tiene pendiente de revisar» para siempre:
 * `atendidaEn` nacía en `null` y ningún código lo escribía. La rama «ya la
 * revisó» del portal era código muerto (lo declaró el propio REG-517).
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `preguntas_paciente` está cerrada al navegador a propósito (`write: if
 * false`): sólo escribe el servidor, con lista blanca. No había ninguna puerta
 * de servidor para el cierre. Y la pantalla que cierra la tarea (cliente) no
 * podía escribir aunque quisiera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. Una ruta de servidor bajo `clinico.escribir` escribe UN campo de negocio
 *    (`atendidaEn`, más `atendidaPor` con el uid de la sesión). Del cuerpo sólo
 *    entran tres identificadores; nada del cuerpo se copia al documento.
 * 2. Idempotente: si ya estaba atendida, no se pisa el instante original.
 * 3. `/pendientes` la llama DESPUÉS de cerrar la tarea, sólo para tareas
 *    `pregunta_paciente` con `preguntaId`, y si falla lo DICE con un toast: la
 *    tarea queda cerrada igual, y nadie cree que el portal ya cambió.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Sin la ruta este archivo no compila. El guardián de abajo, aplicado al
 * `/pendientes` anterior a REG-519, se pone rojo: no llamaba a nada al cerrar.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No renderiza `/pendientes` ni el portal. La ruta se ejecuta de verdad con un
 *   doble de Firestore; la pantalla se vigila por fuente (comentarios fuera).
 * - No responde al paciente. Marcar atendida es constancia; contestar sigue
 *   siendo una llamada o una consulta.
 */

let quienLlama: { ok: boolean; uid?: string; role?: string; clinicIdReal?: string } =
  { ok: true, uid: 'uid-medico', role: 'medico', clinicIdReal: 'clinica-ficticia' }

vi.mock('@/lib/authz/verificar', async () => {
  const { NextResponse } = await import('next/server')
  return {
    verificarCapacidad: async (_req: unknown, clinicId: string, capacidad: string) => {
      if (capacidad !== 'clinico.escribir') throw new Error(`capacidad inesperada: ${capacidad}`)
      if (!quienLlama.ok) return { ok: false, response: NextResponse.json({ ok: false, error: 'Sin permiso' }, { status: 403 }) }
      if (quienLlama.clinicIdReal && clinicId !== quienLlama.clinicIdReal) {
        return { ok: false, response: NextResponse.json({ ok: false, error: 'No tienes acceso a esta clínica.' }, { status: 403 }) }
      }
      return { ok: true, uid: quienLlama.uid, role: quienLlama.role, clinicId }
    },
  }
})

/** Las preguntas ficticias, por ruta `clinica/paciente/pregunta`. */
const preguntas = new Map<string, Record<string, unknown>>()
const escrituras: Array<{ ruta: string; patch: Record<string, unknown> }> = []

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (top: string) => {
      if (top !== 'clinics') throw new Error(`colección superior inesperada: ${top}`)
      return {
        doc: (clinicId: string) => ({
          collection: (sub: string) => {
            if (sub !== 'patients') throw new Error(`subcolección inesperada: ${sub}`)
            return {
              doc: (patientId: string) => ({
                collection: (s2: string) => {
                  if (s2 !== 'preguntas_paciente') throw new Error(`subcolección de paciente inesperada: ${s2}`)
                  return {
                    doc: (preguntaId: string) => {
                      const ruta = `${clinicId}/${patientId}/${preguntaId}`
                      return {
                        get: async () => {
                          const d = preguntas.get(ruta)
                          return { exists: d !== undefined, data: () => d }
                        },
                        update: async (patch: Record<string, unknown>) => {
                          const d = preguntas.get(ruta)
                          if (!d) throw new Error('NOT_FOUND')
                          escrituras.push({ ruta, patch })
                          preguntas.set(ruta, { ...d, ...patch })
                        },
                      }
                    },
                  }
                },
              }),
            }
          },
        }),
      }
    },
  },
}))

import { POST } from '@/app/api/expediente/pregunta-atendida/route'
import { tareaConPregunta, RUTA_PREGUNTA_ATENDIDA } from '@/lib/paciente/marcar-pregunta-atendida'
import { limpiarComentarios } from '@/lib/authz/analisis-estatico'

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'
const PREGUNTA = 'preg-ficticia-1'

function peticion(body: unknown) {
  return new NextRequest('https://ejemplo.test' + RUTA_PREGUNTA_ATENDIDA, {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  quienLlama = { ok: true, uid: 'uid-medico', role: 'medico', clinicIdReal: CLINICA }
  preguntas.clear()
  escrituras.length = 0
  preguntas.set(`${CLINICA}/${PACIENTE}/${PREGUNTA}`, {
    texto: 'Me falta el aire desde anoche.', escalada: true, atendidaEn: null, creadaEn: 1,
  })
})

describe('REG-519 · la ruta que marca atendida la pregunta', () => {
  it('1 · EL CASO: el médico la marca → `atendidaEn` deja de ser null, y el portal ya puede decir «ya la revisó»', async () => {
    const r = await POST(peticion({ clinicId: CLINICA, patientId: PACIENTE, preguntaId: PREGUNTA }))
    expect(r.status).toBe(200)
    const cuerpo = await r.json()
    expect(cuerpo).toMatchObject({ ok: true, yaEstaba: false })
    expect(typeof cuerpo.atendidaEn).toBe('number')
    const d = preguntas.get(`${CLINICA}/${PACIENTE}/${PREGUNTA}`)!
    expect(d.atendidaEn).toBe(cuerpo.atendidaEn)
    expect(d.atendidaPor).toBe('uid-medico')
    // Lo que el portal pinta: `p.atendidaEn ? 'ya la revisó' : 'pendiente'`.
    expect(Boolean(d.atendidaEn)).toBe(true)
  })

  it('2 · lista blanca: se escriben exactamente dos campos, y nada del cuerpo llega al documento', async () => {
    await POST(peticion({ clinicId: CLINICA, patientId: PACIENTE, preguntaId: PREGUNTA, texto: 'INYECTADO', escalada: false, respuesta: 'tómese el doble' }))
    expect(escrituras).toHaveLength(1)
    expect(Object.keys(escrituras[0].patch).sort()).toEqual(['atendidaEn', 'atendidaPor'])
    const d = preguntas.get(`${CLINICA}/${PACIENTE}/${PREGUNTA}`)!
    expect(d.texto).toBe('Me falta el aire desde anoche.')
    expect(d.escalada).toBe(true)
    expect(d).not.toHaveProperty('respuesta')
  })

  it('3 · idempotente: la segunda vez no pisa el instante original y dice `yaEstaba`', async () => {
    const primera = await (await POST(peticion({ clinicId: CLINICA, patientId: PACIENTE, preguntaId: PREGUNTA }))).json()
    const segunda = await (await POST(peticion({ clinicId: CLINICA, patientId: PACIENTE, preguntaId: PREGUNTA }))).json()
    expect(segunda).toMatchObject({ ok: true, yaEstaba: true, atendidaEn: primera.atendidaEn })
    expect(escrituras).toHaveLength(1)
  })

  it('4 · el mostrador no puede: sin `clinico.escribir` → 403 y sin escritura', async () => {
    quienLlama = { ok: false }
    const r = await POST(peticion({ clinicId: CLINICA, patientId: PACIENTE, preguntaId: PREGUNTA }))
    expect(r.status).toBe(403)
    expect(escrituras).toHaveLength(0)
  })

  it('5 · otro consultorio → 403: la membresía manda sobre el cuerpo', async () => {
    const r = await POST(peticion({ clinicId: 'clinica-vecina', patientId: PACIENTE, preguntaId: PREGUNTA }))
    expect(r.status).toBe(403)
    expect(escrituras).toHaveLength(0)
  })

  it('6 · una pregunta que no existe → 404, sin escribir ni inventar', async () => {
    const r = await POST(peticion({ clinicId: CLINICA, patientId: PACIENTE, preguntaId: 'no-existe' }))
    expect(r.status).toBe(404)
    expect(escrituras).toHaveLength(0)
  })

  it('7 · ids con forma inválida → 400 antes de tocar nada', async () => {
    const r = await POST(peticion({ clinicId: CLINICA, patientId: '../otro', preguntaId: PREGUNTA }))
    expect(r.status).toBe(400)
    expect(escrituras).toHaveLength(0)
  })
})

describe('REG-519 · /pendientes marca la pregunta al cerrar SU tarea, y sólo la suya', () => {
  it('`tareaConPregunta` sólo acepta pregunta_paciente con preguntaId', () => {
    expect(tareaConPregunta({ tipo: 'pregunta_paciente', preguntaId: 'p1' })).toBe(true)
    expect(tareaConPregunta({ tipo: 'pregunta_paciente' })).toBe(false)
    expect(tareaConPregunta({ tipo: 'resultado_por_revisar', preguntaId: 'p1' })).toBe(false)
  })

  it('la pantalla llama a marcarPreguntaAtendida al cerrar, DESPUÉS de cambiarEstado, y enseña el fallo (comentarios fuera)', () => {
    const src = limpiarComentarios(readFileSync(join(process.cwd(), 'src/app/(dashboard)/pendientes/page.tsx'), 'utf8'))
    const cambia = src.indexOf('await cambiarEstado(clinicId, t, nuevo, extra)')
    const marca = src.indexOf('await marcarPreguntaAtendida(clinicId, t.patientId, t.preguntaId)')
    expect(cambia).toBeGreaterThan(-1)
    expect(marca, 'al cerrar la tarea de una pregunta nadie avisa al servidor: el portal dirá «pendiente» para siempre').toBeGreaterThan(cambia)
    expect(src).toMatch(/nuevo === 'cerrada' && tareaConPregunta\(t\)/)
    // El fallo no se traga: el motivo llega a un toast.
    expect(src).toMatch(/if \(!m\.ok\) toast\(m\.motivo, 'error'\)/)
  })
})
