/**
 * DÓNDE LO DICE LA NOTA — el rastreo que comparten las dos compuertas que
 * confrontan el dictado con lo escrito.
 *
 * ── QUÉ COMPARTEN, Y POR QUÉ TIENE QUE SER UNO SOLO ──────────────────────────
 *
 * `negaciones.ts` busca en la nota lo que el paciente NEGÓ; `temporalidad.ts`
 * busca lo que el dictado puso en PASADO. Cambia el vocabulario y cambia la
 * marca que exculpa —«niega …» allí, «antecedente de …» aquí—, pero el rastreo
 * es el mismo: encontrar dónde la nota nombra el padecimiento y mirar hacia
 * atrás por si ya viene bien encuadrado.
 *
 * Estaba escrito dos veces, y las dos copias traían el mismo par de fallos
 * (REG-192). Es la misma lección de `SEPARADORES` en `alergias.ts`: dos
 * rastreadores del mismo texto acaban dando respuestas distintas, y el día que
 * se repara uno el otro sigue roto.
 *
 * Módulo PURO.
 */

/**
 * Quitar acentos y bajar a minúsculas. Vivía por duplicado —y en
 * `temporalidad.ts` con los combinantes escritos en crudo dentro de la clase,
 * invisibles en cualquier editor y a un `normalize` de dejar de funcionar—.
 *
 * La longitud se conserva: NFD parte «ñ» en «n» + combinante y el combinante se
 * va, así que los índices calculados aquí valen sobre el texto original. De eso
 * dependen las citas que se le enseñan al médico, que sí llevan acentos.
 */
export function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Cuánto se mira hacia atrás desde el término para decidir si ya viene marcado.
 *
 * 60 caracteres es lo que mide «antecedente personal de …» o «no tiene
 * antecedentes de …» delante del padecimiento. Era el número de las dos copias
 * y no se toca: lo que se corrige es que la ventana **no puede saltar de
 * oración** (ver abajo).
 */
export const VENTANA_HACIA_ATRAS = 60

/**
 * Fin de oración: puntuación seguida de espacio, o un salto de línea a secas.
 *
 * ── POR QUÉ HAY QUE CORTAR AHÍ (REG-192) ─────────────────────────────────────
 *
 * Las dos copias ya avisaban del riesgo en su comentario —«más larga empezaría a
 * leer la oración anterior y una negación ajena taparía una afirmación real, que
 * es el fallo caro»— y las dos lo dejaron sin resolver: acotar por número de
 * caracteres no acota por oración. En una nota real 60 caracteres cruzan un
 * renglón sin esfuerzo:
 *
 *     «No tiene antecedentes de tuberculosis.
 *      IDx: asma persistente moderada.»
 *
 * El «no tiene» del renglón de arriba —que habla de OTRA enfermedad— exculpaba
 * al asma del renglón de abajo, y el aviso no salía. Igual en temporalidad con
 * un «antecedente de tabaquismo» delante de una neumonía afirmada como actual.
 *
 * Se exige el espacio detrás del signo para no partir en «Dr.», «c.s.p.» ni en
 * un decimal —el mismo criterio que ya usa `SEPARADORES` en `alergias.ts`—. Los
 * dos puntos NO cortan: «Antecedentes personales patológicos: neumonía» es
 * justo la forma correcta de escribirlo, y ahí la marca está antes del signo.
 */
const LIMITE_DE_ORACION = '[.;?!]\\s|\\n'

/**
 * El texto que precede a `idx` dentro de su misma oración, ya sin acentos.
 *
 * @param textoNormalizado la nota pasada por `sinAcentos` (los índices son suyos)
 */
export function contextoAntesDe(textoNormalizado: string, idx: number): string {
  const bruto = textoNormalizado.slice(Math.max(0, idx - VENTANA_HACIA_ATRAS), idx)
  const limite = new RegExp(LIMITE_DE_ORACION, 'g')
  let corte = -1
  for (let m = limite.exec(bruto); m; m = limite.exec(bruto)) corte = m.index + m[0].length
  return corte < 0 ? bruto : bruto.slice(corte)
}

/** Todas las posiciones de `aguja` en `heno`, no sólo la primera. */
function posicionesDe(heno: string, aguja: string): number[] {
  if (!aguja) return []
  const out: number[] = []
  for (let i = heno.indexOf(aguja); i >= 0; i = heno.indexOf(aguja, i + aguja.length)) out.push(i)
  return out
}

/**
 * DÓNDE LA NOTA LO AFIRMA SIN ENCUADRARLO — o `null` si en ningún sitio.
 *
 * ── EL FALLO QUE ESTO REPARA (REG-192) ───────────────────────────────────────
 *
 * Las dos copias hacían `indexOf` **una sola vez por forma** y se quedaban con
 * la PRIMERA aparición. En una nota bien redactada la primera aparición es casi
 * siempre la correcta —está en antecedentes, o viene negada— así que se
 * descartaba… y ahí acababa la búsqueda. La afirmación de más abajo, que es el
 * defecto que hay que cazar, no se miraba nunca:
 *
 *     «Interrogatorio por aparatos: niega asma.
 *      Se agrega a la lista de problemas asma persistente moderada.»
 *
 * Resultado: la compuerta callaba **precisamente en la nota mejor escrita**, que
 * es donde el médico más confía en ella. Una nota descuidada —que nombra el
 * padecimiento una sola vez y mal— sí saltaba.
 *
 * Ahora se recorren todas las apariciones de todas las formas y se devuelve la
 * **más temprana que no venga encuadrada**: la primera línea de la nota donde el
 * médico va a ver el problema al abrirla.
 *
 * No decide nada clínico: dice dónde lo dice la nota. Quién lo juzga es el
 * médico, y las dos compuertas siguen redactando su propio aviso.
 *
 * @param yaVieneEncuadrada recibe el contexto anterior **sin acentos y en
 *   minúsculas**; devuelve `true` si esa aparición ya está bien escrita.
 */
export function afirmacionSinEncuadre(
  textoNota: string,
  formas: readonly string[],
  yaVieneEncuadrada: (contextoAnterior: string) => boolean,
): number | null {
  const t = sinAcentos(textoNota)
  let primera: number | null = null
  for (const forma of formas) {
    for (const idx of posicionesDe(t, sinAcentos(forma))) {
      if (yaVieneEncuadrada(contextoAntesDe(t, idx))) continue
      if (primera === null || idx < primera) primera = idx
      break // de esta forma ya basta con la primera sin encuadrar
    }
  }
  return primera
}

export const POR_QUE_NO_BASTA_LA_PRIMERA_APARICION =
  'Porque en una nota bien redactada la primera aparición del padecimiento es ' +
  'la correcta —está en antecedentes, o viene negada— y quedarse ahí hacía que ' +
  'la compuerta callara justo en la nota mejor escrita. La afirmación que hay ' +
  'que cazar está más abajo, en la lista de problemas o en el diagnóstico.'

export const POR_QUE_LA_VENTANA_NO_CRUZA_ORACION =
  'Porque acotar por número de caracteres no acota por oración: 60 caracteres ' +
  'cruzan un renglón sin esfuerzo, y entonces una negación que habla de OTRA ' +
  'enfermedad —«no tiene antecedentes de tuberculosis»— exculpa a la que viene ' +
  'en el renglón siguiente. Las dos copias lo tenían escrito como riesgo y ' +
  'ninguna lo había cerrado.'
