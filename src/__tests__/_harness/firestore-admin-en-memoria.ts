/**
 * FIRESTORE (Admin SDK) EN MEMORIA — con concurrencia optimista de verdad.
 *
 * POR QUE EXISTE
 *
 * Las rutas de `/api` escriben con el Admin SDK, que no tiene emulador dentro del
 * gate rapido. Hasta ahora eso obligaba a probarlas leyendo su fuente como texto
 * y afirmando sobre substrings: eso comprueba que el codigo DIGA lo acordado, no
 * que la base acabe con un solo documento cuando la misma peticion llega dos
 * veces. Y esa diferencia es justo el Golden Path 9.
 *
 * QUE REPRODUCE, Y POR QUE ESO IMPORTA
 *
 * Lo unico que hace falta para que la prueba signifique algo es la semantica de
 * la transaccion, y esta implementada tal cual:
 *
 *   - una `tx.get()` FIJA la version de lo leido (documento o coleccion);
 *   - las escrituras se acumulan y se aplican al commit;
 *   - si algo de lo leido cambio de version antes del commit, la transaccion se
 *     ABORTA y se REEJECUTA desde cero — que es como el perdedor de una carrera
 *     vuelve a leer y ve lo que escribio el ganador.
 *
 * Sin la reejecucion, un doble no prueba nada: dos transacciones "concurrentes"
 * commitearian las dos y el test saldria verde con el defecto vivo. Por eso el
 * contador de reejecuciones es observable (`vecesReejecutada`): una prueba de
 * concurrencia que nunca reejecuto no probo concurrencia.
 *
 * QUE NO ES
 *
 * No es Firestore. No valida reglas de seguridad, no impone tipos de campo ni
 * limites de documento, y sus queries entienden `where` (igualdad, `in` y rangos
 * de CADENA, que es lo que usan las rutas bajo prueba), `orderBy` -con la
 * exclusion de los documentos a los que les falta el campo, igual que Firestore-
 * y `limit`. Todo lo que dependa de las REGLAS se prueba contra el emulador
 * (`emulator/*.emu.test.ts`), no aqui.
 */

type Datos = Record<string, unknown>

interface Celda {
  datos: Datos
  version: number
}

export interface OpcionesTienda {
  /**
   * Se llama justo ANTES de aplicar las escrituras de una transaccion. Es el
   * unico modo honesto de meter una escritura ajena EN MEDIO de otra y forzar la
   * carrera que en produccion ocurre sola.
   */
  alCommitear?: (intento: number) => void | Promise<void>
  /**
   * Se llama justo DESPUES de resolver una lectura en bloque (`getAll`), tanto
   * la suelta como la de dentro de una transaccion.
   *
   * POR QUE HACE FALTA UN GANCHO EN LA LECTURA Y NO EN LA ESCRITURA
   *
   * La carrera que hay que reproducir es «lei que estaba libre, y para cuando
   * escribi ya no lo estaba». Un gancho colgado del mecanismo de ESCRITURA sirve
   * para una implementacion y deja de dispararse en cuanto esa implementacion
   * cambia — asi que la misma prueba no puede fallar antes del arreglo y pasar
   * despues, que es lo unico que la hace prueba.
   *
   * Colgado de la LECTURA, el gancho mete al competidor en el hueco exacto que
   * define el defecto, y sigue metiendolo se escriba luego con lote o con
   * transaccion.
   */
  trasLeerEnBloque?: (rutas: string[]) => void | Promise<void>
}

export class TiendaEnMemoria {
  private docs = new Map<string, Celda>()
  /** Version por coleccion: una alta invalida las queries que la leyeron. */
  private colecciones = new Map<string, number>()
  private reloj = 0
  /** Cuantas veces se tuvo que REEJECUTAR una transaccion por conflicto. */
  vecesReejecutada = 0

  constructor(private opciones: OpcionesTienda = {}) {}

  private rutaColeccion(ruta: string): string {
    return ruta.slice(0, ruta.lastIndexOf('/'))
  }

  /** Escritura directa, fuera de transaccion (siembra y escrituras ajenas). */
  poner(ruta: string, datos: Datos): void {
    this.reloj += 1
    const previa = this.docs.get(ruta)
    this.docs.set(ruta, { datos: previa ? { ...previa.datos, ...datos } : { ...datos }, version: this.reloj })
    this.colecciones.set(this.rutaColeccion(ruta), this.reloj)
  }

  obtener(ruta: string): Datos | undefined {
    return this.docs.get(ruta)?.datos
  }

  /** Borrado directo, fuera de transaccion. Idempotente: borrar lo que no esta no falla. */
  borrar(ruta: string): void {
    this.reloj += 1
    this.docs.delete(ruta)
    this.colecciones.set(this.rutaColeccion(ruta), this.reloj)
  }

