/**
 * Contactos de WhatsApp — rastreo del último mensaje ENTRANTE (Iter. WA-1).
 *
 * Necesario para evaluar la ventana de servicio de 24 h: sin saber cuándo escribió
 * el paciente por última vez, no se puede decidir texto libre vs. plantilla.
 *
 * Doc por contacto: clinics/{id}/whatsapp_contacts/{telefono}. Capa delgada y a
 * prueba de fallos (un error nunca rompe el bot ni el cron).
 */

import { adminDb } from '@/lib/firebase-admin'
import { normalizarTelefonoWa } from '@/lib/whatsapp/consent'
import { conteoDeHoy, siguienteConteo } from '@/lib/whatsapp/frecuencia'

function contactRef(clinicId: string, telefono: string) {
  return adminDb
    .collection('clinics').doc(clinicId)
    .collection('whatsapp_contacts').doc(normalizarTelefonoWa(telefono))
}

/** Registra que el contacto acaba de escribir (abre/renueva la ventana de 24 h). */
export async function registrarEntrante(clinicId: string, telefono: string): Promise<void> {
  try {
    await contactRef(clinicId, telefono).set(
      { telefono: normalizarTelefonoWa(telefono), lastInboundAt: new Date().toISOString() },
      { merge: true },
    )
  } catch (e) {
    console.warn('[whatsapp/contacts] no se pudo registrar entrante (ignorado):', String(e))
  }
}

/** Último instante entrante (ISO) o null si nunca escribió / error de lectura. */
export async function ultimoEntranteAt(clinicId: string, telefono: string): Promise<string | null> {
  try {
    const snap = await contactRef(clinicId, telefono).get()
    return snap.exists ? ((snap.data()?.lastInboundAt as string) ?? null) : null
  } catch (e) {
    console.warn('[whatsapp/contacts] no se pudo leer último entrante (null):', String(e))
    return null
  }
}

/** Nº de mensajes proactivos ya enviados hoy a este contacto. Ante error → 0 (fail-open). */
export async function enviosProactivosHoy(clinicId: string, telefono: string, fechaHoy: string): Promise<number> {
  try {
    const snap = await contactRef(clinicId, telefono).get()
    return conteoDeHoy(snap.data()?.proactivo, fechaHoy)
  } catch (e) {
    console.warn('[whatsapp/contacts] no se pudo leer conteo proactivo (0):', String(e))
    return 0
  }
}

/** Suma 1 al conteo proactivo del día (reinicia en día nuevo). A prueba de fallos. */
export async function registrarEnvioProactivo(clinicId: string, telefono: string, fechaHoy: string): Promise<void> {
  try {
    const ref = contactRef(clinicId, telefono)
    await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref)
      const proactivo = siguienteConteo(snap.data()?.proactivo, fechaHoy)
      tx.set(ref, { telefono: normalizarTelefonoWa(telefono), proactivo }, { merge: true })
    })
  } catch (e) {
    console.warn('[whatsapp/contacts] no se pudo registrar envío proactivo (ignorado):', String(e))
  }
}
