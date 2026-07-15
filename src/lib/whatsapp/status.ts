/**
 * Estados de entrega de WhatsApp (statuses) — Iteración 6 · DELIVERY_STATUS.
 *
 * Meta y 360dialog envían callbacks de estado (sent/delivered/read/failed) además
 * de los mensajes entrantes. Hasta ahora se descartaban → no había visibilidad de
 * si un recordatorio llegó, ni reacción a fallos permanentes u opt-out de Meta.
 *
 * El parseo y la clasificación de errores son PUROS. El registro en Firestore es
 * una capa delgada a prueba de fallos.
 */

import { adminDb } from '@/lib/firebase-admin'
import { registrarBaja } from '@/lib/whatsapp/consent'

export interface EstadoMensaje {
  wamid: string
  estado: 'sent' | 'delivered' | 'read' | 'failed' | string
  telefono?: string
  timestamp?: string
  errorCode?: number
  errorTitulo?: string
}

interface StatusCrudo {
  id?: string
  status?: string
  recipient_id?: string
  timestamp?: string
  errors?: { code?: number; title?: string }[]
}

/**
 * Extrae los estados de un payload. Meta: `value.statuses[]`. 360dialog: en el
 * cuerpo raíz `payload.statuses[]`. Ambos comparten la forma del elemento. Puro.
 */
export function parsearStatuses(contenedor: { statuses?: StatusCrudo[] } | null | undefined): EstadoMensaje[] {
  const arr = Array.isArray(contenedor?.statuses) ? contenedor!.statuses! : []
  return arr
    .map((s): EstadoMensaje => ({
      wamid: s?.id ?? '',
      estado: s?.status ?? 'unknown',
      telefono: s?.recipient_id,
      timestamp: s?.timestamp,
      errorCode: s?.errors?.[0]?.code,
      errorTitulo: s?.errors?.[0]?.title,
    }))
    .filter(s => s.wamid)
}

// Código de Meta cuando el usuario pidió dejar de recibir mensajes (opt-out a
// nivel plataforma). Debemos honrarlo dando de baja al contacto.
const CODIGO_OPTOUT_META = 131050

/** ¿El fallo indica un opt-out del usuario a nivel Meta? Puro. */
export function esOptoutDeMeta(errorCode?: number): boolean {
  return errorCode === CODIGO_OPTOUT_META
}

/**
 * ¿El fallo es PERMANENTE (no reintentar)? Puro.
 *  131026 = mensaje no entregable (nº no está en WhatsApp / bloqueado)
 *  131050 = usuario se dio de baja (opt-out)
 */
export function esFalloPermanente(errorCode?: number): boolean {
  return errorCode === 131026 || errorCode === CODIGO_OPTOUT_META
}

/**
 * Registra un estado de entrega en `clinics/{id}/whatsapp_status/{wamid}`. Si el
 * estado es un opt-out de Meta, da de baja al contacto para no volver a enviarle.
 * A prueba de fallos (un error nunca rompe el webhook).
 */
export async function registrarStatus(clinicId: string, s: EstadoMensaje): Promise<void> {
  try {
    await adminDb
      .collection('clinics').doc(clinicId)
      .collection('whatsapp_status').doc(s.wamid)
      .set({ ...s, updatedAt: new Date().toISOString() }, { merge: true })

    if (s.estado === 'failed' && esOptoutDeMeta(s.errorCode) && s.telefono) {
      await registrarBaja(clinicId, s.telefono, 'meta_optout')
    }
  } catch (e) {
    console.warn('[whatsapp/status] no se pudo registrar estado (ignorado):', String(e))
  }
}
