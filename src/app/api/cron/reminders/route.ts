import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { adminDb } from '@/lib/firebase-admin'
import { Appointment, ClinicConfig } from '@/types'
import { sendWhatsApp as sendWA } from '@/lib/whatsapp-send'
import { instanteMX, hoyISO, sumarDiasISO } from '@/lib/timezone'

const CRON_SECRET = process.env.CRON_SECRET

const ESTADOS_POST_VISITA = ['atendida', 'finalizada', 'pagada']

/**
 * Crea una solicitud de reseña (server-side) y devuelve el link a enviar.
 * Mirror de reviews.crearSolicitudResena pero con adminDb (sin client SDK).
 */
async function crearSolicitudResenaAdmin(origin: string, clinicId: string, appt: Appointment): Promise<string> {
  const token = randomUUID().replace(/-/g, '')
  const now = new Date()
  await adminDb.collection('clinic_review_requests').doc(token).set({
    token, clinicId,
    citaId: appt.id,
    pacienteId: appt.pacienteId,
    pacienteNombre: appt.pacienteNombre,
    medicoNombre: appt.medicoNombre,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 86400_000).toISOString(),
    used: false,
  })
  return `${origin.replace(/\/$/, '')}/resena/${token}`
}

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

/** Thin wrapper — uses per-clinic credentials from whatsapp-send.ts.
 *  proactivo:true → respeta el opt-out del contacto y agrega el pie "Responda BAJA…". */
