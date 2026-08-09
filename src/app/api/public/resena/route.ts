/**
 * POST /api/public/resena   (PÚBLICO — el paciente no tiene cuenta)
 *
 * Crea la reseña y marca la solicitud como usada de forma ATÓMICA (Admin SDK).
 * Resuelve dos bugs del flujo cliente:
 *  - El addDoc a `reviews` fallaba: la regla exige isAuth() y el paciente es anónimo.
 *  - Se marcaba used=true ANTES de crear la reseña → si fallaba, el enlace quedaba
 *    quemado sin reseña. Aquí todo va en una transacción: o ambas o ninguna.
 *
 * Body: { token, rating, texto }
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { limitarOResponder, ipDe } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  /**
   * FRENO POR IP (REG-295). El token aquí es el ID del documento: sin freno,
   * un guion podía adivinar IDs a costa de una transacción de Firestore por
   * intento. Una persona real envía UNA reseña; 8/h por IP —el mismo cupo que
   * el booking público— le sobra incluso al que se equivoca y reintenta.
   */
  const lim = await limitarOResponder(`resena:ip:${ipDe(req)}`, 8, 3600)
  if (lim) return lim

  let body: { token?: string; rating?: number; texto?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, motivo: 'Datos inválidos' }, { status: 400 }) }
  const { token } = body
  const rating = Number(body.rating)
  const texto = String(body.texto ?? '').trim().slice(0, 1000)
  if (!token) return NextResponse.json({ ok: false, motivo: 'Enlace inválido' }, { status: 400 })
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ ok: false, motivo: 'Calificación inválida' }, { status: 400 })

  const reqRef = adminDb.collection('clinic_review_requests').doc(token)

  try {
    const resultado = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(reqRef)
      if (!snap.exists) return { ok: false, motivo: 'Enlace inválido' }
      const r = snap.data() as Record<string, unknown>
      if (r.used === true) return { ok: false, motivo: 'Esta reseña ya fue enviada' }
      if (r.expiresAt && new Date() > new Date(String(r.expiresAt))) return { ok: false, motivo: 'Enlace expirado' }

      const reviewRef = adminDb.collection('clinics').doc(String(r.clinicId)).collection('reviews').doc()
      tx.set(reviewRef, {
        citaId: r.citaId ?? '',
        pacienteNombre: r.pacienteNombre ?? '',
        rating, texto, estado: 'pendiente',
        createdAt: new Date().toISOString(),
      })
      tx.update(reqRef, { used: true, usedAt: new Date().toISOString() })
      return { ok: true }
    })
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 })
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
