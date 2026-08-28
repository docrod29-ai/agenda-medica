import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * REG-344 — EL WORKLIST PODÍA QUEDARSE CORTO, Y CALLARLO.
 *
 * ── QUÉ FALLABA, POR DOS CAMINOS DISTINTOS ───────────────────────────────────
 *
 * 1. `tareasVivas()` leía con `limit(200)` **sin `orderBy`**. Firestore devuelve
 *    entonces 200 documentos ARBITRARIOS de los N que hay, y la pantalla no
 *    tenía forma de saber que había más. Con 200 pendientes vivos, un resultado
 *    crítico sin revisar podía sencillamente no aparecer.
 *
 *    Y ojo: la ausencia de `orderBy` **no es un descuido**. Está razonada en el
 *    módulo — `where … in …` + `orderBy` exige un índice compuesto que hay que
 *    crear a mano, y mientras no existe la lectura falla ENTERA. Así se abrió
 *    esta pantalla en producción: con un error, no con una lista vacía. Quitar
 *    el `orderBy` fue correcto. Lo que faltaba era **decir que se quedó corta**.
 *
 * 2. Al firmar, las tareas de la consulta se creaban con
 *    `void crearTareas(...).catch(() => {})`. `crearTareas` devuelve cuántas
 *    entraron —y traga los fallos de una en una para que un pendiente roto no
 *    tumbe a los demás—, y ese número se descartaba junto con el `catch`. Si la
 *    pestaña se cerraba o la red se caía en esa ventana, los pendientes de esa
 *    consulta desaparecían y el médico se iba convencido de que estaban.
 *
 * ── LO QUE NO SE CAMBIA, Y ES DELIBERADO ─────────────────────────────────────
 *
 * Crear las tareas **sigue sin bloquear la firma**. Hacer que un fallo al
 * escribir el worklist reviente la firma sería cambiar un pendiente perdido por
 * una consulta perdida. Lo que se arregla es el silencio, no el orden.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Una lista de trabajo clínico que se queda corta **lo dice**. «No hay nada
 * pendiente» y «no lo he leído entero» no son lo mismo, y en esta pantalla
 * confundirlos se lee como «todo está al día» — la conclusión más peligrosa
 * posible. Es la misma distinción que la pantalla ya hacía entre un fallo de
 * lectura y una lista vacía; sólo que faltaba el tercer caso.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **NO arregla QUÉ 200 vienen.** Siguen siendo un subconjunto arbitrario. Para
 *   elegirlos —los más urgentes primero— hace falta el índice compuesto, que se
 *   crea fuera del repositorio y es decisión de infraestructura. Mientras tanto
 *   el aviso es la defensa, no la solución. Queda abierto en el tablero.
 * · `tareasDePaciente` sigue con `limit(100)` y sin declarar su recorte. Un
 *   paciente con más de 100 pendientes vivos es improbable, pero no imposible,
 *   y aquí no se da por bueno: queda anotado.
 * · No renderiza: que el aviso EXISTA no prueba que se vea. Eso es navegador.
 */

const almacen = vi.hoisted(() => ({ docs: [] as Record<string, unknown>[] }))

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  getDoc: async () => ({ exists: () => false }),
  setDoc: async () => {},
  addDoc: async () => ({ id: 'x' }),
  updateDoc: async () => {},
  getDocs: async (q: { __limite: number }) => ({
    docs: almacen.docs.slice(0, q.__limite).map((d, i) => ({ id: `t${i}`, data: () => d })),
  }),
  query: (_c: unknown, ..._r: unknown[]) => {
    const lim = (_r.find(r => (r as { __limite?: number })?.__limite !== undefined) ?? {}) as { __limite?: number }
    return { __limite: lim.__limite ?? Infinity }
  },
  where: () => ({}),
  orderBy: () => ({}),
  limit: (n: number) => ({ __limite: n }),
  serverTimestamp: () => ({}),
}))
vi.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u' } } }))

const { tareasVivas } = await import('@/lib/tareas-clinicas/firestore')

const tarea = () => ({ estado: 'solicitada', tipo: 'estudio_pendiente', titulo: 'x' })

beforeEach(() => { almacen.docs = [] })

describe('REG-344 · el worklist dice cuándo se quedó corto', () => {
  it('por debajo del tope, la lista está completa', async () => {
    almacen.docs = Array.from({ length: 5 }, tarea)
    const w = await tareasVivas('c1', 200)
    expect(w.tareas).toHaveLength(5)
    expect(w.truncada).toBe(false)
  })

  it('justo EN el tope todavía no se declara corta', async () => {
    // El borde exacto: 200 documentos y ni uno más. Decir «hay más» aquí sería
    // un aviso falso, y un aviso que miente se aprende a ignorar.
    almacen.docs = Array.from({ length: 10 }, tarea)
    const w = await tareasVivas('c1', 10)
    expect(w.tareas).toHaveLength(10)
    expect(w.truncada).toBe(false)
  })

  it('EL DEFECTO: con más pendientes que el tope, ahora se declara', async () => {
    almacen.docs = Array.from({ length: 11 }, tarea)
    const w = await tareasVivas('c1', 10)
    expect(w.truncada).toBe(true)
    // El documento extra sólo sirve para SABER que hay más; no se devuelve.
    expect(w.tareas).toHaveLength(10)
    expect(w.tope).toBe(10)
  })

  it('sin consultorio no inventa una lista vacía silenciosa', async () => {
    const w = await tareasVivas('', 10)
    expect(w.tareas).toEqual([])
    expect(w.truncada).toBe(false)
  })
})

describe('REG-344 · el cableado de lo que se declara', () => {
  it('la pantalla de pendientes enseña el recorte, con esas palabras', () => {
    const src = readFileSync('src/app/(dashboard)/pendientes/page.tsx', 'utf8')
    expect(src).toMatch(/setTruncado\(w\.truncada \? w\.tope : 0\)/)
    expect(src).toMatch(/no está completa/)
  })

  it('firmar sigue SIN bloquearse, pero un pendiente perdido se dice', () => {
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    // Sigue sin bloquear: nada de `await crearTareas` en el camino de la firma.
    expect(src).not.toMatch(/await crearTareas\(/)
    // Pero el número YA no se descarta.
    expect(src).toMatch(/if \(creadas < pendientesDeLaNota\.length\)/)
    expect(src).toMatch(/NO se abrieron/)
  })

  it('el guardián sabe fallar: reconoce el patrón que se retiró', () => {
    const antes = "void crearTareas(clinicId, tareasDeNota({ ... }, Date.now())).catch(() => {})"
    expect(/\.catch\(\(\) => \{ ?\/?\*? ?\}?\)/.test(antes) || /catch\(\(\) => \{\}\)/.test(antes)).toBe(true)
    expect(/if \(creadas < /.test(antes)).toBe(false)
  })
})
