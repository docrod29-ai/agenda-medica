/**
 * EL PORTAL TIENE FRENO, Y LA REVOCACIÓN FALLA CERRADA — REG-295.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/api/portal` era la única superficie del paciente sin `limitar*`: confirmar,
 * cancelar, reagendar, el formulario previo y las recetas iban sin freno,
 * mientras telesalud lleva 12/600 s y el booking público 8/h por IP. Tampoco
 * tenían freno `api/public/resena` (una transacción de Firestore por intento de
 * adivinar el ID) ni `api/payment/create-checkout` (una sesión de Stripe por
 * llamada).
 *
 * Y la comprobación de revocación del enlace fallaba ABIERTA: si la lectura de
 * `portalTokenVersion` lanzaba, se dejaba pasar. Un enlace revocado —teléfono
 * perdido, número reciclado, mensaje reenviado— volvía a valer exactamente
 * durante una incidencia de Firestore, que es cuando menos vigilancia hay.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditoría del producto real V9 (PATIENT-UX-TRUTH-001, 8-ago-2026), ítem
 * PATIENT-PORTAL-001 del backlog. Y al cablear el arreglo apareció la segunda
 * mitad: los dobles de `portal-alcance.test.ts` no tenían `get` en el documento
 * del paciente, así que la comprobación de revocación llevaba desde su
 * nacimiento tirando `TypeError` en los tests — y el fail-open se lo tragaba.
 * **Los tests pasaban porque el defecto los dejaba pasar.**
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El fail-open se justificó con «dejar al paciente fuera de su propia agenda
 * por un mal minuto de Firestore es peor que el riesgo que esto acota». El
 * argumento ignoraba que la agenda TAMBIÉN vive en Firestore: en el minuto en
 * que esa lectura falla, la acción siguiente iba a fallar igual. El fail-open
 * no le daba servicio a nadie legítimo; sólo revalidaba el enlace revocado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La misma ruta ya sentaba el precedente: «SIN CONFIGURACIÓN NO SE REAGENDA»
 * convierte un fallo de lectura en 503, no en «cualquier hora vale». Una
 * comprobación de seguridad que no se puede hacer se declara (503), no se
 * salta. Y el freno va ANTES del token a propósito: el costo que acota incluye
 * a quien ni siquiera trae un token válido.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No prueba la aritmética de ventanas de `limitar` (tiene su propia lógica en
 * `lib/rate-limit.ts` y es fail-open por diseño declarado). No prueba los
 * frenos de resena/checkout en ejecución —esas rutas cargan Stripe y más
 * dependencias—: para ellas se comprueba el cableado en el fuente, igual que
 * la familia «está CONECTADO». Tampoco fija los NÚMEROS de los cupos: son
 * calibración operativa, no contrato.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Dobles ────────────────────────────────────────────────────────────────
// `vi.hoisted` porque las fábricas de `vi.mock` se izan por encima de los
// `const` del módulo: sin esto, «Cannot access before initialization».
const { limitarOResponder, getPaciente, getCitas, getConfig } = vi.hoisted(() => ({
  limitarOResponder: vi.fn(),
  getPaciente: vi.fn(),
  getCitas: vi.fn(),
  getConfig: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  limitarOResponder,
  ipDe: () => 'ip-de-prueba',
}))

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: (sub: string) => {
          if (sub === 'appointments') return { where: () => ({ get: getCitas }) }
          if (sub === 'config') return { doc: () => ({ get: getConfig }) }
          if (sub === 'patients') return { doc: () => ({ get: getPaciente }) }
          throw new Error(`subcolección inesperada: ${sub}`)
        },
      }),
    }),
  },
}))

import { NextResponse } from 'next/server'
import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'

const CLINICA = 'clinica-ficticia'
const PACIENTE = 'pac-ficticio-001'

const req = (body: unknown) =>
  ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0]

const snap = (docs: Record<string, unknown>[]) =>
  ({ docs: docs.map((d, i) => ({ id: `doc${i}`, data: () => d })) })

beforeEach(() => {
  limitarOResponder.mockReset()
  getPaciente.mockReset()
  getCitas.mockReset()
  getConfig.mockReset()
  limitarOResponder.mockResolvedValue(null) // con cupo, salvo que el caso diga otra cosa
  getPaciente.mockResolvedValue({ exists: true, data: () => ({}) })
  getCitas.mockResolvedValue(snap([]))
  getConfig.mockResolvedValue({ exists: false })
})

describe('REG-295 · el freno corre ANTES que el token', () => {
  it('sin cupo responde 429 aunque el token sea basura', async () => {
    /**
     * Es la propiedad que hace útil el freno: el guion que prueba tokens no
     * trae ninguno válido, y aun así consume Firestore. Si el freno corriera
     * después del HMAC, aquí saldría 401 — probada al revés contra el código
     * anterior, que no tenía freno y devolvía 401.
     */
    limitarOResponder.mockResolvedValue(
      NextResponse.json({ ok: false, error: 'Demasiadas solicitudes' }, { status: 429 }),
    )
    const res = await POST(req({ action: 'session', token: 'basura' }))
    expect(res.status).toBe(429)
    expect(getPaciente).not.toHaveBeenCalled()
    expect(getCitas).not.toHaveBeenCalled()
  })

  it('con cupo, el flujo normal sigue entero: la sesión del paciente responde', async () => {
    // El freno no puede costarle nada al paciente real: es malla, no puerta.
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda')
    const res = await POST(req({ action: 'session', token }))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveProperty('citas')
  })

  it('hay DOS frenos: por IP (antes del token) y por paciente (después)', async () => {
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda')
    await POST(req({ action: 'session', token }))
    const claves = limitarOResponder.mock.calls.map(c => c[0])
    expect(claves.some((k: string) => k.startsWith('portal:ip:'))).toBe(true)
    expect(claves).toContain(`portal:${CLINICA}:${PACIENTE}`)
  })
})

