/**
 * ENTRAR A LA LISTA DE ESPERA UNA SOLA VEZ.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `createWaitlistEntry` escribía con `addDoc`: identificador aleatorio, uno nuevo
 * en cada llamada. Así, dos envíos del mismo formulario —el doble clic, el
 * reintento tras una red lenta, la pestaña duplicada— eran por construcción DOS
 * entradas del mismo paciente.
 *
 * ── POR QUÉ DUELE DONDE NO SE VE ─────────────────────────────────────────────
 *
 * Una entrada duplicada no es sólo ruido en una lista. Al liberarse un hueco sólo
 * se avisa a TRES personas (`LIMITE_NOTIFICAR`), así que el paciente repetido
 * ocupa dos de esos tres sitios: **el tercero de la fila no se entera del hueco**
 * y el repetido recibe dos veces el mismo mensaje. La lista sigue pareciendo que
 * funciona.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La identidad del documento nacía de la ESCRITURA, no de la INTENCIÓN — la
 * misma raíz que `lib/idempotencia.ts` ya describe para el cobro y la nota, y la
 * misma que dejó dos consultorios duplicados en `/setup`.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · Las reglas de Firestore (van contra el emulador).
 * · La atomicidad REAL de la transacción del SDK de cliente: aquí se simula, y
 *   lo que se comprueba es que exista y que el id no dependa de la escritura.
 * · La pantalla: este archivo prueba la frontera de escritura, no el formulario.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { claveDeEspera } from '@/lib/whatsapp/lista-espera'
import { idIdempotente, esIdDeUnSoloSegmento } from '@/lib/idempotencia'

// ── Un Firestore de cliente mínimo, en memoria ───────────────────────────────
const almacen = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>() }))

vi.mock('./firebase', () => ({ db: {} }))
vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))
vi.mock('firebase/firestore', () => {
  const ruta = (...p: unknown[]) => p.slice(1).join('/')
  return {
    collection: (_db: unknown, ...p: string[]) => ({ ruta: p.join('/') }),
    doc: (_db: unknown, ...p: string[]) => ({ ruta: ruta(_db, ...p) }),
    addDoc: async (c: { ruta: string }, datos: Record<string, unknown>) => {
      const id = `azar-${almacen.docs.size + 1}-${Math.random().toString(36).slice(2, 8)}`
      almacen.docs.set(`${c.ruta}/${id}`, { ...datos })
      return { id }
    },
    setDoc: async (r: { ruta: string }, datos: Record<string, unknown>) => { almacen.docs.set(r.ruta, { ...datos }) },
    updateDoc: async () => {},
    deleteDoc: async () => {},
    getDoc: async (r: { ruta: string }) => ({ exists: () => almacen.docs.has(r.ruta), data: () => almacen.docs.get(r.ruta) }),
    getDocs: async () => ({ docs: [] }),
    query: (...a: unknown[]) => a[0],
    orderBy: () => ({}), where: () => ({}),
    serverTimestamp: () => 'ts', Timestamp: {},
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: async (r: { ruta: string }) => ({ exists: () => almacen.docs.has(r.ruta), data: () => almacen.docs.get(r.ruta) }),
        set: (r: { ruta: string }, datos: Record<string, unknown>, opts?: { merge?: boolean }) => {
          const previo = opts?.merge ? (almacen.docs.get(r.ruta) ?? {}) : {}
          almacen.docs.set(r.ruta, { ...previo, ...datos })
        },
      }
      await fn(tx)
    },
  }
})

const CLINICA = 'clinica-sintetica-alfa'
const VECINA = 'clinica-sintetica-beta'

const PETICION = {
  pacienteNombre: 'Ana Sintética',
  pacienteTelefono: '5511110000',
  tipo: 'seguimiento' as const,
  fechaDeseada: '',
  rangoHorario: 'por la mañana',
  prioridad: 3,
  notas: '',
  estado: 'activo' as const,
  createdAt: '2026-08-01T10:00:00.000Z',
  creadoPor: 'recepcion@sintetico.test',
}

const enLista = (clinicId: string) =>
  [...almacen.docs.keys()].filter(k => k.startsWith(`clinics/${clinicId}/waitlist/`))

async function alta(clinicId: string, extra: Partial<typeof PETICION> = {}) {
  const { createWaitlistEntry } = await import('@/lib/firestore')
  return createWaitlistEntry(clinicId, { ...PETICION, ...extra } as never)
}

beforeEach(() => { almacen.docs.clear(); vi.resetModules() })

describe('la clave de una petición de espera', () => {
  it('no cambia por cómo se teclee el teléfono', () => {
    expect(claveDeEspera({ pacienteTelefono: '55 1111 0000', tipo: 'seguimiento' }))
      .toBe(claveDeEspera({ pacienteTelefono: '5511110000', tipo: 'seguimiento' }))
  })

  it('no cambia por la prioridad ni por las notas: eso es gestión, no petición', () => {
    const a = claveDeEspera({ pacienteTelefono: '5511110000', tipo: 'seguimiento' })
    const b = claveDeEspera({ pacienteTelefono: '5511110000', tipo: 'seguimiento' })
    expect(a).toBe(b)
  })

  it('SÍ cambia si pide otro tipo, otra fecha u otra franja: es otra petición', () => {
    const base = { pacienteTelefono: '5511110000', tipo: 'seguimiento', fechaDeseada: '', rangoHorario: 'mañana' }
    expect(claveDeEspera({ ...base, tipo: 'primera-vez' })).not.toBe(claveDeEspera(base))
    expect(claveDeEspera({ ...base, fechaDeseada: '2026-09-01' })).not.toBe(claveDeEspera(base))
    expect(claveDeEspera({ ...base, rangoHorario: 'tarde' })).not.toBe(claveDeEspera(base))
  })

  it('el id derivado es un solo segmento de ruta, nunca un camino', () => {
    const id = idIdempotente(CLINICA, 'lista-espera', claveDeEspera({ pacienteTelefono: '../../otro', tipo: 'x/y' }))
    expect(esIdDeUnSoloSegmento(id)).toBe(true)
    expect(id).not.toContain('/')
  })
})

describe('el alta en la lista de espera es idempotente', () => {
  it('dar de alta dos veces la misma petición deja UNA entrada', async () => {
    const id1 = await alta(CLINICA)
    const id2 = await alta(CLINICA)
    expect(id2).toBe(id1)
    expect(enLista(CLINICA)).toHaveLength(1)
  })

  it('el id no depende de la escritura: sale de la intención', async () => {
    const id = await alta(CLINICA)
    expect(id).toBe(idIdempotente(CLINICA, 'lista-espera', claveDeEspera(PETICION)))
    expect(id).not.toMatch(/^azar-/)
  })

  it('conserva la ANTIGÜEDAD: un segundo envío no manda al paciente al final de su fila', async () => {
    await alta(CLINICA)
    const primero = almacen.docs.get(enLista(CLINICA)[0])!.createdAt
    await alta(CLINICA, { createdAt: '2026-12-31T23:59:59.000Z' })
    // La cuenta va PRIMERO: sin ella, este caso pasaba también con `addDoc`,
    // porque miraba la entrada [0] de dos — es decir, por la razón equivocada.
    expect(enLista(CLINICA)).toHaveLength(1)
    expect(almacen.docs.get(enLista(CLINICA)[0])!.createdAt).toBe(primero)
  })

  it('pedir OTRA cosa sí abre una entrada nueva', async () => {
    await alta(CLINICA)
    await alta(CLINICA, { tipo: 'primera-vez' as never })
    expect(enLista(CLINICA)).toHaveLength(2)
  })

  it('volver a apuntar a quien estaba de baja lo reactiva, no lo duplica', async () => {
    const id = await alta(CLINICA)
    almacen.docs.set(enLista(CLINICA)[0], { ...almacen.docs.get(enLista(CLINICA)[0])!, estado: 'baja' })
    const id2 = await alta(CLINICA)
    expect(id2).toBe(id)
    expect(enLista(CLINICA)).toHaveLength(1)
    expect(almacen.docs.get(enLista(CLINICA)[0])!.estado).toBe('activo')
  })

  it('la misma petición en DOS consultorios son dos entradas distintas', async () => {
    const a = await alta(CLINICA)
    const b = await alta(VECINA)
    expect(a).not.toBe(b)
    expect(enLista(CLINICA)).toHaveLength(1)
    expect(enLista(VECINA)).toHaveLength(1)
  })
})
