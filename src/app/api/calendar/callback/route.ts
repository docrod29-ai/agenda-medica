import { NextRequest, NextResponse } from 'next/server'
import { getTokensFromCode } from '@/lib/google-calendar'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const uid = searchParams.get('state') // uid passed in state param from connect route

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?gcal=error&msg=no_code`
    )
  }

  try {
    const tokens = await getTokensFromCode(code)

    if (uid && tokens.refresh_token) {
      await adminDb.collection('googleTokens').doc(uid).set({
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date,
        updatedAt: new Date().toISOString(),
      })
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?gcal=connected`
    )
  } catch (err) {
    console.error('Google Calendar callback error:', err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?gcal=error&msg=${encodeURIComponent(String(err))}`
    )
  }
}
