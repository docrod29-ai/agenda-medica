import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { linkVerificacionReceta } from '@/lib/receta-token'

/**
 * Firma la URL de verificación de una receta (destino del QR): /verificar/<token>.
 * El token es HMAC, sin datos del paciente (solo ids + info del prescriptor ya
 * impresa en la receta). Requiere ser MIEMBRO de la clínica. Devuelve { url }.
 */
export async function POST(req: NextRequest) {
  let body: { clinicId?: string; notaId?: string; folio?: string; doctorNombre?: string; cedula?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
  if (!body.clinicId || !body.notaId || !body.folio) {
    return NextResponse.json({ error: 'Falta clinicId, notaId o folio' }, { status: 400 })
  }

  const acc = await verificarMiembro(req, body.clinicId)
  if (!acc.ok) return acc.response

  const origin = req.headers.get('origin') || req.nextUrl.origin
  const url = linkVerificacionReceta(origin, {
    clinicId: body.clinicId,
    notaId: body.notaId,
    folio: body.folio,
    doctorNombre: body.doctorNombre || '',
    cedula: body.cedula || '',
  })
  return NextResponse.json({ url })
}
