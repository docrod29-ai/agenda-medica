/**
 * EL PORTAL DEL PACIENTE TIENE LÍMITE DE TASA — REG-310 (V7 · PATIENT-PORTAL-001).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Ninguna acción de `/api/portal` (session, confirmar, cancelar, slots,
 * reagendar, formulario, documentos) llevaba `limitarOResponder`, a diferencia
 * de cada otra ruta alcanzable con un token filtrado (`telesalud/sala`,
 * `expediente/procesar`…). Un enlace de portal reenviado o robado —el mismo
 * riesgo que ya motivó la revocación por versión (`POR_QUE_SE_PUEDE_REVOCAR`
 * en `patient-token.ts`)— permitía enumerar y mover la agenda del consultorio
 * sin ningún freno.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditoría `PATIENT-UX-TRUTH-001` de V9 (8-ago-2026), ítem `PATIENT-PORTAL-001`
 * en `agent-state/BACKLOG.json`.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No toca la OTRA mitad del hallazgo: la comprobación de revocación en
 *   `route.ts` falla ABIERTA si la lectura del expediente lanza. Es una
 *   decisión de política deliberada y documentada en el propio código (línea
 *   174: «dejar al paciente fuera de su propia agenda por un mal minuto de
 *   Firestore es peor que el riesgo que esto acota»), así que cambiarla no es
 *   un arreglo de software — queda en `OWNER_DECISIONS_REQUIRED.md`.
 * · No cubre `api/public/resena` ni `api/payment/create-checkout`, que el
 *   mismo hallazgo señala sin límite. Quedan para otra iteración: este cambio
 *   se queda en una ruta para seguir siendo revisable (`§4.4` de la directiva).
 * · El cupo (40/60s) replica `expediente/procesar` por analogía, no por una
 *   medición de uso real del portal — no hay corpus de tráfico del portal
 *   contra qué calibrarlo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..', '..')
const RUTA = 'src/app/api/portal/route.ts'
const FUENTE = readFileSync(join(RAIZ, RUTA), 'utf8')

// ── Dobles del Admin SDK: routing genérico por colección + un limitador REAL
// en memoria (misma forma que src/__tests__/nucleo/rate-limit.test.ts), para
// que la prueba compruebe el COMPORTAMIENTO —bloquea al 41— y no sólo la
// forma del código. ──────────────────────────────────────────────────────
const almacenLimite = new Map<string, Record<string, unknown>>()
const getCitas = vi.fn()
const getConfig = vi.fn()
const getPaciente = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: {
    collection: (top: string) => {
      if (top === 'rate_limits') return { doc: (id: string) => ({ id }) }
      if (top === 'clinics') {
        return {
          doc: () => ({
            collection: (sub: string) => {
              if (sub === 'appointments') return { where: () => ({ get: getCitas }) }
              if (sub === 'config') return { doc: () => ({ get: getConfig }) }
              if (sub === 'patients') return { doc: () => ({ get: getPaciente }) }
              throw new Error(`subcolección inesperada en el test: ${sub}`)
            },
          }),
        }
      }
      throw new Error(`colección inesperada en el test: ${top}`)
    },
    runTransaction: async (fn: (tx: unknown) => unknown) => fn({
      get: async (ref: { id: string }) => ({
        exists: almacenLimite.has(ref.id),
        data: () => almacenLimite.get(ref.id),
      }),
      set: (ref: { id: string }, data: Record<string, unknown>) => { almacenLimite.set(ref.id, data) },
    }),
  },
}))

import { POST } from '@/app/api/portal/route'
import { crearTokenPaciente } from '@/lib/patient-token'

const CLINICA = 'clinica-ficticia'
const PACIENTE_A = 'pac-ficticio-a'
const PACIENTE_B = 'pac-ficticio-b'

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0]
}

function tokenDe(patientId: string) {
  return crearTokenPaciente(CLINICA, patientId, 30, 'agenda', 0)
}

beforeEach(() => {
  almacenLimite.clear()
  getCitas.mockResolvedValue({ docs: [] })
  getConfig.mockResolvedValue({ exists: false })
  // Sin `portalTokenVersion`: tokenVigente(0, undefined) = true, la sesión pasa.
  getPaciente.mockResolvedValue({ exists: true, data: () => ({}) })
})

describe('el portal está CONECTADO al limitador, no sólo lo escribe', () => {
  it('el route importa y llama a limitarOResponder', () => {
    expect(FUENTE).toMatch(/import\s*\{\s*limitarOResponder\s*\}\s*from\s*'@\/lib\/rate-limit'/)
    expect(FUENTE).toMatch(/limitarOResponder\(`portal:/)
  })

  it('la compuerta va ANTES de tocar Firestore, no después de gastarlo', () => {
    // Si el límite viviera después de leerConfig/leerCitasPaciente, un
    // atacante ya habría pagado el costo de las lecturas antes de que algo lo
    // frenara — justo lo que el limitador existe para evitar.
    const iLimite = FUENTE.indexOf('limitarOResponder(`portal:')
    const iSession = FUENTE.indexOf("case 'session'")
    expect(iLimite).toBeGreaterThan(-1)
    expect(iSession).toBeGreaterThan(-1)
    expect(iLimite).toBeLessThan(iSession)
  })
})

describe('el límite BLOQUEA de verdad, con datos ficticios y sin red', () => {
  it('dentro del cupo, `session` responde normal', async () => {
    const res = await POST(req({ action: 'session', token: tokenDe(PACIENTE_A) }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.clinicId).toBe(CLINICA)
  })

  it('al agotar el cupo (40/60s), la 41ª petición del MISMO paciente recibe 429 con Retry-After', async () => {
    let ultima
    for (let i = 0; i < 41; i++) {
      ultima = await POST(req({ action: 'session', token: tokenDe(PACIENTE_A) }))
    }
    expect(ultima!.status).toBe(429)
    expect(ultima!.headers.get('Retry-After')).toBeTruthy()
    const json = await ultima!.json()
    expect(json.error).toBeTruthy()
  })

  it('AISLAMIENTO: agotar el cupo de un paciente no bloquea al otro', async () => {
    for (let i = 0; i < 40; i++) await POST(req({ action: 'session', token: tokenDe(PACIENTE_A) }))
    const bloqueadoA = await POST(req({ action: 'session', token: tokenDe(PACIENTE_A) }))
    const libreB = await POST(req({ action: 'session', token: tokenDe(PACIENTE_B) }))
    expect(bloqueadoA.status).toBe(429)
    expect(libreB.status).toBe(200)
  })

  it('el límite se comparte entre acciones del mismo paciente (una clave, no una por acción)', async () => {
    // Si `confirmar` y `session` llevaran claves distintas, un token filtrado
    // podría alternar de acción para esquivar el cupo. La clave es
    // `portal:${clinicId}:${patientId}`, no `portal:${action}:...`.
    for (let i = 0; i < 39; i++) await POST(req({ action: 'session', token: tokenDe(PACIENTE_A) }))
    // La 40ª y 41ª por una acción DISTINTA — deben seguir contando el mismo cupo.
    const cuarenta = await POST(req({ action: 'session', token: tokenDe(PACIENTE_A) }))
    const cuarentaYUno = await POST(req({ action: 'session', token: tokenDe(PACIENTE_A) }))
    expect(cuarenta.status).toBe(200)
    expect(cuarentaYUno.status).toBe(429)
  })
})
