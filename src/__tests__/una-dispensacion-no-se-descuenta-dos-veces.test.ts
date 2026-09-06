/**
 * GOLDEN — la transacción protege la aritmética, no la identidad.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `registrarMovimiento` ya corría dentro de `runTransaction`, y su comentario
 * explicaba bien por qué: *«dos salidas concurrentes partían del mismo valor
 * viejo → last-write-wins descuadraba el stock»*. Eso está resuelto.
 *
 * Lo que la transacción **no** resuelve es ejecutar la MISMA salida dos veces.
 * El movimiento se escribía así:
 *
 *     tx.set(doc(COL_MOV(clinicId)), { …movimiento… })
 *
 * y `doc()` sin id fabrica un nombre aleatorio nuevo en cada llamada — lo que el
 * propio `idempotencia.ts` advierte en su primera línea. Así que si el commit
 * sale y la respuesta se pierde, el reintento **descuenta el medicamento otra
 * vez**, con otro nombre, y los dos movimientos quedan en los libros.
 *
 * No es el doble clic —eso lo cubre el botón deshabilitado—: es el caso que
 * provoca la red sola, el mismo que REG-395 describió para la adenda. Con
 * controlados es la diferencia entre la existencia real y la que dice el sistema.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Construyendo el inventario de escrituras sin clave de intención. La primera
 * versión sólo miraba `addDoc` y daba esta por buena; al añadir la otra forma
 * —`doc()` sin id— apareció, y era la peor de la lista.
 *
 * El censo, que llevaba la cuenta a mano, tampoco la nombraba: decía «farmacia»
 * refiriéndose al catálogo de items, que es lo operativo.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * La clave la acuña quien **abre el modal**, no quien confirma. Acuñarla al
 * confirmar haría que cada reintento trajera una clave nueva, que es exactamente
 * el defecto con más pasos.
 *
 * Y al converger se devuelve **la cantidad que se aplicó entonces**, no la que se
 * pidió ahora: si aquella salida se recortó por falta de existencias, el
 * reintento tiene que enterarse del recorte y no del deseo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Sin clave se comporta como antes.** Es deliberado: un llamador que todavía
 *   no la pase no puede quedarse sin registrar el movimiento.
 * · **No deduplica entre pestañas distintas.** Dos personas dispensando el mismo
 *   fármaco a la vez son dos intenciones y dos movimientos, que es lo correcto.
 * · **No toca el catálogo de items** (`crearItem`), que es operativo.
 * · **No cubre las otras cinco escrituras clínicas sin clave** — ARCO, fotos,
 *   signos ×2, laboratorio y UCI. Las vigila el trinquete, con su techo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { idIdempotente } from '@/lib/idempotencia'

const almacen = vi.hoisted(() => ({
  /** Documentos escritos, por id. */
  docs: new Map<string, Record<string, unknown>>(),
  /** Existencias del item. */
  cantidad: 10,
  /** Cuántas veces se ejecutó el cuerpo de la transacción. */
  transacciones: 0,
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...ruta: string[]) => ({ ruta: ruta[ruta.length - 1] }),
  doc: (col: { ruta: string } | unknown, id?: string) => ({
    ruta: (col as { ruta?: string })?.ruta ?? '?',
    id: id ?? `aleatorio-${Math.random()}`,
  }),
  runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    almacen.transacciones += 1
    const tx = {
      get: async (ref: { ruta: string; id: string }) => {
        if (ref.ruta === 'farmacia') {
          return { exists: () => true, data: () => ({ cantidad: almacen.cantidad }) }
        }
        const d = almacen.docs.get(ref.id)
        return { exists: () => !!d, data: () => d }
      },
      set: (ref: { id: string }, datos: Record<string, unknown>) => { almacen.docs.set(ref.id, datos) },
      update: (_ref: unknown, datos: { cantidad: number }) => { almacen.cantidad = datos.cantidad },
    }
    return await fn(tx)
  },
  query: () => ({}), where: () => ({}), orderBy: () => ({}), limit: () => ({}),
  getDocs: async () => ({ docs: [] }), getDoc: async () => ({ exists: () => false }),
  setDoc: async () => {}, updateDoc: async () => {}, deleteDoc: async () => {},
  addDoc: async () => ({ id: 'x' }), serverTimestamp: () => ({}), writeBatch: () => ({}),
}))
vi.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u' } } }))

const ITEM = { id: 'item-1', nombre: 'Tramadol', cantidad: 10 } as never
const SALIDA = { itemId: 'item-1', tipo: 'salida' as const, cantidad: 3, realizadoPor: 'u1' }

beforeEach(() => {
  almacen.docs.clear()
  almacen.cantidad = 10
  almacen.transacciones = 0
})

