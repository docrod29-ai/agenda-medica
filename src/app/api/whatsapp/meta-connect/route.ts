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
import { reclamarCanal } from '@/lib/whatsapp/reclamar-canal'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { guardarSecretoCanal } from '@/lib/whatsapp/secreto-canal'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { fetchConTimeout, TiempoAgotado } from '@/lib/fetch-con-timeout'

const APP_ID     = process.env.META_APP_ID ?? ''
const APP_SECRET = process.env.META_APP_SECRET ?? ''
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'
/**
 * AQUÍ NO VA EL TOKEN DE VERIFICACIÓN, Y NO ES UN OLVIDO — REG-508.
 *
 * Este archivo declaraba `WEBHOOK_VERIFY_TOKEN` con un respaldo literal
 * (`'agenda-medica-bot'`) y **no lo usaba en ninguna parte**: `registerWebhook`
 * hace `POST /{wabaId}/subscribed_apps` y ahí no viaja ningún token. El de
 * verificación se teclea UNA vez en el panel de la app de Meta —Webhooks →
 * Callback URL + Verify token—, no se configura por WABA ni por API.
 *
 * Así que la constante no configuraba nada; sólo dejaba un literal adivinable en
 * el repositorio y hacía creer, a quien leyera el archivo, que este camino
 * acordaba un token con Meta. El webhook ya había tomado la decisión correcta y
 * la dejó escrita —«sin fallback público… mejor que aceptar un token por defecto
 * que está en el repo»—; a este archivo no le llegó.
 *
 * Quien manda es `WHATSAPP_WEBHOOK_TOKEN` (o su alias `WHATSAPP_VERIFY_TOKEN`)
 * en `src/app/api/whatsapp/webhook/route.ts`, y **tiene que ser el mismo valor
 * que esté tecleado en el panel de Meta**. Ver docs/ops/INVENTARIO-DE-ENTORNO.md.
 */

const GRAPH = 'https://graph.facebook.com/v20.0'

// ── Exchange code for token ───────────────────────────────────────
async function exchangeCodeForToken(code: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`)
  url.searchParams.set('client_id', APP_ID)
  url.searchParams.set('client_secret', APP_SECRET)
  url.searchParams.set('code', code)
  url.searchParams.set('redirect_uri', '') // Embedded Signup uses empty redirect_uri

  const res = await fetchConTimeout(url.toString())
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
  const wabaRes = await fetchConTimeout(
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
  const sharedRes = await fetchConTimeout(
    `${GRAPH}/me?fields=shared_waba_id&access_token=${userToken}`
  )
  if (sharedRes.ok) {
    const sharedData = await sharedRes.json()
    const wabaId = sharedData.shared_waba_id
    if (wabaId) {
      const phonesRes = await fetchConTimeout(
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

  const res = await fetchConTimeout(url.toString())
  if (!res.ok) return shortToken // fallback to short token if exchange fails
  const data = await res.json()
  return data.access_token as string
}

// ── Register webhook on the WABA ──────────────────────────────────
async function registerWebhook(wabaId: string, token: string): Promise<void> {
  try {
    await fetchConTimeout(`${GRAPH}/${wabaId}/subscribed_apps`, {
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
    const acceso = await verificarCapacidad(req, clinicId, 'administrar')
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

    // 6. Index by phoneNumberId for fast webhook lookup.
    //    No se le quita el canal a otro consultorio: ver `reclamarCanal`.
    const reclamo = await reclamarCanal(info.phoneNumberId, clinicId, {
      provider: 'meta',
      phoneNumber: info.phoneNumber,
      createdAt: now,
    })
    if (!reclamo.ok) {
      safeLog.warn(`[meta-connect] canal ya en uso por ${reclamo.dueñoPrevio ?? '?'}`)
      return NextResponse.json({ ok: false, error: reclamo.error }, { status: 409 })
    }

    safeLog.info(`[meta-connect] ✅ Connected clinic ${clinicId} → ${info.phoneNumber} (WABA: ${info.wabaId})`)

    return NextResponse.json({
      ok: true,
      phoneNumber: info.phoneNumber,
      phoneNumberId: info.phoneNumberId,
    })
  } catch (err) {
    safeLog.error('[meta-connect] Error:', err)
    /**
     * «SE TARDÓ» NO ES «FALLÓ», Y AL MÉDICO LE CAMBIA QUÉ HACER.
     *
     * Las seis llamadas de esta ruta van a la API de Meta y no llevaban tiempo
     * máximo. `fetch-con-timeout` existe justo por eso —su cabecera lo dice: un
     * socket colgado del proveedor inmoviliza la función los 300 s completos—
     * pero se había aplicado al ENVÍO de mensajes y no a la CONEXIÓN.
     *
     * El daño no es sólo de factura. El médico que conecta su WhatsApp pulsa el
     * botón y lo ve girar minutos, porque su petición espera a esta ruta, que
     * espera a Meta. Es la misma familia que el «Guardando…» eterno del alta:
     * ni error, ni éxito, ni nada que hacer.
     *
     * Con 504 y este texto, quien lo lee sabe que puede reintentar — y que el
     * problema no está en sus credenciales.
     */
    if (err instanceof TiempoAgotado) {
      return NextResponse.json({
        error: 'Meta no respondió a tiempo. No se cambió nada: vuelve a intentar la conexión.',
      }, { status: 504 })
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
