/**
 * HUELLAS — cómo se dice «éste es el mismo documento» sin abrirlo.
 *
 * ── POR QUÉ HACE FALTA ───────────────────────────────────────────────────────
 *
 * Todo lo que #312 pide —conciliar conteos, detectar el duplicado, ver el
 * documento rancio, probar que la nota firmada NO cambió, saber si un reintento
 * escribiría lo mismo— se apoya en una sola pregunta: **¿es este documento el
 * mismo que aquél?**
 *
 * Sin una respuesta determinista, «restauramos 10 000 documentos» sólo cuenta
 * líneas. Con ella se puede decir cuáles faltan, cuáles sobran y cuáles
 * volvieron distintos.
 *
 * ── NO SE INVENTA UNA SEGUNDA CANONICALIZACIÓN ───────────────────────────────
 *
 * El orden estable de llaves y el SHA-256 salen de `expediente/integrity.ts`,
 * que es el sello NOM-024 que ya usan las notas firmadas. Escribir aquí otra
 * versión sería crear una segunda opinión sobre qué significa «igual»: el día
 * que discreparan, una de las dos marcaría como alterada una nota intacta —el
 * modo de falla grave del sello (REG-060).
 *
 * ── LO QUE UNA HUELLA NO PRUEBA ──────────────────────────────────────────────
 *
 * Que dos documentos tengan la misma huella dice que su CONTENIDO coincide. No
 * dice que sean el mismo documento (dos citas idénticas en días distintos no lo
 * son) ni que ninguno esté corrupto: los dos pueden estar mal igual. La
 * identidad la da la ruta; la huella, el contenido.
 *
 * Módulo PURO: no lee disco, no toca la red, no mira el reloj.
 */
import { sha256Hex, ordenEstable } from '@/lib/expediente/integrity'

/**
 * Campos que NO entran en la huella de contenido, con su razón.
 *
 * Son los que el propio viaje cambia. Meterlos convertiría «volvió idéntico» en
 * «volvió distinto» en cada ida y vuelta, y una comparación que siempre falla
 * es una comparación que se acaba apagando.
 */
export const CAMPOS_FUERA_DE_LA_HUELLA: Readonly<Record<string, string>> = {
  _ruta: 'Es la identidad, no el contenido: se compara aparte y además se RE-ENRAÍZA al restaurar, así que meterla haría que todo documento re-enraizado pareciera alterado.',
  _coleccion: 'Metadato del formato del archivo, derivable de la ruta.',
  _huella: 'Auto-referencia: es la propia huella.',
}

/** Quita del documento lo que no forma parte de su contenido. */
export function soloContenido(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(doc)) {
    if (k in CAMPOS_FUERA_DE_LA_HUELLA) continue
    out[k] = v
  }
  return out
}

/** El texto canónico de un documento: mismas llaves, mismo orden, siempre. */
export function canonico(doc: Record<string, unknown>): string {
  return JSON.stringify(ordenEstable(soloContenido(doc)))
}

/** Huella de contenido de un documento. Dos iguales ⇒ mismo contenido. */
export async function huellaDeDocumento(doc: Record<string, unknown>): Promise<string> {
  return sha256Hex(canonico(doc))
}

/**
 * Huella de un CONJUNTO de documentos, independiente del orden en que llegan.
 *
 * ── POR QUÉ NO SE ENCADENAN LAS HUELLAS EN ORDEN DE LECTURA ──────────────────
 *
 * El respaldo se escribe en streaming, paginando por `__name__`, y una
 * restauración por lotes puede reordenar. Una huella sensible al orden marcaría
 * como distinto un consultorio idéntico leído en otro orden: falsa alarma
 * garantizada, y una alarma que suena sin motivo se desconecta.
 *
 * Se ordenan las huellas individuales y se sella la lista. Así el resultado
 * depende del CONJUNTO y no del camino.
 */
export async function huellaDelConjunto(huellas: readonly string[]): Promise<string> {
  return sha256Hex([...huellas].sort().join('|'))
}

/**
 * Identidad de una restauración concreta, para poder repetirla sin duplicar.
 *
 * `origen` + `destino` + la huella del archivo. Dos peticiones con la misma
 * terna son **la misma restauración reintentada**, no dos restauraciones.
 */
export async function huellaDeTrabajo(
  origen: string, destino: string, huellaArchivo: string,
): Promise<string> {
  return sha256Hex(`${origen} ${destino} ${huellaArchivo}`)
}

/** Huella del ARCHIVO tal cual llegó: detecta el byte cambiado, no el semántico. */
export async function huellaDelArchivo(ndjson: string): Promise<string> {
  return sha256Hex(ndjson)
}

export const POR_QUE_LA_HUELLA_NO_ES_LA_IDENTIDAD =
  'Dos citas idénticas en días distintos tienen contenidos distintos; dos ' +
  'asientos de bitácora idénticos en el mismo milisegundo tienen el mismo ' +
  'contenido y son dos hechos. La identidad de un documento es su RUTA. La ' +
  'huella responde a otra pregunta: si el documento que hay en esa ruta es el ' +
  'que el respaldo dice que debería haber.'
