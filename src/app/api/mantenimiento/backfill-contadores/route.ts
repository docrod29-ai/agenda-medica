import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'

/**
 * Reconstruye `noShowCount`, `cancelacionCount` y `ultimaCita` a partir de las
 * citas que ya existen.
 *
 * POR QUÉ HACE FALTA: esos tres campos se leían en cuatro pantallas —el badge de
 * riesgo de no-show, el CRM, la campaña de reactivación y la retención NOM-004—
 * pero NUNCA se escribían. Se inicializaban en 0 al crear el paciente y ahí se
 * quedaban. Ya se corrigió el camino que los mantiene al día, pero eso solo
 * detiene la hemorragia: el historial anterior sigue en cero.
 *
 * Es IDEMPOTENTE: recalcula desde las citas y ESCRIBE EL TOTAL, no incrementa.
 * Correrlo dos veces da el mismo resultado. Esa es la razón de recalcular en vez
 * de sumar: un backfill que incrementa es un backfill que no se puede repetir si
 * se corta a la mitad.
 *
 * Solo médico/admin: reescribe datos de todos los pacientes del consultorio.
 * Con `?simular=1` no escribe nada y devuelve lo que haría — conviene mirarlo
 * antes, sobre todo si se corre por primera vez.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const NO_SHOW = 'no-asistio'
const CANCELADA = 'cancelada'
const ATENDIDAS = new Set(['atendida', 'finalizada', 'pagada'])

export async function POST(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  const simular = req.nextUrl.searchParams.get('simular') === '1'

  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response

  const clinicRef = adminDb.collection('clinics').doc(clinicId)

  let citasLeidas = 0
  const porPaciente = new Map<string, { noShow: number; cancel: number; ultima: string }>()

  try {
    const snap = await clinicRef.collection('appointments').get()
    snap.forEach(d => {
      citasLeidas++
      const a = d.data()
      const pid = typeof a.pacienteId === 'string' ? a.pacienteId : ''
      if (!pid) return                     // cita huérfana: no hay a quién atribuirla
      const fecha = typeof a.fechaHora === 'string' ? a.fechaHora.slice(0, 10) : ''
      const acc0 = porPaciente.get(pid) ?? { noShow: 0, cancel: 0, ultima: '' }
      if (a.estado === NO_SHOW) acc0.noShow++
      else if (a.estado === CANCELADA) acc0.cancel++
      else if (ATENDIDAS.has(a.estado) && fecha > acc0.ultima) acc0.ultima = fecha
      porPaciente.set(pid, acc0)
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'no se pudieron leer las citas' },
      { status: 502 },
    )
  }

  const resumen = {
    citasLeidas,
    pacientesAfectados: porPaciente.size,
    totalNoShows: [...porPaciente.values()].reduce((n, v) => n + v.noShow, 0),
    totalCancelaciones: [...porPaciente.values()].reduce((n, v) => n + v.cancel, 0),
    conUltimaCita: [...porPaciente.values()].filter(v => v.ultima).length,
  }

  if (simular) return NextResponse.json({ ok: true, simulacion: true, ...resumen })

  // En lotes de 400: el tope de Firestore por batch es 500.
  let escritos = 0
  const entradas = [...porPaciente.entries()]
  try {
    for (let i = 0; i < entradas.length; i += 400) {
      const batch = adminDb.batch()
      for (const [pid, v] of entradas.slice(i, i + 400)) {
        batch.set(
          clinicRef.collection('patients').doc(pid),
          {
            noShowCount: v.noShow,
            cancelacionCount: v.cancel,
            ...(v.ultima ? { ultimaCita: v.ultima } : {}),
          },
          { merge: true },   // merge: no toca ningún otro campo del expediente
        )
        escritos++
      }
      await batch.commit()
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, escritos, error: e instanceof Error ? e.message.slice(0, 200) : 'fallo al escribir' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, ...resumen, escritos })
}