  /** Todos los documentos de una coleccion, en orden de insercion. */
  listar(ruta: string): Array<{ id: string; datos: Datos }> {
    return [...this.docs.entries()]
      .filter(([r]) => this.rutaColeccion(r) === ruta)
      .map(([r, c]) => ({ id: r.slice(r.lastIndexOf('/') + 1), datos: c.datos }))
  }

  cuantos(ruta: string): number {
    return this.listar(ruta).length
  }

  versionDoc(ruta: string): number {
    return this.docs.get(ruta)?.version ?? 0
  }

  versionColeccion(ruta: string): number {
    return this.colecciones.get(ruta) ?? 0
  }

  nuevoId(): string {
    this.reloj += 1
    return `auto-${this.reloj.toString(36)}`
  }

  get intercepcion(): OpcionesTienda {
    return this.opciones
  }
}

interface Filtro { campo: string; op: string; valor: unknown }

function pasa(datos: Datos, f: Filtro): boolean {
  const v = datos[f.campo]
  if (f.op === '==') return v === f.valor
  if (f.op === '>=') return String(v) >= String(f.valor)
  if (f.op === '<=') return String(v) <= String(f.valor)
  /**
   * `in` con la MISMA semantica que Firestore: pertenencia por igualdad
   * estricta, no coercion. Hace falta porque la busqueda de expediente por
   * telefono manda varios formatos a la vez (10 digitos, con lada, con el 1 de
   * movil), y sin este operador esa consulta lanzaba, el llamador se lo tragaba
   * en su try/catch y la cita salia SIN paciente — o sea, la prueba pasaba por
   * el camino de error y no por el que corre en produccion.
   */
  if (f.op === 'in') return Array.isArray(f.valor) && f.valor.some(x => x === v)
  throw new Error(`Operador no soportado por la tienda en memoria: ${f.op}`)
}

interface Orden { campo: string; dir: 'asc' | 'desc' }

class Consulta {
  constructor(
    readonly tienda: TiendaEnMemoria,
    readonly ruta: string,
    readonly filtros: Filtro[] = [],
    readonly tope: number | null = null,
    readonly ordenes: Orden[] = [],
  ) {}

  where(campo: string, op: string, valor: unknown): Consulta {
    return new Consulta(this.tienda, this.ruta, [...this.filtros, { campo, op, valor }], this.tope, this.ordenes)
  }

  /**
   * `orderBy(campo, dir)` — y con las DOS mitades de lo que Firestore hace.
   *
   * La primera es la obvia: ordenar. La segunda es la que se olvida y la que
   * decide si una consulta pierde pacientes — **un documento al que le falta el
   * campo del `orderBy` no se ordena el ultimo: NO SALE**. Firestore no puede
   * colocar en un indice lo que no tiene valor para esa columna.
   *
   * Esta mitad esta aqui a proposito, aunque hoy ninguna consulta de la
   * aplicacion dependa de ella: es la trampa de `ofrecer-hueco` (una entrada de
   * lista sin `prioridad` desapareceria de la lectura sin que nada lo dijera) y
   * la de `useAppointments` (una cita sin `fechaHora`). Un doble que ordenara
   * poniendo los huecos al final haria pasar una prueba que en produccion
   * pierde a un paciente.
   */
  orderBy(campo: string, dir: 'asc' | 'desc' = 'asc'): Consulta {
    return new Consulta(this.tienda, this.ruta, this.filtros, this.tope, [...this.ordenes, { campo, dir }])
  }

  /**
   * `limit(n)`. NO es adorno: se recorta DESPUES de filtrar y de ordenar. Sin
   * `orderBy` el recorte va en orden de insercion, que es lo unico que esta
   * tienda puede prometer: una ruta que dependa del orden real de un indice de
   * Firestore y no lo pida con `orderBy` no se puede probar aqui, y eso hay que
   * saberlo antes de escribir la asercion.
   */
  limit(n: number): Consulta {
    return new Consulta(this.tienda, this.ruta, this.filtros, n, this.ordenes)
  }

