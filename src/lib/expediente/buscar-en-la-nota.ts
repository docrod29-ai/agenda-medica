/**
 * BUSCAR UN TÉRMINO EN LA NOTA SIN QUE LA PRIMERA MENCIÓN TAPE A LAS DEMÁS.
 *
 * ── EL DEFECTO QUE ESTO REPARA (7-ago-2026) ──────────────────────────────────
 *
 * Dos guardianes —`contradicciones` (negaciones) y `desajustesTemporales`—
 * buscaban el término con un solo `indexOf`: **la primera aparición y ninguna
 * más**. Si esa primera venía bien encuadrada, el guardián se callaba para toda
 * la nota.
 *
 * Y una nota bien escrita empieza justamente así:
 *
 *     «Interrogatorio: niega diabetes mellitus.
 *      Impresión diagnóstica: diabetes mellitus tipo 2 descontrolada.
 *      Se inicia metformina 850 mg cada 12 horas.»
 *
 * El paciente negó la diabetes, la nota lo registró bien **y luego la afirmó y
 * recetó por ella**. El guardián no dijo nada: había visto «niega diabetes» y se
 * dio por satisfecho.
 *
 * Lo perverso es la dirección del incentivo. Cuanto **mejor** redactada la nota
 * —con su interrogatorio arriba y su impresión diagnóstica abajo—, más ciego el
 * guardián. Sólo saltaba en la nota descuidada que nunca registró la negación.
 * La forma en que el Dr. escribe de verdad es la que quedaba sin vigilar.
 *
 * ── POR QUÉ VIVE AQUÍ Y NO EN CADA MÓDULO ────────────────────────────────────
 *
 * El defecto estaba dos veces porque el bucle estaba copiado dos veces. Cada
 * módulo conserva **su** criterio de encuadre —lo que a una negación la deja
 * bien escrita no es lo que a un antecedente— pero la manera de recorrer la nota
 * es una sola, y se arregla en un sitio.
 *
 * Módulo PURO.
 */

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * La ventana hacia atrás es de 60 caracteres, la que ya usaban los dos módulos.
 *
 * Es la distancia en la que cabe «niega …» o «antecedente de …» en la misma
 * oración. Más larga empezaría a leer la oración anterior, y un encuadre ajeno
 * taparía una afirmación real — que es el fallo caro, y el mismo que este módulo
 * viene a reparar a otra escala.
 */
const VENTANA_ENCUADRE = 60

/**
 * Y SE CORTA EN EL FIN DE ORACIÓN — lo que los dos módulos ya decían hacer.
 *
 * Sesenta **caracteres** no son una oración. En una nota de verdad, con sus
 * renglones cortos, la ventana llegaba de sobra a la línea anterior:
 *
 *     «Interrogatorio: niega diabetes mellitus.
 *      Impresión diagnóstica: diabetes mellitus tipo 2 descontrolada.»
 *
 * A 60 caracteres del segundo «diabetes» está el «niega» del primero. Recorrer
 * todas las apariciones no arreglaba nada por sí solo: cada una seguía tapada
 * por el encuadre de la anterior.
 *
 * Así que la ventana se corta en el último punto, signo o salto de línea. El
 * comentario que estaba escrito en los dos módulos —«más larga leería la oración
 * anterior»— describía la intención, no lo que el código hacía.
 */
const FIN_DE_ORACION = /[^.?!;\n\r¿¡]*$/

/**
 * MENCIONES QUE NO SON DEL PACIENTE.
 *
 * «Antecedentes heredofamiliares: madre con diabetes e hipertensión» está en
 * casi toda historia clínica de primera vez, y es compatible con que el paciente
 * niegue las dos para sí mismo. Sin esta marca, reparar la ceguera convertiría
 * un fallo raro en un aviso que salta en la mayoría de las notas — y un aviso que
 * salta donde no debe se acaba ignorando, con los que sí importan detrás.
 *
 * No es criterio clínico ni decide nada del paciente: es encuadre de redacción,
 * igual que «niega …» o «antecedente de …».
 *
 * **Señala de menos**: «acude con su madre por descontrol de diabetes» queda sin
 * vigilar. Es la dirección en la que estos motores se equivocan a propósito.
 */
const NO_ES_DEL_PACIENTE = new RegExp(
  '\\bheredofamiliar(?:es)?\\b|\\bantecedentes?\\s+familiar(?:es)?\\b'
  + '|\\b(?:madre|padre|mama|papa|hermanos?|hermanas?|abuelos?|abuelas?|hijos?|hijas?|tios?|tias?|primos?|primas?)\\b',
  'i')

/** Contexto que se enseña al médico a cada lado, para que juzgue sin abrir el audio. */
const CONTEXTO_ATRAS = 40
const CONTEXTO_ADELANTE = 60

/**
 * La primera vez que la nota nombra el término **sin encuadrarlo**.
 *
 * Recorre todas las apariciones de todas las formas y devuelve la más temprana
 * cuya ventana previa no trae la marca de encuadre. Que una aparición esté bien
 * escrita ya no dice nada sobre las siguientes: cada una se juzga sola.
 *
 * @param textoNota  la nota tal cual, que es la que se cita.
 * @param formas     las maneras de escribir el término («tvp», «trombosis»…).
 * @param encuadrada qué marca previa deja la mención bien escrita. Es de cada
 *   módulo: la negación y el antecedente no se encuadran igual.
 * @returns el fragmento a enseñar, o `null` si todas venían encuadradas — o si
 *   la nota no nombra el término.
 */
export function primeraMencionSinEncuadre(
  textoNota: string,
  formas: readonly string[],
  encuadrada: RegExp,
): string | null {
  const t = sinAcentos(textoNota)

  /**
   * Se ordenan por POSICIÓN, no por el orden de la lista de formas. Con una sola
   * aparición da igual —es el caso de siempre— y con varias, citar la primera de
   * la nota es lo que el médico espera leer.
   */
  const posiciones: number[] = []
  for (const forma of formas) {
    const aguja = sinAcentos(forma)
    if (!aguja) continue
    for (let i = t.indexOf(aguja); i >= 0; i = t.indexOf(aguja, i + 1)) posiciones.push(i)
  }

  for (const idx of [...new Set(posiciones)].sort((a, b) => a - b)) {
    const crudo = textoNota.slice(Math.max(0, idx - VENTANA_ENCUADRE), idx)
    /**
     * El encuadre se busca sobre el texto SIN acentos. Las marcas de los tres
     * juegos se escriben sin acento, así que normalizar no puede quitar
     * coincidencias: sólo añade tolerancia a cómo venga escrita la nota.
     */
    const antes = sinAcentos(crudo.slice(crudo.search(FIN_DE_ORACION)))
    if (encuadrada.test(antes) || NO_ES_DEL_PACIENTE.test(antes)) continue
    return textoNota.slice(Math.max(0, idx - CONTEXTO_ATRAS), idx + CONTEXTO_ADELANTE).trim()
  }
  return null
}

export const POR_QUE_NO_BASTA_LA_PRIMERA =
  'Una nota bien escrita registra el antecedente o la negación arriba y luego ' +
  'redacta la impresión diagnóstica abajo. Mirar sólo la primera aparición hace ' +
  'que la mención correcta silencie a la incorrecta: cuanto mejor redactada la ' +
  'nota, más ciego el guardián. Cada aparición se juzga sola.'
