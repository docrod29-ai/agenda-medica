import { NextRequest, NextResponse } from 'next/server'
import { listCalendars } from '@/lib/google-calendar'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')

  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 })

  try {
    const tokenDoc = await adminDb.collection('googleTokens').doc(uid).get()
    if (!tokenDoc.exists) return NextResponse.json({ error: 'Not connected' }, { status: 400 })

    const { refreshToken } = tokenDoc.data() as { refreshToken: string }
    const calendars = await listCalendars(refreshToken)

    return NextResponse.json({
      calendars: calendars.map(c => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary ?? false,
      }))
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