describe('la misma intención descuenta UNA vez', () => {
  it('AL REVÉS: sin clave, el reintento descuenta dos veces', async () => {
    /**
     * El defecto, reproducido. Es lo que hacía SIEMPRE, y la transacción no lo
     * impedía: cada llamada fabrica un nombre nuevo, así que los dos movimientos
     * son documentos distintos y las dos restas se aplican.
     */
    const { registrarMovimiento } = await import('@/lib/farmacia')
    await registrarMovimiento('c1', ITEM, SALIDA)
    await registrarMovimiento('c1', ITEM, SALIDA)
    expect(almacen.docs.size, 'dos movimientos por una sola salida').toBe(2)
    expect(almacen.cantidad, '10 − 3 − 3').toBe(4)
  })

  it('y con la MISMA clave, el reintento converge', async () => {
    const { registrarMovimiento } = await import('@/lib/farmacia')
    await registrarMovimiento('c1', ITEM, SALIDA, 'intento-abc')
    await registrarMovimiento('c1', ITEM, SALIDA, 'intento-abc')
    expect(almacen.docs.size, 'un movimiento, no dos').toBe(1)
    expect(almacen.cantidad, '10 − 3, una sola vez').toBe(7)
  })

  it('el segundo intento devuelve lo que se aplicó ENTONCES', async () => {
    /**
     * Con 2 en existencia y una salida de 3, la primera se recorta a 2. El
     * reintento tiene que decir 2 —lo que ocurrió— y no 3 —lo que se pidió—: es
     * la cifra que la pantalla enseña y la que cuadra los libros.
     */
    almacen.cantidad = 2
    const { registrarMovimiento } = await import('@/lib/farmacia')
    const primera = await registrarMovimiento('c1', ITEM, SALIDA, 'intento-xyz')
    const segunda = await registrarMovimiento('c1', ITEM, SALIDA, 'intento-xyz')
    expect(primera).toBe(2)
    expect(segunda).toBe(2)
    expect(almacen.cantidad).toBe(0)
  })

  it('dos intenciones DISTINTAS siguen siendo dos movimientos', async () => {
    /**
     * El caso que impide pasarse de frenada. Dos dispensaciones de verdad —dos
     * pacientes, o el mismo dos veces— tienen que restar dos veces. Colapsarlas
     * sería perder una salida real, que es peor que duplicarla: el sistema diría
     * que hay medicamento que no está.
     */
    const { registrarMovimiento } = await import('@/lib/farmacia')
    await registrarMovimiento('c1', ITEM, SALIDA, 'intento-1')
    await registrarMovimiento('c1', ITEM, SALIDA, 'intento-2')
    expect(almacen.docs.size).toBe(2)
    expect(almacen.cantidad).toBe(4)
  })

  it('sin clave se comporta como antes, a propósito', async () => {
    /* Un llamador que todavía no la pase no puede quedarse sin registrar. */
    const { registrarMovimiento } = await import('@/lib/farmacia')
    expect(await registrarMovimiento('c1', ITEM, SALIDA)).toBe(3)
    expect(almacen.docs.size).toBe(1)
  })

  it('la comprobación vive DENTRO de la transacción', async () => {
    /**
     * Un `getDoc` previo dejaría abierta la ventana entre leer y escribir, que es
     * por donde entra la otra pestaña — el mismo razonamiento que REG-395 dejó
     * escrito para la adenda.
     */
    const { registrarMovimiento } = await import('@/lib/farmacia')
    await registrarMovimiento('c1', ITEM, SALIDA, 'k')
    expect(almacen.transacciones).toBe(1)
    const src = readFileSync('src/lib/farmacia.ts', 'utf8')
    const cuerpo = src.slice(src.indexOf('runTransaction(db'), src.indexOf('tx.update(itemRef'))
    expect(cuerpo).toMatch(/tx\.get\(movRef\)/)
  })
})

describe('el id sale de la intención, y lleva el consultorio dentro', () => {
  it('la misma clave en dos consultorios da dos documentos', async () => {
    /* La clave la propone el cliente y un cliente puede mandar la de otro. */
    expect(idIdempotente('c1', 'farmacia', 'k')).not.toBe(idIdempotente('c2', 'farmacia', 'k'))
  })

  it('y el ámbito «farmacia» está declarado, no es texto libre', () => {
    /* La lista de ámbitos es cerrada: uno libre convierte el prefijo del id en
       otro campo que elige el cliente. */
    expect(() => idIdempotente('c1', 'farmacia', 'k')).not.toThrow()
    expect(idIdempotente('c1', 'farmacia', 'k')).toMatch(/^farmacia__[0-9a-f]{32}$/)
  })
})

describe('la clave nace al ABRIR el modal, no al confirmar', () => {
  const PAGINA = readFileSync('src/app/(dashboard)/farmacia/page.tsx', 'utf8')

  it('se acuña al abrir, y viaja con la intención', () => {
    /**
     * Si se acuñara dentro de `onConfirmar`, cada reintento traería una clave
     * nueva y el movimiento volvería a escribirse: el defecto entero, con más
     * pasos y con aspecto de estar resuelto.
     */
    expect(PAGINA).toMatch(/setMoviendo\(\{ item, tipo: 'entrada', clave: claveDeIntento\(\) \}\)/)
    expect(PAGINA).toMatch(/setMoviendo\(\{ item, tipo: 'salida', clave: claveDeIntento\(\) \}\)/)
  })

  it('y LLEGA a la escritura', () => {
    /* «El dato tiene que LLEGAR»: una función que acepta la clave y una pantalla
       que no se la pasa no protegen nada. */
    expect(PAGINA).toMatch(/\}, moviendo\.clave\)/)
  })
})
