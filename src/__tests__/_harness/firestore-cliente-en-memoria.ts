/**
 * FIRESTORE (SDK de CLIENTE) EN MEMORIA — con CONTEO de documentos leídos.
 *
 * ── POR QUÉ EXISTE, Y POR QUÉ ES UNO SOLO ────────────────────────────────────
 *
 * Nació dentro de `scale-342-lecturas-acotadas.test.ts` (REG-341) porque el
 * invariante de escala no se puede afirmar leyendo código: hay que **contar**
 * cuántos documentos se leen y comprobar que el número no crece con el tamaño
 * del consultorio.
 *
 * REG-350 necesitó exactamente lo mismo para el historial de un paciente. La
 * salida fácil habría sido copiar el doble en el archivo nuevo; se extrae aquí
 * en su lugar, porque dos dobles divergen y el día que uno se corrige el otro se
 * queda con el defecto. Ese es el patrón `depende_de_recordar` del propio
 * repositorio.
 *
 * ── QUÉ REPRODUCE ────────────────────────────────────────────────────────────
 *
 * `where` (==, <, <=, >, >=), `orderBy` con dirección, `limit`, `startAfter`
 * multi-campo, `documentId()`, `collectionGroup` y `getCountFromServer`. Y dos
 * comportamientos de Firestore que NO son detalles:
 *
 *  · una consulta ordenada **omite** los documentos que no tienen el campo del
 *    `orderBy` (así se descubrió que un paciente sin `nombre` desaparecía);
 *  · `startAfter` compara **en la dirección del orden**: con `desc` avanza hacia
 *    valores MENORES. Un doble que ignore la dirección da por buena una
 *    paginación descendente que en Firestore devolvería la primera página una y
 *    otra vez, o nada.
 *
 * ── QUÉ NO ES ────────────────────────────────────────────────────────────────
 *
 * No es Firestore. No valida reglas, no impone índices, no cobra latencia y no
 * conoce los topes de tamaño. Nada sobre reglas se prueba aquí: eso va contra el
 * emulador (`emulator/*.emu.test.ts`).
 */

export type Datos = Record<string, unknown>

export interface EstadoDoble {
  docs: Map<string, Datos>
  contador: { lecturas: number; getDocs: number; getDoc: number }
  fallos: {
    collectionGroup: boolean
    /**
     * Cuando es `true`, toda lectura LANZA. Sirve para probar que quien lee
     * distingue «no hay» de «no se pudo preguntar» — una diferencia que en un
     * directorio de pacientes decide si se crea un expediente duplicado.
     */
    lectura?: boolean
  }
}

/** Estado nuevo, listo para `vi.hoisted`. */
export function estadoDoble(): EstadoDoble {
  return {
    docs: new Map<string, Datos>(),
    contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
    fallos: { collectionGroup: false, lectura: false },
  }
}

type Fila = { ruta: string; id: string; data: Datos }
type Restriccion =
  | { t: 'orderBy'; campo: string; dir: 'asc' | 'desc' }
  | { t: 'where'; campo: string; op: string; valor: unknown }
  | { t: 'limit'; n: number }
  | { t: 'startAfter'; valores: unknown[] }

/**
 * Construye el módulo que sustituye a `firebase/firestore`.
 *
 * Se le pasa el estado en vez de crearlo dentro porque `vi.mock` se iza por
 * encima de todo: la fábrica no puede cerrar sobre nada que no venga de
 * `vi.hoisted`.
 */
