/**
 * Rate limiting propio, respaldado en Firestore (funciona en serverless/Vercel,
 * donde la memoria del proceso no se comparte entre lambdas).
 *
 * Ventana fija por clave. Pensado para endpoints que CUESTAN dinero por llamada
 * (IA, transcripción, bot) o que se pueden spamear (soporte). Protege contra
 * cost-bombing y abuso, ADEMÁS del sistema de créditos.
 *
 * Diseño defensivo:
 *  - fail-open: si Firestore falla, NO bloquea al usuario (no romper la app por
 *    el limitador). El límite es una malla de seguridad, no el gate principal.
 *  - una transacción por request: correcto bajo concurrencia.
 *  - doc con `exp` para poder purgar con TTL de Firestore si algún día se activa.
 */
import { adminDb } from '@/lib/firebase-admin'
import { NextResponse } from 'next/server'

export interface LimiteResultado {
  ok: boolean
  restante: number
  resetEnSeg: number
}

/**
 * Cuenta una petición contra el cupo `max` en una ventana de `ventanaSeg`.
 * `clave` debe identificar al sujeto + la acción, ej. `bot:${uid}`.
 */
export async function limitar(clave: string, max: number, ventanaSeg: number): Promise<LimiteResultado> {
  const ventanaMs = ventanaSeg * 1000
  const id = clave.replace(/[/#?]/g, '_').slice(0, 400)
  const ref = adminDb.collection('rate_limits').doc(id)
  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const now = Date.now()
      const d = snap.exists ? snap.data() : undefined
      let inicio = typeof d?.inicio === 'number' ? d.inicio : now
      let conteo = typeof d?.conteo === 'number' ? d.conteo : 0
      if (now - inicio >= ventanaMs) { inicio = now; conteo = 0 }  // ventana expiró → reset
      conteo += 1
      tx.set(ref, { inicio, conteo, exp: new Date(inicio + ventanaMs) })
      const resetEnSeg = Math.max(1, Math.ceil((inicio + ventanaMs - now) / 1000))
      return { ok: conteo <= max, restante: Math.max(0, max - conteo), resetEnSeg }
    })
  } catch {
    return { ok: true, restante: max, resetEnSeg: ventanaSeg }  // fail-open
  }
}

/** Respuesta 429 estándar con Retry-After. */
export function respuesta429(resetEnSeg: number, mensaje = 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.') {
  return NextResponse.json(
    { ok: false, error: mensaje },
    { status: 429, headers: { 'Retry-After': String(resetEnSeg) } },
  )
}

/**
 * Atajo: verifica el límite y, si se excede, devuelve la respuesta 429 lista.
 * Devuelve `null` si hay cupo (sigue el flujo normal).
 */
export async function limitarOResponder(clave: string, max: number, ventanaSeg: number, mensaje?: string) {
  const r = await limitar(clave, max, ventanaSeg)
  return r.ok ? null : respuesta429(r.resetEnSeg, mensaje)
}
