/**
 * GOLDEN — un reintento no puede dejar dos enmiendas idénticas en el expediente.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `agregarAdenda` nacía con `addDoc`, o sea con la identidad de la ESCRITURA en
 * vez de la de la INTENCIÓN — exactamente la causa raíz que
 * `lib/idempotencia.ts` existe para cerrar, y que ya se había cerrado para la
 * nota, el cobro, el laboratorio y la lista de espera. La adenda se quedó fuera.
 *
 * El doble clic **sí** estaba cubierto: el botón se bloquea mientras la petición
 * está en vuelo. El caso que no lo estaba es el que la red provoca sola:
 *
 *   1. el médico pulsa «Guardar adenda»;
 *   2. Firestore COMMITEA;
 *   3. la respuesta se pierde — pestaña dormida, túnel, wifi que salta;
 *   4. el `catch` pinta «No se pudo agregar la adenda. Intenta de nuevo.» y el
 *      `finally` reactiva el botón;
 *   5. el médico hace lo que se le acaba de pedir: reintenta.
 *
 * Y quedan **dos enmiendas idénticas** a una nota firmada.
 *
 * ── POR QUÉ ESTO ES PEOR QUE UN DUPLICADO CUALQUIERA ────────────────────────
 *
 * Una adenda es la corrección medicolegal de un documento inmutable (NOM-004).
 * **No se puede borrar.** El expediente diría, para siempre, que el médico
 * enmendó dos veces lo mismo — y quien lo lea después no tiene forma de saber
 * que fue la red.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Quien inicia la operación acuña UNA clave y la conserva **mientras el intento
 * no haya terminado bien**. De ahí sale un id determinista. Una acción lógica,
 * un recurso.
 *
 * Y si el documento ya existe, **se devuelve lo que hay sin pisarlo**: la adenda
 * previa puede llevar minutos en el expediente, y reescribirla cambiaría su
 * `createdAt` — el dato que una enmienda medicolegal no puede perder.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba Firestore.** La transacción está doblada; lo que se ejercita es
 *   que el id venga de la intención y que una convergencia no reescriba. Que la
 *   transacción sea atómica es de Firestore.
 * · **Sólo cubre la adenda.** El resto del inventario de escrituras con `addDoc`
 *   —tareas clínicas, fotos, farmacia, ARCO— sigue sin clave de intención y
 *   queda dicho en el censo, no arreglado aquí.
 * · **No cubre la ruta del servidor**, porque la adenda se escribe desde el
 *   cliente contra las reglas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { claveDeIntento, idIdempotente } from '@/lib/idempotencia'

const almacen = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  escrituras: 0,
  añadidosAlAzar: 0,
  notaFirmada: true,
}))

vi.mock('@/lib/firebase', () => ({
  db: {}, storage: null,
  auth: { currentUser: { uid: 'medico-1' } },
}))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))

vi.mock('firebase/firestore', async () => {
  const ref = (path: string) => ({ path })
  return {
    collection: (padre: { path?: string }, hijo: string) => ref(`${padre?.path ?? 'c'}/${hijo}`),
    doc: (...partes: unknown[]) => {
      const ultimo = partes[partes.length - 1]
      const base = (partes[0] as { path?: string })?.path ?? 'c'
      return ref(typeof ultimo === 'string' && partes.length === 2 ? `${base}/${ultimo}` : `${base}/${partes.slice(1).join('/')}`)
    },
    getDoc: async (r: { path: string }) => ({
      exists: () => r.path.includes('notas') ? true : almacen.docs.has(r.path),
      data: () => almacen.docs.get(r.path) ?? { estado: almacen.notaFirmada ? 'firmada' : 'borrador' },
    }),
    addDoc: async (c: { path: string }, data: Record<string, unknown>) => {
      almacen.añadidosAlAzar += 1
      const id = `azar-${almacen.añadidosAlAzar}`
      almacen.docs.set(`${c.path}/${id}`, data)
      return { id }
    },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async (r: { path: string }) => ({
        exists: () => almacen.docs.has(r.path),
        data: () => almacen.docs.get(r.path),
      }),
      set: (r: { path: string }, data: Record<string, unknown>) => {
        almacen.escrituras += 1
        almacen.docs.set(r.path, data)
      },
    }),
    updateDoc: async () => {}, deleteDoc: async () => {}, setDoc: async () => {},
    getDocs: async () => ({ docs: [] }),
    query: () => ({}), where: () => ({}), orderBy: () => ({}), limit: () => ({}),
    startAfter: () => ({}), documentId: () => ({}), collectionGroup: () => ({}),
    serverTimestamp: () => new Date().toISOString(), increment: (n: number) => n,
    arrayUnion: (...x: unknown[]) => x, writeBatch: () => ({ set() {}, commit: async () => {} }),
    onSnapshot: () => () => {}, Timestamp: { now: () => ({}) },
  }
})

const DATOS = { texto: 'La dosis correcta era 500 mg.', motivo: 'Corrección de dosis', autorNombre: 'Dra. Sintética', autorEmail: 'dra@ejemplo.mx' }

beforeEach(() => {
  almacen.docs.clear()
  almacen.escrituras = 0
  almacen.añadidosAlAzar = 0
  almacen.notaFirmada = true
})

describe('la misma intención escribe UNA adenda', () => {
  it('AL REVÉS: sin clave, dos intentos dejan dos enmiendas', async () => {
    /**
     * El defecto reproducido. Sin clave se cae al `addDoc`, que inventa un id
     * nuevo cada vez — la identidad de la escritura, no la de la intención.
     */
    const { agregarAdenda } = await import('@/lib/expediente/firestore')
    const a = await agregarAdenda('c1', 'p1', 'n1', DATOS)
    const b = await agregarAdenda('c1', 'p1', 'n1', DATOS)
    expect(a.id).not.toBe(b.id)
    expect(almacen.añadidosAlAzar, 'dos enmiendas idénticas en el expediente').toBe(2)
  })

  it('con la misma clave, el reintento converge en el mismo documento', async () => {
    const { agregarAdenda } = await import('@/lib/expediente/firestore')
    const clave = claveDeIntento()
    const a = await agregarAdenda('c1', 'p1', 'n1', DATOS, clave)
    const b = await agregarAdenda('c1', 'p1', 'n1', DATOS, clave)
    expect(b.id).toBe(a.id)
    expect(almacen.escrituras, 'la segunda no debió escribir').toBe(1)
    expect(almacen.añadidosAlAzar, 'y no debió caer al addDoc').toBe(0)
  })

  it('y el id sale de la intención, no de la escritura', async () => {
    const { agregarAdenda } = await import('@/lib/expediente/firestore')
    const clave = claveDeIntento()
    const a = await agregarAdenda('c1', 'p1', 'n1', DATOS, clave)
    expect(a.id).toBe(idIdempotente('c1', 'adenda', clave))
  })

  it('la convergencia NO reescribe: el `createdAt` de la primera se conserva', async () => {
    /**
     * Reescribir «para dejarlo igual» cambiaría el instante en que consta la
     * enmienda. En un documento medicolegal eso no es un detalle: es la hora que
     * dice cuándo se corrigió.
     */
    const { agregarAdenda } = await import('@/lib/expediente/firestore')
    const clave = claveDeIntento()
    const a = await agregarAdenda('c1', 'p1', 'n1', DATOS, clave)
    await new Promise(r => setTimeout(r, 5))
    const b = await agregarAdenda('c1', 'p1', 'n1', { ...DATOS, texto: 'otra cosa' }, clave)
    expect(b.createdAt).toBe(a.createdAt)
    expect(b.texto, 'la enmienda que ya consta no se reescribe').toBe(DATOS.texto)
  })

  it('una intención NUEVA sí escribe una adenda nueva', async () => {
    /* La defensa no puede volver imposible enmendar dos veces de verdad. */
    const { agregarAdenda } = await import('@/lib/expediente/firestore')
    const a = await agregarAdenda('c1', 'p1', 'n1', DATOS, claveDeIntento())
    const b = await agregarAdenda('c1', 'p1', 'n1', { ...DATOS, texto: 'Y además…', motivo: 'Aclaración' }, claveDeIntento())
    expect(b.id).not.toBe(a.id)
    expect(almacen.escrituras).toBe(2)
  })

  it('la misma clave en otro consultorio da otro id', async () => {
    /* La clave la propone el cliente, y un cliente puede mandar la de otro. */
    const clave = claveDeIntento()
    expect(idIdempotente('c1', 'adenda', clave)).not.toBe(idIdempotente('c2', 'adenda', clave))
  })

  it('y no puede convertirse en una ruta', () => {
    /* `/`, `.` y `..` no sobreviven a la derivación. */
    const id = idIdempotente('c1', 'adenda', '../../otro/consultorio')
    expect(id).toMatch(/^[a-z-]+__[0-9a-f]{32}$/)
  })
})

