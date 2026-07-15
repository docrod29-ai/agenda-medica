/**
 * Contrato del ADAPTADOR de proveedor de WhatsApp (Iteración 2 · META_ONBOARDING).
 *
 * Objetivo del programa: "La lógica de agenda nunca debe depender del proveedor".
 * Toda la app envía a través de esta interfaz; detrás puede estar Meta Cloud API
 * o un partner oficial (360dialog). Migrar de proveedor = cambiar la implementación,
 * no la lógica de negocio. Aquí solo el CONTRATO (tipos); las implementaciones
 * concretas envuelven a `src/lib/whatsapp-send.ts`.
 */
import type { ProveedorWA } from './connection'

export interface SendResult {
  ok: boolean
  /** id del mensaje del proveedor (wamid), para conciliar estados. */
  messageId?: string
  error?: string
}

export interface SendTextInput { to: string; text: string; tenantId: string }
export interface SendTemplateInput {
  to: string; tenantId: string
  templateName: string; templateLang: string
  variables?: string[]
  categoria?: 'utility' | 'authentication' | 'marketing'
}
export interface SendButtonsInput { to: string; tenantId: string; body: string; buttons: { id: string; label: string }[] }
export interface SendListInput { to: string; tenantId: string; body: string; button: string; items: { id: string; label: string; description?: string }[] }
export interface SendFlowInput { to: string; tenantId: string; flowId: string; flowToken: string; body: string; cta: string }

export interface NormalizedWebhookEvent {
  tenantId: string
  from: string
  kind: 'text' | 'button' | 'list' | 'flow_response' | 'status'
  text?: string
  selectionId?: string
  messageId?: string
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  raw: unknown
}

export interface WhatsAppProviderAdapter {
  provider: ProveedorWA
  sendText(input: SendTextInput): Promise<SendResult>
  sendTemplate(input: SendTemplateInput): Promise<SendResult>
  sendButtons(input: SendButtonsInput): Promise<SendResult>
  sendList(input: SendListInput): Promise<SendResult>
  sendFlow(input: SendFlowInput): Promise<SendResult>
  verifyWebhook(request: unknown): Promise<boolean>
  normalizeWebhook(request: unknown): Promise<NormalizedWebhookEvent[]>
}

/** Consentimiento granular (regla no negociable del programa). */
export interface WhatsAppConsent {
  id: string
  tenantId: string
  contactId: string
  phoneNumber: string
  purpose: 'administrative' | 'appointment_reminders' | 'clinical_followup' | 'documents' | 'marketing'
  status: 'granted' | 'revoked' | 'expired'
  textVersion: string
  source: string
  grantedAt?: string
  revokedAt?: string
}
