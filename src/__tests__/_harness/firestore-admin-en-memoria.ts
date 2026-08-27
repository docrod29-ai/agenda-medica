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
 * limites de documento, y sus queries solo entienden `where` sobre igualdad y
 * rangos de cadena, que es lo que usa la ruta bajo prueba. Todo lo que dependa
 * de las REGLAS se prueba contra el emulador (`emulator/*.emu.test.ts`), no aqui.
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
  throw new Error(`Operador no soportado por la tienda en memoria: ${f.op}`)
}

class Consulta {
  constructor(
    readonly tienda: TiendaEnMemoria,
    readonly ruta: string,
    readonly filtros: Filtro[] = [],
  ) {}

  where(campo: string, op: string, valor: unknown): Consulta {
    return new Consulta(this.tienda, this.ruta, [...this.filtros, { campo, op, valor }])
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

  async get(): Promise<{ docs: Array<{ id: string; data: () => Datos }>; size: number }> {
    const docs = this.tienda.listar(this.ruta)
      .filter(d => this.filtros.every(f => pasa(d.datos, f)))
      .map(d => ({ id: d.id, data: () => d.datos }))
    return { docs, size: docs.length }
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
    const docs = this.tienda.listar(q.ruta)
      .filter(d => q.filtros.every(f => pasa(d.datos, f)))
      .map(d => ({ id: d.id, data: () => d.datos }))
    return {
      docs,
      size: docs.length,
      forEach: (fn: (d: { id: string; data: () => Datos }) => void) => docs.forEach(fn),
    } as unknown as Record<string, unknown>
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

export interface AdminDbFalso {
  collection(nombre: string): RefColeccion
  runTransaction<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T>
}

/** Construye el `adminDb` falso sobre una tienda. */
export function adminDbSobre(tienda: TiendaEnMemoria): AdminDbFalso {
  return {
    collection: (nombre: string) => new RefColeccion(tienda, nombre),
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
