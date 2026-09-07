/**
 * Sugerencias de la IA: lo que el modelo propone pero el médico NO dictó.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * El prompt le ordenaba al modelo, con estas palabras, "si el médico solo dictó
 * parte, complétalo con lo que aplique al cuadro clínico", y le exigía para CADA
 * fármaco dosis, vía, intervalo, duración, ajuste renal y signos de alarma. Además
 * esas secciones son obligatorias para poder firmar, así que el sistema empujaba
 * estructuralmente al modelo a rellenarlas.
 *
 * El médico dictaba "faringitis, le doy amoxicilina" y firmaba una nota que decía
 * 500 mg cada 8 horas por 7 días, con ajuste renal y signos de alarma. Todo eso
 * suele ser correcto — pero él no lo indicó, y salía con su firma y su cédula. Si
 * alguien pregunta quién indicó 7 días, la respuesta honesta era "el modelo".
 *
 * LA SOLUCIÓN (decisión del médico: que siga proponiendo, pero marcado)
 *
 * El modelo sigue completando, porque ahorra dictado y suele acertar. Pero cada
 * línea que no salga de lo dictado va prefijada con una marca. Antes de firmar, o
 * el médico las acepta como suyas, o se van. Nada entra a una nota firmada sin que
 * él lo haya visto.
 *
 * Todo aquí es puro y determinista → testeable.
 */

/**
 * Marca de línea sugerida. Se eligió texto legible y no un símbolo oscuro: si por
 * cualquier fallo llegara a imprimirse, en el papel se lee claramente qué es.
 */
export const MARCA_SUGERENCIA = '[IA — no dictado]'

/** ¿Este texto contiene alguna línea sugerida por la IA sin confirmar? */
export function tieneSugerencias(texto: string | undefined | null): boolean {
  return typeof texto === 'string' && texto.includes(MARCA_SUGERENCIA)
}

/** Cuántas líneas sugeridas hay en un texto. */
export function contarSugerencias(texto: string | undefined | null): number {
  if (typeof texto !== 'string') return 0
  return texto.split('\n').filter(l => l.includes(MARCA_SUGERENCIA)).length
}

/**
 * ACEPTAR: el médico las hace suyas. Se quita solo la marca; el contenido se queda
 * tal cual y pasa a ser indistinguible de lo que dictó, porque ya lo avaló.
 */