describe('REG-295 · la revocación falla CERRADA', () => {
  it('un enlace de versión vieja recibe 401 — la revocación de verdad revoca', async () => {
    /**
     * Este caso llevaba sin poder ejecutarse desde que existe la revocación:
     * el doble sin `get` lanzaba, el fail-open tragaba, y ningún test del
     * repositorio había visto nunca el 401 de un enlace revocado.
     */
    getPaciente.mockResolvedValue({ exists: true, data: () => ({ portalTokenVersion: 3 }) })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda', 2)
    const res = await POST(req({ action: 'session', token }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toMatch(/ya no es válido/i)
  })

  it('si la lectura de la versión FALLA, responde 503 — no deja pasar', async () => {
    /**
     * Probada al revés: con el código anterior (catch vacío) este caso daba
     * 200 con las citas del paciente — un enlace revocado funcionando durante
     * una incidencia.
     */
    getPaciente.mockRejectedValue(new Error('Firestore no contesta'))
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda', 0)
    const res = await POST(req({ action: 'session', token }))
    expect(res.status).toBe(503)
    expect(getCitas).not.toHaveBeenCalled() // no se llegó a leer NADA del paciente
  })

  it('un enlace emitido con versión MÁS ALTA que la guardada sigue valiendo', async () => {
    // La regla `>=` de tokenVigente, ahora ejercitada de verdad por la ruta:
    // cortar los viejos, no castigar un error de escritura nuestro.
    getPaciente.mockResolvedValue({ exists: true, data: () => ({ portalTokenVersion: 1 }) })
    const token = crearTokenPaciente(CLINICA, PACIENTE, 1, 'agenda', 2)
    const res = await POST(req({ action: 'session', token }))
    expect(res.status).toBe(200)
  })
})

describe('REG-295 · las otras dos rutas sin freno quedaron cableadas', () => {
  const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

  it('api/public/resena frena por IP, con el cupo del booking', () => {
    const s = leer('src', 'app', 'api', 'public', 'resena', 'route.ts')
    expect(s).toContain("limitarOResponder(`resena:ip:${ipDe(req)}`")
    // Y el freno corre antes de tocar el body: quien no cabe, ni se parsea.
    expect(s.indexOf('limitarOResponder')).toBeLessThan(s.indexOf('await req.json()'))
  })

  it('api/payment/create-checkout frena por IP antes de hablar con Stripe', () => {
    const s = leer('src', 'app', 'api', 'payment', 'create-checkout', 'route.ts')
    expect(s).toContain("limitarOResponder(`checkout:ip:${ipDe(req)}`")
    expect(s.indexOf('limitarOResponder')).toBeLessThan(s.indexOf('stripe.checkout.sessions.create'))
  })

  it('ipDe vive UNA vez, en lib/rate-limit, y api/errores la importa de ahí', () => {
    // Dos copias de «cómo se lee la IP» es la familia `depende_de_recordar`.
    expect(leer('src', 'lib', 'rate-limit.ts')).toContain('export function ipDe')
    const errores = leer('src', 'app', 'api', 'errores', 'route.ts')
    expect(errores).not.toContain('function ipDe')
    expect(errores).toMatch(/import \{ limitarOResponder, ipDe \} from '@\/lib\/rate-limit'/)
  })
})
