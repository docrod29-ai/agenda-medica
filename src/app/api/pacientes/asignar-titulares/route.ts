/**
 * POST /api/pacientes/asignar-titulares  { clinicId, simular? }
 *
 * LOS PACIENTES DE ANTES DE D-057 NECESITAN UN TITULAR — Y LA AGENDA SABE CUÁL.
 *
 * Cada médico ve sus pacientes desde D-057, pero los pacientes que ya existían
 * nacieron sin `medicoTitularUid` y se ven como siempre (por diseño: esconder
 * el consultorio entero el día del despliegue sería el fallo caro). Esta ruta
 * les pone titular con el único dato que ya dice de quién son: el médico de su
 * ÚLTIMA cita. Sin cita, o con un médico sin `uid` (dado de alta sin sesión),
 * no se adivina: se cuentan y se dicen, y quedan para asignar a mano.
 *
 * Es del ADMIN (`administrar`), como fundir expedientes: reparte quién ve qué
 * en todo el consultorio. `simular: true` cuenta sin escribir, para verlo antes.
 * No toca `compartidoCon`, no toca a los que ya tienen titular, y deja asiento
 * en `audit_log` por cada asignación escrita.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'

export const TOPE_PACIENTES_POR_CORRIDA = 500

export interface ResultadoAsignacion {
  ok: true
  simulado: boolean
  revisados: number
  yaTenian: number
  asignados: number
  sinCita: number
  medicoSinUid: number
  truncado: boolean
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; simular?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }
  const clinicId = String(body.clinicId ?? '')
  if (!clinicId) return NextResponse.json({ ok: false, error: 'Falta clinicId' }, { status: 400 })
  const simular = body.simular === true

  const acceso = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acceso.ok) return acceso.response

  try {
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const [pacientes, medicos] = await Promise.all([
      clinicRef.collection('patients').limit(TOPE_PACIENTES_POR_CORRIDA + 1).get(),
      clinicRef.collection('doctors').get(),
    ])
    const uidDeMedico = new Map<string, string>()
    medicos.forEach(d => {
      const uid = d.data().uid
      if (typeof uid === 'string' && uid) uidDeMedico.set(d.id, uid)
    })

    const r: ResultadoAsignacion = {
      ok: true, simulado: simular, revisados: 0, yaTenian: 0, asignados: 0, sinCita: 0, medicoSinUid: 0,
      truncado: pacientes.size > TOPE_PACIENTES_POR_CORRIDA,
    }
    const ahora = new Date().toISOString()
    const docs = pacientes.docs.slice(0, TOPE_PACIENTES_POR_CORRIDA)
    for (const p of docs) {
      r.revisados++
      if (p.data().medicoTitularUid) { r.yaTenian++; continue }
      // La última cita del paciente: el índice `appointments(pacienteId, fechaHora)` ya existe.
      const citas = await clinicRef.collection('appointments')
        .where('pacienteId', '==', p.id).orderBy('fechaHora', 'desc').limit(5).get()
      const conMedico = citas.docs.map(c => String(c.data().medicoId || c.data().doctorId || '')).find(Boolean)
      if (!conMedico) { r.sinCita++; continue }
      const uid = uidDeMedico.get(conMedico)
      if (!uid) { r.medicoSinUid++; continue }
      if (!simular) {
        await p.ref.set({ medicoTitularUid: uid, updatedAt: ahora }, { merge: true })
        await clinicRef.collection('audit_log').add({
          evento: 'expediente_titular_asignado', clinicId, patientId: p.id,
          medicoUid: acceso.uid, timestamp: ahora,
          meta: { titular: uid, desde: 'ultima-cita', medicoId: conMedico },
        }).catch(() => { /* la bitácora no bloquea la asignación */ })
      }
      r.asignados++
    }
    return NextResponse.json(r)
  } catch (e) {
    safeLog.error('[asignar-titulares] falló', e)
    return NextResponse.json({ ok: false, error: 'No se pudieron asignar los titulares. Inténtalo de nuevo.' }, { status: 500 })
  }
}
