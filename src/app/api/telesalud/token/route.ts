/**
 * POST /api/telesalud/token  { clinicId, patientId }
 *
 * Emite un token HMAC de paciente para el enlace de teleconsulta (camino seguro que
 * cierra el IDOR de la sala). Lo emite solo un MÉDICO/ADMIN — así el médico genera
 * enlaces autorizados; el token prueba titularidad al abrir la sala.
 *
 * SEGURIDAD (L2 auditoría maestra 2026-07): antes usaba verificarMiembro, que
 * autoriza a CUALQUIER rol (secretaría/recepción). Como el token es aceptado por
 * /api/portal (handler 'documentos', que devuelve Dx + medicamentos de notas
 * FIRMADAS), un rol no-médico podía obtener secreto médico saltándose el gate
 * `isMedico` de firestore.rules. Ahora exige verificarMedico + que el paciente
 * pertenezca a la clínica (no emitir tokens para patientId arbitrarios).
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMedico } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'
import { crearTokenPaciente } from '@/lib/patient-token'

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { clinicId, patientId } = body
  if (!clinicId || !patientId) return NextResponse.json({ error: 'clinicId y patientId requeridos' }, { status: 400 })

  const acc = await verificarMedico(req, clinicId)
  if (!acc.ok) return acc.response

  // El paciente debe existir en ESTA clínica (no emitir tokens para ids arbitrarios).
  const pac = await adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).get()
  if (!pac.exists) return NextResponse.json({ error: 'Paciente no encontrado en esta clínica' }, { status: 404 })

  // TTL corto: el token es para unirse a la teleconsulta, no un acceso persistente.
  const token = crearTokenPaciente(clinicId, patientId, 1)
  return NextResponse.json({ ok: true, token })
}