describe('la pantalla conserva la clave hasta que el intento termina BIEN', () => {
  const PAGINA = readFileSync('src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx', 'utf8')

  it('la acuña una vez y la reutiliza mientras no termine', () => {
    /**
     * `??=`, no `=`. Con asignación directa cada reintento acuñaría una clave
     * nueva y la defensa no serviría de nada — el defecto seguiría ahí con más
     * código encima.
     */
    expect(PAGINA).toContain('claveAdendaRef.current ??= claveDeIntento()')
  })

  it('la suelta al terminar bien, y sólo entonces', () => {
    /* Si no se soltara, la segunda enmienda de verdad convergería sobre la
       primera y el médico no podría enmendar dos veces. */
    const i = PAGINA.indexOf('claveAdendaRef.current = null')
    expect(i, 'la clave no se suelta nunca').toBeGreaterThan(0)
    const antes = PAGINA.slice(Math.max(0, i - 2500), i)
    expect(antes, 'se suelta antes de saber que salió bien').toContain('await agregarAdenda(')
    /* Y no dentro del `catch` ni del `finally`, que es donde no debe estar. */
    const bloqueCatch = PAGINA.slice(PAGINA.indexOf('No se pudo agregar la adenda') - 200, PAGINA.indexOf('No se pudo agregar la adenda') + 400)
    expect(bloqueCatch).not.toContain('claveAdendaRef.current = null')
  })

  it('y si el reintento converge, la lista no pinta la adenda dos veces', () => {
    expect(PAGINA).toContain('prev.some(a => a.id === nueva.id)')
  })
})
