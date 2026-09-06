/**
 * S-004 · Panel de Lujo (S-ciberseguridad) — la llave viva de WhatsApp del
 * consultorio se usaba como NOMBRE de un documento de plataforma, justo lo que
 * el gestor de secretos existe para evitar.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `whatsapp-send.ts`: `adminDb.collection('whatsapp_channels').doc(apiKey)`.
 * El callback de 360dialog y `reclamarCanal` escribían ese documento con la
 * api_key como id, y `whatsapp-disconnect` lo borraba por el mismo id. La llave
 * viajaba en la RUTA del recurso: registros de acceso, exportaciones, consola.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor S-ciberseguridad, S-004 (P2); el equipo rojo confirmó las tres citas
 * y la contradicción literal con `secreto-canal.ts` («nunca debe viajar en
 * claro fuera del gestor de secretos»). Decisión PL-S2: el cambio de nombre
 * del documento se prepara sin rotar la llave (rotar es del dueño).
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * El índice se consulta por HUELLA (`idDeIndiceDeCanal` = `k_` + SHA-256),
 * el documento guarda sólo el clinicId y una pista de cuatro caracteres, y la
 * migración es perezosa: si sólo existe el documento heredado (nombrado con la
 * llave), se copia a la huella y se borra.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Que el callback y `reclamarCanal` (AGENDA-MENSAJERIA, handoff) escriban ya
 * por huella: mientras no lo hagan, la primera búsqueda migra. No rota la
 * llave (PL-S2). No toca los documentos de Meta, cuyo id es el phoneNumberId
 * (no es secreto).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { idDeIndiceDeCanal, pistaDeLlave, esIdDeHuella, elIdContieneLaLlave, PREFIJO_HUELLA } from '@/lib/security/indice-canal-whatsapp'

/** Firestore de mentira: un mapa de ruta → datos, con la API mínima que usa el buscador. */
const { docs } = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>() }))
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (col: string) => ({
      doc: (id: string) => {
        const ruta = `${col}/${id}`
        return {
          get: async () => ({ exists: docs.has(ruta), data: () => docs.get(ruta) }),
          set: async (d: Record<string, unknown>) => { docs.set(ruta, { ...(docs.get(ruta) ?? {}), ...d }) },
          delete: async () => { docs.delete(ruta) },
        }
      },
    }),
  },
}))
vi.mock('@/lib/whatsapp/consent', () => ({ estaDadoDeBaja: async () => false, conPieOptout: (s: string) => s, normalizarTelefonoWa: (s: string) => s }))
vi.mock('@/lib/whatsapp/secreto-canal', () => ({ conSecretoCanal: async () => undefined }))

import { findClinicByDialog360ApiKey } from '@/lib/whatsapp-send'

const LLAVE = 'llave-sintetica-de-360dialog-ABC123'

describe('S-004 · el id del índice es una huella, nunca la llave', () => {
  it('la huella es determinista, no contiene la llave y se reconoce', () => {
    const id = idDeIndiceDeCanal(LLAVE)
    expect(id).toBe(idDeIndiceDeCanal(` ${LLAVE} `))
    expect(id.startsWith(PREFIJO_HUELLA)).toBe(true)
    expect(esIdDeHuella(id)).toBe(true)
    expect(elIdContieneLaLlave(id, LLAVE)).toBe(false)
    expect(elIdContieneLaLlave(LLAVE, LLAVE)).toBe(true)
    expect(esIdDeHuella(LLAVE)).toBe(false)
    expect(() => idDeIndiceDeCanal('')).toThrow()
    expect(pistaDeLlave(LLAVE)).toBe('…C123')
    expect(pistaDeLlave('ab')).toBe('****')
  })
})

describe('S-004 · findClinicByDialog360ApiKey resuelve por huella y migra lo heredado', () => {
  beforeEach(() => docs.clear())

  it('con el documento por huella resuelve directo', async () => {
    docs.set(`whatsapp_channels/${idDeIndiceDeCanal(LLAVE)}`, { clinicId: 'clinica-alfa' })
    expect(await findClinicByDialog360ApiKey(LLAVE)).toBe('clinica-alfa')
  })

  it('con SÓLO el documento heredado (id = llave) resuelve, lo reescribe por huella y borra el viejo', async () => {
    docs.set(`whatsapp_channels/${LLAVE}`, { clinicId: 'clinica-beta', channelId: 'ch-1' })
    expect(await findClinicByDialog360ApiKey(LLAVE)).toBe('clinica-beta')
    // Después de la primera búsqueda NINGÚN id del índice contiene la llave.
    const ids = [...docs.keys()].map(r => r.split('/')[1])
    expect(ids.some(id => elIdContieneLaLlave(id, LLAVE))).toBe(false)
    const migrado = docs.get(`whatsapp_channels/${idDeIndiceDeCanal(LLAVE)}`)
    expect(migrado?.clinicId).toBe('clinica-beta')
    expect(migrado?.channelId).toBe('ch-1')
    expect(migrado?.pista).toBe('…C123')
    // Y la segunda búsqueda ya no necesita migrar.
    expect(await findClinicByDialog360ApiKey(LLAVE)).toBe('clinica-beta')
  })

  it('sin ningún documento devuelve null y no inventa nada', async () => {
    expect(await findClinicByDialog360ApiKey(LLAVE)).toBeNull()
    expect(await findClinicByDialog360ApiKey('')).toBeNull()
    expect(docs.size).toBe(0)
  })
})
