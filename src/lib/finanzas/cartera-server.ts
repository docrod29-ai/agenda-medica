/**
 * CARTERA DE CRÉDITOS — la transacción.
 *
 * La decisión de gastar y el descuento ocurren en el MISMO paso, que es lo único
 * que impide que dos notas simultáneas del mismo consultorio pasen las dos con
 * el saldo de una. La aritmética y las reglas están en `cartera.ts`; aquí sólo
 * vive lo que toca Firestore.
 *
 * Los reservados se guardan en el mismo documento que el uso
 * (`clinics/{id}/secretos/ia`, campo `uso.{mes}.reservados`) para que la
 * transacción lea y escriba un solo documento: repartirlo en dos obligaría a una
 * transacción de dos documentos por cada llamada de IA.
 */

import admin from '@/lib/firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { cabe, ajusteAlConfirmar, aplicaCartera, type Saldo } from '@/lib/finanzas/cartera'
import { creditosExtraDelMes, entitlementsDe, nivelIADe } from '@/lib/ai-keys'

const mesActual = (): string => new Date().toISOString().slice(0, 7)
const docIA = (clinicId: string) => adminDb.doc(`clinics/${clinicId}/secretos/ia`)

export interface Reserva {
  ok: boolean
  /** Cuántos créditos quedaron apartados. 0 si no aplicaba o si falló abierto. */
  apartados: number
  clinicId: string
  mes: string
  /** Por qué no se pudo. Es el mensaje que ve el médico. */
  motivo?: string
  /**
   * `true` si la reserva no se pudo hacer por un problema de infraestructura y
   * se dejó pasar. El gasto ocurre igual: hay que poder distinguirlo de una
   * reserva legítima al cuadrar el mes.
   */
  falloAbierto?: boolean
}

/**
 * Aparta créditos antes de llamar al modelo.
 *
 * Falla ABIERTO: si la transacción revienta, `ok: true` con `falloAbierto`. Un
 * intensivista sin su nota por un mal minuto de Firestore es peor que unos
 * créditos regalados — y queda anotado para poder verlo después.
 */
export async function reservarCreditos(
  clinicId: string, costo: number, limite: number, extra: number,
): Promise<Reserva> {
  const mes = mesActual()
  if (!(costo > 0)) return { ok: true, apartados: 0, clinicId, mes }
  try {
    return await adminDb.runTransaction(async tx => {
      const snap = await tx.get(docIA(clinicId))
      const u = snap.data()?.uso?.[mes] ?? {}
      const saldo: Saldo = {
        limite, extra,
        usados: Number(u.creditos ?? 0),
        reservados: Number(u.reservados ?? 0),
      }
      const v = cabe(saldo, costo)
      if (!v.ok) return { ok: false, apartados: 0, clinicId, mes, motivo: v.motivo }
      tx.set(docIA(clinicId), {
        uso: { [mes]: { reservados: admin.firestore.FieldValue.increment(v.reservar) } },
      }, { merge: true })
      return { ok: true, apartados: v.reservar, clinicId, mes }
    })
  } catch (err) {
    safeLog.error('[cartera] no se pudo reservar; se deja pasar', err)
    return { ok: true, apartados: 0, clinicId, mes, falloAbierto: true }
  }
}

/**
 * La llamada terminó bien: lo apartado se convierte en gastado.
 *
 * Si costó MÁS de lo reservado se cobra el excedente igual y se anota: preferir
 * un cobro exacto a uno cómodo, pero dejando rastro de que la estimación se
 * quedó corta — es la señal de que hay que corregirla.
 */
export async function confirmarCreditos(r: Reserva, real: number): Promise<void> {
  if (!r.ok || r.apartados <= 0) {
    // Nada que liberar. Si hubo fallo abierto, el gasto se anota igual: la
    // llamada ocurrió y alguien la pagó.
    if (r.falloAbierto && real > 0) await sumarUsados(r, real)
    return
  }
  const { cobrar, excedente } = ajusteAlConfirmar(r.apartados, real)
  if (excedente > 0) {
    safeLog.error('[cartera] la operación costó más de lo reservado', { reservado: r.apartados, real })
  }
  try {
    await docIA(r.clinicId).set({
      uso: { [r.mes]: {
        reservados: admin.firestore.FieldValue.increment(-r.apartados),
        creditos: admin.firestore.FieldValue.increment(cobrar + excedente),
      } },
    }, { merge: true })
  } catch (err) {
    safeLog.error('[cartera] no se pudo confirmar', err)
  }
}

/**
 * La llamada falló: los créditos vuelven a la bolsa.
 *
 * Esto es lo que no se puede fallar en ninguna dirección. Un médico al que se le
 * cobra una nota que nunca salió pierde dos veces: el crédito y la confianza en
 * el contador.
 */
export async function devolverCreditos(r: Reserva): Promise<void> {
  if (!r.ok || r.apartados <= 0) return
  try {
    await docIA(r.clinicId).set({
      uso: { [r.mes]: { reservados: admin.firestore.FieldValue.increment(-r.apartados) } },
    }, { merge: true })
  } catch (err) {
    // Un reservado que no se devuelve deja saldo bloqueado hasta fin de mes.
    safeLog.error('[cartera] NO SE PUDO DEVOLVER: quedan créditos apartados', { clinicId: r.clinicId, apartados: r.apartados })
  }
}

async function sumarUsados(r: Reserva, n: number): Promise<void> {
  try {
    await docIA(r.clinicId).set({
      uso: { [r.mes]: { creditos: admin.firestore.FieldValue.increment(n) } },
    }, { merge: true })
  } catch { /* no bloquea */ }
}

/**
 * Reserva resolviendo el límite del consultorio por su cuenta.
 *
 * Es la puerta que usa el gateway: si el llamador tuviera que averiguar el
 * límite y pasarlo, volveríamos al problema que este módulo existe para evitar
 * —algo que hay que acordarse de hacer en cada ruta— y bastaría con que una lo
 * calculara distinto para que dos consultorios tuvieran dos topes.
 *
 * Devuelve una reserva vacía y correcta cuando no aplica (llave propia del
 * consultorio, o sin consultorio): el llamador no tiene que preguntar.
 */
export async function reservarParaClinica(
  clinicId: string | null, fuente: string, costo: number, esFundador?: boolean,
): Promise<Reserva> {
  const mes = mesActual()
  if (!aplicaCartera(fuente, clinicId, esFundador) || !clinicId) {
    return { ok: true, apartados: 0, clinicId: clinicId ?? '', mes }
  }
  try {
    const nivel = await nivelIADe(clinicId)
    const [ent, extra] = await Promise.all([
      entitlementsDe(clinicId, nivel),
      creditosExtraDelMes(clinicId),
    ])
    return await reservarCreditos(clinicId, costo, ent.limiteCreditos, extra)
  } catch (err) {
    // Falla abierto, igual que la transacción: no saber el límite no es razón
    // para dejar a nadie sin su nota.
    safeLog.error('[cartera] no se pudo resolver el límite; se deja pasar', err)
    return { ok: true, apartados: 0, clinicId, mes, falloAbierto: true }
  }
}