  /**
   * `get()` vive en Consulta y NO en RefColeccion a proposito: `where()` y
   * `limit()` devuelven una Consulta, asi que si `get()` estuviera solo en la
   * coleccion, `col.where(...).limit(1).get()` -que es lo que escribe media
   * aplicacion- reventaria con «no es una funcion». Aqui lo heredan las dos.
   */
  async get(): Promise<{ docs: Array<{ id: string; data: () => Datos; ref: RefDoc }>; size: number; empty: boolean }> {
    const todos = this.tienda.listar(this.ruta).map(d => ({
      id: d.id,
      datos: d.datos,
      data: () => d.datos,
      /**
       * `ref` NO es decoracion: media aplicacion escribe con `d.ref.update(...)`
       * sobre el resultado de una consulta. Sin el, esa escritura lanzaba, el
       * llamador se lo tragaba en su try/catch y la prueba veia el documento sin
       * cambiar — o sea, denunciaba un defecto del producto que era del doble.
       */
      ref: new RefDoc(this.tienda, `${this.ruta}/${d.id}`),
    }))
      .filter(d => this.filtros.every(f => pasa(d.datos, f)))
      /* Firestore EXCLUYE lo que no tiene el campo por el que se ordena. */
      .filter(d => this.ordenes.every(o => d.datos[o.campo] !== undefined && d.datos[o.campo] !== null))
      .sort((a, b) => {
        for (const o of this.ordenes) {
          const va = a.datos[o.campo] as string | number
          const vb = b.datos[o.campo] as string | number
          if (va === vb) continue
          const cmp = va < vb ? -1 : 1
          return o.dir === 'desc' ? -cmp : cmp
        }
        return 0
      })
    const docs = this.tope === null ? todos : todos.slice(0, this.tope)
    return { docs, size: docs.length, empty: docs.length === 0 }
  }
}

class RefDoc {
  constructor(readonly tienda: TiendaEnMemoria, readonly ruta: string) {}

  get id(): string {
    return this.ruta.slice(this.ruta.lastIndexOf('/') + 1)
  }

  collection(nombre: string): RefColeccion {
    return new RefColeccion(this.tienda, `${this.ruta}/${nombre}`)
  }

  async get(): Promise<{ exists: boolean; id: string; data: () => Datos | undefined }> {
    const d = this.tienda.obtener(this.ruta)
    return { exists: d !== undefined, id: this.id, data: () => d }
  }

  /**
   * Escritura DIRECTA (fuera de transaccion), como la del Admin SDK.
   *
   * Sin `merge` reemplaza el documento entero; con `merge: true` funde. La
   * diferencia importa: media aplicacion escribe con merge para no pisar campos
   * que no conoce, y una tienda que siempre fundiera dejaria pasar el defecto de
   * quien olvido el merge.
   */
  async set(datos: Datos, opciones?: { merge?: boolean }): Promise<void> {
    if (opciones?.merge !== true) this.tienda.borrar(this.ruta)
    this.tienda.poner(this.ruta, datos)
  }

  /** `update` del Admin SDK: funde, y FALLA si el documento no existe. */
  async update(datos: Datos): Promise<void> {
    if (this.tienda.obtener(this.ruta) === undefined) {
      const e = new Error(`NOT_FOUND: no such document ${this.ruta}`) as Error & { code: number }
      e.code = 5
      throw e
    }
    this.tienda.poner(this.ruta, datos)
  }

  /** `create` del Admin SDK: FALLA con ALREADY_EXISTS si ya existe (dedup). */
  async create(datos: Datos): Promise<void> {
    if (this.tienda.obtener(this.ruta) !== undefined) {
      const e = new Error(`ALREADY_EXISTS: ${this.ruta}`) as Error & { code: number }
      e.code = 6
      throw e
    }
    this.tienda.poner(this.ruta, datos)
  }

  async delete(): Promise<void> {
    this.tienda.borrar(this.ruta)
  }
}

class RefColeccion extends Consulta {
  doc(id?: string): RefDoc {
    return new RefDoc(this.tienda, `${this.ruta}/${id ?? this.tienda.nuevoId()}`)
  }

  async add(datos: Datos): Promise<RefDoc> {
    const ref = this.doc()
    this.tienda.poner(ref.ruta, datos)
    return ref
  }

}

/** Conflicto interno: obliga a reejecutar la transaccion. */
const CONFLICTO_TX = Symbol('conflicto-tx')

class Transaccion {
  private leidosDoc = new Map<string, number>()
  private leidasCol = new Map<string, number>()
  private escrituras: Array<{ ruta: string; datos: Datos; merge: boolean }> = []

  constructor(private tienda: TiendaEnMemoria) {}

  async get(refOConsulta: RefDoc | Consulta): Promise<never | Record<string, unknown>> {
    if (refOConsulta instanceof RefDoc) {
      const ref = refOConsulta
      this.leidosDoc.set(ref.ruta, this.tienda.versionDoc(ref.ruta))
      const d = this.tienda.obtener(ref.ruta)
      return { exists: d !== undefined, id: ref.id, data: () => d } as unknown as Record<string, unknown>
    }
    const q = refOConsulta
    this.leidasCol.set(q.ruta, this.tienda.versionColeccion(q.ruta))
    const todosTx = this.tienda.listar(q.ruta)
      .filter(d => q.filtros.every(f => pasa(d.datos, f)))
      .map(d => ({ id: d.id, data: () => d.datos }))
    const docs = q.tope === null ? todosTx : todosTx.slice(0, q.tope)
    return {
      docs,
      size: docs.length,
      forEach: (fn: (d: { id: string; data: () => Datos }) => void) => docs.forEach(fn),
    } as unknown as Record<string, unknown>
  }

