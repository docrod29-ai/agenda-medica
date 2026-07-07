import { NextRequest, NextResponse } from 'next/server'
import { listCalendars } from '@/lib/google-calendar'
import { adminDb } from '@/lib/firebase-admin'
import { verificarUsuario } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  // uid del TOKEN, no del query: antes cualquiera leía los calendarios de otro uid.
  const acc = await verificarUsuario(req)
  if (!acc.ok) return acc.response
  const uid = acc.uid

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
