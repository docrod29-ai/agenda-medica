import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getOAuth2Client } from '@/lib/google-calendar'
import { verificarUsuario } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'

const SCOPES = ['https://www.googleapis.com/auth/calendar']
const STATE_TTL_MIN = 15

export async function GET(req: NextRequest) {
  // AUTENTICACIÓN OBLIGATORIA: el uid se deriva del token, NUNCA del query.
  // Antes `state = uid` del query permitía ligar el Google de un atacante al uid
  // de una víctima → sus citas (PHI) se sincronizaban al calendario ajeno.
  const acc = await verificarUsuario(req)
  if (!acc.ok) return acc.response

  try {
    // Nonce de un solo uso, ligado al uid autenticado y con expiración. El callback
    // recupera el uid desde aquí, no del parámetro `state` que viaja por el navegador.
    const nonce = randomUUID()
    await adminDb.collection('oauthStates').doc(nonce).set({
      uid: acc.uid,
      // El correo VERIFICADO de la sesión, no el que mande el navegador: es con
      // lo que el callback liga este calendario a la ficha del médico.
      email: acc.email ?? '',
      proveedor: 'google-calendar',
      exp: Date.now() + STATE_TTL_MIN * 60_000,
      createdAt: new Date().toISOString(),
    })

    const oauth2Client = getOAuth2Client()
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: nonce,
    })

    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
