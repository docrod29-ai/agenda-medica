/**
 * Outbox / dead-letter de mensajes proactivos — Iteración 10 · RELIABILITY.
 *
 * Guarda un aviso proactivo de un solo disparo (lista de espera) que falló, para
 * reintentarlo con backoff. Tras agotar los reintentos pasa a estado 'muerto'
 * (dead-letter) para inspección, sin perder el registro.
 *
 * El cron de recordatorios drena esta cola (no requiere un cron nuevo). La política
 * (backoff / agotado / vencido) es pura (reintentos.ts); aquí solo hay Firestore.
 */

import { adminDb } from '@/lib/firebase-admin'
import type { ClavePlantilla, DatosProactivos } from '@/lib/whatsapp/templates'
import { proximoIntentoISO, agotado } from '@/lib/whatsapp/reintentos'

export interface CargaProactiva {
  to: string
  clave: ClavePlantilla
  datos: DatosProactivos
  textoLibre: string
  /**
   * Contexto opcional para reconstruir efectos secundarios al REENVIAR desde la
   * cola. Para la oferta de lista de espera lleva los datos de la sesión
   * `esperando_lista` (que el handler inline crea, pero el drenado del cron no):
   * sin esto, una oferta reenviada por el outbox deja al paciente sin sesión y su
   * "SÍ" cae al menú por defecto → el hueco se pierde.
   */
  meta?: Record<string, unknown>
}

export interface EntradaOutbox extends CargaProactiva {
  id: string
  estado: 'pendiente' | 'muerto'
  intentos: number
  proximoIntentoAt: string
  ultimoError?: string
}

function outboxCol(clinicId: string) {
  return adminDb.collection('clinics').doc(clinicId).collection('whatsapp_outbox')
}

/** Encola tras el 1er fallo (intentos=1). A prueba de fallos. */
export async function encolarReintento(clinicId: string, carga: CargaProactiva, ahoraMs: number, error?: string): Promise<void> {
  try {
    await outboxCol(clinicId).add({
      ...carga,
      estado: 'pendiente',
      intentos: 1,
      proximoIntentoAt: proximoIntentoISO(1, ahoraMs),
      ultimoError: error?.slice(0, 300) ?? null,
      createdAt: new Date(ahoraMs).toISOString(),
    })
  } catch (e) {
    console.warn('[whatsapp/outbox] no se pudo encolar (ignorado):', String(e))
  }
}

/** Entradas pendientes cuyo próximo intento ya venció. */
export async function entradasVencidas(clinicId: string, ahoraMs: number, limite = 25): Promise<EntradaOutbox[]> {
  try {
    const snap = await outboxCol(clinicId)
      .where('estado', '==', 'pendiente')
      .where('proximoIntentoAt', '<=', new Date(ahoraMs).toISOString())
      .limit(limite)
      .get()
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<EntradaOutbox, 'id'>) }))
  } catch (e) {
    console.warn('[whatsapp/outbox] no se pudo leer la cola (vacío):', String(e))
    return []
  }
}

/** Éxito → quita la entrada de la cola. */
export async function resolverEntrada(clinicId: string, id: string): Promise<void> {
  try { await outboxCol(clinicId).doc(id).delete() }
  catch (e) { console.warn('[whatsapp/outbox] no se pudo resolver:', String(e)) }
}

/** Fallo → reprograma con backoff, o pasa a dead-letter si se agotó. */
export async function reprogramarEntrada(clinicId: string, entrada: EntradaOutbox, ahoraMs: number, error?: string): Promise<void> {
  const intentos = entrada.intentos + 1
  try {
    if (agotado(intentos)) {
      await outboxCol(clinicId).doc(entrada.id).set(
        { estado: 'muerto', intentos, ultimoError: error?.slice(0, 300) ?? entrada.ultimoError ?? null, muertoAt: new Date(ahoraMs).toISOString() },
        { merge: true },
      )
    } else {
      await outboxCol(clinicId).doc(entrada.id).set(
        { intentos, proximoIntentoAt: proximoIntentoISO(intentos, ahoraMs), ultimoError: error?.slice(0, 300) ?? null },
        { merge: true },
      )
    }
  } catch (e) {
    console.warn('[whatsapp/outbox] no se pudo reprogramar:', String(e))
  }
}
