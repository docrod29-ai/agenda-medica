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
 * ── EL ESCUDO PRESTADO (TEMP-001, 8-ago-2026) ────────────────────────────────
 *
 * La reparación de arriba dejó vivo su reverso, y quedó anotado: la ventana de
 * 60 caracteres se contaba a ciegas y **cruzaba el punto**.
 *
 *     Antecedentes: neumonía en 2019. Impresión diagnóstica: neumonía adquirida.
 *
 * Con el antecedente corto, los 60 caracteres del segundo «neumonía» todavía
 * alcanzaban la palabra «Antecedentes» de la primera oración: la impresión
 * diagnóstica se quedaba callada otra vez. La misma nota, con el antecedente
 * escrito largo, sí avisaba. El aviso dependía de cuánto hubiera escrito el
 * médico en el renglón de arriba, que no es un criterio de nada.
 *
 * Ahora la ventana se corta donde acabó la afirmación anterior, y el escudo que
 * de verdad gobierna varias afirmaciones —el encabezado de sección— se busca
 * aparte. Los dos puntos abren; el punto cierra.
 *
 * Módulo PURO.
 */

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Cuánto se mira hacia atrás buscando el escudo.
 *
 * 60 caracteres: es lo que mide «niega …», «sin antecedente de …» o
 * «antecedente de …» en la misma oración. Más larga empezaría a leer la oración
 * anterior y un escudo ajeno taparía una afirmación real — que es el fallo caro.
 *
 * El número lo fijaron las negaciones en la v1013 y la temporalidad lo copió; se
 * declara aquí una sola vez para que no vuelvan a poder divergir.
 *
 * Desde TEMP-001 el número ya no es lo único que acota la ventana: la ventana
 * **también** se corta donde acaba la afirmación anterior. Se conserva porque
 * sigue siendo el tope, y porque mide igual de bien lo que puede ser un
 * encabezado de sección y lo que ya es prosa.
 */
export const VENTANA_DEL_ESCUDO = 60

/**
 * Dónde acaba una afirmación: punto, interrogación, admiración o salto de línea.
 *
 * Los dos puntos NO están, y es la mitad del arreglo de TEMP-001. «Antecedentes:»
 * no cierra nada — abre una sección y gobierna lo que viene detrás. El punto sí
 * cierra: «Niega diabetes.» agota su escudo ahí y no le presta nada a la frase
 * siguiente.
 *
 * El salto de línea se cuenta como final porque `frases()` —en `negaciones.ts`,
 * sobre el mismo texto— ya lo cuenta así desde la v1013: una nota clínica separa
 * renglones, no párrafos.
 */
const FIN_DE_AFIRMACION = new Set(['.', '?', '!', '\n'])

/** Dónde empieza la afirmación que contiene `hasta`; `0` si es la primera. */
function inicioDeLaAfirmacion(texto: string, hasta: number): number {
  for (let i = hasta - 1; i >= 0; i--) if (FIN_DE_AFIRMACION.has(texto[i])) return i + 1
  return 0
}

/**
 * El encabezado de la sección donde cae `idx`, o `''` si no hay ninguno.
 *
 * Es la otra mitad del arreglo de TEMP-001. Cortar la ventana en el punto, a
 * secas, dejaba sin escudo la nota que lista bajo un encabezado:
 *
 *     Antecedentes personales patológicos: apendicectomía en 2010. Neumonía en 2019.
 *     Antecedentes personales patológicos:
 *     Neumonía en 2019.
 *
 * En las dos, «Neumonía» está bien escrita y el escudo lo pone el encabezado, no
 * la oración. Se toman los dos puntos más cercanos hacia atrás y lo que hay entre
 * el final de la afirmación anterior y ellos.
 *
 * El tope de `VENTANA_DEL_ESCUDO` distingue el encabezado de la prosa: un
 * encabezado clínico —«Impresión diagnóstica», «Antecedentes personales
 * patológicos»— cabe de sobra; una oración larga que acaba en dos puntos no, y
 * ésa no debe escudar nada.
 */
function encabezadoDeLaSeccion(texto: string, idx: number): string {
  const dosPuntos = texto.lastIndexOf(':', idx - 1)
  if (dosPuntos < 0) return ''
  const enc = texto.slice(inicioDeLaAfirmacion(texto, dosPuntos), dosPuntos).trim()
  return enc.length <= VENTANA_DEL_ESCUDO ? enc : ''
}

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
    for (let i = t.indexOf(f); i >= 0; i = t.indexOf(f, i + 1)) apariciones.add(i)
  }

  for (const idx of [...apariciones].sort((a, b) => a - b)) {
    /**
     * El escudo alcanza desde donde empezó ESTA afirmación, nunca desde la
     * anterior (TEMP-001) — y como mucho `VENTANA_DEL_ESCUDO` hacia atrás.
     */
    const desde = Math.max(idx - VENTANA_DEL_ESCUDO, inicioDeLaAfirmacion(textoNota, idx))
    const antes = textoNota.slice(desde, idx)
    if (escudo.test(sinAcentos(antes))) continue
    // …o lo pone el encabezado de la sección, que gobierna varias afirmaciones.
    if (escudo.test(sinAcentos(encabezadoDeLaSeccion(textoNota, idx)))) continue
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
