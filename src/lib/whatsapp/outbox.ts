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
import { proximoIntentoISO, decidirReprogramacion } from '@/lib/whatsapp/reintentos'

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
  /**
   * Veces que se dejó de intentar porque el PROVEEDOR no estaba (REG-391).
   *
   * Va aparte de `intentos` a propósito: son dos cuentas distintas y mezclarlas
   * era el defecto. Los intentos son del mensaje; las pausas, del proveedor.
   */
  pausas?: number
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
      pausas: 0,
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

/**
 * CUÁNTAS SE RINDIERON — el cajón que nadie abría (REG-397).
 *
 * El dead-letter existe desde hace mucho y **ninguna pantalla lo enseña**: una
 * entrada muerta queda en Firestore con su motivo y ahí se acaba la historia.
 * Un aviso de lista de espera que nadie mandó es un hueco de agenda que nadie
 * ocupó, y nadie se entera.
 *
 * Esto no es la pantalla que falta: es lo mínimo para que el vigilante pueda
 * decir «hay N mensajes rendidos en este consultorio». Se cuenta con tope y se
 * declara: por encima del tope se dice «al menos N», no un número inventado.
 */
export const TOPE_CUENTA_MUERTAS = 50

export async function contarMuertas(clinicId: string): Promise<{ cuantas: number; alMenos: boolean }> {
  try {
    const snap = await outboxCol(clinicId)
      .where('estado', '==', 'muerto')
      .limit(TOPE_CUENTA_MUERTAS + 1)
      .get()
    const alMenos = snap.size > TOPE_CUENTA_MUERTAS
    return { cuantas: alMenos ? TOPE_CUENTA_MUERTAS : snap.size, alMenos }
  } catch (e) {
    /* No poder contar NO es «no hay»: se devuelve 0 porque no hay más que
       hacer, y el latido del cron ya dice si él mismo falló. */
    console.warn('[whatsapp/outbox] no se pudo contar las muertas:', String(e))
    return { cuantas: 0, alMenos: false }
  }
}

/** Éxito → quita la entrada de la cola. */
export async function resolverEntrada(clinicId: string, id: string): Promise<void> {
  try { await outboxCol(clinicId).doc(id).delete() }
  catch (e) { console.warn('[whatsapp/outbox] no se pudo resolver:', String(e)) }
}

/**
 * Fallo → reprograma con backoff, o pasa a dead-letter si se agotó.
 *
 * `esDelProveedor` (REG-391) cambia la cuenta: un fallo del proveedor NO gasta
 * un reintento del mensaje, porque el mensaje no tiene nada malo. Ver
 * `whatsapp/fallo-del-proveedor.ts` para lo que costaba no distinguirlo.
 */
export async function reprogramarEntrada(
  clinicId: string, entrada: EntradaOutbox, ahoraMs: number,
  error?: string, esDelProveedor = false,
): Promise<void> {
  const d = decidirReprogramacion(
    { intentos: entrada.intentos, pausas: entrada.pausas ?? 0 },
    esDelProveedor, ahoraMs,
  )
  const ultimoError = error?.slice(0, 300) ?? null
  try {
    if (d.accion === 'dead-letter') {
      await outboxCol(clinicId).doc(entrada.id).set(
        {
          estado: 'muerto', intentos: d.intentos, pausas: d.pausas,
          /* De qué murió. «Agotó reintentos» y «el proveedor estuvo caído tres
             días» mandan a mirar a sitios distintos. */
          porQueMurio: d.porQue,
          ultimoError: ultimoError ?? entrada.ultimoError ?? null,
          muertoAt: new Date(ahoraMs).toISOString(),
        },
        { merge: true },
      )
    } else if (d.accion === 'pausar') {
      await outboxCol(clinicId).doc(entrada.id).set(
        { pausas: d.pausas, proximoIntentoAt: d.proximoIntentoAt, ultimoError },
        { merge: true },
      )
    } else {
      await outboxCol(clinicId).doc(entrada.id).set(
        { intentos: d.intentos, proximoIntentoAt: d.proximoIntentoAt, ultimoError },
        { merge: true },
      )
    }
  } catch (e) {
    console.warn('[whatsapp/outbox] no se pudo reprogramar:', String(e))
  }
}
