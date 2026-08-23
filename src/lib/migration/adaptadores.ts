/**
 * DE DÓNDE SALEN LAS FILAS — un contrato, varios orígenes.
 *
 * ── POR QUÉ UN ADAPTADOR Y NO UN PARSER ──────────────────────────────────────
 *
 * Hoy el origen es un CSV. Mañana será el export de un sistema con su propio
 * formato, y pasado el respaldo NDJSON de la propia Ausculta. Si el resto de la
 * migración habla de «columnas de un CSV», cada origen nuevo obliga a tocar la
 * normalización, el emparejamiento y las cuentas — y ahí es donde aparecen las
 * tres versiones del mismo arreglo, dos de ellas mal.
 *
 * El resto del carril sólo conoce `FilaOrigen`: un mapa de nombre-de-columna a
 * texto, con su número de fila. Todo lo demás es asunto del adaptador.
 *
 * ── LO QUE NO SE HACE, Y NO ES UN OLVIDO ─────────────────────────────────────
 *
 *  · **No se raspa ningún sitio web.** Ni con la sesión del médico.
 *  · **No se inventa la API de nadie.** Un adaptador para un sistema concreto se
 *    escribe cuando haya una especificación publicada o un archivo de muestra
 *    real en la mano. Adivinar el formato de un competidor y estrenarlo con los
 *    pacientes de alguien es cómo se pierde un expediente entero.
 *  · **No se supone la forma de un export.** `export-estructurado` existe como
 *    hueco declarado, no como implementación a medias.
 *
 * Módulo PURO.
 */
import { filaConContenido, filasDeCsv } from '@/lib/csv-pacientes'
import type { Razon } from './contrato'

/* ═══════════════════════ LO QUE TODO ORIGEN PRODUCE ═══════════════════════ */

/** Una fila del archivo, ya separada en columnas pero SIN interpretar. */
export interface FilaOrigen {
  /** 1 = primera fila de datos. El encabezado no cuenta. */
  readonly sourceRow: number
  /** Encabezado → texto crudo. Nada normalizado todavía. */
  readonly campos: Readonly<Record<string, string>>
  /** El id que traía el propio archivo, si lo traía. */
  readonly sourceRecordId?: string
}

/** Una fila que ni siquiera se pudo separar en columnas. */
export interface FilaRota {
  readonly sourceRow: number
  readonly razon: Razon
  /** Cuántas columnas traía contra cuántas esperaba. Sin el contenido: puede ser PHI. */
  readonly detalle: Readonly<Record<string, number | string>>
}

export interface Lectura {
  readonly encabezados: readonly string[]
  readonly filas: readonly FilaOrigen[]
  /**
   * Las que no se pudieron leer. **Cuentan como filas de origen.**
   *
   * Es la parte que un parser normal se come. Si una fila rota simplemente
   * desaparece, `sourceRecords` sale más bajo de lo que era y la reconciliación
   * cuadra sobre un total falso: las cuentas dan, y aun así se perdieron filas.
   */
  readonly rotas: readonly FilaRota[]
  /** Filas de datos que traía el archivo = `filas.length + rotas.length`. */
  readonly sourceRecords: number
}

/* ═══════════════════════ LEER SIN SOSTENER EL ARCHIVO ═══════════════════════ */

/**
 * Un trozo de lectura: unas cuantas filas y las que se rompieron entre ellas.
 *
 * Las rotas viajan CON su trozo y no en una lista aparte al final. Si se
 * juntaran al final, la única forma de saber cuántas hubo sería haber leído el
 * archivo entero — y entonces el troceado no habría servido de nada.
 */
export interface Trozo {
  readonly filas: readonly FilaOrigen[]
  readonly rotas: readonly FilaRota[]
}

/**
 * El archivo leído POR TROZOS. Lo mismo que `Lectura`, sin tenerlo todo delante.
 *
 * `trozos` es **re-iterable**: cada recorrido vuelve a empezar por el principio.
 * De eso depende el ensayo, que da dos pasadas sobre el mismo archivo —una para
 * las huellas y otra para los veredictos— sin conservar entre las dos ni una
 * sola fila de origen.
 */
export interface LecturaPorTrozos {
  readonly encabezados: readonly string[]
  readonly trozos: Iterable<Trozo>
}

export interface AdaptadorOrigen {
  readonly id: string
  readonly nombre: string
  /** Extensiones que dice atender. Sólo informativo: no decide nada. */
  readonly extensiones: readonly string[]
  /** `false` = declarado pero no implementado. `leer` lanza en ese caso. */
  readonly disponible: boolean
  /** Por qué no está disponible. Se enseña al médico tal cual. */
  readonly porQueNo?: string
  leer(contenido: string): Lectura
  /**
   * Lo mismo que `leer`, pero entregando como mucho `porTrozo` filas a la vez.
   *
   * Es OBLIGATORIO en el contrato, no un extra opcional. Con un método opcional
   * y un respaldo a `leer`, un adaptador nuevo que se olvidara de implementarlo
   * volvería en silencio a sostener el archivo entero — y el defecto sólo se
   * vería el día de la importación grande, que es la que no se puede repetir.
   */
  leerPorTrozos(contenido: string, porTrozo: number): LecturaPorTrozos
}

