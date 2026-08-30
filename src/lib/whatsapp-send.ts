/**
 * Unified WhatsApp send function
 *
 * All message sending in the app goes through here.
 * Reads per-clinic credentials from Firestore (set by 360dialog enrollment).
 * Falls back to global env vars for backward compatibility.
 */

import { adminDb } from '@/lib/firebase-admin'
import { fetchConTimeout, TIMEOUT } from '@/lib/fetch-con-timeout'
import type { ClinicWhatsApp } from '@/types'
import { estaDadoDeBaja, conPieOptout, normalizarTelefonoWa } from '@/lib/whatsapp/consent'
import { conSecretoCanal } from '@/lib/whatsapp/secreto-canal'
import { permiteLlamar, anotarVeredicto, type Veredicto } from '@/lib/red/interruptor'
import {
  veredictoDeRespuestaWA, veredictoDeExcepcionWA, claveCircuitoWA,
} from '@/lib/whatsapp/fallo-del-proveedor'

interface SendResult {
  ok: boolean
  error?: string
  /** true si no se envió por baja del contacto (opt-out). No es un fallo. */
  optout?: boolean
  /**
   * ¿El fallo dice que el PROVEEDOR no está? (REG-391)
   *
   * Va como dato y no deducido del texto de `error`: quien decide con esto es el
   * outbox, y hacerle leer «Meta 503: …» con una expresión regular sería atar la
   * supervivencia de un recordatorio al formato de un mensaje de registro.
   */
  veredicto?: Veredicto
}

interface SendOpts {
  /**
   * Mensaje PROACTIVO iniciado por el consultorio (recordatorio, aviso de lista
   * de espera). Se respeta el opt-out y se agrega el pie "Responda BAJA…".
   * Las respuestas REACTIVAS del bot (que el paciente inició) omiten esto.
   */
  proactivo?: boolean
}

/**
 * Normaliza un teléfono mexicano a la forma canónica de WhatsApp.
 *
 * Reexporta la MISMA función que usan el opt-out y la ventana de 24 h: distintas y una dejaba el "1" de móvil que la otra quitaba, de
 * modo que el mensaje se enviaba con una clave y la baja se había guardado con
 * otra. Una sola definición cierra ese desajuste de raíz.
 */
function normalisePhone(raw: string): string {
  return normalizarTelefonoWa(raw)
}

// ── 360dialog ────────────────────────────────────────────────────────────────

async function sendVia360dialog(apiKey: string, to: string, body: string): Promise<SendResult> {
  try {
    const res = await fetchConTimeout('https://waba.360dialog.io/v1/messages', {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
    }, TIMEOUT.whatsapp)
    if (!res.ok) {
      const err = await res.text()
      return { ok: false, error: `360dialog ${res.status}: ${err}`, veredicto: veredictoDeRespuestaWA(res.status) }
    }
    return { ok: true, veredicto: 'contesto' }
  } catch (e) {
    return { ok: false, error: String(e), veredicto: veredictoDeExcepcionWA(e) }
  }
}

// ── Meta Cloud API ────────────────────────────────────────────────────────────

async function sendViaMeta(token: string, phoneNumberId: string, to: string, body: string): Promise<SendResult> {
  try {
    const res = await fetchConTimeout(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    }, TIMEOUT.whatsapp)
    if (!res.ok) {
      const err = await res.text()
      return { ok: false, error: `Meta ${res.status}: ${err}`, veredicto: veredictoDeRespuestaWA(res.status) }
    }
    return { ok: true, veredicto: 'contesto' }
  } catch (e) {
    return { ok: false, error: String(e), veredicto: veredictoDeExcepcionWA(e) }
  }
}

// ── Twilio ───────────────────────────────────────────────────────────────────

