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
import { parseCsv } from '@/lib/csv-pacientes'
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
export const ADAPTADOR_CSV: AdaptadorOrigen = {
  id: 'csv',
  nombre: 'CSV',
  extensiones: ['.csv', '.txt'],
  disponible: true,
  leer(contenido: string): Lectura {
    const tabla = parseCsv(contenido)
    if (tabla.length === 0) {
      return { encabezados: [], filas: [], rotas: [], sourceRecords: 0 }
    }

    // El BOM viaja pegado al primer encabezado y lo deja sin emparejar.
    const encabezados = tabla[0].map((h, i) =>
      (i === 0 && h.charCodeAt(0) === 0xfeff ? h.slice(1) : h).trim(),
    )
    const cuerpo = tabla.slice(1)

    const filas: FilaOrigen[] = []
    const rotas: FilaRota[] = []

    cuerpo.forEach((cols, i) => {
      const sourceRow = i + 1
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
        return
      }
      const campos: Record<string, string> = {}
      encabezados.forEach((h, j) => {
        // La columna sin encabezado se conserva bajo un nombre posicional. Perderla
        // porque su encabezado venía vacío es perder un dato por un detalle de forma.
        const clave = h === '' ? `columna_${j + 1}` : h
        campos[clave] = cols[j] ?? ''
      })
      filas.push({ sourceRow, campos })
    })

    return { encabezados, filas, rotas, sourceRecords: filas.length + rotas.length }
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
