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
    /**
     * Falla sólo las lecturas cuya ruta contenga este texto. Hace falta para
     * probar que UNA comprobación concreta falla cerrado sin que otra anterior
     * se lleve el caso por delante — si todo se cae a la vez, la prueba mide la
     * primera guarda y no la que se quería mirar.
     */
    lecturaEn?: string
    /**
     * SIMULA UN ÍNDICE QUE NO EXISTE.
     *
     * Toda consulta que ordene por este campo lanza `FAILED_PRECONDITION`, que es
     * literalmente lo que hace Firestore: **no degrada la consulta, la rechaza**.
     *
     * Hace falta porque la ventana peligrosa de un índice nuevo es real —el
     * código llega a producción con cada merge y la construcción del índice tarda
     * de minutos a horas— y sin poder reproducirla no se puede probar que la
     * pantalla sobreviva. Es el par de `conRespaldoSinIndice`.
     */
    indiceAusenteSobre?: string
  }
}

/** Estado nuevo, listo para `vi.hoisted`. */
export function estadoDoble(): EstadoDoble {
  return {
    docs: new Map<string, Datos>(),
    contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
    fallos: { collectionGroup: false, lectura: false, lecturaEn: '' },
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
      /**
       * `in` — hasta P1-14 este doble lo rechazaba, así que la única consulta
       * grande que lo usa (el worklist, `where('estado','in',[…])`) no se podía
       * probar contra él y se probaba contra un muñeco que no filtraba nada.
       *
       * Como en Firestore: es una IGUALDAD contra cualquiera de la lista, y un
       * documento sin el campo no entra (lo cubre el `v === undefined` de
       * arriba).
       */
      case 'in': return Array.isArray(c) && c.some(x => x === v)
      case 'not-in': return Array.isArray(c) && !c.some(x => x === v)
      default: throw new Error(`operador no soportado en el doble: ${op}`)
    }
  }

  const envolver = (f: Fila) => ({
    id: f.id,
    /**
     * El `ref` de un documento de consulta lleva `ruta` **y** `path`.
     *
     * `doc(db, …)` produce `{ ruta }` y el SDK real expone `.path`; media
     * aplicación pasa el `d.ref` de una consulta a un `batch.delete(...)`. Con
     * sólo `path`, el lote no sabía qué borrar y **no borraba nada en silencio**
     * — un borrado en cascada podía no borrar ni una cita y la prueba pasaba.
     */
    ref: { path: f.ruta, ruta: f.ruta },
    exists: () => true,
    data: () => f.data,
  })

  /** Filtra y ordena, sin contar ni aplicar `limit`. Lo comparten `getDocs` y el conteo. */
  const resolver = (q: { tipo: string; ref?: unknown; cs?: Restriccion[] }): Fila[] => {
    const ref0 = (q.tipo === 'query' ? q.ref : q) as { tipo: string; ruta?: string; id?: string }
    if (h.fallos.lectura) throw new Error('UNAVAILABLE: lectura caída (doble)')
    if (h.fallos.lecturaEn && String(ref0.ruta ?? ref0.id ?? '').includes(h.fallos.lecturaEn)) {
      throw new Error(`UNAVAILABLE: lectura caída en ${h.fallos.lecturaEn} (doble)`)
    }
    const ref = ref0
    const cs = (q.tipo === 'query' ? q.cs : []) as Restriccion[]
    if (ref.tipo === 'grupo' && h.fallos.collectionGroup) {
      throw new Error('FAILED_PRECONDITION: the query requires an index')
    }
    const ordenes = cs.filter(c => c.t === 'orderBy') as Extract<Restriccion, { t: 'orderBy' }>[]
    if (h.fallos.indiceAusenteSobre && ordenes.some(o => o.campo === h.fallos.indiceAusenteSobre)) {
      /* Con el `code` del SDK de cliente, no sólo el texto: quien lo reconozca
         tiene que reconocer lo que manda Firestore de verdad. */
      throw Object.assign(
        new Error('The query requires an index. You can create it here: https://console.firebase.google.com/…'),
        { code: 'failed-precondition' },
      )
    }
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
    /**
     * `writeBatch` DE VERDAD — aplica lo acumulado al commitear.
     *
     * Era un muñeco: `{ set(){}, update(){}, delete(){}, commit: async()=>{} }`.
     * Con él, **cualquier prueba que afirmara sobre una escritura pasaba
     * vacíamente**: el borrado en cascada de un expediente podía no borrar nada y
     * el doble decía que sí. Es «el dato tiene que LLEGAR» dentro del arnés.
     */
    writeBatch: () => {
      const ops: Array<{ t: 'set' | 'update' | 'delete'; ruta: string; datos?: Datos; merge?: boolean }> = []
      /** Un ref puede venir de `doc(db,…)` (`ruta`) o de una consulta (`path`). */
      type Ref = { ruta?: string; path?: string }
      const rutaDe = (ref: Ref): string => {
        const r = ref?.ruta ?? ref?.path
        // Un lote que no sabe qué escribir no puede callarse: lo que sigue sería
        // un borrado que no borra y una prueba en verde.
        if (!r) throw new Error('writeBatch: referencia sin ruta (doble)')
        return r
      }
      return {
        set(ref: Ref, datos: Datos, opciones?: { merge?: boolean }) {
          ops.push({ t: 'set', ruta: rutaDe(ref), datos, merge: opciones?.merge === true }); return this
        },
        update(ref: Ref, datos: Datos) {
          ops.push({ t: 'update', ruta: rutaDe(ref), datos }); return this
        },
        delete(ref: Ref) { ops.push({ t: 'delete', ruta: rutaDe(ref) }); return this },
        async commit() {
          for (const o of ops) {
            if (o.t === 'delete') { h.docs.delete(o.ruta); continue }
            const previo = o.t === 'update' || o.merge ? (h.docs.get(o.ruta) ?? {}) : {}
            h.docs.set(o.ruta, { ...previo, ...(o.datos ?? {}) })
          }
          ops.length = 0
        },
      }
    },
    addDoc: async (ref: { ruta: string }, datos: Datos) => {
      const id = `auto-${h.docs.size + 1}`
      h.docs.set(`${ref.ruta}/${id}`, { ...datos })
      return { id }
    },
    setDoc: async (ref: { ruta: string }, datos: Datos, opciones?: { merge?: boolean }) => {
      const previo = opciones?.merge ? (h.docs.get(ref.ruta) ?? {}) : {}
      h.docs.set(ref.ruta, { ...previo, ...datos })
    },
    updateDoc: async (ref: { ruta: string }, datos: Datos) => {
      h.docs.set(ref.ruta, { ...(h.docs.get(ref.ruta) ?? {}), ...datos })
    },
    deleteDoc: async (ref: { ruta: string }) => { h.docs.delete(ref.ruta) },

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