export function aceptarSugerencias(texto: string): string {
  return texto
    .split('\n')
    .map(l => l.includes(MARCA_SUGERENCIA) ? l.replace(MARCA_SUGERENCIA, '').replace(/^\s+/, '') : l)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * QUITAR: el médico no las avala. Desaparece la línea entera, no solo la marca —
 * dejar el contenido sin marca sería exactamente el problema original.
 */
export function quitarSugerencias(texto: string): string {
  return texto
    .split('\n')
    .filter(l => !l.includes(MARCA_SUGERENCIA))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Aplica una decisión a todas las secciones de la nota de una vez. */
export function resolverSugerencias<T extends { value?: string }>(
  secciones: readonly T[],
  decision: 'aceptar' | 'quitar',
): T[] {
  const fn = decision === 'aceptar' ? aceptarSugerencias : quitarSugerencias
  return secciones.map(s => (s.value && tieneSugerencias(s.value) ? { ...s, value: fn(s.value) } : s))
}

/**
 * LAS LÍNEAS QUE SE VAN A QUITAR, PARA PODER ENSEÑARLAS.
 *
 * ── POR QUÉ HACÍA FALTA (6-ago-2026, REG-195) ────────────────────────────────
 *
 * El diálogo de firma decía «la IA añadió 3 líneas que no dictaste» y ofrecía
 * quitarlas. No decía CUÁLES. Y una de esas líneas puede ser el **plan de
 * abordaje entero**, porque el plan es justamente lo que la IA redacta cuando el
 * médico no lo dicta palabra por palabra.
 *
 * El Dr. pulsó «quitarlas» y perdió el plan de una nota real. Un diálogo que
 * pide permiso para borrar sin enseñar qué borra no está pidiendo permiso.
 */
export function lineasSugeridas(secciones: readonly { value?: string; label?: string }[]): string[] {
  const out: string[] = []
  for (const s of secciones) {
    for (const linea of String(s.value ?? '').split('\n')) {
      if (!tieneSugerencias(linea)) continue
      const limpia = linea.split(MARCA_SUGERENCIA).join('').trim()
      if (!limpia) continue
      /** Con la sección delante: «Plan de tratamiento: …» dice mucho más que el texto solo. */
      out.push(s.label ? `${s.label}: ${limpia.slice(0, 90)}` : limpia.slice(0, 90))
    }
  }
  return out
}

/** Total de sugerencias pendientes en la nota completa. */
export function sugerenciasPendientes(secciones: readonly { value?: string }[]): number {
  return secciones.reduce((n, s) => n + contarSugerencias(s.value), 0)
}

/**
 * ── LA MARCA SALE DEL TEXTO Y SE QUEDA EN LA PROCEDENCIA (7-sep-2026) ────────
 *
 * ── LO QUE EL DUEÑO DIJO, TEXTUAL ───────────────────────────────────────────
 *
 *   «Y luego me pones que la inteligencia artificial no escuchó esto y lo
 *    inventó. Pues no le pongas, tú pon lo mejor. Esos cachos no quiero que los
 *    vea el médico […] no quiero que empiece a modificar nada; a lo mejor, si
 *    faltó algo, pues le dices que faltó, pero no quiero que batalle.»
 *
 * ── QUÉ CAMBIA Y QUÉ NO ─────────────────────────────────────────────────────
 *
 * Lo que cambia es DÓNDE vive la marca. Lo que no cambia es que exista.
 *
 * Hasta hoy `[IA — no dictado]` iba **dentro del texto de la nota**, y de ahí
 * colgaba un cartel antes de firmar con dos botones —«acepto las 7» / «quítalas
 * todas»—. Esa era la batalla: cada nota terminaba con una pregunta cuya
 * respuesta era siempre la misma, y el precio de equivocarse era perder el plan
 * entero de una nota real (REG-195).
 *
 * Ahora el texto sale limpio y las mismas líneas viajan aparte, en
 * `redactadoPorIA`, que es procedencia: se guarda con la nota, se puede
 * enseñar, se puede auditar y se puede contar. Medicolegalmente **no se pierde
 * nada** —sigue constando qué redactó la IA y qué salió del dictado—; lo que se
 * pierde es la fricción de que eso viva incrustado en el documento que el
 * médico lee.
 *
 * ── POR QUÉ ESTO NO CONTRADICE LA REGLA 3 DE SEGURIDAD CLÍNICA ──────────────
 *
 * «Nada cambia en silencio» pide que toda corrección automática sea VISIBLE y
 * REVERSIBLE. Sigue siéndolo: la lista de lo que redactó la IA se le enseña al
 * médico —resumida, en una línea, sin bloquear— y el texto sigue siendo suyo
 * para editar. Lo que la regla nunca exigió es que el aviso viva dentro del
 * párrafo, prefijando cada renglón.
 *
 * ── LO QUE SIGUE VIGILADO ───────────────────────────────────────────────────
 *
 * `sugerenciasPendientes` y su cartel se quedan en la pantalla como RED: si una
 * marca llegara a colarse hasta el editor —una ruta que no despegue, un texto
 * pegado a mano—, el cartel vuelve a aparecer y la marca no se imprime. Con el
 * despegue en su sitio ese contador vale cero, y ésa es justamente la prueba de
 * que el despegue funciona.
 */

/** Una línea que redactó la IA porque no se dictó, con el apartado del que salió. */
export interface LineaDeLaIA {
  /** Clave del apartado (`planTratamiento`, `exploracionFisica`…). */
  seccion: string
  /** El texto, ya sin la marca. */
  linea: string
}

export interface NotaDespegada<T> {
  /** Los apartados, con el mismo tipo que entraron y sin una sola marca. */
  secciones: T
  /** Lo que redactó la IA. Vacío cuando el médico lo dictó todo. */
  redactadoPorIA: LineaDeLaIA[]
}

/** Quita la marca de una línea y devuelve el texto limpio. */
function sinMarca(linea: string): string {
  return linea.split(MARCA_SUGERENCIA).join('').replace(/^\s+/, '')
}

/**
 * Despega las marcas del texto de los apartados y las devuelve aparte.
 *
 * Trabaja sobre el mapa plano `{clave: texto}` que produce la extracción, que
 * es donde hay que hacerlo: **antes** de que el texto llegue a la pantalla. Que
 * lo hiciera el componente sería la misma familia de defecto que ya costó caro
 * —una regla clínica que sólo protege a la pantalla que la escribió—, y la nota
 * viaja además al portal, al PDF y al expediente.
 *
 * El contenido NO se toca: la línea se queda entera, sólo pierde el prefijo. Se
 * eligió conservar y no borrar porque es lo que el dueño pidió («tú pon lo
 * mejor»), y porque borrar en silencio el plan que la IA redactó es exactamente
 * el defecto de REG-195 con el signo cambiado.
 */
export function despegarMarcas(
  secciones: Readonly<Record<string, unknown>> | null | undefined,
): NotaDespegada<Record<string, unknown>> {
  const entrada = secciones ?? {}
  const salida: Record<string, unknown> = { ...entrada }
  const redactadoPorIA: LineaDeLaIA[] = []

  for (const [clave, valor] of Object.entries(entrada)) {
    if (typeof valor !== 'string' || !valor.includes(MARCA_SUGERENCIA)) continue
    const lineas = valor.split('\n')
    salida[clave] = lineas.map(l => (l.includes(MARCA_SUGERENCIA) ? sinMarca(l) : l)).join('\n')
    for (const l of lineas) {
      if (!l.includes(MARCA_SUGERENCIA)) continue
      const limpia = sinMarca(l).trim()
      if (limpia) redactadoPorIA.push({ seccion: clave, linea: limpia })
    }
  }
  return { secciones: salida, redactadoPorIA }
}

/** Los apartados que la IA tuvo que redactar, sin repetir. Es lo que «faltó». */
export function apartadosQueFaltaron(lineas: readonly LineaDeLaIA[]): string[] {
  return [...new Set((lineas ?? []).map(l => l.seccion))]
}

export const POR_QUE_LA_MARCA_SALE_DEL_TEXTO =
  'Decisión del dueño, 7-sep-2026. La marca no desaparece: cambia de sitio. '
  + 'Sale del documento que el médico lee y se queda en la procedencia, que se '
  + 'guarda con la nota y se le enseña resumida. Lo que se elimina es la '
  + 'pregunta obligatoria antes de firmar, cuya respuesta era siempre la misma '
  + 'y cuyo error costaba el plan entero de una nota real (REG-195).'

export const POR_QUE_EL_CARTEL_SE_QUEDA_COMO_RED =
  'Porque una marca que se cuele hasta el editor —una ruta que no despegue, un '
  + 'texto pegado a mano— no debe imprimirse. Con el despegue en su sitio el '
  + 'contador vale cero, y eso es la prueba de que el despegue funciona.'
