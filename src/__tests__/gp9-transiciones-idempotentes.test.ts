/**
 * GOLDEN PATH 9 — agenda / check-in / pago / inicio no duplican estado.
 *
 * Este archivo NO inventa otro motor: fija con pruebas las primitivas que ya usa
 * Consultorio. El alta viaja por la transacción de /api/appointments; el check-in
 * muta el MISMO documento de cita; Stripe usa id determinista; y «Iniciar
 * consulta» navega al paciente, mientras el primer borrador se crea detrás de la
 * cadena serializada y fija notaIdRef antes del siguiente guardado.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cambiosPorTransicion } from '@/lib/agenda/contadores-paciente'

const root = process.cwd()
const firestore = readFileSync(join(root, 'src/lib/firestore.ts'), 'utf8')
const citas = readFileSync(join(root, 'src/app/(dashboard)/citas/page.tsx'), 'utf8')
const consulta = readFileSync(join(root, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
const anticipo = readFileSync(join(root, 'src/app/api/stripe/webhook/route.ts'), 'utf8')

describe('GP9 — transiciones idempotentes', () => {
  it('check-in repetido no incrementa contadores ni fabrica otra cita', () => {
    expect(cambiosPorTransicion('en-sala', 'en-sala', '2026-08-24 10:00')).toEqual({})
    expect(cambiosPorTransicion('en-consulta', 'en-consulta', '2026-08-24 10:00')).toEqual({})
    // updateAppointment escribe por id con updateDoc; no existe un addDoc en este camino.
    const inicio = firestore.indexOf('export async function updateAppointment')
    const fin = firestore.indexOf('// ── Patients', inicio)
    const bloque = firestore.slice(inicio, fin)
    expect(bloque).toContain('updateDoc(d(clinicId, COLLECTIONS.appointments, id)')
    expect(bloque).not.toContain('addDoc(')
  })

  it('el botón Iniciar/Continuar consulta navega; no crea un encuentro por cada tap', () => {
    expect(citas).toContain("if (e === 'en-consulta' && appt.pacienteId) return { tipo: 'consulta', label: 'Continuar consulta' }")
    expect(citas).toContain("if (e === 'en-sala' && appt.pacienteId) return { tipo: 'consulta', label: 'Iniciar consulta' }")
    expect(citas).toContain("case 'consulta': onConsulta(appt.pacienteId); break")
    expect(citas).toContain('onConsulta={pid => router.push(`/consulta/${pid}`)}')
  })

  it('el primer borrador de consulta se serializa, conserva la clave del encuentro y publica su id antes de otro guardado', () => {
    expect(consulta).toContain('const tarea = cadenaGuardadoRef.current.then(async () => {')
    expect(consulta).toContain('const idActual = notaIdRef.current')
    expect(consulta).toContain('const claveEncuentroRef = useRef<string | null>(null)')
    expect(consulta).toContain('cita:${citaDeHoyIdRef.current}')
    expect(consulta).toContain('sesion:${claveDeIntento()}')
    expect(consulta).toContain('const id = await createNota(clinicId, patientId, nota, { claveEncuentro: claveEncuentro() })')
    expect(consulta).toContain('notaIdRef.current = id   // marca síncrona ANTES de re-render')
    expect(consulta).toContain('cadenaGuardadoRef.current = tarea.catch(() => {})')
  })

  it('el pago de anticipo converge al documento Stripe de la misma sesión', () => {
    expect(anticipo).toContain('`stripe_${session.id}`')
    expect(anticipo).toContain('.create(')
    // Un alta con id aleatorio volvería posible dos cargos lógicos para el mismo checkout.
    expect(anticipo).not.toContain("collection('cobros').add(")
  })
})
