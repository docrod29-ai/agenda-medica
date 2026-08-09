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
 */
export const VENTANA_DEL_ESCUDO = 60

/**
 * Dónde acaba el apartado anterior: hasta ahí, y no más atrás, llega el escudo.
 *
 * ── LA VENTANA CRUZABA DE APARTADO (verificado el 9-ago-2026) ────────────────
 *
 * Recorrer todas las apariciones no bastaba, y se comprobó con los motores
 * reales sobre la nota que motiva este módulo:
 *
 *     ANTECEDENTES PERSONALES PATOLÓGICOS: niega diabetes mellitus, niega hipertensión.
 *     IMPRESIÓN DIAGNÓSTICA: 1. Diabetes mellitus tipo 2 descontrolada.
 *
 *     contradicciones(...)  →  []
 *
 * La segunda aparición —la de abajo, la que este módulo existe para cazar— tiene
 * el «niega hipertensión» de la LÍNEA DE ARRIBA dentro de sus 60 caracteres
 * previos. Se recorrían todas las apariciones y se escudaban todas: el guardián
 * seguía callado sobre el caso exacto que lo motivó.
 *
 * Es, palabra por palabra, lo que `VENTANA_DEL_ESCUDO` ya temía aquí arriba —«un
 * escudo ajeno taparía una afirmación real, que es el fallo caro»—. Acortar la
 * ventana sólo lo hacía menos probable; no salirse del apartado lo hace
 * imposible.
 *
 * ── QUÉ CORTA Y QUÉ NO ───────────────────────────────────────────────────────
 *
 * Cortan el punto, el salto de línea y el punto y coma: son los que separan la
 * oración anterior de ésta.
 *
 * **Los dos puntos NO cortan, y ésta fue la primera versión equivocada.** Cortar
 * en ellos parece lo natural —«ANTECEDENTES:» abre un apartado— y rompe el caso
 * legítimo, porque **el encabezado ES el escudo**:
 *
 *     Antecedentes personales patológicos: neumonía en 2019, manejada de forma
 *     ambulatoria con amoxicilina durante siete días.
 *
 * Ahí no hay ningún «antecedente de» pegado al término: lo que escuda a esa
 * neumonía es la palabra «Antecedentes» del encabezado, al otro lado de los dos
 * puntos. Cortar allí la dejaba sin escudo y el motor avisaba del antecedente
 * bien escrito en vez del diagnóstico de abajo — al revés de lo que hay que
 * hacer. Lo cazó el golden de REG-192 al correr la suite entera.
 *
 * La coma tampoco corta: «niega diabetes, hipertensión y asma» es una sola
 * enumeración negada, y cortarla resucitaría de golpe el falso positivo que la
 * ventana existe para evitar.
 *
 * El punto y el salto de línea bastan para el defecto que esto repara: en
 * «…niega hipertensión.\nIMPRESIÓN DIAGNÓSTICA: 1. Diabetes…» ya cortan tres
 * veces antes de llegar al «niega» de la línea de arriba.
 */
const FIN_DE_APARTADO = /[.\n;!?¡¿]/g

/** Los `VENTANA_DEL_ESCUDO` caracteres previos, recortados en su propio apartado. */
function contextoPrevio(textoNota: string, idx: number): string {
  const ventana = textoNota.slice(Math.max(0, idx - VENTANA_DEL_ESCUDO), idx)
  let corte = 0
  for (const m of ventana.matchAll(FIN_DE_APARTADO)) corte = m.index + 1
  return ventana.slice(corte)
}

/**
 * Menciones que NO afirman el padecimiento, y que sólo se ven al recortar.
 *
 * ── POR QUÉ NACE CON EL RECORTE Y NO ANTES ───────────────────────────────────
 *
 * Mientras la ventana cruzaba de apartado, «Antecedentes: niega diabetes. Plan:
 * glucosa para descartar diabetes» se callaba **por el motivo equivocado**: el
 * «niega» de la frase anterior escudaba la segunda mención. Al recortar, esa
 * segunda mención se queda sola —«glucosa para descartar »— y el escudo de las
 * negaciones no la reconoce: su `descarta` no casa con «descartar».
 *
 * O sea que arreglar el recorte sin esto **estrenaría** un falso positivo de alta
 * frecuencia —el plan de estudios de casi cualquier nota— sobre un aviso que no
 * se puede plegar.
 *
 * Es **vocabulario, no criterio**: que falte una forma significa que esa mención
 * se sigue contando como afirmación —se avisa de más, no de menos— y el aviso
 * lleva la cita delante para descartarlo de un vistazo.
 *
 * ── VA ANCLADO AL TÉRMINO, Y ESO NO ES ESTILO ────────────────────────────────
 *
 * Sin el `$`, el «descartar» de «glucosa para descartar diabetes y control de la
 * hipertensión» callaría también a la hipertensión, que la nota sí afirma. La
 * marca sólo vale si va pegada a la mención que se está juzgando.
 *
 * ── Y NO VIVE EN EL ESCUDO DE CADA MOTOR ─────────────────────────────────────
 *
 * El escudo de `negaciones.ts` decide además qué cuenta como que el PACIENTE
 * negó algo. «Lo mandé a descartar diabetes» no es el paciente negando nada:
 * meterlo allí mezclaría dos preguntas distintas. Esto sólo mira la NOTA.
 */
const COLA = '(?:\\s+(?:de|del|de\\s+la|la|el|los|las|un|una))?\\s*$'
const NO_AFIRMA = new RegExp([
  '\\bdescartar' + COLA,
  '\\b(?:prevenir|prevencion|profilaxis)' + COLA,
  '\\briesgo\\s+(?:de|para)' + COLA,
  '\\b(?:tamizaje|cribado|escrutinio)' + COLA,
].join('|'), 'i')

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
    const antes = sinAcentos(contextoPrevio(textoNota, idx))
    if (escudo.test(antes)) continue
    if (NO_AFIRMA.test(antes)) continue
    return { idx, cita: textoNota.slice(Math.max(0, idx - 40), idx + 60).trim() }
  }
  return null
}

export const POR_QUE_EL_ESCUDO_NO_SALE_DEL_APARTADO =
  'Recorrer todas las apariciones no bastaba: la mención de abajo tenía el ' +
  '«niega» de la línea de arriba dentro de sus 60 caracteres previos, así que se ' +
  'escudaba igual y el guardián seguía callado sobre el caso que lo motivó. El ' +
  'contexto se recorta en el punto, el salto de línea y el punto y coma. En los ' +
  'dos puntos NO, porque el encabezado es el escudo: en «Antecedentes personales ' +
  'patológicos: neumonía en 2019» lo único que escuda a esa neumonía está al ' +
  'otro lado de los dos puntos. Y en la coma tampoco, que es la que enumera lo ' +
  'negado.'

export const POR_QUE_TODAS_LAS_APARICIONES =
  'La nota nombra el mismo padecimiento en varios sitios: en los antecedentes, ' +
  'en el interrogatorio y en la impresión diagnóstica. Mirar sólo la primera ' +
  'aparición hace que la sección bien escrita compre el silencio de la mal ' +
  'escrita — y la que cambia la conducta de hoy y viaja a la nota siguiente es ' +
  'casi siempre la de abajo.'
