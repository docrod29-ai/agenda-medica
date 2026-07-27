import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { getTokensFromCode } from '@/lib/google-calendar'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const nonce = searchParams.get('state') // nonce de un solo uso creado en /connect

  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!code) {
    return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=no_code`)
  }

  try {
    // El uid NO se toma del `state`: se recupera del nonce guardado server-side en
    // /connect, ligado a la sesión autenticada. Un `state` desconocido/expirado se
    // rechaza → cierra el secuestro de cuenta / fuga de PHI por OAuth.
    if (!nonce) {
      return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=state_invalido`)
    }
    const stateRef = adminDb.collection('oauthStates').doc(nonce)
    const stateSnap = await stateRef.get()
    const st = stateSnap.data()
    // Consumir el nonce SIEMPRE (un solo uso), aunque luego falle algo.
    await stateRef.delete().catch(() => {})

    if (!stateSnap.exists || !st?.uid || (typeof st.exp === 'number' && st.exp < Date.now())) {
      return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=state_invalido`)
    }
    const uid = st.uid as string

    const tokens = await getTokensFromCode(code)

    // Sin refresh_token NO queda nada guardado → no reportar "conectado" en falso.
    // (Google solo lo devuelve con prompt=consent/access_type=offline la 1ª vez.)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=sin_permiso_offline`)
    }

    await adminDb.collection('googleTokens').doc(uid).set({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiryDate: tokens.expiry_date,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.redirect(`${base}/configuracion?gcal=connected`)
  } catch (err) {
    safeLog.error('Google Calendar callback error:', err)
    return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=${encodeURIComponent(String(err))}`)
  }
}