/**
 * Junta todos los trozos en una `Lectura`. Deliberadamente NO acotado.
 *
 * Existe para quien de verdad quiere la tabla entera —una hoja pequeña, una
 * prueba— y para que `leer()` no sea una segunda implementación del análisis
 * del archivo: hay un solo camino de lectura y esto es su final.
 */
export function materializar(l: LecturaPorTrozos): Lectura {
  const filas: FilaOrigen[] = []
  const rotas: FilaRota[] = []
  for (const t of l.trozos) {
    // Sin `push(...spread)`: con cincuenta mil filas eso desborda la pila.
    for (const f of t.filas) filas.push(f)
    for (const r of t.rotas) rotas.push(r)
  }
  return { encabezados: l.encabezados, filas, rotas, sourceRecords: filas.length + rotas.length }
}

/* ═══════════════════════ CSV ═══════════════════════ */

/**
 * Un CSV separado en columnas.
 *
 * Reutiliza `parseCsv` de `csv-pacientes.ts`, que ya respeta comillas, comas
 * internas y saltos de línea dentro de campo — y que ya tiene sus pruebas. Lo
 * que se añade encima es la contabilidad: `parseCsv` descarta las filas
 * totalmente vacías y no dice cuántas descartó, que para una hoja de cálculo
 * está bien y para una migración no.
 */
/**
 * Los encabezados, sin leer el resto del archivo.
 *
 * El generador es perezoso: esto consume sólo hasta la primera fila con algo
 * dentro y suelta el resto. Poder saber las columnas antes de procesar nada es
 * lo que permite decidir el mapeo —y bloquear el trabajo si falta el nombre—
 * sin haber pagado una pasada completa.
 */
function encabezadosDeCsv(contenido: string): readonly string[] | null {
  for (const f of filasDeCsv(contenido)) {
    if (!filaConContenido(f)) continue
    // El BOM viaja pegado al primer encabezado y lo deja sin emparejar.
    return f.map((h, i) => (i === 0 && h.charCodeAt(0) === 0xfeff ? h.slice(1) : h).trim())
  }
  return null
}

function* trozosDeCsv(
  contenido: string,
  encabezados: readonly string[],
  porTrozo: number,
): Generator<Trozo> {
  let filas: FilaOrigen[] = []
  let rotas: FilaRota[] = []
  let sourceRow = 0
  let esEncabezado = true

  for (const cols of filasDeCsv(contenido)) {
    if (!filaConContenido(cols)) continue
    if (esEncabezado) { esEncabezado = false; continue }
    sourceRow++

    /**
     * MÁS COLUMNAS QUE EL ENCABEZADO = FILA ROTA.
     *
     * Casi siempre es una coma sin escapar dentro de un nombre («Pérez, Juan»
     * sin comillas). Si se ignoran las columnas de más, ese paciente entra con
     * el apellido en el campo del teléfono y el teléfono en el del correo:
     * un expediente que parece bueno y no lo es.
     *
     * Menos columnas sí se tolera: un CSV con la última columna vacía las
     * omite, y eso es normal y no cambia el significado de las que sí vinieron.
     */
    if (cols.length > encabezados.length) {
      rotas.push({
        sourceRow,
        razon: 'ROW_ARITY_MISMATCH',
        detalle: { columnas: cols.length, esperadas: encabezados.length },
      })
    } else {
      const campos: Record<string, string> = {}
      encabezados.forEach((h, j) => {
        // La columna sin encabezado se conserva bajo un nombre posicional. Perderla
        // porque su encabezado venía vacío es perder un dato por un detalle de forma.
        const clave = h === '' ? `columna_${j + 1}` : h
        campos[clave] = cols[j] ?? ''
      })
      filas.push({ sourceRow, campos })
    }

    if (filas.length + rotas.length >= porTrozo) {
      yield { filas, rotas }
      // Arreglos NUEVOS, no `length = 0`: quien recibió el trozo puede seguir
      // mirándolo mientras se prepara el siguiente, y vaciarlo se lo borraría
      // debajo. Soltar la referencia es lo que deja que el recolector se lo
      // lleve; reutilizar el arreglo es lo que impediría que se lo llevara.
      filas = []
      rotas = []
    }
  }
  if (filas.length > 0 || rotas.length > 0) yield { filas, rotas }
}

function leerCsvPorTrozos(contenido: string, porTrozo: number): LecturaPorTrozos {
  const encabezados = encabezadosDeCsv(contenido)
  if (encabezados === null) return { encabezados: [], trozos: [] }
  const tope = Math.max(1, Math.floor(porTrozo))
  return {
    encabezados,
    // Re-iterable a propósito: el ensayo recorre esto dos veces.
    trozos: { [Symbol.iterator]: () => trozosDeCsv(contenido, encabezados, tope) },
  }
}

