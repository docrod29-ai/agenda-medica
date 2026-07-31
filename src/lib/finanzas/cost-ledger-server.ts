/**
 * Escritura del libro de costos. Sólo servidor (Admin SDK).
 *
 * Vive en `platform_cost_ledger`, a nivel plataforma y NO dentro del
 * consultorio: es contabilidad del dueño, no dato del cliente. Las reglas de
 * Firestore ya cierran `platform_*` al cliente (`allow read, write: if false`),
 * así que ningún navegador lo ve.
 *
 * NUNCA bloquea la operación clínica. Si el ledger falla, la nota se entrega
 * igual y el fallo se registra: perder un asiento contable es un problema de
 * mañana; no entregar la nota es un problema de ahora.
 */
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { asiento, type EntradaLedger, type EventoCosto } from '@/lib/finanzas/cost-ledger'

const COL = 'platform_cost_ledger'

/**
 * Registra el costo de una llamada de IA.
 *
 * @returns el asiento escrito, o `null` si no se pudo escribir.
 */
export async function registrarCosto(e: EntradaLedger): Promise<EventoCosto | null> {
  const ev = asiento(e)
  try {
    // El id es el requestId: si el runtime reintenta, no se cobra dos veces.
    // §AX exige idempotencia y aquí sale gratis.
    await adminDb.collection(COL).doc(ev.requestId).set(ev, { merge: true })
    return ev
  } catch (err) {
    safeLog.error('[cost-ledger] no se pudo registrar', err)
    return null
  }
}

/** Lee un rango para el tablero. `desde`/`hasta` en ISO. */
export async function leerCostos(desde: string, hasta: string, tope = 5000): Promise<EventoCosto[]> {
  try {
    const snap = await adminDb.collection(COL)
      .where('ts', '>=', desde).where('ts', '<=', hasta)
      .orderBy('ts', 'desc').limit(tope).get()
    return snap.docs.map(d => d.data() as EventoCosto)
  } catch (err) {
    safeLog.error('[cost-ledger] no se pudo leer', err)
    return []
  }
}
