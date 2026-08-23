/**
 * LOS DOCUMENTOS QUE VIENEN CON EL PADRÓN.
 *
 * ── QUÉ SE HACE Y QUÉ NO ─────────────────────────────────────────────────────
 *
 * Un export de otro sistema trae, además del CSV, una carpeta de PDF y de fotos:
 * estudios, consentimientos firmados, notas escaneadas. Este módulo define cómo
 * se declaran, cómo se comprueba que llegaron y cómo se cuentan.
 *
 * Lo que NO se hace:
 *
 *  · **No se lee el contenido.** Ni OCR, ni extracción, ni clasificación
 *    automática. Un PDF escaneado se guarda como lo que es: un documento del
 *    paciente. Convertirlo en «datos clínicos» sería inventar hechos a partir de
 *    una lectura automática que nadie revisó.
 *  · **No se adivina de quién es.** Un archivo que no case con ninguna fila del
 *    padrón queda huérfano y a revisión. Colgarlo del paciente «más probable»
 *    por el nombre del archivo es cómo un estudio acaba en el expediente
 *    equivocado.
 *
 * ── EL CHECKSUM NO ES BUROCRACIA ─────────────────────────────────────────────
 *
 * Un archivo que llega truncado por una subida a medias sigue abriéndose: el
 * visor enseña las tres primeras páginas y no dice nada de las otras nueve. Sin
 * comparar contra un checksum declarado, eso pasa desapercibido para siempre.
 * Es la regla «el dato tiene que LLEGAR» aplicada a un binario.
 *
 * Módulo PURO.
 */
import type { Razon } from './contrato'

/**
 * Los tipos que se admiten. Lista blanca.
 *
 * Blanca y no negra porque el archivo lo sube alguien de fuera del equipo y
 * acaba servido a un navegador. Un `.svg` o un `.html` en esa lista son
 * ejecución de guion en el dominio del expediente; un `.csv` malicioso es la
 * inyección de fórmulas que `csv-seguro.ts` ya conoce. Lo que no esté aquí, no
 * entra — y se dice por qué, en vez de fallar en silencio.
 */
export const TIPOS_ADMITIDOS: readonly string[] = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'text/plain',
]

/** Tope por documento. Por encima, se declara y se deja fuera del lote. */
export const MAXIMO_BYTES = 25 * 1024 * 1024

/** Lo que el manifiesto del paquete declara de cada documento. */
export interface AdjuntoDeclarado {
  /** Id dentro del paquete. Es lo que ata el archivo a su fila. */
  readonly id: string
  /** A qué fila del padrón pertenece. Sin esto es huérfano. */
  readonly sourceRecordId?: string
  readonly sourceRow?: number
  /** Ruta dentro del paquete. NO es la ruta de destino. */
  readonly rutaEnPaquete: string
  readonly mime: string
  readonly bytes: number
  /** SHA-256 declarado por quien armó el paquete. */
  readonly checksum: string
  /** Qué dice ser: «estudio», «consentimiento»… Sin verificar y sin interpretar. */
  readonly etiquetaOrigen?: string
  /** ISO. Fecha que el sistema de origen le atribuía. */
  readonly fechaOrigen?: string
}

export type EstadoAdjunto =
  | 'pendiente'
  | 'subido'
  | 'fallido'
  /** Declarado en el manifiesto pero no venía en el paquete. */
  | 'ausente'
  /** Vino, pero su checksum no coincide con el declarado. */
  | 'corrupto'
  /** No se sabe de quién es. A revisión, nunca adivinado. */
  | 'huerfano'
  /** Tipo o tamaño fuera de lo admitido. */
  | 'rechazado'

export interface AdjuntoResuelto {
  readonly declarado: AdjuntoDeclarado
  readonly estado: EstadoAdjunto
  readonly razon?: Razon
  /** El paciente al que quedó colgado. Sólo cuando `estado === 'subido'`. */
  readonly patientId?: string
}

