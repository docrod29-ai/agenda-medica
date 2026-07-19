import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cobertura del limitador (estaba al 0%). Protege los endpoints que CUESTAN
 * dinero por llamada — IA, transcripción, bot — contra cost-bombing.
 *
 * Se simula Firestore con un almacén en memoria, ejecutando el callback de la
 * transacción tal cual, para poder avanzar el reloj y ver el comportamiento de
 * la ventana sin depender de la red.
 */

const almacen = new Map<string, Record<string, unknown>>()
let transaccionFalla = false

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: async (fn: (tx: unknown) => unknown) => {
      if (transaccionFalla) throw new Error('firestore caído')
      return fn({
        get: async (ref: { id: string }) => ({
          exists: almacen.has(ref.id),
          data: () => almacen.get(ref.id),
        }),
        set: (ref: { id: string }, data: Record<string, unknown>) => { almacen.set(ref.id, data) },
      })
    },
  },
}))

import { limitar, limitarOResponder, respuesta429 } from '@/lib/rate-limit'

beforeEach(() => {
  almacen.clear()
  transaccionFalla = false
  vi.useRealTimers()
})

describe('limitar — ventana fija', () => {
  it('deja pasar hasta el cupo y bloquea la siguiente', async () => {
    for (let i = 0; i < 3; i++) expect((await limitar('ia:u1', 3, 60)).ok).toBe(true)
    expect((await limitar('ia:u1', 3, 60)).ok).toBe(false)
  })

  it('el restante baja y nunca es negativo', async () => {
    expect((await limitar('ia:u2', 2, 60)).restante).toBe(1)
    expect((await limitar('ia:u2', 2, 60)).restante).toBe(0)
    expect((await limitar('ia:u2', 2, 60)).restante).toBe(0)
  })

  it('AISLAMIENTO: el cupo es por clave — un usuario no consume el del otro', async () => {
    await limitar('ia:u1', 1, 60)
    expect((await limitar('ia:u1', 1, 60)).ok).toBe(false)
    expect((await limitar('ia:u2', 1, 60)).ok).toBe(true)   // otro usuario, cupo intacto
  })

  it('la misma acción de un usuario no consume el cupo de otra acción', async () => {
    await limitar('ia:u1', 1, 60)
    expect((await limitar('soporte:u1', 1, 60)).ok).toBe(true)
  })

  it('al expirar la ventana se reinicia el cupo', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await limitar('ia:u3', 1, 60)
    expect((await limitar('ia:u3', 1, 60)).ok).toBe(false)
    vi.advanceTimersByTime(61_000)                      // pasó la ventana
    expect((await limitar('ia:u3', 1, 60)).ok).toBe(true)
    vi.useRealTimers()
  })

  it('resetEnSeg siempre es al menos 1 (nunca un Retry-After de 0)', async () => {
    expect((await limitar('ia:u4', 1, 60)).resetEnSeg).toBeGreaterThanOrEqual(1)
  })

  it('sanea la clave: los caracteres que rompen un id de documento no se usan', async () => {
    // Sin sanear, una clave con '/' crearía una subcolección en vez de un doc.
    const r = await limitar('ia:/otro/#frag?q=1', 2, 60)
    expect(r.ok).toBe(true)
    expect([...almacen.keys()][0]).not.toMatch(/[/#?]/)
  })

  it('claves larguísimas se recortan y no revientan', async () => {
    const r = await limitar('ia:' + 'x'.repeat(5000), 1, 60)
    expect(r.ok).toBe(true)
    expect([...almacen.keys()][0].length).toBeLessThanOrEqual(400)
  })

  it('FAIL-OPEN documentado: si Firestore cae, NO bloquea al médico', async () => {
    // Decisión de diseño deliberada: el limitador es una malla secundaria; el
    // gate primario son verificarUsuario + los créditos. Se prueba para que un
    // cambio futuro a fail-closed sea una decisión consciente y no un accidente.
    transaccionFalla = true
    const r = await limitar('ia:u5', 1, 60)
    expect(r.ok).toBe(true)
    expect(r.restante).toBe(1)
  })
})

describe('respuesta429 y limitarOResponder', () => {
  it('el 429 lleva Retry-After', () => {
    const res = respuesta429(42)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
  })

  it('devuelve null mientras haya cupo, y la respuesta cuando se agota', async () => {
    expect(await limitarOResponder('bot:u9', 1, 60)).toBeNull()
    const res = await limitarOResponder('bot:u9', 1, 60)
    expect(res?.status).toBe(429)
  })
})
