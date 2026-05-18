import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { Appointment, ClinicConfig } from '@/types'

const CRON_SECRET = process.env.CRON_SECRET

function buildWhatsAppMessage(
  template: string,
  data: {
    paciente: string
    fecha: string
    hora: string
    medico: string
    clinica: string
    direccion: string
    telefono: string
  }
): string {
  return template
    .replace(/\{paciente\}/g, data.paciente)
    .replace(/\{fecha\}/g, data.fecha)
    .replace(/\{hora\}/g, data.hora)
    .replace(/\{medico\}/g, data.medico)
    .replace(/\{clinica\}/g, data.clinica)
    .replace(/\{direccion\}/g, data.direccion)
    .replace(/\{telefono\}/g, data.telefono)
}

function formatDateES(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

async function sendWhatsApp(phone: string, message: string, config: ClinicConfig): Promise<boolean> {
  const provider = config.whatsappProveedor || process.env.WHATSAPP_PROVIDER || 'meta'
  const cleanPhone = phone.replace(/\D/g, '')
  const whatsappNumber = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`

  if (provider === 'meta') {
    const token = process.env.WHATSAPP_API_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!token || !phoneNumberId) return false

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: whatsappNumber,
          type: 'text',
          text: { body: message },
        }),
      }
    )
    return res.ok
  }

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_WHATSAPP_FROM
    if (!sid || !authToken || !from) return false

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: from,
          To: `whatsapp:+${whatsappNumber}`,
          Body: message,
        }),
      }
    )
    return res.ok
  }

  return false
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const configSnap = await adminDb.collection('config').doc('main').get()
    if (!configSnap.exists) return NextResponse.json({ skipped: 'no config' })

    const config = configSnap.data() as ClinicConfig
    if (!config.recordatorio24h && !config.recordatorioMismoDia) {
      return NextResponse.json({ skipped: 'reminders disabled' })
    }

    const now = new Date()
    const results = { sent: 0, failed: 0, skipped: 0 }

    // Get all pending/confirmed appointments
    const snap = await adminDb
      .collection('appointments')
      .where('estado', 'in', ['confirmada', 'pendiente-confirmar', 'solicitada'])
      .get()

    const appointments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))

    const defaultTemplate24h =
      `Hola {paciente} 👋\n\nTe recordamos que tienes una cita *mañana* con {medico}.\n\n📅 {fecha}\n🕐 {hora}\n📍 {clinica}\n{direccion}\n\n¿Confirmas tu asistencia? Responde *SÍ* para confirmar o *NO* para cancelar.\n\nConsultorio: {telefono}`

    const defaultTemplateSameDay =
      `Buenos días {paciente} ☀️\n\nHoy tienes tu cita con {medico}:\n\n🕐 {hora}\n📍 {clinica}\n{direccion}\n\nTe esperamos. Cualquier duda: {telefono}`

    for (const appt of appointments) {
      if (!appt.consentimientoMensajes) { results.skipped++; continue }
      const phone = appt.pacienteTelefono
      if (!phone) { results.skipped++; continue }

      const apptDate = appt.fechaHora.slice(0, 10)
      const apptHour = appt.fechaHora.slice(11, 16)
      const apptDateObj = new Date(`${apptDate}T${apptHour}:00`)

      const diffHours = (apptDateObj.getTime() - now.getTime()) / (1000 * 60 * 60)
      const msgData = {
        paciente: appt.pacienteNombre,
        fecha: formatDateES(apptDate),
        hora: apptHour,
        medico: `Dr. ${config.nombreMedico}`,
        clinica: config.nombreClinica,
        direccion: config.direccion,
        telefono: config.whatsappConsultorio || config.telefonoAdmin,
      }

      // 24h reminder: window 23–26 hours before
      if (
        config.recordatorio24h &&
        !appt.recordatorio24hEnviado &&
        diffHours >= 23 && diffHours <= 26
      ) {
        const msg = buildWhatsAppMessage(defaultTemplate24h, msgData)
        const ok = await sendWhatsApp(phone, msg, config)
        if (ok) {
          await adminDb.collection('appointments').doc(appt.id).update({
            recordatorio24hEnviado: true,
            estado: appt.estado === 'confirmada' ? 'recordatorio-enviado' : appt.estado,
            updatedAt: now.toISOString(),
          })
          await adminDb.collection('notificationLogs').add({
            appointmentId: appt.id,
            pacienteId: appt.pacienteId,
            tipo: 'recordatorio-24h',
            canal: 'whatsapp',
            estado: 'enviado',
            sentAt: now.toISOString(),
          })
          results.sent++
        } else {
          results.failed++
        }
        continue
      }

      // Same-day reminder: 2–4 hours before
      if (
        config.recordatorioMismoDia &&
        !appt.recordatorioMismoDiaEnviado &&
        diffHours >= 1 && diffHours <= 4
      ) {
        const msg = buildWhatsAppMessage(defaultTemplateSameDay, msgData)
        const ok = await sendWhatsApp(phone, msg, config)
        if (ok) {
          await adminDb.collection('appointments').doc(appt.id).update({
            recordatorioMismoDiaEnviado: true,
            updatedAt: now.toISOString(),
          })
          await adminDb.collection('notificationLogs').add({
            appointmentId: appt.id,
            pacienteId: appt.pacienteId,
            tipo: 'recordatorio-dia',
            canal: 'whatsapp',
            estado: 'enviado',
            sentAt: now.toISOString(),
          })
          results.sent++
        } else {
          results.failed++
        }
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err) {
    console.error('Reminders cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
