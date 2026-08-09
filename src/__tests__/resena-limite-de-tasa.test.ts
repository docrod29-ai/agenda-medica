import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * REG-291 — PATIENT-PORTAL-001: `/api/public/resena` es pública (el paciente
 * no tiene cuenta) y no tenía ningún freno de tasa, a diferencia de
 * `public/booking`, que sí limita por IP.
 *
 * CÓMO SE DESCUBRIÓ: auditoría PATIENT-UX-TRUTH-001 (V9), 8-ago-2026 —
 * `agent-state/BACKLOG.json`, ítem `PATIENT-PORTAL-001`.
 *
 * LA REGLA QUE LO HACE SEGURO: `limitarOResponder` por IP, mismo patrón que
 * `public/booking` (`booking:ip:${ip}`).
 *
 * QUÉ NO CUBRE: no mide el umbral exacto (10 por hora); sólo que el
 * guardián EXISTE y corta antes de abrir la transacción de Firestore.
 * Probado al revés: sin la llamada a `limitarOResponder`, el segundo caso
 * dejaría de devolver 429 y la transacción se ejecutaría igual.
 */

const limitarOResponder = vi.fn()
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: (...a: unknown[]) => limitarOResponder(...a) }))

const runTransaction = vi.fn()
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({}) }),
    runTransaction: (...a: unknown[]) => runTransaction(...a),
  },
}))

import { POST } from '@/app/api/public/resena/route'

function req(body: unknown, ip = '203.0.113.9') {
  return new NextRequest('https://ejemplo.test/api/public/resena', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  limitarOResponder.mockReset()
  runTransaction.mockReset()
  limitarOResponder.mockResolvedValue(null)
  runTransaction.mockResolvedValue({ ok: true })
})

describe('PATIENT-PORTAL-001 · /api/public/resena frena por IP antes de abrir la transacción', () => {
  it('con cupo, la reseña sigue su curso — la clave usa la IP del cliente', async () => {
    const res = await POST(req({ token: 'tok-1', rating: 5, texto: 'bien' }, '203.0.113.9'))
    expect(res.status).toBe(200)
    expect(limitarOResponder).toHaveBeenCalledWith('resena:ip:203.0.113.9', 10, 3600, expect.any(String))
    expect(runTransaction).toHaveBeenCalled()
  })

  it('sin cupo, devuelve 429 y NO abre la transacción de Firestore', async () => {
    limitarOResponder.mockResolvedValue(new Response(null, { status: 429 }))
    const res = await POST(req({ token: 'tok-1', rating: 5, texto: 'bien' }))
    expect(res.status).toBe(429)
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it('sin IP en la cabecera, usa una clave de reserva y no revienta', async () => {
    const res = await POST(req({ token: 'tok-1', rating: 4, texto: '' }, ''))
    expect(limitarOResponder).toHaveBeenCalledWith('resena:ip:sin-ip', 10, 3600, expect.any(String))
    expect(res.status).toBe(200)
  })
})
