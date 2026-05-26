/**
 * POST /api/whatsapp/manual-connect
 *
 * Conexión manual de WhatsApp (Meta Cloud API) sin Embedded Signup.
 * El médico pega su Phone Number ID y su access token (del panel de Meta
 * o del número de prueba). Validamos el token consultando Graph API y,
 * si es válido, guardamos las credenciales en la clínica.
 *
 * Body: { clinicId, phoneNumberId, token }
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

const GRAPH = 'https://graph.facebook.com/v20.0'

export async function POST(req: NextRequest) {
  try {
    const { clinicId, phoneNumberId, token } = await req.json()

    if (!clinicId || !phoneNumberId || !token) {
      return NextResponse.json({ ok: false, error: 'Faltan clinicId, phoneNumberId o token' }, { status: 400 })
    }

    // 1. Validar credenciales: pedir el número a Graph API
    const res = await fetch(
      `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(token)}`
    )
    if (!res.ok) {
      const err = await res.text()
      console.error('[manual-connect] Validación falló:', res.status, err)
      return NextResponse.json(
        { ok: false, error: 'Credenciales inválidas. Revisa el Phone Number ID y el token.' },
        { status: 400 },
      )
    }
    const data = await res.json()
    const phoneNumber: string = data.display_phone_number ?? `ID ${phoneNumberId}`

    // 2. Guardar en la clínica
    const now = new Date().toISOString()
    const whatsapp = {
      provider: 'meta',
      apiKey: token,
      phoneNumberId,
      phoneNumber,
      connected: true,
      connectedAt: now,
    }
    await adminDb.collection('clinics').doc(clinicId).update({ whatsapp, updatedAt: now })

    // 3. Índice para que el webhook encuentre la clínica por phoneNumberId
    await adminDb.collection('whatsapp_channels').doc(phoneNumberId).set({
      clinicId, provider: 'meta', phoneNumber, createdAt: now,
    })

    return NextResponse.json({ ok: true, phoneNumber })
  } catch (err) {
    console.error('[manual-connect] Error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
