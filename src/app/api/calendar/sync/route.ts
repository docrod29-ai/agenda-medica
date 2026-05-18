import { NextRequest, NextResponse } from 'next/server'
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/google-calendar'
import { adminDb } from '@/lib/firebase-admin'
import { Appointment, ClinicConfig } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { action, appointment, uid } = await req.json() as {
      action: 'create' | 'update' | 'delete'
      appointment: Appointment
      uid: string
    }

    // Get stored tokens
    const tokenDoc = await adminDb.collection('googleTokens').doc(uid).get()
    if (!tokenDoc.exists) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
    }
    const { refreshToken } = tokenDoc.data() as { refreshToken: string }

    // Get clinic config for calendar ID and timezone
    const configSnap = await adminDb.collection('config').doc('main').get()
    const config = (configSnap.exists ? configSnap.data() : {}) as ClinicConfig
    const calendarId = config.googleCalendarId || 'primary'

    if (action === 'create') {
      const eventId = await createCalendarEvent(refreshToken, calendarId, appointment, config)
      // Update appointment with eventId
      await adminDb.collection('appointments').doc(appointment.id).update({
        googleCalendarEventId: eventId,
        googleCalendarSyncStatus: 'synced',
        updatedAt: new Date().toISOString(),
      })
      return NextResponse.json({ success: true, eventId })
    }

    if (action === 'update') {
      if (!appointment.googleCalendarEventId) {
        // No existing event, create one
        const eventId = await createCalendarEvent(refreshToken, calendarId, appointment, config)
        await adminDb.collection('appointments').doc(appointment.id).update({
          googleCalendarEventId: eventId,
          googleCalendarSyncStatus: 'synced',
          updatedAt: new Date().toISOString(),
        })
        return NextResponse.json({ success: true, eventId })
      }
      await updateCalendarEvent(refreshToken, calendarId, appointment.googleCalendarEventId, appointment, config)
      await adminDb.collection('appointments').doc(appointment.id).update({
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
    console.error('Calendar sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
