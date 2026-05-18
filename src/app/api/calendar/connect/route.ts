import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client } from '@/lib/google-calendar'

const SCOPES = ['https://www.googleapis.com/auth/calendar']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const uid = searchParams.get('uid') ?? ''

    const oauth2Client = getOAuth2Client()
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: uid,
    })

    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
