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
import { verificarCapacidad } from '@/lib/authz/verificar'
import { adminDb } from '@/lib/firebase-admin'
import { sendWhatsApp } from '@/lib/whatsapp-send'

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; mensaje?: string; destinatarioUid?: string; doctorId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const { clinicId, mensaje, destinatarioUid, doctorId } = body
  if (!clinicId || !mensaje) return NextResponse.json({ ok: false, error: 'clinicId y mensaje requeridos' }, { status: 400 })

  /**
   * Solo rol clínico puede disparar alertas (no secretaria/recepción/facturación).
   * E0-07: era una lista `ROLES_CLINICOS` suelta en este archivo — una de las seis
   * copias de la política de acceso del repo. `clinico.leer` es EXACTAMENTE el mismo
   * conjunto, y un test lo ata a `rolesDe('isClinicoHospital')` de firestore.rules,
   * así que aflojar una y no la otra ya no pasa desapercibido.
   */
  const acc = await verificarCapacidad(req, clinicId, 'clinico.leer')
  if (!acc.ok) return acc.response

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

  /**
   * UNA ALERTA QUE NO SALE TIENE QUE DEJAR RASTRO.
   *
   * Esta ruta avisa de un valor crítico de laboratorio, un NEWS2 alto o una
   * interconsulta. Cuando el envío fallaba, la respuesta lo decía honestamente
   * (`enviado: false`) y ahí terminaba todo: nadie recibía la alerta y nadie se
   * enteraba de que no había llegado. Un fallo silencioso en un aviso crítico es
   * peor que no tener el aviso, porque el equipo cree que ya avisó.
   *
   * No se puede reintentar como los recordatorios —fuera de la ventana de 24 h
   * haría falta una plantilla aprobada en Meta, que es un trámite del dueño— así
   * que lo que sí se puede hacer es que quede escrito y se vea.
   */
  const registrarFallo = async (motivo: string) => {
    try {
      await clinicRef.collection('alertas_no_entregadas').add({
        motivo, destino, telefono: telefono ? `…${telefono.slice(-4)}` : '',
        texto: String(mensaje).slice(0, 300),
        createdAt: new Date().toISOString(),
      })
    } catch { /* si ni esto se puede escribir, queda el `enviado:false` de la respuesta */ }
  }

  if (!telefono) {
    await registrarFallo('sin-telefono')
    return NextResponse.json({ ok: true, enviado: false, motivo: 'sin-telefono' })
  }

  // Cap de longitud (anti-abuso): la alerta es un texto breve.
  const texto = String(mensaje).slice(0, 500)
  try {
    const { ok } = await sendWhatsApp(clinicId, telefono, texto)
    if (!ok) await registrarFallo('envio-rechazado')
    return NextResponse.json({ ok: true, enviado: ok, destino })
  } catch {
    await registrarFallo('whatsapp-no-disponible')
    return NextResponse.json({ ok: true, enviado: false, motivo: 'whatsapp-no-disponible' })
  }
}