/**
 * Comprueba un documento contra lo declarado, ANTES de subirlo.
 *
 * `checksumReal` lo calcula quien tenga los bytes delante; aquí sólo se compara.
 * Mantener este módulo sin acceso a los bytes es lo que le permite seguir siendo
 * puro y probarse sin archivos.
 *
 * El orden importa: primero lo que hace que el archivo no deba entrar (tipo,
 * tamaño), luego lo que dice que no llegó entero. Un `.exe` de 40 MB se rechaza
 * por lo que es, no por lo que pesa.
 */
export function verificarAdjunto(
  d: AdjuntoDeclarado,
  presente: boolean,
  checksumReal?: string,
): AdjuntoResuelto {
  if (!presente) return { declarado: d, estado: 'ausente' }
  if (!TIPOS_ADMITIDOS.includes(d.mime)) {
    return { declarado: d, estado: 'rechazado', razon: 'UNSUPPORTED_FIELD' }
  }
  if (d.bytes <= 0 || d.bytes > MAXIMO_BYTES) {
    return { declarado: d, estado: 'rechazado', razon: 'FIELD_TOO_LONG' }
  }
  if (!checksumReal || checksumReal !== d.checksum) {
    /**
     * SIN CHECKSUM SE TRATA COMO CORRUPTO, no como bueno.
     *
     * «No pude comprobarlo» y «está bien» no son lo mismo, y por omisión se
     * elige el que manda el archivo a revisión en vez del que lo cuelga del
     * expediente sin haberlo mirado.
     */
    return { declarado: d, estado: 'corrupto', razon: 'INVALID_ENCODING' }
  }
  if (!d.sourceRecordId && d.sourceRow === undefined) {
    return { declarado: d, estado: 'huerfano', razon: 'MISSING_REQUIRED_IDENTITY' }
  }
  return { declarado: d, estado: 'pendiente' }
}

/**
 * Cuenta los documentos por desenlace, para la reconciliación.
 *
 * Los estados se agrupan en los cinco cubos de `CuentasAdjuntos`. `huerfano` y
 * `rechazado` cuentan como `fallidos`: no entraron, se sabe por qué, y están
 * esperando a que alguien los mire. `pendiente` también cuenta como fallido
 * cuando el trabajo ya terminó — un documento que se quedó pendiente para
 * siempre es un documento que no llegó, se llame como se llame.
 */
export function contarAdjuntos(resueltos: readonly AdjuntoResuelto[]): {
  readonly declarados: number
  readonly subidos: number
  readonly fallidos: number
  readonly ausentes: number
  readonly corruptos: number
} {
  let subidos = 0, fallidos = 0, ausentes = 0, corruptos = 0
  for (const r of resueltos) {
    switch (r.estado) {
      case 'subido': subidos++; break
      case 'ausente': ausentes++; break
      case 'corrupto': corruptos++; break
      default: fallidos++; break
    }
  }
  return { declarados: resueltos.length, subidos, fallidos, ausentes, corruptos }
}

/**
 * Los metadatos que se guardan de un documento importado.
 *
 * Se guarda la REFERENCIA, no el binario. Meter un PDF de 8 MB en base64 dentro
 * de un documento de Firestore revienta el tope de 1 MiB y, cuando no lo
 * revienta, hace que cada lectura del expediente arrastre megas. El estándar de
 * endurecimiento (#320, compuerta 2) lo pide explícitamente: almacenamiento de
 * objetos con referencia, no binario en línea.
 */
export interface MetadatosAdjunto {
  readonly id: string
  readonly patientId: string
  readonly mime: string
  readonly bytes: number
  readonly checksum: string
  /** Ruta en el almacenamiento de objetos. Nunca el contenido. */
  readonly referencia: string
  readonly etiquetaOrigen?: string
  readonly fechaOrigen?: string
  readonly importJobId: string
  readonly importedAt: string
  /** Cómo llegó. Nunca se afirma que alguien lo haya revisado. */
  readonly revisadoPorClinico: false
}
