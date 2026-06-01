/**
 * GET /api/public/clinic/[clinicId]
 *
 * Endpoint público: devuelve información básica de la clínica para el portal
 * de reserva. NO expone datos sensibles (pacientes, notas, etc.).
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> },
) {
  try {
    const { clinicId } = await params

    const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
    if (!clinicSnap.exists) return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })

    const clinic = clinicSnap.data()!
    if (clinic.status !== 'active' && clinic.status !== 'trial') {
      return NextResponse.json({ error: 'Clínica no activa' }, { status: 403 })
    }

    // Configuración relevante
    const configSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const cfg = configSnap.exists ? configSnap.data()! : {}

    // Médicos activos
    const doctorsSnap = await adminDb.collection('clinics').doc(clinicId).collection('doctors')
      .where('activo', '==', true).get()
    const medicos = doctorsSnap.docs.map(d => ({
      id: d.id,
      nombre: d.data().nombre,
      especialidad: d.data().especialidad ?? '',
    }))

    return NextResponse.json({
      ok: true,
      clinic: {
        id: clinicId,
        nombre: clinic.nombreClinica ?? '',
        nombreMedico: clinic.nombreMedico ?? cfg.nombreMedico ?? '',
        especialidad: cfg.especialidad ?? '',
        direccion: cfg.direccion ?? '',
        telefono: cfg.telefonoAdmin ?? cfg.whatsappConsultorio ?? '',
        googleMapsUrl: cfg.googleMapsUrl ?? '',
        avisoPrivacidad: cfg.avisoPrivacidad ?? '',
        publicBookingEnabled: cfg.publicBookingEnabled !== false,
      },
      medicos,
      tiposCita: Object.entries(cfg.duraciones ?? {}).map(([k, v]) => ({ tipo: k, duracion: v })),
      horarios: cfg.horario ?? {},
    })
  } catch (err) {
    console.error('[public/clinic] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
