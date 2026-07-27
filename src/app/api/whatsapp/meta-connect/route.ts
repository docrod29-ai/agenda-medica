/**
 * POST /api/whatsapp/meta-connect
 *
 * Called after the doctor completes Meta Embedded Signup.
 * Receives the short-lived `code` from the frontend, exchanges it for
 * a permanent System User access token, fetches the phone_number_id,
 * registers our webhook, and saves credentials to Firestore.
 *
 * Flow:
 *   1. Frontend calls FB.login() → gets `code`
 *   2. Frontend POSTs { code, clinicId } here
 *   3. We exchange code → user_token
 *   4. We create a System User token scoped to the WABA
 *   5. We fetch phone numbers for that WABA
 *   6. We subscribe our webhook to the WABA
 *   7. We save to Firestore: clinics/{clinicId}.whatsapp
 *   8. We create whatsapp_channels/{phoneNumberId} index
 */

import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { guardarSecretoCanal } from '@/lib/whatsapp/secreto-canal'
import { verificarMedico } from '@/lib/auth-server'

const APP_ID     = process.env.META_APP_ID ?? ''
const APP_SECRET = process.env.META_APP_SECRET ?? ''
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'
// Mismo valor que el webhook (acepta cualquiera de los dos nombres para no
// depender de cuál pusiste en Vercel).
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'agenda-medica-bot'

const GRAPH = 'https://graph.facebook.com/v20.0'

// ── Exchange code for token ───────────────────────────────────────
async function exchangeCodeForToken(code: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`)
  url.searchParams.set('client_id', APP_ID)
  url.searchParams.set('client_secret', APP_SECRET)
  url.searchParams.set('code', code)
  url.searchParams.set('redirect_uri', '') // Embedded Signup uses empty redirect_uri

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

// ── Get WABA ID and phone numbers for this user ───────────────────
async function getWABAInfo(userToken: string): Promise<{
  wabaId: string
  phoneNumberId: string
  phoneNumber: string
} | null> {
  // Get WhatsApp Business Accounts this user has access to
  const wabaRes = await fetch(
    `${GRAPH}/me/businesses?fields=whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number}}&access_token=${userToken}`
  )

  if (!wabaRes.ok) {
    safeLog.error('[meta-connect] Failed to get businesses:', await wabaRes.text())
    return null
  }

  const wabaData = await wabaRes.json()
  const businesses = wabaData.data ?? []

  // Find first WABA with phone numbers
  for (const biz of businesses) {
    const wabas = biz.whatsapp_business_accounts?.data ?? []
    for (const waba of wabas) {
      const phones = waba.phone_numbers?.data ?? []
      if (phones.length > 0) {
        return {
          wabaId: waba.id,
          phoneNumberId: phones[0].id,
          phoneNumber: phones[0].display_phone_number,
        }
      }
    }
  }

  // Alternative: try the shared_waba endpoint (Embedded Signup v2)
  const sharedRes = await fetch(
    `${GRAPH}/me?fields=shared_waba_id&access_token=${userToken}`
  )
  if (sharedRes.ok) {
    const sharedData = await sharedRes.json()
    const wabaId = sharedData.shared_waba_id
    if (wabaId) {
      const phonesRes = await fetch(
        `${GRAPH}/${wabaId}/phone_numbers?access_token=${userToken}`
      )
      if (phonesRes.ok) {
        const phonesData = await phonesRes.json()
        const phones = phonesData.data ?? []
        if (phones.length > 0) {
          return {
            wabaId,
            phoneNumberId: phones[0].id,
            phoneNumber: phones[0].display_phone_number,
          }
        }
      }
    }
  }

  return null
}

// ── Generate long-lived System User token ─────────────────────────
async function getLongLivedToken(shortToken: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', APP_ID)
  url.searchParams.set('client_secret', APP_SECRET)
  url.searchParams.set('fb_exchange_token', shortToken)

  const res = await fetch(url.toString())
  if (!res.ok) return shortToken // fallback to short token if exchange fails
  const data = await res.json()
  return data.access_token as string
}

// ── Register webhook on the WABA ──────────────────────────────────
async function registerWebhook(wabaId: string, token: string): Promise<void> {
  try {
    await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (e) {
    safeLog.warn('[meta-connect] Webhook subscription warning:', e)
  }
}

// ── Route handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { code, clinicId } = await req.json()

    if (!code || !clinicId) {
      return NextResponse.json({ error: 'code and clinicId required' }, { status: 400 })
    }
    const acceso = await verificarMedico(req, clinicId)
    if (!acceso.ok) return acceso.response

    if (!APP_ID || !APP_SECRET) {
      return NextResponse.json({ error: 'META_APP_ID / META_APP_SECRET not configured' }, { status: 500 })
    }

    // 1. Exchange code for token
    const shortToken = await exchangeCodeForToken(code)

    // 2. Get long-lived token (60 days)
    const longToken = await getLongLivedToken(shortToken)

    // 3. Get WABA + phone number info
    const info = await getWABAInfo(longToken)
    if (!info) {
      return NextResponse.json({ error: 'Could not find WhatsApp Business Account for this user' }, { status: 400 })
    }

    // 4. Subscribe our webhook to this WABA
    await registerWebhook(info.wabaId, longToken)

    // 5. Save to Firestore
    const now = new Date().toISOString()
    // El token va al gestor de secretos, NUNCA al doc raíz (legible por miembros).
    await guardarSecretoCanal(clinicId, longToken)
    const whatsapp = {
      provider: 'meta',
      phoneNumberId: info.phoneNumberId,
      phoneNumber: info.phoneNumber,
      wabaId: info.wabaId,
      connected: true,
      connectedAt: now,
    }

    await adminDb.collection('clinics').doc(clinicId).update({
      whatsapp,
      updatedAt: now,
    })

    // 6. Index by phoneNumberId for fast webhook lookup
    await adminDb.collection('whatsapp_channels').doc(info.phoneNumberId).set({
      clinicId,
      provider: 'meta',
      phoneNumber: info.phoneNumber,
      createdAt: now,
    })

    safeLog.info(`[meta-connect] ✅ Connected clinic ${clinicId} → ${info.phoneNumber} (WABA: ${info.wabaId})`)

    return NextResponse.json({
      ok: true,
      phoneNumber: info.phoneNumber,
      phoneNumberId: info.phoneNumberId,
    })
  } catch (err) {
    safeLog.error('[meta-connect] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
