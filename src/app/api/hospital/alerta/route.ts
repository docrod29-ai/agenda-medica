/**
 * POST /api/hospital/alerta
 *
 * Envía una alerta clínica por WhatsApp al médico (lab crítico, NEWS2 alto,
 * interconsulta/resultado). La alerta en-app se guarda desde el cliente en
 * Firestore; esta ruta SOLO hace el envío por WhatsApp (server-side, con la
 * conexión de la clínica). Degrada con gracia si no hay WhatsApp/teléfono.
 *
 * Body: { clinicId, telefono, mensaje }
 * Resp: { ok, enviado }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { sendWhatsApp } from '@/lib/whatsapp-send'

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; telefono?: string; mensaje?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const { clinicId, telefono, mensaje } = body
  if (!clinicId || !mensaje) return NextResponse.json({ ok: false, error: 'clinicId y mensaje requeridos' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  // Sin teléfono configurado → la alerta vive solo en-app (no es un error).
  if (!telefono || !telefono.trim()) return NextResponse.json({ ok: true, enviado: false, motivo: 'sin-telefono' })

  try {
    const { ok } = await sendWhatsApp(clinicId, telefono.trim(), mensaje)
    return NextResponse.json({ ok: true, enviado: ok })
  } catch {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'whatsapp-no-disponible' })
  }
}
