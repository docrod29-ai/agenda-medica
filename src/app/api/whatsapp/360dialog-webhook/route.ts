/**
 * POST /api/whatsapp/360dialog-webhook
 *
 * Receives incoming WhatsApp messages from 360dialog for ANY connected clinic.
 * Identifies the clinic via the D360-API-KEY header, then hands off to the
 * same conversation state machine used by the Meta webhook.
 *
 * 360dialog message format:
 * {
 *   "contacts": [{ "wa_id": "521234567890", "profile": { "name": "María" } }],
 *   "messages": [{
 *     "from": "521234567890",
 *     "id": "wamid.xxx",
 *     "type": "text",
 *     "text": { "body": "Hola" },
 *     "timestamp": "1234567890"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { findClinicByDialog360ApiKey } from '@/lib/whatsapp-send'
import { marcarProcesado, telefonoRedactado } from '@/lib/whatsapp/dedup'
import { parsearStatuses, registrarStatus } from '@/lib/whatsapp/status'

// We import the core bot handler from the main webhook so we don't duplicate logic.
// The main webhook exports handleMessage for reuse.
import { handleMessage } from '@/app/api/whatsapp/webhook/route'

export async function POST(req: NextRequest) {
  // ── Identify clinic by api_key header ────────────────────────
  const apiKey = req.headers.get('D360-API-KEY') ?? req.headers.get('d360-api-key') ?? ''

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing D360-API-KEY header' }, { status: 400 })
  }

  const clinicId = await findClinicByDialog360ApiKey(apiKey)
  if (!clinicId) {
    // §9.5: no registrar material de la llave. Solo el evento (llave desconocida).
    safeLog.warn('[360dialog webhook] api_key desconocida — no coincide con ningún canal')
    return NextResponse.json({ error: 'Unknown channel' }, { status: 404 })
  }

  // ── Parse payload ────────────────────────────────────────────
  let payload: {
    messages?: { id?: string; from: string; type: string; text?: { body: string } }[]
    statuses?: { id?: string; status?: string; recipient_id?: string; timestamp?: string; errors?: { code?: number; title?: string }[] }[]
  }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Estados de entrega (sent/delivered/read/failed) → visibilidad + opt-out Meta
  if (Array.isArray(payload.statuses) && payload.statuses.length > 0) {
    for (const s of parsearStatuses(payload)) await registrarStatus(clinicId, s)
  }

  const messages = payload.messages ?? []
  if (messages.length === 0) {
    return NextResponse.json({ ok: true }) // solo estados, sin mensaje entrante
  }

  // ── Process each message ─────────────────────────────────────
  for (const msg of messages) {
    if (msg.type !== 'text' || !msg.text?.body) continue
    const from = msg.from  // already E.164 without '+', e.g. "521234567890"
    const body = msg.text.body.trim()

    // Idempotencia: 360dialog puede reentregar el mismo wamid. Fail-open.
    const { nuevo } = await marcarProcesado(msg.id)
    if (!nuevo) continue

    try {
      await handleMessage(from, body, clinicId)
    } catch (err) {
      safeLog.error(`[360dialog webhook] handleMessage error for ${telefonoRedactado(from)}:`, err)
    }
  }

  return NextResponse.json({ ok: true })
}

// 360dialog also sends a GET for webhook verification (optional)
export async function GET() {
  return NextResponse.json({ status: 'ok', webhook: '360dialog' })
}
