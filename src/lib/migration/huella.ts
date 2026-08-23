/**
 * IDEMPOTENCIA — que reintentar no duplique.
 *
 * ── EL FALLO QUE ESTO IMPIDE ─────────────────────────────────────────────────
 *
 * Importar 12 000 pacientes tarda minutos. En esos minutos pasa de todo: se va
 * la red, se cierra la pestaña, el servidor reinicia, el médico le da otra vez
 * al botón porque «no se ve que esté haciendo nada». Sin idempotencia, cada una
 * de esas cosas duplica el consultorio entero — y un duplicado no se ve como un
 * error, se ve como un paciente más.
 *
 * El caso peor no es el reintento evidente. Es el **tiempo de espera agotado
 * DESPUÉS de que la escritura entró**: el cliente ve un fallo, reintenta, y la
 * base ya tenía el dato. Ese camino no lo cubre ningún reintento «con cuidado»;
 * sólo lo cubre una llave que ya esté ocupada.
 *
 * ── LAS CUATRO IDENTIDADES, Y POR QUÉ SON CUATRO ─────────────────────────────
 *
 *  · `importJobId`   — este archivo, subido por esta persona, esta vez.
 *  · `batchId`       — un trozo del trabajo. Reanudar es saltarse los completos.
 *  · `fingerprint`   — el CONTENIDO de una fila. Igual en dos archivos distintos.
 *  · `idempotencyKey`— fila + trabajo. Es la llave del documento que se escribe.
 *
 * La distinción entre las dos últimas es lo que hace que funcione. La huella
 * detecta que la MISMA fila viene dos veces; la llave impide que la misma fila
 * se ESCRIBA dos veces. Si sólo hubiera huella, el mismo archivo subido dos
 * veces a propósito —que a veces es lo que el médico quiere, para completar una
 * importación a medias— no tendría forma de continuar sin duplicar.
 *
 * ── POR QUÉ LA HUELLA SE CALCULA SOBRE LO NORMALIZADO ────────────────────────
 *
 * Sobre el texto crudo, `  JUAN  PÉREZ ` y `Juan Pérez` son dos filas distintas
 * y el mismo paciente entra dos veces. Sobre lo normalizado son la misma, que es
 * lo que un ser humano diría mirándolas.
 *
 * Módulo PURO salvo por el SHA-256 de la plataforma (`crypto.subtle`), que ya
 * usa el sello de integridad de las notas: una sola forma de hacer huellas en
 * todo el repositorio.
 */
import { sha256Hex } from '@/lib/expediente/integrity'

/** Longitud a la que se recortan las huellas. */
const LARGO_HUELLA = 32

/**
 * Serialización ESTABLE de los campos de una fila.
 *
 * Claves ordenadas y vacíos fuera. Sin el orden, dos filas idénticas cuyos
 * campos llegaron en distinto orden dan huellas distintas — y el orden de las
 * claves de un objeto NO es algo en lo que se pueda confiar cuando el dato ha
 * dado una vuelta por Firestore.
 *
 * El vacío se omite en vez de escribirse como `""` para que «sin correo» y
 * «correo vacío» sean la misma cosa: en un CSV lo son.
 */
export function serializarEstable(campos: Readonly<Record<string, string | undefined>>): string {
  const claves = Object.keys(campos).filter(k => (campos[k] ?? '') !== '').sort()
  return claves.map(k => `${k}=${campos[k]}`).join('')
}

/**
 * La huella del CONTENIDO de una fila de origen.
 *
 * No incluye el trabajo de importación ni el número de fila: la misma persona
 * exportada dos veces desde el mismo sistema tiene que dar la misma huella
 * aunque cambie de posición en el archivo. Eso es justo lo que permite detectar
 * «esto ya lo importaste el mes pasado».
 */
export async function huellaDeFila(
  campos: Readonly<Record<string, string | undefined>>,
): Promise<string> {
  const h = await sha256Hex(serializarEstable(campos))
  return h.slice(0, LARGO_HUELLA)
}

