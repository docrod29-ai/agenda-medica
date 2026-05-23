/**
 * POST /api/whatsapp/waitlist-notify
 *
 * Called when an appointment is cancelled.
 * Finds active waitlist patients and sends them a WhatsApp offer
 * for the now-open slot.
 *
 * Body: { fecha: string, hora: string, doctorId?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { ClinicConfig, WaitlistEntry } from '@/types'

async function send(to: string, body: string): Promise<boolean> {
  const provider = process.env.WHATSAPP_PROVIDER || 'meta'
  const clean = to.replace(/\D/g, '')
  const phone = clean.startsWith('52') ? clean : `52${clean}`

  if (provider === 'meta') {
    const token = process.env.WHATSAPP_API_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!token || !phoneNumberId) return false
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body },
      }),
    })
    return res.ok
  }

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const auth = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_WHATSAPP_FROM
    if (!sid || !auth || !from) return false
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:+${phone}`, Body: body }),
    })
    return res.ok
  }

  return false
}

function formatDate(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

export async function POST(req: NextRequest) {
  try {
    const { fecha, hora, clinicId: bodyClinicId } = await req.json()
    if (!fecha || !hora) {
      return NextResponse.json({ error: 'fecha and hora required' }, { status: 400 })
    }

    // clinicId can be passed in body or default to the only clinic (single-tenant compat)
    let clinicId = bodyClinicId
    if (!clinicId) {
      const snap = await adminDb.collection('clinics').limit(1).get()
      if (snap.empty) return NextResponse.json({ error: 'no clinics' }, { status: 500 })
      clinicId = snap.docs[0].id
    }

    const clinicRef = adminDb.collection('clinics').doc(clinicId)

    // Load config
    const configSnap = await clinicRef.collection('config').doc('main').get()
    if (!configSnap.exists) {
      return NextResponse.json({ error: 'no config' }, { status: 500 })
    }
    const config = configSnap.data() as ClinicConfig

    // Get active waitlist entries
    const waitlistSnap = await clinicRef.collection('waitlist')
      .where('estado', '==', 'activo')
      .orderBy('prioridad', 'desc')
      .orderBy('createdAt', 'asc')
      .limit(3)
      .get()

    if (waitlistSnap.empty) {
      return NextResponse.json({ notified: 0 })
    }

    const clinicName = config.nombreClinica || config.nombreMedico
    let notified = 0

    for (const doc of waitlistSnap.docs) {
      const entry = { id: doc.id, ...doc.data() } as WaitlistEntry

      if (!entry.pacienteTelefono) continue

      const msg = [
        `🔔 *Espacio disponible en ${clinicName}*`,
        ``,
        `Hola ${entry.pacienteNombre.split(' ')[0]}, se liberó un horario:`,
        ``,
        `📅 *${formatDate(fecha)}*`,
        `🕐 *${hora} hrs*`,
        ``,
        `¿Desea tomar este horario? Responda *SÍ* antes de que se ocupe.`,
        ``,
        `Si ya no está interesado, responda *NO* y le quitamos de la lista.`,
      ].join('\n')

      const ok = await send(entry.pacienteTelefono, msg)
      if (ok) {
        notified++

        const sessionData = {
          telefono: entry.pacienteTelefono,
          estado: 'esperando_lista',
          datos: {
            nombre: entry.pacienteNombre,
            slotFecha: fecha,
            slotHora: hora,
            tipo: entry.tipo || 'seguimiento',
            waitlistId: entry.id,
            pacienteId: entry.pacienteId || '',
          },
          lastMessageAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }

        // Upsert bot session (clinic-scoped)
        const sessionSnap = await clinicRef.collection('bot_sessions')
          .where('telefono', '==', entry.pacienteTelefono).limit(1).get()
        if (!sessionSnap.empty) {
          await clinicRef.collection('bot_sessions').doc(sessionSnap.docs[0].id).set(sessionData)
        } else {
          await clinicRef.collection('bot_sessions').add(sessionData)
        }

        // Mark waitlist entry as contactado
        await clinicRef.collection('waitlist').doc(entry.id).update({ estado: 'contactado' })
      }
    }

    return NextResponse.json({ ok: true, notified })
  } catch (err) {
    console.error('[WaitlistNotify] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
