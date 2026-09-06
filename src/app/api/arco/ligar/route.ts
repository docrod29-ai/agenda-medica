/**
 * POST /api/arco/ligar
 *
 * LIGAR UNA SOLICITUD ARCO A UN EXPEDIENTE (Panel de Lujo ASE-010, P1).
 *
 * Las solicitudes reales llegan del portal público SIN expediente
 * (`patientId` está prohibido en el create público, y con razón: quien llega
 * de la calle no puede señalar un expediente ajeno). Para atenderlas hay que
 * identificar al titular con su identificación delante y LIGAR la solicitud
 * al expediente. Las reglas lo permitían a un miembro desde 2026-07 y ningún
 * código lo hacía: el derecho estaba escrito y no se podía ejecutar.
 *
 * Va en el servidor por tres cosas que un `updateDoc` no garantiza:
 *  · el expediente EXISTE en este consultorio (no se liga a un id inventado);
 *  · queda asiento en `audit_log` con quién afirmó haber visto la
 *    identificación (Art. 29 LFPDPPP) — la bitácora sólo se escribe aquí;
 *  · la solicitud sigue siendo lo que declaró el ciudadano: sólo se añaden
 *    `patientId`, `identidadVerificada*`, nada más.
 *
 * Body: { clinicId, solicitudId, patientId, identidadVerificada: true }
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { parcheDeLigado } from '@/lib/arco/ligar'

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; solicitudId?: string; patientId?: string; identidadVerificada?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }
  const clinicId = String(body.clinicId ?? '').trim()
  const solicitudId = String(body.solicitudId ?? '').trim()
  const patientId = String(body.patientId ?? '').trim()
  if (!clinicId || !solicitudId || !patientId) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId, solicitudId o patientId' }, { status: 400 })
  }

  // Misma capacidad que ejecutar la cancelación: es el responsable del
  // tratamiento quien identifica al titular, no el mostrador.
  const acceso = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acceso.ok) return acceso.response

  if (body.identidadVerificada !== true) {
    return NextResponse.json({
      ok: false,
      error: 'Para ligar la solicitud a un expediente hay que afirmar que se vio la identificación oficial del titular.',
    }, { status: 400 })
  }

  try {
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const [solicitud, paciente] = await Promise.all([
      clinicRef.collection('arco_requests').doc(solicitudId).get(),
      clinicRef.collection('patients').doc(patientId).get(),
    ])
    if (!solicitud.exists) return NextResponse.json({ ok: false, error: 'Esa solicitud no existe' }, { status: 404 })
    if (!paciente.exists) return NextResponse.json({ ok: false, error: 'Ese expediente no existe en este consultorio' }, { status: 404 })
    const estado = String(solicitud.data()?.estado ?? '')
    if (estado === 'resuelta' || estado === 'rechazada') {
      return NextResponse.json({ ok: false, error: 'Esa solicitud ya está cerrada; no se puede volver a ligar.' }, { status: 409 })
    }

    const ahoraIso = new Date().toISOString()
    await clinicRef.collection('arco_requests').doc(solicitudId)
      .set(parcheDeLigado({ patientId, uid: acceso.uid ?? '', ahoraIso }), { merge: true })

    await clinicRef.collection('audit_log').add({
      evento: 'arco_solicitud_ligada', clinicId, patientId,
      medicoUid: acceso.uid, medicoEmail: acceso.email ?? '',
      meta: { solicitudId, identidadVerificadaPor: acceso.uid },
      timestamp: ahoraIso,
    }).catch(() => { /* la bitácora no puede tumbar el derecho del paciente */ })

    return NextResponse.json({ ok: true, solicitudId, patientId })
  } catch (e) {
    safeLog.error('[arco/ligar]', e)
    return errorAlCliente('No se pudo ligar la solicitud al expediente. Intenta de nuevo.')
  }
}

export const runtime = 'nodejs'
