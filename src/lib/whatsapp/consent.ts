/**
 * Consentimiento y baja (opt-out) de WhatsApp — Iteración 5 · CONSENT_AND_OPTOUT.
 *
 * Política:
 *  - Un mensaje PROACTIVO (recordatorio, aviso de lista de espera) solo se envía
 *    si el contacto NO se ha dado de baja. La respuesta REACTIVA a un mensaje que
 *    el propio paciente inició no se bloquea (conversación que él abrió).
 *  - El paciente se da de baja con una palabra clave dedicada (BAJA / STOP). Se
 *    reactiva con ALTA. Ambos casos se confirman.
 *  - Registro por contacto en `clinics/{id}/whatsapp_optout/{telefono}`.
 *
 * Las detecciones de palabra clave y la normalización son PURAS (testeables). El
 * registro en Firestore es una capa delgada y a prueba de fallos.
 */

import { adminDb } from '@/lib/firebase-admin'

// ── Puro: normalización de teléfono (misma clave en registro y verificación) ──

/** Normaliza a solo dígitos con lada 52 (MX). Clave estable del registro. */
export function normalizarTelefonoWa(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  return d.startsWith('52') && d.length >= 12 ? d : `52${d}`
}

// ── Puro: detección de intención de baja / alta ──────────────────────────────

function norm(text: string): string {
  return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/**
 * ¿El mensaje pide dejar de recibir mensajes? Palabras DEDICADAS para no chocar
 * con el flujo del bot ("cancelar" = cancelar cita; "salir" = salir del menú).
 */
export function esPalabraBaja(text: string): boolean {
  const t = norm(text)
  if (!t) return false
  // Coincidencias exactas de una palabra
  if (/^(baja|stop|unsubscribe|cancelarsuscripcion)$/.test(t.replace(/\s+/g, ''))) return true
  // Frases dedicadas
  return (
    /\bdar(me)? de baja\b/.test(t) ||
    /\bcancelar (la )?suscripcion\b/.test(t) ||
    /\bno (quiero|deseo) (mas |recibir )?(mensajes|recordatorios)\b/.test(t) ||
    /\bno molestar\b/.test(t) ||
    /\bdej(a|en) de (enviar|mandar|escribir)(me)?\b/.test(t) ||
    /\bquit(a|ar|enme|ame) de la lista\b/.test(t) ||
    /\bya no (me )?(escriban|manden|envien)\b/.test(t)
  )
}

/** ¿El mensaje pide reactivar el envío de mensajes? */
export function esPalabraAlta(text: string): boolean {
  const t = norm(text).replace(/\s+/g, ' ')
  if (!t) return false
  if (/^(alta|reactivar|suscribir(me)?)$/.test(t.replace(/\s+/g, ''))) return true
  return (
    /\bdar(me)? de alta\b/.test(t) ||
    /\b(si )?(quiero|deseo) (volver a )?recibir (mensajes|recordatorios)\b/.test(t) ||
    /\breactiv(a|ar|enme|ame)\b/.test(t)
  )
}

// ── Mensajes de confirmación / pie de opt-out ────────────────────────────────

export const MENSAJE_BAJA_OK =
  '✅ Listo. No le enviaremos más recordatorios ni mensajes automáticos por este medio. ' +
  'Si desea volver a recibirlos, responda *ALTA* en cualquier momento.'

export const MENSAJE_ALTA_OK =
  '✅ Su suscripción a recordatorios por WhatsApp quedó reactivada. ' +
  'Puede darse de baja cuando guste respondiendo *BAJA*.'

/** Pie que TODO mensaje proactivo debe llevar (opt-out visible). */
export const PIE_OPTOUT = '\n\n_Responda BAJA para dejar de recibir estos mensajes._'

/** Agrega el pie de opt-out si no está ya presente. */
export function conPieOptout(mensaje: string): string {
  return mensaje.includes('BAJA para dejar de recibir') ? mensaje : mensaje + PIE_OPTOUT
}

// ── Capa Firestore (delgada, a prueba de fallos) ─────────────────────────────

function optoutRef(clinicId: string, telefono: string) {
  return adminDb
    .collection('clinics').doc(clinicId)
    .collection('whatsapp_optout').doc(normalizarTelefonoWa(telefono))
}

/**
 * ¿El contacto está dado de baja? Ante error de lectura → false (fail-open): un
 * fallo transitorio de Firestore no debe bloquear TODOS los recordatorios. El
 * registro es de un solo documento; los errores son raros. Se registra el fallo.
 */
export async function estaDadoDeBaja(clinicId: string, telefono: string): Promise<boolean> {
  try {
    const snap = await optoutRef(clinicId, telefono).get()
    return snap.exists && snap.data()?.baja === true
  } catch (e) {
    console.warn('[whatsapp/consent] no se pudo leer opt-out (fail-open):', String(e))
    return false
  }
}

/** Marca la baja del contacto. Idempotente. Devuelve true si PERSISTIÓ. */
export async function registrarBaja(clinicId: string, telefono: string, via = 'whatsapp_inbound'): Promise<boolean> {
  try {
    await optoutRef(clinicId, telefono).set(
      { baja: true, telefono: normalizarTelefonoWa(telefono), via, updatedAt: new Date().toISOString() },
      { merge: true },
    )
    return true
  } catch (e) {
    console.error('[whatsapp/consent] no se pudo registrar la baja:', String(e))
    return false
  }
}

/** Reactiva al contacto (baja=false). No borra el historial. Devuelve true si PERSISTIÓ. */
export async function registrarAlta(clinicId: string, telefono: string, via = 'whatsapp_inbound'): Promise<boolean> {
  try {
    await optoutRef(clinicId, telefono).set(
      { baja: false, telefono: normalizarTelefonoWa(telefono), via, updatedAt: new Date().toISOString() },
      { merge: true },
    )
    return true
  } catch (e) {
    console.error('[whatsapp/consent] no se pudo registrar el alta:', String(e))
    return false
  }
}