async function sendWhatsApp(phone: string, message: string, _config: ClinicConfig, clinicId: string): Promise<boolean> {
  const { ok } = await sendWA(clinicId, phone, message, { proactivo: true })
  return ok
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const totals = { sent: 0, failed: 0, skipped: 0, clinics: 0 }

    // ── Get all active clinics ────────────────────────────────
    const clinicsSnap = await adminDb.collection('clinics')
      .where('status', 'in', ['active', 'trial'])
      .get()

    for (const clinicDoc of clinicsSnap.docs) {
      const clinicId = clinicDoc.id
      totals.clinics++

      try {
        const configSnap = await adminDb
          .collection('clinics').doc(clinicId)
          .collection('config').doc('main').get()

        if (!configSnap.exists) continue

        const config = configSnap.data() as ClinicConfig
        if (!config.recordatorio24h && !config.recordatorioMismoDia && !config.resenaAutomatica) continue

        // ── Get appointments for this clinic ─────────────────
        const snap = await adminDb
          .collection('clinics').doc(clinicId)
          .collection('appointments')
          .where('estado', 'in', ['confirmada', 'pendiente-confirmar', 'solicitada'])
          .get()

        const appointments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))

        const template24h =
          `Hola {paciente} 👋\n\nTe recordamos que tienes una cita *mañana* con {medico}.\n\n📅 {fecha}\n🕐 {hora}\n📍 {clinica}\n{direccion}\n\n¿Confirmas tu asistencia? Responde *SÍ* para confirmar o *NO* para cancelar.\n\nConsultorio: {telefono}`

        const templateSameDay =
          `Buenos días {paciente} ☀️\n\nHoy tienes tu cita con {medico}:\n\n🕐 {hora}\n📍 {clinica}\n{direccion}\n\nTe esperamos. Cualquier duda: {telefono}`

        for (const appt of appointments) {
          if (!appt.consentimientoMensajes) { totals.skipped++; continue }
          const phone = appt.pacienteTelefono
          if (!phone) { totals.skipped++; continue }

          const apptDate = appt.fechaHora.slice(0, 10)
          const apptHour = appt.fechaHora.slice(11, 16)
          // Instante REAL de la cita en hora MX (no en la zona del servidor)
          const apptDateObj = instanteMX(apptDate, apptHour)
          const diffHours = (apptDateObj.getTime() - now.getTime()) / (1000 * 60 * 60)

          const msgData = {
            paciente: appt.pacienteNombre,
            fecha: formatDateES(apptDate),
            hora: apptHour,
            medico: config.nombreMedico || 'el médico',
            clinica: config.nombreClinica,
            direccion: config.direccion || '',
            telefono: config.whatsappConsultorio || config.telefonoAdmin,
          }

          // 24h reminder (window: 23–26h before)
          if (config.recordatorio24h && !appt.recordatorio24hEnviado && diffHours >= 23 && diffHours <= 26) {
            const msg = buildWhatsAppMessage(template24h, msgData)
            const ok = await sendWhatsApp(phone, msg, config, clinicId)
            if (ok) {
              await adminDb.collection('clinics').doc(clinicId)
                .collection('appointments').doc(appt.id).update({
                  recordatorio24hEnviado: true,
                  estado: appt.estado === 'confirmada' ? 'recordatorio-enviado' : appt.estado,
                  updatedAt: now.toISOString(),
                })
              totals.sent++
            } else { totals.failed++ }
            continue
          }

          // Same-day reminder (window: 1–4h before)
          if (config.recordatorioMismoDia && !appt.recordatorioMismoDiaEnviado && diffHours >= 1 && diffHours <= 4) {
            const msg = buildWhatsAppMessage(templateSameDay, msgData)
            const ok = await sendWhatsApp(phone, msg, config, clinicId)
            if (ok) {
              await adminDb.collection('clinics').doc(clinicId)
                .collection('appointments').doc(appt.id).update({
                  recordatorioMismoDiaEnviado: true,
                  updatedAt: now.toISOString(),
                })
              totals.sent++
            } else { totals.failed++ }
          }
        }

        // ── Auto-reseña tras la visita (opt-in por clínica) ──
        if (config.resenaAutomatica) {
          const origin = req.nextUrl.origin
          // Acotar por fecha (~4 días) → desigualdad de un solo campo (índice automático,
          // sin índice compuesto). El estado se filtra en código.
          const desdeStr = `${sumarDiasISO(hoyISO(), -4)} 00:00`
          const postSnap = await adminDb
            .collection('clinics').doc(clinicId)
            .collection('appointments')
            .where('fechaHora', '>=', desdeStr)
            .get()
          for (const d of postSnap.docs) {
            const a = { id: d.id, ...d.data() } as Appointment & { resenaSolicitada?: boolean }
            if (!ESTADOS_POST_VISITA.includes(a.estado)) continue
            if (a.resenaSolicitada) continue
            if (!a.consentimientoMensajes || !a.pacienteTelefono) { totals.skipped++; continue }
            // Solo citas terminadas hace 2–72h (no spamear histórico viejo)
            const fin = instanteMX(a.fechaHora.slice(0, 10), a.fechaHora.slice(11, 16))
            const horas = (now.getTime() - fin.getTime()) / 3_600_000
            if (horas < 2 || horas > 72) continue
            try {
              const link = await crearSolicitudResenaAdmin(origin, clinicId, a)
              const nombre = (a.pacienteNombre || '').split(' ')[0]
              const msg = `Hola ${nombre} 🙏 ¿Nos ayudas con una reseña de tu consulta con ${config.nombreMedico || 'el médico'}? Solo toma 30 segundos:\n${link}`
              const ok = await sendWhatsApp(a.pacienteTelefono, msg, config, clinicId)
              // Marcar siempre (un intento) para no spamear ante fallos transitorios
              await adminDb.collection('clinics').doc(clinicId)
                .collection('appointments').doc(a.id).update({ resenaSolicitada: true, updatedAt: now.toISOString() })
              if (ok) totals.sent++; else totals.failed++
            } catch { totals.failed++ }
          }
        }
      } catch (clinicErr) {
        console.error(`[Cron] Error for clinic ${clinicId}:`, clinicErr)
      }
    }

    return NextResponse.json({ ok: true, ...totals })
  } catch (err) {
    console.error('Reminders cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