export const ADAPTADOR_CSV: AdaptadorOrigen = {
  id: 'csv',
  nombre: 'CSV',
  extensiones: ['.csv', '.txt'],
  disponible: true,
  leerPorTrozos: leerCsvPorTrozos,
  leer(contenido: string): Lectura {
    // Un solo trozo con todo dentro. `leer` es, por definición, la lectura NO
    // acotada; lo que no puede ser es un segundo analizador con sus propias
    // reglas para las comillas y las filas rotas.
    return materializar(leerCsvPorTrozos(contenido, Number.MAX_SAFE_INTEGER))
  },
}

/* ═══════════════════════ XLSX ═══════════════════════ */

/**
 * XLSX — DECLARADO, NO IMPLEMENTADO. Y el hueco es deliberado.
 *
 * ── EL ESTADO REAL DEL REPOSITORIO ───────────────────────────────────────────
 *
 * `src/lib/xlsx.ts` es un ESCRITOR de libros hecho a mano, sin dependencias. No
 * hay lector. Un `.xlsx` es un ZIP con XML dentro, y leerlo exige un `inflate`
 * —los libros reales vienen comprimidos con DEFLATE, no con STORE— que no está
 * en el repositorio y que no se puede escribir a mano de forma responsable en
 * este carril.
 *
 * Añadir una librería de hoja de cálculo es una decisión del dueño: las del ramo
 * pesan megas, arrastran árboles de dependencias y han tenido su cuota de CVEs
 * —el propio `xlsx.ts` lo dice como razón para no usarlas al escribir—, y aquí
 * la superficie es peor, porque leer es procesar un archivo que llega de fuera.
 *
 * ── EL DEFECTO QUE ESTO DESTAPA ──────────────────────────────────────────────
 *
 * La pantalla de Migración dice hoy, literalmente, «Sube un CSV o Excel
 * exportado desde tu sistema actual». El selector de archivo acepta
 * `.csv,text/csv` y el lector hace `readAsText`. Un `.xlsx` arrastrado ahí se
 * lee como texto: sale el ZIP en binario, el parser no encuentra columnas y el
 * médico ve «El archivo no tiene filas de datos» con su archivo bueno delante.
 *
 * Está en el registro de riesgos como P1. Se arregla diciendo la verdad en la
 * pantalla —que es de #306— o implementando el lector, que es del dueño.
 */
export const ADAPTADOR_XLSX: AdaptadorOrigen = {
  id: 'xlsx',
  nombre: 'Excel (.xlsx)',
  extensiones: ['.xlsx', '.xlsm'],
  disponible: false,
  porQueNo:
    'Todavía no leemos archivos de Excel. Ábrelo en Excel o en Google Sheets y guárdalo como CSV (UTF-8): es el mismo contenido y lo importamos igual.',
  leer(): Lectura {
    throw new Error('migración: el adaptador de XLSX no está implementado — ver docs/migration/HANDOFF.md')
  },
  leerPorTrozos(): LecturaPorTrozos {
    throw new Error('migración: el adaptador de XLSX no está implementado — ver docs/migration/HANDOFF.md')
  },
}

/**
 * Export estructurado de un sistema concreto — HUECO DECLARADO.
 *
 * Existe para que el contrato esté escrito antes de que llegue el primer
 * archivo, no para fingir que ya se atiende. Cuando el dueño consiga un export
 * real de muestra, se implementa `leer` y se pone `disponible: true`; nada más
 * del carril cambia, que es justamente para lo que sirve el contrato.
 */
export const ADAPTADOR_ESTRUCTURADO: AdaptadorOrigen = {
  id: 'export-estructurado',
  nombre: 'Export de otro sistema',
  extensiones: ['.json', '.ndjson'],
  disponible: false,
  porQueNo:
    'Todavía no leemos exports de otros sistemas directamente. Mándanos un archivo de muestra y lo añadimos.',
  leer(): Lectura {
    throw new Error('migración: no hay adaptador para exports estructurados — hace falta una muestra real')
  },
  leerPorTrozos(): LecturaPorTrozos {
    throw new Error('migración: no hay adaptador para exports estructurados — hace falta una muestra real')
  },
}

export const ADAPTADORES: readonly AdaptadorOrigen[] = [
  ADAPTADOR_CSV, ADAPTADOR_XLSX, ADAPTADOR_ESTRUCTURADO,
]

/**
 * Qué adaptador atiende este archivo.
 *
 * Devuelve también los NO disponibles a propósito: el médico que sube un `.xlsx`
 * tiene que leer «todavía no leemos Excel, guárdalo como CSV», no «formato
 * desconocido». La primera frase le resuelve el problema en treinta segundos; la
 * segunda le hace escribir a soporte.
 */
export function adaptadorPara(nombreArchivo: string): AdaptadorOrigen | null {
  const n = nombreArchivo.toLowerCase()
  return ADAPTADORES.find(a => a.extensiones.some(e => n.endsWith(e))) ?? null
}
