import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import type { Appointment } from '@/types'

/**
 * Alta de cita ATÓMICA (dashboard/asistente). Reemplaza el addDoc del cliente:
 * re-chequea el conflicto y escribe en una transacción → cierra la carrera
 * check-then-write si dos miembros agendan el mismo hueco a la vez.
 *
 * Requiere ser MIEMBRO de la clínica. Devuelve { id }.
 * Conflicto MÉDICO-AWARE (igual que el booking público): si la cita trae medicoId,
 * solo choca con citas del mismo médico; si no (modal), choca contra todas. Así
 * cada path conserva su comportamiento actual, solo que ahora es atómico.
 */
export async function POST(req: NextRequest) {
  let body: { clinicId?: string; appointment?: Omit<Appointment, 'id'> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
  const { clinicId, appointment } = body
  if (!clinicId || !appointment?.fechaHora) {
    return NextResponse.json({ error: 'Faltan datos de la cita' }, { status: 400 })
  }

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  const fecha = appointment.fechaHora.slice(0, 10)
  const hora = appointment.fechaHora.slice(11, 16)
  const duracion = appointment.duracion || 30
  const medicoId = appointment.medicoId
  const now = new Date().toISOString()
  const apptsCol = adminDb.collection('clinics').doc(clinicId).collection('appointments')

  const [h, m] = hora.split(':').map(Number)
  const start = h * 60 + m
  const end = start + duracion

  const CONFLICTO = Symbol('conflicto')
  let id = ''
  try {
    // Centinela por médico+día: la transacción lo LEE y lo ESCRIBE, forzando a
    // Firestore a serializar dos reservas simultáneas del mismo día (una query
    // dentro de la tx NO bloquea inserciones fantasma por sí sola). El perdedor
    // reintenta, re-consulta y ya ve la cita del ganador → detecta el conflicto.
    const diaRef = adminDb.collection('clinics').doc(clinicId).collection('slot_locks').doc(`${medicoId || 'sin'}_${fecha}`)
    await adminDb.runTransaction(async (tx) => {
      await tx.get(diaRef)  // read: fija la versión del día para la serialización
      const snap = await tx.get(
        apptsCol.where('fechaHora', '>=', `${fecha} 00:00`).where('fechaHora', '<=', `${fecha} 23:59`)
      )
      let conflicto = false
      snap.forEach(d => {
        const a = d.data()
        if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
        if (medicoId && a.medicoId && a.medicoId !== medicoId) return
        const [ah, am] = (a.fechaHora?.slice(11, 16) || '00:00').split(':').map(Number)
        const aStart = ah * 60 + am
        const aEnd = aStart + (a.duracion ?? 30)
        if (start < aEnd && end > aStart) conflicto = true
      })
      if (conflicto) throw CONFLICTO

      tx.set(diaRef, { ultimaReserva: now }, { merge: true })  // write: invalida la tx concurrente
      const ref = apptsCol.doc()
      tx.set(ref, { ...appointment, createdAt: now, updatedAt: now })
      id = ref.id
    })
  } catch (e) {
    if (e === CONFLICTO) {
      return NextResponse.json({ error: 'Ese horario acaba de ocuparse. Elige otro.' }, { status: 409 })
    }
    throw e
  }
  return NextResponse.json({ id })
}
