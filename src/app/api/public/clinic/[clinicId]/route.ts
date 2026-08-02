/**
 * GET /api/public/clinic/[clinicId]
 *
 * Endpoint público: devuelve información básica de la clínica para el portal
 * de reserva. NO expone datos sensibles (pacientes, notas, etc.).
 *
 * RESILIENCIA: en Firestore un documento padre puede ser "virtual" — es decir,
 * `clinics/{id}` puede reportar .exists === false aunque su subcolección
 * `config/main` SÍ tenga datos (clínicas creadas por migración o versiones
 * viejas). Antes esto daba "Clínica no encontrada" y rompía el portal de un
 * consultorio real. Ahora la clínica se considera válida si existe el doc
 * padre O su config.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> },
) {
  try {
    const { clinicId } = await params
    const clinicRef = adminDb.collection('clinics').doc(clinicId)

    // Doc padre + config en paralelo
    const [clinicSnap, configSnap] = await Promise.all([
      clinicRef.get(),
      clinicRef.collection('config').doc('main').get(),
    ])

    const clinic = clinicSnap.exists ? clinicSnap.data()! : null
    const cfg = configSnap.exists ? configSnap.data()! : null

    // Solo es "no encontrada" si NO existe ni el doc padre ni la config.
    if (!clinic && !cfg) {
      return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })
    }

    // Bloquear solo si SABEMOS que la clínica está inactiva (status explícito).
    // Si el doc padre falta (virtual), no bloqueamos — la config presente
    // indica que el consultorio está configurado y en uso.
    if (clinic && clinic.status && clinic.status !== 'active' && clinic.status !== 'trial') {
      return NextResponse.json({ error: 'Clínica no activa' }, { status: 403 })
    }

    // Si el médico apagó el portal público explícitamente, respétalo.
    if (cfg && cfg.publicBookingEnabled === false) {
      return NextResponse.json({ error: 'El portal de reservas está desactivado' }, { status: 403 })
    }

    // Médicos activos
    const doctorsSnap = await clinicRef.collection('doctors').where('activo', '==', true).get()
    const medicos = doctorsSnap.docs.map(d => ({
      id: d.id,
      nombre: d.data().nombre,
      especialidad: d.data().especialidad ?? '',
    }))

    const c = clinic ?? {}
    const config = cfg ?? {}

    return NextResponse.json({
      ok: true,
      clinic: {
        id: clinicId,
        nombre: c.nombreClinica ?? config.nombreClinica ?? '',
        nombreMedico: c.nombreMedico ?? config.nombreMedico ?? '',
        especialidad: config.especialidad ?? '',
        direccion: config.direccion ?? '',
        telefono: config.telefonoAdmin ?? config.whatsappConsultorio ?? '',
        googleMapsUrl: config.googleMapsUrl ?? '',
        // Para el aviso público solo se exponen los datos que un aviso de privacidad
        // debe contener. RFC y domicilio FISCAL NO se sirven aquí (quedan privados,
        // solo en el contrato de encargo tras el login del médico).
        razonSocial: config.razonSocial ?? '',
        responsablePrivacidad: config.responsablePrivacidad ?? '',
        correoArco: config.correoArco ?? '',
        avisoPrivacidad: config.avisoPrivacidad ?? '',
        publicBookingEnabled: config.publicBookingEnabled !== false,
      },
      medicos,
      tiposCita: Object.entries(config.duraciones ?? {}).map(([k, v]) => ({ tipo: k, duracion: v })),
      horarios: config.horario ?? {},
      // La ZONA del consultorio. Sin ella el portal armaba la lista de días con
      // el reloj del paciente: alguien en otro huso perdía un día entero de la
      // agenda sin ningún aviso.
      zonaHoraria: config.zonaHoraria ?? 'America/Mexico_City',
    })
  } catch (err) {
    safeLog.error('[public/clinic] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
