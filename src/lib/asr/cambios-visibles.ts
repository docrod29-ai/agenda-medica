/**
 * LOS OTROS DOS CAMBIOS, LOS QUE NO SE ENSEÑABAN.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `ResultadoPipeline` trae **tres** listas de cambios aplicados al dictado:
 *
 * · `cambiosLexicos` — fármacos mal transcritos. Se enseñan y se pueden deshacer.
 * · `cambiosNormalizacion` — cifras y unidades: «dos gramos» → «2 g».
 * · `cambiosSiglas` — siglas escritas como toca.
 *
 * Las dos últimas se calculaban en cada dictado y **no salían del pipeline**: el
 * hook no las devolvía y ninguna pantalla las pedía.
 *
 * ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────────
 *
 * El comentario que ya estaba escrito sobre `cambiosLexicos` dice la regla: «una
 * corrección que el médico no puede ver ni revertir es una edición que alguien le
 * hizo a su dictado sin decírselo». Vale igual para las otras dos — y la de
 * cifras y unidades es **la que toca dosis**.
 *
 * El guardián ya impide que una cifra desaparezca o cambie de unidad. Lo que no
 * puede hacer es decidir por el médico si «dos» quería decir «2» en esa frase.
 * Eso se enseña, y él decide.
 *
 * Módulo PURO.
 */
import type { CambioNormalizacion } from '@/lib/asr/normalizacion'
import type { CambioSigla } from '@/lib/asr/siglas'

export interface CambioVisible {
  antes: string
  despues: string
  /** Qué etapa lo hizo, en palabras del médico. */
  etiqueta: 'Cifra' | 'Unidad' | 'Sigla'
}

/**
 * Junta las dos listas en una sola, sin repetir y sin los cambios que no
 * cambiaron nada.
 *
 * El orden es el del pipeline: primero cifras y unidades, luego siglas. Es el
 * orden en que se aplicaron, así que es el orden en que se pueden deshacer.
 */
export function cambiosVisibles(
  normalizacion: readonly CambioNormalizacion[],
  siglas: readonly CambioSigla[],
): CambioVisible[] {
  const out: CambioVisible[] = []
  const vistos = new Set<string>()
  const meter = (antes: string, despues: string, etiqueta: CambioVisible['etiqueta']) => {
    // Un «cambio» que deja el texto igual es ruido: llenaría la lista de líneas
    // que no dicen nada y el médico dejaría de leerla.
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

/**
 * Cuántos de esos cambios tocan una **cifra o una unidad**.
 *
 * Se cuenta aparte porque no pesan lo mismo: una sigla mal expandida se lee y se
 * corrige; una cifra o una unidad es una dosis.
 */
export function cuantosTocanCifra(cambios: readonly CambioVisible[]): number {
  return cambios.filter(c => c.etiqueta !== 'Sigla').length
}

export const POR_QUE_SE_ENSENAN =
  'La regla ya estaba escrita para las correcciones léxicas: una corrección que ' +
  'el médico no puede ver ni revertir es una edición que alguien le hizo a su ' +
  'dictado sin decírselo. Vale igual para las cifras, las unidades y las siglas ' +
  '— y la de cifras y unidades es la que toca DOSIS.'

export const POR_QUE_NO_BASTA_EL_GUARDIAN =
  'El guardián impide que una cifra desaparezca o cambie de unidad. Lo que no ' +
  'puede hacer es decidir por el médico si «dos» quería decir «2» en esa frase. ' +
  'Eso se enseña, y decide él.'
