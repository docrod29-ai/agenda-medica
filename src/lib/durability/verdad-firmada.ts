/**
 * LA VERDAD FIRMADA NO SE RESTAURA ENCIMA — se compara, y si difiere, se para.
 *
 * ── EL RIESGO QUE `restaurar.ts` YA DOCUMENTA Y NADIE COMPROBABA ─────────────
 *
 * El importador escribe con el **SDK admin**, que **ignora las reglas de
 * Firestore**. La regla que hace inmutable una nota firmada —
 *
 *     allow update: if isMedico(clinicId) && resource.data.estado != 'firmada'
 *
 * — no se evalúa por este camino. Ni una vez. Así que la restauración es, por
 * construcción, la única puerta de la aplicación por la que se puede reescribir
 * una nota firmada, y hasta ahora la cruzaba con `batch.set(ref, datos,
 * { merge: true })`.
 *
 * `merge: true` es peor que una sobrescritura limpia: deja los campos que el
 * archivo no trae y pisa los que sí, así que el documento resultante es una
 * MEZCLA de dos versiones que nunca existió — y su `hashIntegridad` (que
 * también viene del archivo) puede cuadrar con ninguna de las dos, o cuadrar
 * con la del archivo mientras el contenido guardado es otro.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Antes de escribir sobre una nota que YA EXISTE en el destino y está firmada:
 *
 *   1. si el archivo trae exactamente el mismo documento → no se escribe nada
 *      (ya está) y se cuenta como restaurado: eso es lo que hace idempotente el
 *      reintento;
 *   2. si difiere en cualquier campo sellado → **no se escribe** y se marca
 *      `revision-humana`;
 *   3. si el destino no la tiene → se escribe, y se comprueba que el sello que
 *      trae el archivo cuadra con el contenido que trae el archivo. Si no
 *      cuadra, el archivo llegó con una nota ya alterada y tampoco se escribe.
 *
 * Nunca «se escribe y se avisa». Un aviso en un informe de 10 000 líneas sobre
 * un documento medicolegal alterado no es un control: es un registro de que
 * pasó.
 *
 * ── LO QUE ESTO NO PUEDE VER ─────────────────────────────────────────────────
 *
 * El sello v3 no cubre `transcripcionMotor` (declarado en
 * `CAMPOS_NO_SELLADOS_V3`, con su razón). Una nota cuyo único cambio esté ahí
 * pasa la comparación de sello. Por eso esta comprobación se hace en DOS
 * niveles: el sello y la huella de contenido completa. El sello decide si es
 * una alteración del documento firmado; la huella decide si el documento volvió
 * literalmente igual.
 *
 * Módulo PURO.
 */
import { canonico } from '@/lib/durability/huellas'
import { sha256Hex } from '@/lib/expediente/integrity'

/** Lo mínimo que hace falta de una nota para juzgarla. No se pide `NotaMedica`
 *  entera porque el respaldo trae documentos crudos de Firestore, no el tipo. */
export interface NotaComoDocumento {
  estado?: unknown
  metadata?: unknown
  [k: string]: unknown
}

/** `true` si el documento está firmado según su propio contenido. */
export function estaFirmada(doc: NotaComoDocumento): boolean {
  if (doc.estado === 'firmada') return true
  const m = doc.metadata
  return !!m && typeof m === 'object' && (m as Record<string, unknown>).estado === 'firmada'
}

/** El sello guardado en el documento, si lo tiene. */
export function selloDe(doc: NotaComoDocumento): { hash: string | null; version: number | null } {
  const m = (doc.metadata ?? {}) as Record<string, unknown>
  const hash = typeof m.hashIntegridad === 'string' && m.hashIntegridad ? m.hashIntegridad : null
  const version = typeof m.hashVersion === 'number' ? m.hashVersion : null
  return { hash, version }
}

export type VeredictoVerdadFirmada =
  /** El destino no la tiene: se escribe. */
  | 'escribir'
  /** El destino ya la tiene idéntica: no se escribe y cuenta como restaurada. */
  | 'ya-esta'
  /** Difiere. NO se escribe. */
  | 'revision-humana'
  /** El archivo trae una nota firmada cuyo sello no cuadra con su contenido. */
  | 'archivo-alterado'
  /** Está firmada y no trae sello: no se puede juzgar. Fail closed. */
  | 'sin-sello-no-juzgable'

export interface ComparacionFirmada {
  veredicto: VeredictoVerdadFirmada
  porQue: string
  /** Qué campos de la comparación difieren, por nombre. Sin volcar valores (PHI). */
  camposQueDifieren: string[]
  /** El sello del archivo cuadra con el contenido del archivo. */
  selloDelArchivoCuadra: boolean | null
}

/**
 * Campos que pueden diferir sin que sea una alteración del documento firmado.
 *
 * Salen de `CAMPOS_NO_SELLADOS_V3` por la misma razón que están ahí: los mueve
 * el propio viaje, no el contenido clínico. Se enumeran aquí para poder decir
 * QUÉ se toleró, en vez de tolerarlo callando.
 */
export const DIFERENCIAS_TOLERADAS: Readonly<Record<string, string>> = {
  updatedAt: 'lo reescribe cada escritura, después de calcular el hash.',
  'metadata.fechaModificacion': 'se fija después de calcular el hash.',
  id: 'lo sobrescribe la lectura con el `doc.id`; la identidad sellada es `metadata.id`.',
}

