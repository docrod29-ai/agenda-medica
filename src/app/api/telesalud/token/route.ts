/**
 * POST /api/telesalud/token  { clinicId, patientId }
 *
 * Emite un token HMAC de paciente para el enlace de teleconsulta (camino seguro que
 * cierra el IDOR de la sala). Solo un MIEMBRO de la clínica puede emitirlo — así el
 * médico genera enlaces autorizados; el token prueba titularidad al abrir la sala.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { crearTokenPaciente } from '@/lib/patient-token'

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { clinicId, patientId } = body
  if (!clinicId || !patientId) return NextResponse.json({ error: 'clinicId y patientId requeridos' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  // TTL corto: el token es para unirse a la teleconsulta, no un acceso persistente.
  const token = crearTokenPaciente(clinicId, patientId, 1)
  return NextResponse.json({ ok: true, token })
}
