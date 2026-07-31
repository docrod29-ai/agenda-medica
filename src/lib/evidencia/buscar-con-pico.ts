/**
 * Puente entre el extractor PICO (E2-02) y el retrieval de PubMed que YA existe.
 *
 * PORQUÉ ESTÁ EN SU PROPIO ARCHIVO Y NO DENTRO DE `pico.ts`: `./pubmed` lee
 * `process.env.NCBI_API_KEY` y monta una cola de throttle EN EL MOMENTO DEL
 * IMPORT (pubmed.ts:15 y :45-57). Si `pico.ts` lo importara, dejaría de ser puro
 * e importable desde cualquier lado. Mismo criterio que `desde-pubmed.ts` (E2-01)
 * con su `import type`.
 *
 * PORQUÉ NO SE TOCA `pubmed.ts`: su throttle fue el fix de un bug real y probado
 * en vivo («a veces no salen citas», por 429 de PubMed). Aquí sólo se le pone una
 * ENTRADA TIPADA delante: el retrieval no cambia ni un carácter.
 *
 * LA MITAD DE COMPILACIÓN DE LA ACEPTACIÓN vive en la firma: esta función NO
 * admite cadenas. Sólo `ConsultaPubMed`, y una `ConsultaPubMed` sólo la produce
 * `consultaDesdePICO`/`consultasDesdePICO` a partir de un `PICO` (marca fantasma
 * no exportada). No hay forma de colar la pregunta cruda por aquí.
 *
 * Sin callers todavía: el cableado de las rutas es E2-05.
 */

import { buscarEvidenciaMulti, type ArticuloPubMed } from './pubmed'
import type { ConsultaPubMed } from './pico'
import type { NoVacio } from '@/types/evidence'

/**
 * Ejecuta el backoff de `consultasDesdePICO` contra PubMed.
 *
 * `buscarEvidenciaMulti` ya hace round-robin entre sub-consultas + dedup por
 * PMID, así que las 1-3 consultas de la relajación (P AND I AND C AND O → P AND I
 * → P) encajan tal cual, sin cambiarle nada.
 */
export async function buscarConPICO(
  consultas: NoVacio<ConsultaPubMed>,
  opts: { max?: number; aniosRecientes?: number; signal?: AbortSignal } = {},
): Promise<ArticuloPubMed[]> {
  return buscarEvidenciaMulti(consultas.map(c => c.texto), opts)
}
