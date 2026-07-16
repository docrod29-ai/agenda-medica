/**
 * GET /api/fhir/paciente/[patientId]?clinicId=...
 *
 * API FHIR REST viva (lectura): devuelve un Bundle FHIR R4 con el paciente y todo
 * su expediente mapeado (Patient, AllergyIntolerance, Condition, MedicationRequest,
 * Observation). Sustituye el "export de archivo" por una interfaz consultable por
 * sistemas de terceros. Solo miembros de la clínica.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { bundlePaciente } from '@/lib/fhir/recursos'
import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'

export async function GET(req: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId || !patientId) {
    return NextResponse.json({ error: 'clinicId y patientId requeridos' }, { status: 400 })
  }

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  try {
    const pRef = adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId)
    const [pSnap, nSnap] = await Promise.all([pRef.get(), pRef.collection('notas').get()])
    if (!pSnap.exists) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    const patient = { id: pSnap.id, ...pSnap.data() } as Patient
    const notas = nSnap.docs.map(d => ({ id: d.id, ...d.data() })) as NotaMedica[]
    const bundle = bundlePaciente(patient, notas)

    return NextResponse.json(bundle, { headers: { 'Content-Type': 'application/fhir+json' } })
  } catch (err) {
    console.error('[fhir/paciente] error:', err)
    return NextResponse.json({ error: 'No se pudo generar el Bundle FHIR' }, { status: 500 })
  }
}
