import { NextRequest, NextResponse } from 'next/server'
import { verificarMedico } from '@/lib/auth-server'
import { linkVerificacionReceta } from '@/lib/receta-token'

/**
 * Firma la URL de verificación de una receta (destino del QR): /verificar/<token>.
 * El token es HMAC, sin datos del paciente (solo ids + info del prescriptor ya
 * impresa en la receta). Requiere ser MIEMBRO de la clínica. Devuelve { url }.
 */
export async function POST(req: NextRequest) {
  let body: { clinicId?: string; notaId?: string; folio?: string; doctorNombre?: string; cedula?: string; contenidoHash?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
  if (!body.clinicId || !body.notaId || !body.folio) {
    return NextResponse.json({ error: 'Falta clinicId, notaId o folio' }, { status: 400 })
  }

  // Solo un MÉDICO/admin acuña el certificado de verificación (auditoría P0): antes
  // era cualquier miembro → una recepcionista podía firmar un "Integridad verificada"
  // con la cédula de otro médico. La cédula/nombre siguen siendo los que el médico
  // tiene en su config (no un tercero); esto cierra el vector de la recepcionista.
  const acc = await verificarMedico(req, body.clinicId)
  if (!acc.ok) return acc.response

  const origin = req.headers.get('origin') || req.nextUrl.origin
  const url = linkVerificacionReceta(origin, {
    clinicId: body.clinicId,
    notaId: body.notaId,
    folio: body.folio,
    doctorNombre: body.doctorNombre || '',
    cedula: body.cedula || '',
    // Huella del contenido prescrito (liga la firma al contenido). Se acota por si
    // llega manipulada: es un hash FNV-1a de 8 hex.
    contenidoHash: typeof body.contenidoHash === 'string' && /^[0-9a-f]{1,16}$/.test(body.contenidoHash) ? body.contenidoHash : undefined,
  })
  return NextResponse.json({ url })
}