/**
 * La huella del ARCHIVO. Identifica «este archivo, byte por byte».
 *
 * Es lo que permite decir «este archivo ya lo subiste» antes de procesar nada, y
 * lo que ata el informe a un archivo concreto meses después. Va a la bitácora:
 * no lleva PHI —es un hash— y sin él un asiento de auditoría no puede señalar
 * cuál de las cinco importaciones de aquel mes fue.
 */
export async function huellaDeArchivo(contenido: string): Promise<string> {
  return sha256Hex(contenido)
}

/**
 * El identificador del trabajo de importación.
 *
 * DERIVADO, no aleatorio: mismo archivo + mismo consultorio + mismo mapeo +
 * misma marca de tiempo declarada → mismo id. Un id aleatorio haría que el
 * reintento de la propia CREACIÓN del trabajo abriera un trabajo nuevo, y ahí se
 * pierde la idempotencia antes de haber escrito una sola fila.
 *
 * `iniciadoEn` entra en la mezcla a propósito: dos importaciones deliberadas del
 * mismo archivo (por ejemplo, para completar una que quedó a medias con otro
 * mapeo) tienen que poder coexistir. Es el llamador quien decide si reutiliza la
 * marca —y por tanto reanuda— o pone una nueva —y por tanto empieza otro.
 */
export async function idDeTrabajo(args: {
  readonly clinicId: string
  readonly huellaArchivo: string
  readonly huellaMapeo: string
  readonly iniciadoEn: string
}): Promise<string> {
  const h = await sha256Hex(
    [args.clinicId, args.huellaArchivo, args.huellaMapeo, args.iniciadoEn].join(''),
  )
  return `imp_${h.slice(0, 24)}`
}

/**
 * LA LLAVE DEL DOCUMENTO. Ésta es la que impide el duplicado.
 *
 * Se usa como **id de documento**, no como campo: `set()` sobre un id que ya
 * existe es idempotente por construcción, mientras que `add()` más una
 * comprobación previa tiene una carrera en medio. La diferencia importa
 * exactamente en el caso que más duele — dos reintentos a la vez.
 *
 * Incluye `importJobId` para que dos trabajos distintos sobre el mismo archivo
 * no se pisen las escrituras, y `fingerprint` para que dentro de un trabajo la
 * misma fila caiga siempre en el mismo sitio, esté en el lote que esté.
 */
export function llaveIdempotente(importJobId: string, huellaFila: string): string {
  return `${importJobId}__${huellaFila}`
}

/**
 * El id de un lote. Derivado del trabajo y del número de lote.
 *
 * Derivado y no correlativo-en-memoria: al reanudar tras un reinicio no hay
 * memoria, y el lote 37 tiene que seguir llamándose igual que antes de caerse o
 * el punto de control no sirve para nada.
 */
export function idDeLote(importJobId: string, numero: number): string {
  return `${importJobId}__lote_${String(numero).padStart(6, '0')}`
}

/**
 * LO QUE HAY QUE RECORDAR DE UN ARCHIVO ENTERO, Y NADA MÁS.
 *
 * ── POR QUÉ ES UN ACUMULADOR Y NO DOS FUNCIONES SOBRE ARREGLOS ───────────────
 *
 * Dos preguntas del ensayo no se pueden contestar mirando una fila sola:
 *
 *  · «¿esta fila repite otra?» — hay que saber si su huella salió antes;
 *  · «¿este id de origen se contradice?» — la fila 5 puede colisionar con la
 *    40 000, así que su veredicto no se puede dictar hasta haber visto el final.
 *
 * Lo que hace falta guardar para contestarlas es **una huella de 32 caracteres
 * por fila distinta**, no la fila. Con este acumulador el ensayo puede leer el
 * archivo por trozos y soltarlos: lo que sobrevive al trozo es esto, que es
 * pequeño y acotado por el número de filas DISTINTAS, no por su contenido.
 *
 * Las dos funciones de abajo se construyen encima para no tener dos definiciones
 * de «primera aparición» — una para el caso pequeño y otra para el grande.
 */
