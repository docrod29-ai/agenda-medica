/**
 * PROVENANCE DE REESCRITURAS DETERMINISTAS DEL DICTADO.
 *
 * `ResultadoPipeline` conserva tres listas de cambios aplicados al dictado:
 * `cambiosLexicos`, `cambiosNormalizacion` y `cambiosSiglas`. Esta unión pura
 * mantiene cifras/unidades/siglas disponibles para trazabilidad, auditoría y
 * recuperación sin convertir cada normalización segura en una tarea de revisión
 * para el médico.
 *
 * La incertidumbre clínicamente material no se resuelve aquí: sustituciones
 * inseguras/rechazadas continúan por el guardián y la ruta contextual de
 * ambigüedad antes de firmar.
 */
import type { CambioNormalizacion } from '@/lib/asr/normalizacion'
import type { CambioSigla } from '@/lib/asr/siglas'

export interface CambioVisible {
  antes: string
  despues: string
  /** Etapa determinista que produjo la representación canónica. */
  etiqueta: 'Cifra' | 'Unidad' | 'Sigla'
}

/**
 * Junta las dos listas en una sola, sin repetir y sin cambios nulos.
 * El orden conserva el lineage del pipeline: normalización y después siglas.
 */
export function cambiosVisibles(
  normalizacion: readonly CambioNormalizacion[],
  siglas: readonly CambioSigla[],
): CambioVisible[] {
  const out: CambioVisible[] = []
  const vistos = new Set<string>()
  const meter = (antes: string, despues: string, etiqueta: CambioVisible['etiqueta']) => {
    if (!antes || !despues || antes === despues) return
    const llave = `${etiqueta}|${antes}|${despues}`
    if (vistos.has(llave)) return
    vistos.add(llave)
    out.push({ antes, despues, etiqueta })
  }
  for (const c of normalizacion) meter(c.antes, c.despues, c.tipo === 'unidad' ? 'Unidad' : 'Cifra')
  for (const c of siglas) meter(c.antes, c.despues, 'Sigla')
  return out
}

export const POR_QUE_SE_CONSERVAN =
  'Las reescrituras deterministas se conservan como provenance del dictado para auditoría y recuperación, ' +
  'sin convertir normalizaciones seguras en interrupciones del flujo clínico.'

export const FRONTERA_DE_SEGURIDAD =
  'Una normalización segura puede presentarse en forma canónica sin ruido de interfaz; si una cifra, unidad, ' +
  'medicamento, negación u otro dato queda clínicamente ambiguo, debe escalar por la ruta contextual de revisión.'
