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

    // Sin refresh_token NO queda nada guardado → no reportar "conectado" en falso.
    // (Google solo lo devuelve con prompt=consent/access_type=offline la 1ª vez.)
    if (!uid || !tokens.refresh_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/configuracion?gcal=error&msg=sin_permiso_offline`)
    }

    await adminDb.collection('googleTokens').doc(uid).set({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiryDate: tokens.expiry_date,
      updatedAt: new Date().toISOString(),
    })

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