export class RegistroDeHuellas {
  private readonly primeras = new Map<string, number>()
  private readonly huellaPorId = new Map<string, string>()
  private readonly enColision = new Set<string>()

  /**
   * Anota una fila ya resumida.
   *
   * `posicion` es la dirección estable de la fila —el ensayo usa `sourceRow`—
   * porque el informe tiene que poder decir «la fila 4 812 repite la 37». «Es un
   * duplicado» a secas obliga al médico a buscar a mano en cincuenta mil filas.
   */
  ver(huella: string, posicion: number, sourceRecordId?: string): void {
    if (!this.primeras.has(huella)) this.primeras.set(huella, posicion)
    if (!sourceRecordId) return
    const previa = this.huellaPorId.get(sourceRecordId)
    if (previa === undefined) this.huellaPorId.set(sourceRecordId, huella)
    else if (previa !== huella) this.enColision.add(sourceRecordId)
  }

  /** Dónde salió por primera vez esta huella. `undefined` = no se ha visto. */
  primeraDe(huella: string): number | undefined {
    return this.primeras.get(huella)
  }

  /** ¿ESTA es la aparición buena? Sólo la primera puede aceptarse. */
  esPrimera(huella: string, posicion: number): boolean {
    return this.primeras.get(huella) === posicion
  }

  /**
   * ¿Este id de origen aparece con contenidos distintos?
   *
   * Si el archivo trae su propia columna de identificador —lo normal en un
   * export de otro sistema— dos filas con el MISMO id y CONTENIDO DISTINTO son
   * un problema del archivo: alguien editó el export a mano, o el sistema de
   * origen reutiliza ids. Fundirlas escogería una de las dos al azar, así que
   * van a cuarentena con `SOURCE_ID_COLLISION`.
   */
  colisionDeIdOrigen(sourceRecordId?: string): boolean {
    return sourceRecordId !== undefined && this.enColision.has(sourceRecordId)
  }

  /** Cuántas huellas distintas se están reteniendo. Es la memoria del ensayo. */
  get huellasDistintas(): number {
    return this.primeras.size
  }

  /** Copia del mapa huella → primera posición. */
  primerasApariciones(): Map<string, number> {
    return new Map(this.primeras)
  }

  /** Copia del conjunto de ids en conflicto. */
  idsEnColision(): Set<string> {
    return new Set(this.enColision)
  }
}

/**
 * Filas repetidas DENTRO del archivo.
 *
 * No se resuelve aquí (eso lo decide `emparejamiento.ts`): sólo se cuenta cuál
 * es la primera aparición de cada huella. La primera es la que puede aceptarse;
 * las demás son `DUPLICATE_IN_SOURCE`.
 *
 * Se devuelve un mapa huella → primer índice, no un booleano por fila, porque el
 * informe tiene que poder decir «la fila 4 812 repite la 37» — «es un duplicado»
 * a secas obliga al médico a buscar a mano en cincuenta mil filas.
 */
export function primeraAparicion(huellas: readonly string[]): Map<string, number> {
  const r = new RegistroDeHuellas()
  huellas.forEach((h, i) => r.ver(h, i))
  return r.primerasApariciones()
}

/**
 * IDs de origen que colisionan.
 *
 * Se devuelven los ids en conflicto para que las filas afectadas vayan a
 * cuarentena con `SOURCE_ID_COLLISION`.
 */
export function colisionesDeIdOrigen(
  filas: readonly { readonly sourceRecordId?: string; readonly huella: string }[],
): Set<string> {
  const r = new RegistroDeHuellas()
  filas.forEach((f, i) => r.ver(f.huella, i, f.sourceRecordId))
  return r.idsEnColision()
}
