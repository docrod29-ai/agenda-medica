/**
 * GET /api/whatsapp/360dialog-callback
 *
 * 360dialog redirects here after the doctor completes the WhatsApp
 * Business enrollment flow. Query params:
 *
 *   ?client=CLIENT_ID          — 360dialog client ID for this doctor
 *   &channels=["CHANNEL_ID"]   — JSON array of channel IDs (phone numbers)
 *   &clinicId=CLINIC_ID        — our own param, passed via redirect_url
 *
 * What this handler does:
 *   1. Calls 360dialog Partner API to generate a permanent api_key
 *   2. Registers our webhook URL with 360dialog for this channel
 *   3. Stores credentials in Firestore under clinics/{clinicId}.whatsapp
 *   4. Creates a whatsapp_channels/{apiKey} index doc for O(1) lookups
 *   5. Redirects the doctor to the configuracion page with a success banner
 */

import { NextRequest, NextResponse } from 'next/server'
import { reclamarCanal } from '@/lib/whatsapp/reclamar-canal'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { guardarSecretoCanal } from '@/lib/whatsapp/secreto-canal'

const PARTNER_ID    = process.env.DIALOG360_PARTNER_ID ?? ''
const PARTNER_TOKEN = process.env.DIALOG360_PARTNER_TOKEN ?? ''
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'
const WEBHOOK_URL   = `${APP_URL}/api/whatsapp/360dialog-webhook`

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId  = searchParams.get('client')
  const channelsRaw = searchParams.get('channels')
  const nonce     = searchParams.get('state')

  // ── Validate ──────────────────────────────────────────────────
  if (!clientId || !channelsRaw || !nonce) {
    safeLog.error('[360dialog callback] Missing params:', { clientId, channelsRaw, nonce: !!nonce })
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=integraciones&wa=error&reason=missing_params`)
  }

  // El clinicId NUNCA sale de la URL. Se recupera del nonce de un solo uso que
  // emitió /api/whatsapp/360dialog-connect contra un usuario ya verificado como
  // miembro. Antes venía por query string sin autenticación: cualquiera podía
  // apuntar SU canal de WhatsApp al consultorio de otro y, con eso, leer y
  // responder los mensajes de sus pacientes y su agenda.
  const estadoRef = adminDb.collection('oauthStates').doc(nonce)
  const estadoSnap = await estadoRef.get()
  const estado = estadoSnap.data()
  if (!estadoSnap.exists || estado?.proveedor !== 'whatsapp-360dialog' || !estado?.clinicId) {
    safeLog.error('[360dialog callback] Nonce inválido o de otro proveedor')
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=integraciones&wa=error&reason=estado_invalido`)
  }
  if (typeof estado.exp !== 'number' || estado.exp < Date.now()) {
    await estadoRef.delete().catch(() => {})
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=integraciones&wa=error&reason=estado_expirado`)
  }
  const clinicId: string = estado.clinicId
  // De un solo uso: se consume aquí para que no pueda repetirse.
  await estadoRef.delete().catch(() => {})

  if (!PARTNER_ID || !PARTNER_TOKEN) {
    safeLog.error('[360dialog callback] Partner credentials not set in env vars')
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=integraciones&wa=error&reason=not_configured`)
  }

  let channelIds: string[]
  try {
    channelIds = JSON.parse(decodeURIComponent(channelsRaw))
    if (!Array.isArray(channelIds) || channelIds.length === 0) throw new Error('empty')
  } catch {
    return NextResponse.redirect(`${APP_URL}/configuracion?tab=integraciones&wa=error&reason=bad_channels`)
  }

  const channelId = channelIds[0] // Use first channel (most doctors have one number)

  try {
    // ── Step 1: Generate permanent API key ───────────────────────
    const keyRes = await fetch(
      `https://partner.360dialog.io/api/v2/clients/${clientId}/channels/${channelId}/api-keys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PARTNER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    )

    if (!keyRes.ok) {
      const body = await keyRes.text()
      safeLog.error('[360dialog callback] Failed to get api_key:', keyRes.status, body)
      return NextResponse.redirect(`${APP_URL}/configuracion?tab=integraciones&wa=error&reason=api_key_failed`)
    }

    const keyData = await keyRes.json()
    const apiKey: string = keyData.api_key ?? keyData.apiKey ?? keyData.data?.api_key

    if (!apiKey) {
      safeLog.error('[360dialog callback] No api_key in response:', JSON.stringify(keyData))
      return NextResponse.redirect(`${APP_URL}/configuracion?tab=integraciones&wa=error&reason=no_api_key`)
    }

    // ── Step 2: Get phone number info ─────────────────────────────
    let phoneNumber = ''
    const phoneNumberId = channelId
    try {
      const infoRes = await fetch('https://waba.360dialog.io/v1/settings/business/profile', {
        headers: { 'D360-API-KEY': apiKey },
      })
      if (infoRes.ok) {
        const info = await infoRes.json()
        phoneNumber = info.phone_number ?? info.wa_id ?? ''
      }
    } catch {
      // Phone number info is optional — don't fail
    }

    // ── Step 3: Register our webhook with 360dialog ───────────────
    try {
      const webhookRes = await fetch('https://waba.360dialog.io/v1/configs/webhook', {
        method: 'POST',
        headers: {
          'D360-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: WEBHOOK_URL }),
      })
      if (!webhookRes.ok) {
        const err = await webhookRes.text()
        safeLog.warn('[360dialog callback] Webhook registration warning:', err)
        // Non-fatal — continue
      }
    } catch (e) {
      safeLog.warn('[360dialog callback] Webhook registration failed (non-fatal):', e)
    }

    // ── Step 4: Save to Firestore ─────────────────────────────────
    const now = new Date().toISOString()
    await guardarSecretoCanal(clinicId, apiKey)
    const whatsapp = {
      provider: '360dialog',
      phoneNumberId,
      phoneNumber: phoneNumber || `+${channelId}`,
      connected: true,
      connectedAt: now,
    }

    await adminDb.collection('clinics').doc(clinicId).update({
      whatsapp,
      updatedAt: now,
    })

    // ── Step 5: Index by apiKey for fast webhook lookup ───────────
    //    No se le quita el canal a otro consultorio: ver `reclamarCanal`.
    const reclamo = await reclamarCanal(apiKey, clinicId, { channelId, clientId, createdAt: now })
    if (!reclamo.ok) {
      safeLog.warn(`[360dialog callback] canal ya en uso por ${reclamo.dueñoPrevio ?? '?'}`)
      return NextResponse.json({ ok: false, error: reclamo.error }, { status: 409 })
    }

    safeLog.info(`[360dialog callback] ✅ Connected clinic ${clinicId} → channel ${channelId}`)

    return NextResponse.redirect(
      `${APP_URL}/configuracion?tab=integraciones&wa=connected`
    )
  } catch (err) {
    safeLog.error('[360dialog callback] Unexpected error:', err)
    return NextResponse.redirect(
      `${APP_URL}/configuracion?tab=integraciones&wa=error&reason=unexpected`
    )
  }
}
