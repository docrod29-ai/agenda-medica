import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { safeLog } from '@/lib/security/sanitize'
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/google-calendar'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { Appointment, ClinicConfig } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { action, appointment, clinicId } = await req.json() as {
      action: 'create' | 'update' | 'delete'
      appointment: Appointment
      clinicId: string
    }

    // AUTORIZACIÓN: el uid sale del TOKEN verificado, nunca del body (antes era IDOR).
    const acc = await verificarMiembro(req, clinicId)
    if (!acc.ok) return acc.response
    const uid = acc.uid

    // Token de Google del usuario autenticado (conexión personal, flat por uid)
    const tokenDoc = await adminDb.collection('googleTokens').doc(uid).get()
    if (!tokenDoc.exists) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
    }
    const { refreshToken } = tokenDoc.data() as { refreshToken: string }

    // Config y citas SCOPED a la clínica (antes leía/escribía colecciones planas legacy)
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const configSnap = await clinicRef.collection('config').doc('main').get()
    const config = (configSnap.exists ? configSnap.data() : {}) as ClinicConfig
    const calendarId = config.googleCalendarId || 'primary'
    const apptRef = clinicRef.collection('appointments').doc(appointment.id)

    if (action === 'create') {
      const eventId = await createCalendarEvent(refreshToken, calendarId, appointment, config)
      await apptRef.update({
        googleCalendarEventId: eventId,
        googleCalendarSyncStatus: 'synced',
        updatedAt: new Date().toISOString(),
      })
      return NextResponse.json({ success: true, eventId })
    }

    if (action === 'update') {
      if (!appointment.googleCalendarEventId) {
        const eventId = await createCalendarEvent(refreshToken, calendarId, appointment, config)
        await apptRef.update({
          googleCalendarEventId: eventId,
          googleCalendarSyncStatus: 'synced',
          updatedAt: new Date().toISOString(),
        })
        return NextResponse.json({ success: true, eventId })
      }
      await updateCalendarEvent(refreshToken, calendarId, appointment.googleCalendarEventId, appointment, config)
      await apptRef.update({
        googleCalendarSyncStatus: 'synced',
        updatedAt: new Date().toISOString(),
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      if (appointment.googleCalendarEventId) {
        await deleteCalendarEvent(refreshToken, calendarId, appointment.googleCalendarEventId)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    safeLog.error('Calendar sync error:', err)
    return errorAlCliente()
  }
}