async function sendViaTwilio(to: string, body: string): Promise<SendResult> {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!sid || !auth || !from) return { ok: false, error: 'Twilio not configured' }
  try {
    const res = await fetchConTimeout(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:+${to}`, Body: body }),
    }, TIMEOUT.whatsapp)
    return res.ok
      ? { ok: true, veredicto: 'contesto' }
      : { ok: false, error: `Twilio ${res.status}`, veredicto: veredictoDeRespuestaWA(res.status) }
  } catch (e) {
    return { ok: false, error: String(e), veredicto: veredictoDeExcepcionWA(e) }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * LA PUERTA DEL INTERRUPTOR (REG-391).
 *
 * Envuelve un envío: si el proveedor lleva un rato sin estar, no se llama y se
 * falla RÁPIDO diciendo la verdad —«el proveedor no está»—, que es justo el dato
 * que el outbox necesita para no gastarle un reintento al mensaje.
 *
 * Sin esto, el cron que drena hasta 25 entradas por consultorio, en serie, se
 * comía 250 s de timeouts en el primer consultorio de la lista y los últimos se
 * quedaban sin recordatorios.
 */
async function conInterruptor(clave: string, enviar: () => Promise<SendResult>): Promise<SendResult> {
  if (!permiteLlamar(clave).pasa) {
    return {
      ok: false,
      error: 'El proveedor de WhatsApp no está respondiendo; no se intentó el envío.',
      veredicto: 'el_proveedor_no_esta',
    }
  }
  const r = await enviar()
  /**
   * Un envío que no dejó veredicto no enseña nada del proveedor: se anota como
   * «no dice nada» en vez de suponer una caída que nadie observó.
   */
  anotarVeredicto(clave, r.veredicto ?? (r.ok ? 'contesto' : 'no_dice_nada_del_proveedor'))
  return r
}

/**
 * Send a WhatsApp message on behalf of a clinic.
 *
 * Credential resolution order:
 *   1. Clinic's own 360dialog api_key (from Firestore)
 *   2. Clinic's own Meta token + phoneNumberId (from Firestore — set by Embedded Signup)
 *   3. Global env vars (WHATSAPP_PROVIDER / WHATSAPP_API_TOKEN / ...)
 */
export async function sendWhatsApp(
  clinicId: string,
  to: string,
  body: string,
  opts: SendOpts = {},
): Promise<SendResult> {
  const phone = normalisePhone(to)

  // ── 0. Opt-out: los mensajes PROACTIVOS respetan la baja del contacto ──
  let outgoing = body
  if (opts.proactivo) {
    if (await estaDadoDeBaja(clinicId, phone)) {
      return { ok: false, optout: true, error: 'contacto dado de baja (opt-out)' }
    }
    outgoing = conPieOptout(body) // pie "Responda BAJA…" visible
  }

  // ── 1. Load clinic WhatsApp config from Firestore ─────────────
  let waConfig: ClinicWhatsApp | undefined
  try {
    const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
    const publico = clinicSnap.data()?.whatsapp as ClinicWhatsApp | undefined
    // El token NO viene en el doc raíz: se resuelve desde el gestor de secretos.
    waConfig = await conSecretoCanal(clinicId, publico)
  } catch {
    // Firestore unavailable — fall through to env vars
  }

  // ── 2. Use clinic-specific credentials ─────────────────────────
  if (waConfig?.connected) {
    if (waConfig.provider === '360dialog' && waConfig.apiKey) {
      const apiKey = waConfig.apiKey
      const result = await conInterruptor(
        claveCircuitoWA('360dialog', true, clinicId),
        () => sendVia360dialog(apiKey, phone, outgoing),
      )
      if (!result.ok) console.error(`[WhatsApp] 360dialog error for clinic ${clinicId}:`, result.error)
      return result
    }

    if (waConfig.provider === 'meta' && waConfig.apiKey && waConfig.phoneNumberId) {
      const { apiKey, phoneNumberId } = waConfig
      return conInterruptor(
        claveCircuitoWA('meta', true, clinicId),
        () => sendViaMeta(apiKey, phoneNumberId, phone, outgoing),
      )
    }
  }

  // ── 3. Fall back to global env vars ────────────────────────────
  const provider = process.env.WHATSAPP_PROVIDER || 'meta'

  if (provider === 'meta') {
    const token = process.env.WHATSAPP_API_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!token || !phoneNumberId) {
      console.warn(`[WhatsApp] No credentials for clinic ${clinicId} and no global env vars set.`)
      return { ok: false, error: 'WhatsApp not configured for this clinic' }
    }
    return conInterruptor(
      claveCircuitoWA('meta', false, clinicId),
      () => sendViaMeta(token, phoneNumberId, phone, outgoing),
    )
  }

  if (provider === 'twilio') {
    return conInterruptor(
      claveCircuitoWA('twilio', false, clinicId),
      () => sendViaTwilio(phone, outgoing),
    )
  }

  return { ok: false, error: 'No WhatsApp provider configured' }
}

// ── Plantillas HSM (mensajes proactivos fuera de la ventana de 24 h) ───────────

export interface TemplatePayload {
  /** Nombre de la plantilla aprobada en Meta/360dialog. */
  name: string
  /** Código de idioma aprobado (p. ej. es_MX). */
  lang: string
  /** Parámetros del BODY en orden {{1}}..{{n}}. */
  bodyParams: string[]
}

function componentesPlantilla(bodyParams: string[]) {
  return bodyParams.length
    ? [{ type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text })) }]
    : []
}

async function sendVia360dialogTemplate(apiKey: string, to: string, t: TemplatePayload): Promise<SendResult> {
  try {
    const res = await fetchConTimeout('https://waba.360dialog.io/v1/messages', {
      method: 'POST',
      headers: { 'D360-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: { name: t.name, language: { code: t.lang }, components: componentesPlantilla(t.bodyParams) },
      }),
    }, TIMEOUT.whatsapp)
    if (!res.ok) return { ok: false, error: `360dialog ${res.status}: ${await res.text()}`, veredicto: veredictoDeRespuestaWA(res.status) }
    return { ok: true, veredicto: 'contesto' }
  } catch (e) {
    return { ok: false, error: String(e), veredicto: veredictoDeExcepcionWA(e) }
  }
}

async function sendViaMetaTemplate(token: string, phoneNumberId: string, to: string, t: TemplatePayload): Promise<SendResult> {
  try {
    const res = await fetchConTimeout(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: t.name, language: { code: t.lang }, components: componentesPlantilla(t.bodyParams) },
      }),
    }, TIMEOUT.whatsapp)
    if (!res.ok) return { ok: false, error: `Meta ${res.status}: ${await res.text()}`, veredicto: veredictoDeRespuestaWA(res.status) }
    return { ok: true, veredicto: 'contesto' }
  } catch (e) {
    return { ok: false, error: String(e), veredicto: veredictoDeExcepcionWA(e) }
  }
}

/**
 * Envía una PLANTILLA HSM aprobada (para mensajes proactivos fuera de la ventana
 * de 24 h). Respeta el opt-out. Resolución de credenciales espejo de sendWhatsApp.
 * Twilio (formato de contenido distinto) no se soporta por esta vía.
 */
export async function sendWhatsAppTemplate(
  clinicId: string,
  to: string,
  t: TemplatePayload,
  opts: SendOpts = {},
): Promise<SendResult> {
  const phone = normalisePhone(to)

  if (opts.proactivo && (await estaDadoDeBaja(clinicId, phone))) {
    return { ok: false, optout: true, error: 'contacto dado de baja (opt-out)' }
  }

  let waConfig: ClinicWhatsApp | undefined
  try {
    const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get()
    waConfig = await conSecretoCanal(clinicId, clinicSnap.data()?.whatsapp as ClinicWhatsApp | undefined)
  } catch {
    // Firestore no disponible — cae a env vars
  }

  if (waConfig?.connected) {
    if (waConfig.provider === '360dialog' && waConfig.apiKey) {
      const apiKey = waConfig.apiKey
      const result = await conInterruptor(
        claveCircuitoWA('360dialog', true, clinicId),
        () => sendVia360dialogTemplate(apiKey, phone, t),
      )
      if (!result.ok) console.error(`[WhatsApp] 360dialog plantilla error clínica ${clinicId}:`, result.error)
      return result
    }
    if (waConfig.provider === 'meta' && waConfig.apiKey && waConfig.phoneNumberId) {
      const { apiKey, phoneNumberId } = waConfig
      return conInterruptor(
        claveCircuitoWA('meta', true, clinicId),
        () => sendViaMetaTemplate(apiKey, phoneNumberId, phone, t),
      )
    }
  }

  const provider = process.env.WHATSAPP_PROVIDER || 'meta'
  if (provider === 'meta') {
    const token = process.env.WHATSAPP_API_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!token || !phoneNumberId) return { ok: false, error: 'WhatsApp not configured for this clinic' }
    return conInterruptor(
      claveCircuitoWA('meta', false, clinicId),
      () => sendViaMetaTemplate(token, phoneNumberId, phone, t),
    )
  }

  return { ok: false, error: 'Plantillas no soportadas para el proveedor actual' }
}

/**
 * Quick lookup: find clinicId from a 360dialog api_key.
 * Uses the whatsapp_channels index collection for O(1) lookup.
 */
export async function findClinicByDialog360ApiKey(apiKey: string): Promise<string | null> {
  try {
    const snap = await adminDb.collection('whatsapp_channels').doc(apiKey).get()
    return snap.exists ? (snap.data()!.clinicId as string) : null
  } catch {
    return null
  }
}
