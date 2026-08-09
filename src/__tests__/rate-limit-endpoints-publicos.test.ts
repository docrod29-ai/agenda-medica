import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * PATIENT-PORTAL-001 — `/api/portal`, `/api/public/resena` y
 * `/api/payment/create-checkout` no tenían NINGÚN `limitar*`, a diferencia de
 * `telesalud/sala` y `public/booking`. Cómo se descubrió: auditoría de
 * PATIENT-UX-TRUTH-001 (8-ago-2026), backlog `agent-state/BACKLOG.json`.
 *
 * Por qué importa: las tres rutas son alcanzables sin sesión de médico —sólo
 * con un token de paciente, y la comprobación del token ni siquiera corre
 * antes del límite— así que un token filtrado (teléfono perdido, mensaje
 * reenviado) o un simple script podían martillarlas sin freno: enumerar
 * tokens, crear sesiones de cobro de Stripe en masa, o spamear reseñas.
 *
 * La regla que lo hace seguro: el límite se aplica por IP, ANTES de leer o
 * validar el token, usando el mismo `limitar()` (Firestore, fail-open) que ya
 * protege `public/booking` y `telesalud/sala`.
 *
 * Qué NO cubre: no distingue un atacante de un NAT compartido (varios
 * pacientes detrás de la misma IP corporativa) — es el mismo trade-off que ya
 * acepta `public/booking`. Tampoco repara el fail-open de `portalTokenVersion`
 * (revocación), que es una decisión de política pendiente en
 * OWNER_DECISIONS_REQUIRED.md, ni el resto de PATIENT-PORTAL-001 (enlace de
 * telesalud sin token).
 */

const almacen = new Map<string, Record<string, unknown>>()
let transaccionFalla = false

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: (nombre: string) => {
      if (nombre === 'rate_limits') return { doc: (id: string) => ({ id }) }
      if (nombre === 'clinics') {
        return {
          doc: () => ({
            collection: (sub: string) => {
              if (sub === 'appointments') return { where: () => ({ get: async () => ({ docs: [] }) }), doc: () => ({ get: async () => ({ exists: false }) }) }
              if (sub === 'config') return { doc: () => ({ get: async () => ({ exists: false }) }) }
              if (sub === 'patients') return { doc: () => ({ collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }) }) }
              throw new Error(`subcolección inesperada en el test: ${sub}`)
            },
          }),
        }
      }
      if (nombre === 'clinic_review_requests') return { doc: () => ({}) }
      throw new Error(`colección inesperada en el test: ${nombre}`)
    },
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

import { POST as portalPOST } from '@/app/api/portal/route'
import { POST as resenaPOST } from '@/app/api/public/resena/route'
import { POST as checkoutPOST } from '@/app/api/payment/create-checkout/route'

function req(body: unknown, ip = '203.0.113.9') {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as Parameters<typeof portalPOST>[0]
}

beforeEach(() => {
  almacen.clear()
  transaccionFalla = false
})

describe('PATIENT-PORTAL-001 · /api/portal tiene límite de tasa por IP', () => {
  it('la petición 41 desde la misma IP recibe 429, ANTES de tocar el token', async () => {
    let ultima: Response | undefined
    for (let i = 0; i < 41; i++) {
      ultima = await portalPOST(req({ action: 'session', token: 'token-basura-no-verificado' }, '198.51.100.1'))
    }
    expect(ultima!.status).toBe(429)
    expect(ultima!.headers.get('Retry-After')).toBeTruthy()
  })

  it('AISLAMIENTO: otra IP conserva su propio cupo', async () => {
    for (let i = 0; i < 40; i++) {
      await portalPOST(req({ action: 'session', token: 'x' }, '198.51.100.2'))
    }
    // La IP .2 agotó su cupo; la .3 no debe verse afectada.
    const res = await portalPOST(req({ action: 'session', token: 'x' }, '198.51.100.3'))
    expect(res.status).not.toBe(429)
  })

  it('sin el límite (FALLO REPRODUCIDO): 41 peticiones pasarían todas — prueba al revés', async () => {
    // Si `portal:ip:*` no se registrara en absoluto, ninguna de las 41 daría
    // 429. Se reproduce llamando al limitador directamente con una clave que
    // el endpoint nunca usa: confirma que el mecanismo SÍ bloquea cuando se
    // agota, y que el aislamiento de claves (visto arriba) no es un artefacto
    // del mock.
    const { limitar } = await import('@/lib/rate-limit')
    for (let i = 0; i < 40; i++) expect((await limitar('otra-clave-no-relacionada', 40, 600)).ok).toBe(true)
    expect((await limitar('otra-clave-no-relacionada', 40, 600)).ok).toBe(false)
  })
})

describe('PATIENT-PORTAL-001 · /api/public/resena tiene límite de tasa por IP', () => {
  it('la petición 21 desde la misma IP recibe 429', async () => {
    let ultima: Response | undefined
    for (let i = 0; i < 21; i++) {
      ultima = await resenaPOST(req({ token: 't', rating: 5, texto: 'ok' }, '198.51.100.4'))
    }
    expect(ultima!.status).toBe(429)
  })
})

describe('PATIENT-PORTAL-001 · /api/payment/create-checkout tiene límite de tasa por IP', () => {
  it('la petición 21 desde la misma IP recibe 429, antes de tocar Stripe', async () => {
    let ultima: Response | undefined
    for (let i = 0; i < 21; i++) {
      ultima = await checkoutPOST(req({ token: 't', citaId: 'c1' }, '198.51.100.5'))
    }
    expect(ultima!.status).toBe(429)
  })
})
