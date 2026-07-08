/**
 * POST /api/hospital/alerta
 *
 * Envía una alerta clínica por WhatsApp al médico (lab crítico, NEWS2 alto,
 * interconsulta/resultado). La alerta en-app se guarda desde el cliente en
 * Firestore; esta ruta SOLO hace el envío por WhatsApp (server-side).
 *
 * SEGURIDAD: el teléfono destino se DERIVA en el servidor (Admin SDK) — NUNCA se
 * acepta del cliente (evita exfiltrar PII a un número arbitrario). El cliente
 * puede pasar `destinatarioUid` (el médico tratante del episodio): el servidor
 * busca el WhatsApp que ESE usuario registró en `hospital_roles/{uid}.telefono`
 * y le envía a él. También puede pasar `doctorId` (médico del catálogo, p.ej. el
 * médico SOLICITADO en una interconsulta): el servidor toma su teléfono de
 * `doctors/{doctorId}.telefono`. Si nada resuelve, cae al teléfono general de la
 * clínica. Restringido a rol clínico (no secretaria/facturación).
 *
 * Body: { clinicId, mensaje, destinatarioUid?, doctorId? }
 * Resp: { ok, enviado, destino?, motivo? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'
import { sendWhatsApp } from '@/lib/whatsapp-send'

const ROLES_CLINICOS = ['medico', 'admin', 'enfermeria', 'farmacia', 'laboratorio']

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; mensaje?: string; destinatarioUid?: string; doctorId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const { clinicId, mensaje, destinatarioUid, doctorId } = body
  if (!clinicId || !mensaje) return NextResponse.json({ ok: false, error: 'clinicId y mensaje requeridos' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response
  // Solo rol clínico puede disparar alertas (no secretaria/recepción/facturación).
  if (!ROLES_CLINICOS.includes(String(acc.role ?? ''))) {
    return NextResponse.json({ ok: false, error: 'Rol no autorizado' }, { status: 403 })
  }

  const clinicRef = adminDb.collection('clinics').doc(clinicId)

  // 1) Preferente: teléfono personal del médico tratante (el que ÉL registró).
  //    destinatarioUid solo se usa como CLAVE de búsqueda server-side; el número
  //    nunca viaja desde el cliente.
  let telefono = ''
  let destino: 'tratante' | 'medico' | 'clinica' | '' = ''
  if (destinatarioUid) {
    try {
      const r = await clinicRef.collection('hospital_roles').doc(String(destinatarioUid)).get()
      const t = r.exists ? String((r.data() as Record<string, unknown>).telefono ?? '').trim() : ''
      if (t) { telefono = t; destino = 'tratante' }
    } catch { /* sigue al fallback */ }
  }

  // 1b) Médico del catálogo (p.ej. el solicitado en una interconsulta): su
  //     teléfono sale de doctors/{doctorId}.telefono, resuelto en el servidor.
  if (!telefono && doctorId) {
    try {
      const r = await clinicRef.collection('doctors').doc(String(doctorId)).get()
      const t = r.exists ? String((r.data() as Record<string, unknown>).telefono ?? '').trim() : ''
      if (t) { telefono = t; destino = 'medico' }
    } catch { /* sigue al fallback */ }
  }

  // 2) Fallback: teléfono general de la clínica.
  if (!telefono) {
    try {
      const cfg = await clinicRef.collection('config').doc('main').get()
      const d = cfg.exists ? (cfg.data() as Record<string, unknown>) : {}
      telefono = String(d.telefonoAlertas ?? d.whatsapp ?? d.telefono ?? d.telefonoClinica ?? '').trim()
      if (telefono) destino = 'clinica'
    } catch { /* sin config → sin envío */ }
  }

  if (!telefono) return NextResponse.json({ ok: true, enviado: false, motivo: 'sin-telefono' })

  // Cap de longitud (anti-abuso): la alerta es un texto breve.
  const texto = String(mensaje).slice(0, 500)
  try {
    const { ok } = await sendWhatsApp(clinicId, telefono, texto)
    return NextResponse.json({ ok: true, enviado: ok, destino })
  } catch {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'whatsapp-no-disponible' })
  }
}
