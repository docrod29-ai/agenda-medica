/**
 * POST /api/hospital/alerta
 *
 * Envía una alerta clínica por WhatsApp al médico (lab crítico, NEWS2 alto,
 * interconsulta/resultado). La alerta en-app se guarda desde el cliente en
 * Firestore; esta ruta SOLO hace el envío por WhatsApp (server-side).
 *
 * SEGURIDAD: el teléfono destino se DERIVA en el servidor de la config de la
 * clínica (Admin SDK) — NUNCA se acepta del cliente (evita exfiltrar PII a un
 * número arbitrario). Restringido a rol clínico (no secretaria/facturación).
 *
 * Body: { clinicId, mensaje }   Resp: { ok, enviado, motivo? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'
import { sendWhatsApp } from '@/lib/whatsapp-send'

const ROLES_CLINICOS = ['medico', 'admin', 'enfermeria', 'farmacia', 'laboratorio']

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; mensaje?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const { clinicId, mensaje } = body
  if (!clinicId || !mensaje) return NextResponse.json({ ok: false, error: 'clinicId y mensaje requeridos' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response
  // Solo rol clínico puede disparar alertas (no secretaria/recepción/facturación).
  if (!ROLES_CLINICOS.includes(String(acc.role ?? ''))) {
    return NextResponse.json({ ok: false, error: 'Rol no autorizado' }, { status: 403 })
  }

  // Deriva el teléfono destino de la config de la clínica (Admin SDK) — nunca del cliente.
  let telefono = ''
  try {
    const cfg = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const d = cfg.exists ? (cfg.data() as Record<string, unknown>) : {}
    telefono = String(d.telefonoAlertas ?? d.whatsapp ?? d.telefono ?? d.telefonoClinica ?? '').trim()
  } catch { /* sin config → sin envío */ }

  if (!telefono) return NextResponse.json({ ok: true, enviado: false, motivo: 'sin-telefono' })

  // Cap de longitud (anti-abuso): la alerta es un texto breve.
  const texto = String(mensaje).slice(0, 500)
  try {
    const { ok } = await sendWhatsApp(clinicId, telefono, texto)
    return NextResponse.json({ ok: true, enviado: ok })
  } catch {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'whatsapp-no-disponible' })
  }
}