/** Los campos de primer nivel (y `metadata.*`) en los que dos documentos difieren. */
export function camposQueDifieren(
  a: Record<string, unknown>, b: Record<string, unknown>,
): string[] {
  const out: string[] = []
  const llaves = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of [...llaves].sort()) {
    if (k === 'metadata') {
      const ma = (a.metadata ?? {}) as Record<string, unknown>
      const mb = (b.metadata ?? {}) as Record<string, unknown>
      const mk = new Set([...Object.keys(ma), ...Object.keys(mb)])
      for (const j of [...mk].sort()) {
        if (JSON.stringify(ma[j] ?? null) !== JSON.stringify(mb[j] ?? null)) out.push(`metadata.${j}`)
      }
      continue
    }
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) out.push(k)
  }
  return out.filter(k => !(k in DIFERENCIAS_TOLERADAS))
}

/**
 * ¿Se escribe esta nota del respaldo sobre el destino?
 *
 * @param delArchivo la nota tal y como viene en el respaldo (ya sin `_ruta`).
 * @param enDestino la nota que ya hay en el destino, o `null` si no hay ninguna.
 * @param recalcularSello canonicalizador del sello por versión. Se inyecta para
 *   que este módulo no dependa del tipo `NotaMedica` ni de la Web Crypto en un
 *   camino donde puede no haber nota completa; el llamador pasa
 *   `generarHashIntegridad`. Si no se pasa, el sello no se re-calcula y se dice.
 */
export async function compararNotaFirmada(
  delArchivo: NotaComoDocumento,
  enDestino: NotaComoDocumento | null,
  recalcularSello?: (n: NotaComoDocumento, v: number) => Promise<string>,
): Promise<ComparacionFirmada> {
  const firmadaEnArchivo = estaFirmada(delArchivo)
  const firmadaEnDestino = !!enDestino && estaFirmada(enDestino)

  if (!firmadaEnArchivo && !firmadaEnDestino) {
    return {
      veredicto: enDestino ? 'escribir' : 'escribir',
      porQue: 'ninguna de las dos está firmada: es un borrador y su régimen lo decide la comparación de frescura, no ésta.',
      camposQueDifieren: [], selloDelArchivoCuadra: null,
    }
  }

  const sello = selloDe(firmadaEnArchivo ? delArchivo : (enDestino as NotaComoDocumento))
  if (!sello.hash) {
    return {
      veredicto: 'sin-sello-no-juzgable',
      porQue:
        'la nota está firmada y no trae `metadata.hashIntegridad`: no hay con qué comprobar si el ' +
        'contenido es el que se firmó. Se para: escribir un documento medicolegal que no se puede ' +
        'verificar es exactamente lo que esta comprobación existe para impedir.',
      camposQueDifieren: [], selloDelArchivoCuadra: null,
    }
  }

  /**
   * ¿El sello del archivo cuadra con el contenido del archivo?
   *
   * Si no cuadra, el archivo ya venía con la nota alterada —da igual lo que
   * haya en el destino—. Es la comprobación que hace del respaldo una prueba y
   * no un contenedor.
   */
  let selloDelArchivoCuadra: boolean | null = null
  if (recalcularSello && sello.version) {
    try {
      const recalculado = await recalcularSello(delArchivo, sello.version)
      selloDelArchivoCuadra = recalculado === selloDe(delArchivo).hash
    } catch {
      selloDelArchivoCuadra = null
    }
  }
  if (selloDelArchivoCuadra === false) {
    return {
      veredicto: 'archivo-alterado',
      porQue:
        'el sello que trae el archivo no corresponde al contenido que trae el archivo: la nota ' +
        'firmada fue alterada ANTES de llegar aquí. No se escribe, y el hallazgo es del incidente, ' +
        'no de la restauración.',
      camposQueDifieren: [], selloDelArchivoCuadra,
    }
  }

  if (!enDestino) {
    return {
      veredicto: 'escribir',
      porQue: 'el destino no tiene esta nota: restaurarla es devolver lo perdido, no alterar lo existente.',
      camposQueDifieren: [], selloDelArchivoCuadra,
    }
  }

  const difieren = camposQueDifieren(
    delArchivo as Record<string, unknown>, enDestino as Record<string, unknown>,
  )
  if (difieren.length === 0) {
    return {
      veredicto: 'ya-esta',
      porQue: 'el destino ya tiene exactamente esta nota. No se escribe: es lo que hace que reintentar la misma restauración no cambie nada.',
      camposQueDifieren: [], selloDelArchivoCuadra,
    }
  }

  return {
    veredicto: 'revision-humana',
    porQue:
      `el destino ya tiene esta nota FIRMADA y difiere en ${difieren.length} campo(s). Escribir ` +
      'sería alterar un documento inmutable por la NOM-024 usando el SDK admin, que no evalúa las ' +
      'reglas de Firestore. La restauración se detiene sobre este documento y lo decide una persona.',
    camposQueDifieren: difieren,
    selloDelArchivoCuadra,
  }
}

/**
 * Huella de contenido de un documento firmado, para poder conciliar linaje sin
 * volver a canonicalizar en cada llamador.
 */
export async function huellaFirmada(doc: NotaComoDocumento): Promise<string> {
  return sha256Hex(canonico(doc as Record<string, unknown>))
}

export const POR_QUE_NO_SE_ESCRIBE_Y_SE_AVISA =
  'Un aviso sobre un documento medicolegal alterado, dentro de un informe de ' +
  'diez mil líneas, no es un control: es la constancia de que ya pasó. La ' +
  'diferencia entre una restauración y una edición de documentos firmados es ' +
  'que la primera se detiene cuando encuentra una diferencia que no le toca ' +
  'resolver.'
