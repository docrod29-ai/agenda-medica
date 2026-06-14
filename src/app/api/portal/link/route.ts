import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { linkPortalPaciente } from '@/lib/patient-token'

/**
 * Genera el magic-link del Portal del Paciente para enviarlo (p. ej. por WhatsApp).
 * Requiere ser MIEMBRO de la clínica (médico/asistente). Devuelve { url }.
 */
export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
  if (!body.clinicId || !body.patientId) {
    return NextResponse.json({ error: 'Falta clinicId o patientId' }, { status: 400 })
  }

  const acc = await verificarMiembro(req, body.clinicId)
  if (!acc.ok) return acc.response

  // Origen real desde el navegador del personal (la URL que el médico está usando)
  const origin = req.headers.get('origin') || req.nextUrl.origin
  const url = linkPortalPaciente(origin, body.clinicId, body.patientId)
  return NextResponse.json({ url })
}