  /**
   * `tx.getAll` — lee varios documentos FIJANDO la version de cada uno. Si
   * cualquiera cambia antes del commit, la transaccion se reejecuta. Es la
   * diferencia entera entre «mire antes de escribir» y «mire, y ademas eso
   * seguia siendo verdad cuando escribi».
   */
  async getAll(...refs: RefDoc[]): Promise<Array<{ exists: boolean; id: string; data: () => Datos | undefined }>> {
    const salida = refs.map(ref => {
      this.leidosDoc.set(ref.ruta, this.tienda.versionDoc(ref.ruta))
      const d = this.tienda.obtener(ref.ruta)
      return { exists: d !== undefined, id: ref.id, data: () => d }
    })
    await this.tienda.intercepcion.trasLeerEnBloque?.(refs.map(r => r.ruta))
    return salida
  }

  set(ref: RefDoc, datos: Datos, opciones?: { merge?: boolean }): void {
    this.escrituras.push({ ruta: ref.ruta, datos, merge: opciones?.merge === true })
  }

  update(ref: RefDoc, datos: Datos): void {
    this.escrituras.push({ ruta: ref.ruta, datos, merge: true })
  }

  /** @returns `false` si hubo conflicto y hay que reejecutar. */
  intentarCommit(): boolean {
    for (const [ruta, v] of this.leidosDoc) if (this.tienda.versionDoc(ruta) !== v) return false
    for (const [ruta, v] of this.leidasCol) if (this.tienda.versionColeccion(ruta) !== v) return false
    for (const w of this.escrituras) {
      if (w.merge) this.tienda.poner(w.ruta, w.datos)
      else {
        // `set` sin merge REEMPLAZA: se borra lo previo antes de escribir.
        const previo = this.tienda.obtener(w.ruta)
        if (previo) for (const k of Object.keys(previo)) delete previo[k]
        this.tienda.poner(w.ruta, w.datos)
      }
    }
    return true
  }
}

/**
 * `WriteBatch` del Admin SDK: acumula escrituras y las aplica de golpe.
 *
 * NO es una transaccion, y esa diferencia es justo lo que una prueba de carrera
 * tiene que poder ver: un lote **no vuelve a mirar** lo que alguien leyo antes
 * de meterlo, asi que escribe aunque el mundo haya cambiado desde la lectura.
 */
class Lote {
  private escrituras: Array<{ ruta: string; datos: Datos; merge: boolean }> = []

  constructor(private tienda: TiendaEnMemoria) {}

  set(ref: RefDoc, datos: Datos, opciones?: { merge?: boolean }): Lote {
    this.escrituras.push({ ruta: ref.ruta, datos, merge: opciones?.merge === true })
    return this
  }

  async commit(): Promise<void> {
    for (const w of this.escrituras) {
      if (!w.merge) this.tienda.borrar(w.ruta)
      this.tienda.poner(w.ruta, w.datos)
    }
    this.escrituras = []
  }
}

export interface AdminDbFalso {
  collection(nombre: string): RefColeccion
  doc(ruta: string): RefDoc
  getAll(...refs: RefDoc[]): Promise<Array<{ exists: boolean; id: string; data: () => Datos | undefined }>>
  batch(): Lote
  runTransaction<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T>
}

/** Construye el `adminDb` falso sobre una tienda. */
export function adminDbSobre(tienda: TiendaEnMemoria): AdminDbFalso {
  return {
    collection: (nombre: string) => new RefColeccion(tienda, nombre),
    doc: (ruta: string) => new RefDoc(tienda, ruta),
    batch: () => new Lote(tienda),
    /**
     * `getAll` SUELTO: lee y devuelve, sin fijar version de nada. Quien escriba
     * despues de esto lo hace sobre una foto que ya puede estar vieja — que es
     * exactamente lo que ocurre en produccion.
     */
    async getAll(...refs: RefDoc[]) {
      const salida = refs.map(r => {
        const d = tienda.obtener(r.ruta)
        return { exists: d !== undefined, id: r.id, data: () => d }
      })
      await tienda.intercepcion.trasLeerEnBloque?.(refs.map(r => r.ruta))
      return salida
    },
    async runTransaction<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T> {
      for (let intento = 0; intento < 10; intento++) {
        const tx = new Transaccion(tienda)
        let resultado: T
        try {
          resultado = await fn(tx)
        } catch (e) {
          if (e === CONFLICTO_TX) continue
          throw e   // el error del llamador (p. ej. su centinela de conflicto) sube tal cual
        }
        await tienda.intercepcion.alCommitear?.(intento)
        if (tx.intentarCommit()) return resultado
        tienda.vecesReejecutada += 1
      }
      throw new Error('La transaccion no convergio tras 10 intentos.')
    },
  }
}