export function firestoreClienteSobre(h: EstadoDoble) {
  const valorDe = (f: Fila, campo: string): unknown => {
    if (campo === '__name__') return f.id
    return campo.split('.').reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Datos)[k] : undefined),
      f.data,
    )
  }

  const filasDe = (ref: { tipo: string; ruta?: string; id?: string }): Fila[] => {
    const out: Fila[] = []
    for (const [ruta, data] of h.docs) {
      const p = ruta.split('/')
      const fila = { ruta, id: p[p.length - 1], data }
      if (ref.tipo === 'col' && p.slice(0, -1).join('/') === ref.ruta) out.push(fila)
      if (ref.tipo === 'grupo' && p[p.length - 2] === ref.id) out.push(fila)
    }
    return out
  }

  const cumple = (v: unknown, op: string, c: unknown): boolean => {
    if (v === undefined) return false
    switch (op) {
      case '==': return v === c
      case '>=': return (v as string) >= (c as string)
      case '>': return (v as string) > (c as string)
      case '<=': return (v as string) <= (c as string)
      case '<': return (v as string) < (c as string)
      default: throw new Error(`operador no soportado en el doble: ${op}`)
    }
  }

  const envolver = (f: Fila) => ({
    id: f.id,
    ref: { path: f.ruta },
    exists: () => true,
    data: () => f.data,
  })

  /** Filtra y ordena, sin contar ni aplicar `limit`. Lo comparten `getDocs` y el conteo. */
  const resolver = (q: { tipo: string; ref?: unknown; cs?: Restriccion[] }): Fila[] => {
    if (h.fallos.lectura) throw new Error('UNAVAILABLE: lectura caída (doble)')
    const ref = (q.tipo === 'query' ? q.ref : q) as { tipo: string; ruta?: string; id?: string }
    const cs = (q.tipo === 'query' ? q.cs : []) as Restriccion[]
    if (ref.tipo === 'grupo' && h.fallos.collectionGroup) {
      throw new Error('FAILED_PRECONDITION: the query requires an index')
    }
    const ordenes = cs.filter(c => c.t === 'orderBy') as Extract<Restriccion, { t: 'orderBy' }>[]
    let filas = filasDe(ref)
    for (const c of cs) {
      if (c.t === 'where') filas = filas.filter(f => cumple(valorDe(f, c.campo), c.op, c.valor))
    }
    // Firestore excluye los documentos que NO tienen el campo del orderBy.
    for (const o of ordenes) filas = filas.filter(f => valorDe(f, o.campo) !== undefined)
    filas.sort((a, b) => {
      for (const o of ordenes) {
        const va = valorDe(a, o.campo) as string
        const vb = valorDe(b, o.campo) as string
        if (va < vb) return o.dir === 'desc' ? 1 : -1
        if (va > vb) return o.dir === 'desc' ? -1 : 1
      }
      return 0
    })
    const sa = cs.find(c => c.t === 'startAfter') as Extract<Restriccion, { t: 'startAfter' }> | undefined
    if (sa) {
      filas = filas.filter(f => {
        for (let i = 0; i < ordenes.length; i++) {
          const v = valorDe(f, ordenes[i].campo) as string
          const c = sa.valores[i] as string
          /**
           * «Después», en la DIRECCIÓN DEL ORDEN. Con `desc`, después del cursor
           * son los valores MENORES. Comparar siempre como ascendente hacía que
           * una paginación descendente devolviera la primera página en bucle, y
           * el doble la daba por buena.
           */
          const despues = ordenes[i].dir === 'desc' ? v < c : v > c
          const antes = ordenes[i].dir === 'desc' ? v > c : v < c
          if (despues) return true
          if (antes) return false
        }
        return false
      })
    }
    return filas
  }

  return {
    collection: (_db: unknown, ...segs: string[]) => ({ tipo: 'col', ruta: segs.join('/') }),
    collectionGroup: (_db: unknown, id: string) => ({ tipo: 'grupo', id }),
    doc: (_db: unknown, ...segs: string[]) => ({
      tipo: 'doc', ruta: segs.join('/'), id: segs[segs.length - 1],
    }),
    query: (ref: unknown, ...cs: Restriccion[]) => ({ tipo: 'query', ref, cs }),
    orderBy: (campo: string, dir: 'asc' | 'desc' = 'asc') => ({ t: 'orderBy', campo, dir }),
    where: (campo: string, op: string, valor: unknown) => ({ t: 'where', campo, op, valor }),
    limit: (n: number) => ({ t: 'limit', n }),
    startAfter: (...valores: unknown[]) => ({ t: 'startAfter', valores }),
    documentId: () => '__name__',
    serverTimestamp: () => 'ts',
    Timestamp: class {},
    writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
    addDoc: async () => ({ id: 'nuevo' }),
    setDoc: async () => {},
    updateDoc: async () => {},
    deleteDoc: async () => {},

    getDoc: async (ref: { ruta: string; id: string }) => {
      if (h.fallos.lectura) throw new Error('UNAVAILABLE: lectura caída (doble)')
      h.contador.getDoc++
      h.contador.lecturas++
      const data = h.docs.get(ref.ruta)
      return {
        id: ref.id,
        ref: { path: ref.ruta },
        exists: () => data !== undefined,
        data: () => data,
      }
    },

    getDocs: async (q: { tipo: string; ref?: unknown; cs?: Restriccion[] }) => {
      let filas = resolver(q)
      const cs = (q.tipo === 'query' ? q.cs : []) as Restriccion[]
      const lim = cs.find(c => c.t === 'limit') as Extract<Restriccion, { t: 'limit' }> | undefined
      if (lim) filas = filas.slice(0, lim.n)
      h.contador.getDocs++
      h.contador.lecturas += filas.length
      return { docs: filas.map(envolver), size: filas.length, empty: filas.length === 0 }
    },

    /**
     * `getCountFromServer` cuenta EN EL SERVIDOR: cobra una lectura por cada mil
     * documentos y no transporta ninguno. El doble cobra igual, porque el
     * invariante que se prueba con él es «esta pantalla no lee N documentos», y
     * cobrar N aquí lo haría fallar por una lectura que en producción no ocurre.
     */
    getCountFromServer: async (q: { tipo: string; ref?: unknown; cs?: Restriccion[] }) => {
      const n = resolver(q).length
      h.contador.getDocs++
      h.contador.lecturas += Math.ceil(n / 1000)
      return { data: () => ({ count: n }) }
    },
  }
}
