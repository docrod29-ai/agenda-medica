/**
 * DÓNDE LA NOTA LO AFIRMA — buscar el término en TODAS sus apariciones.
 *
 * ── EL DEFECTO QUE ESTO REPARA (8-ago-2026) ──────────────────────────────────
 *
 * `contradicciones` (negaciones) y `desajustesTemporales` (temporalidad) tenían
 * la misma línea copiada: `t.indexOf(forma)` — **la primera** aparición y sólo
 * ésa. Si esa primera venía escudada («niega diabetes», «antecedente de
 * neumonía»), la condición se descartaba entera y las apariciones posteriores no
 * se miraban nunca.
 *
 * Y esa es justo la forma de una nota bien estructurada:
 *
 *     Antecedentes personales patológicos: neumonía en 2019, manejada de
 *     forma ambulatoria con amoxicilina durante siete días.
 *     Impresión diagnóstica: neumonía adquirida en la comunidad.
 *
 * El antecedente de arriba está bien escrito. El diagnóstico de abajo es el
 * defecto — y era el que quedaba callado, porque el bueno iba primero. La nota
 * que hace bien una parte se compraba el silencio para la otra.
 *
 * Es el peor reparto posible: **la mención que importa es la de abajo**. Un
 * antecedente no cambia la conducta de hoy; una impresión diagnóstica sí — y es
 * la que se arrastra a la nota siguiente.
 *
 * ── POR QUÉ VIVE EN SU PROPIO MÓDULO ─────────────────────────────────────────
 *
 * Porque ya se había copiado una vez. El caso oro de la v1035 lo dice con todas
 * sus letras: «lo mismo para el motor de temporalidad, que copió la misma
 * línea». Dos copias del mismo criterio se reparan de una en una y la segunda se
 * olvida — es el patrón de REG-180 y de REG-184. Una tercera copia era cuestión
 * de tiempo.
 *
 * Módulo PURO.
 */

/**
 * El término se busca **como palabra** (REG-270): con `indexOf` a secas, la
 * «sida» de «obesidad» y el «asma» de «plasma» contaban como aparición, y esta
 * función iba a buscarlas a la nota. El buscador es el mismo que usan los dos
 * vocabularios, para que no puedan divergir.
 */
import { sinAcentos, indiceDeTermino } from '@/lib/expediente/vocabulario-clinico'

/**
 * Cuánto se mira hacia atrás buscando el escudo.
 *
 * 60 caracteres: es lo que mide «niega …», «sin antecedente de …» o
 * «antecedente de …» en la misma oración. Más larga empezaría a leer la oración
 * anterior y un escudo ajeno taparía una afirmación real — que es el fallo caro.
 *
 * El número lo fijaron las negaciones en la v1013 y la temporalidad lo copió; se
 * declara aquí una sola vez para que no vuelvan a poder divergir.
 */
export const VENTANA_DEL_ESCUDO = 60

export interface MencionSinEscudo {
  /** Índice en el texto ORIGINAL donde empieza la forma encontrada. */
  idx: number
  /** El fragmento con su contexto, para que el médico juzgue sin abrir el audio. */
  cita: string
}

/**
 * La primera aparición del término que la nota afirma **sin escudo delante**.
 *
 * Se recorren todas las apariciones de todas las formas, en orden de aparición
 * en el texto, y se devuelve la primera cuyo contexto previo no traiga el escudo
 * (la negación o la marca de antecedente, según qué motor pregunte).
 *
 * @param escudo qué hace que esa mención esté bien escrita y no haya nada que
 *   avisar. Sin bandera `g`: se evalúa muchas veces y `lastIndex` haría que
 *   fallara una de cada dos.
 * @returns `null` cuando el término no aparece, o cuando **todas** sus
 *   apariciones vienen escudadas — que es el caso en que la nota está bien.
 */
export function primeraMencionSinEscudo(
  textoNota: string,
  formas: readonly string[],
  escudo: RegExp,
): MencionSinEscudo | null {
  /**
   * `sinAcentos` conserva la longitud del texto —quita marcas combinantes sobre
   * letras latinas, no letras—, así que los índices de `t` valen sobre el
   * original. De ahí se sacan las citas: se enseñan **con** sus acentos.
   */
  const t = sinAcentos(textoNota)

  const apariciones = new Set<number>()
  for (const forma of formas) {
    const f = sinAcentos(forma)
    if (!f) continue
    for (let i = indiceDeTermino(t, f); i >= 0; i = indiceDeTermino(t, f, i + 1)) apariciones.add(i)
  }

  for (const idx of [...apariciones].sort((a, b) => a - b)) {
    const antes = textoNota.slice(Math.max(0, idx - VENTANA_DEL_ESCUDO), idx)
    if (escudo.test(sinAcentos(antes))) continue
    return { idx, cita: textoNota.slice(Math.max(0, idx - 40), idx + 60).trim() }
  }
  return null
}

export const POR_QUE_TODAS_LAS_APARICIONES =
  'La nota nombra el mismo padecimiento en varios sitios: en los antecedentes, ' +
  'en el interrogatorio y en la impresión diagnóstica. Mirar sólo la primera ' +
  'aparición hace que la sección bien escrita compre el silencio de la mal ' +
  'escrita — y la que cambia la conducta de hoy y viaja a la nota siguiente es ' +
  'casi siempre la de abajo.'
