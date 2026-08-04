/**
 * LA CABECERA QUE HAY QUE MANDAR Y EL AUDIO QUE NO HAY QUE REPETIR.
 *
 * ── EL PROBLEMA FÍSICO ───────────────────────────────────────────────────────
 *
 * `MediaRecorder` sólo pone la cabecera del contenedor (EBML/moov) en el PRIMER
 * fragmento. Del segundo en adelante son datos sueltos: un decodificador no
 * puede abrirlos. Por eso, para transcribir un tramo cualquiera hay que
 * anteponerle el primer fragmento — es lo que ya hacía `transcribirEnPartes`.
 *
 * ── EL EFECTO SECUNDARIO QUE NADIE MIRÓ ──────────────────────────────────────
 *
 * Ese primer fragmento **no es sólo cabecera**: son 2 segundos de audio real,
 * con voz dentro. Al anteponerlo a cada lote, las primeras palabras de la
 * consulta se transcriben **una vez por lote** y acaban repetidas en mitad del
 * relato. En una consulta de 20 minutos troceada en cuatro, lo primero que dijo
 * el paciente aparece cuatro veces, intercalado donde no ocurrió.
 *
 * Y si esos 2 segundos llevan una cifra o un fármaco («…meropenem dos
 * gramos…»), el modelo lee la misma indicación repetida en momentos distintos de
 * la consulta. Eso no es ruido: es una orden médica duplicada.
 *
 * ── LO QUE HACE ESTE MÓDULO ──────────────────────────────────────────────────
 *
 * Quita del texto de un lote el eco de la cabecera — y **sólo** si de verdad
 * coincide con el principio del primer lote. Si no coincide, no toca nada:
 * borrar texto que quizá era del paciente sería mucho peor que dejar una
 * repetición.
 *
 * Módulo PURO.
 */

const limpia = (s: string) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:¿?¡!()"'—–-]/g, '')
    .trim()

/**
 * Cuántas palabras del principio se comparan como máximo.
 *
 * La cabecera son ~2 segundos de habla. Doce palabras es holgado para eso y
 * corto para el resto: comparar más arriesgaría recortar frase de verdad si el
 * paciente repitiera algo por su cuenta.
 */
export const MAX_PALABRAS_ECO = 12

/**
 * Quita del inicio de `textoLote` el prefijo que repite el arranque de
 * `textoPrimerLote`.
 *
 * Se compara palabra a palabra, normalizando acentos y puntuación —el motor no
 * transcribe dos veces exactamente igual el mismo audio— y se corta por la
 * coincidencia MÁS LARGA. Sin coincidencia, se devuelve el texto intacto.
 */
export function quitarEcoDeCabecera(textoLote: string, textoPrimerLote: string): string {
  if (!textoLote.trim() || !textoPrimerLote.trim()) return textoLote

  const lote = textoLote.trim().split(/\s+/)
  const primero = textoPrimerLote.trim().split(/\s+/)
  const tope = Math.min(MAX_PALABRAS_ECO, lote.length, primero.length)

  let coinciden = 0
  for (let i = 0; i < tope; i++) {
    if (limpia(lote[i]) !== limpia(primero[i])) break
    coinciden = i + 1
  }

  /**
   * Una sola palabra en común NO es un eco.
   *
   * Casi cualquier par de frases empieza por «el», «y» o «bueno». Recortar por
   * una coincidencia de una palabra borraría contenido real con regularidad.
   */
  if (coinciden < 2) return textoLote
  return lote.slice(coinciden).join(' ')
}

export const POR_QUE_LA_CABECERA_SE_MANDA =
  'MediaRecorder sólo pone la cabecera del contenedor en el PRIMER fragmento; ' +
  'del segundo en adelante son datos sueltos que ningún decodificador abre. Sin ' +
  'anteponerla, todo tramo que no sea el primero se transcribe vacío o falla.'

export const POR_QUE_EL_ECO_SE_QUITA =
  'Ese primer fragmento no es sólo cabecera: son 2 segundos de audio real. ' +
  'Anteponerlo a cada lote repite las primeras palabras de la consulta en mitad ' +
  'del relato, y si llevan una cifra o un fármaco, el modelo lee la misma ' +
  'indicación repetida en momentos distintos.'

export const POR_QUE_NO_SE_RECORTA_A_CIEGAS =
  'Sólo se quita el prefijo que COINCIDE con el arranque del primer lote, y ' +
  'nunca por una sola palabra en común. Borrar texto que quizá dijo el paciente ' +
  'es mucho peor que dejar una repetición: una se ve, la otra no.'
