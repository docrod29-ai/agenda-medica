/**
 * Red de seguridad: quita del TEXTO de la nota banderas internas y comentarios
 * sobre el proceso de transcripción que a veces se cuelan de la IA (deben vivir
 * solo en la metadata, nunca en la prosa clínica). No toca contenido clínico.
 */
const PATRONES: RegExp[] = [
  // Banderas internas de revisión.
  /\s*[—–-]?\s*\(?\s*needs[_\s]?review\s*\)?/gi,
  /\s*[—–-]?\s*\(?\s*(?:por confirmar\s*\(IA\)|baja confianza)\s*\)?/gi,
  // Comentarios sobre la transcripción / audio / grabación.
  /**
   * Participio Y pretérito.
   *
   * El patrón sólo cazaba «no especificado en la grabación». Lo que un modelo
   * escribe de verdad es «no se **especificó** en la grabación» — lo encontró
   * una prueba del corpus oro, no una revisión.
   */
  /,?\s*(?:no\s+(?:se\s+)?(?:especificad[oa]s?|especific[oó]|especifica)\s+en\s+(?:la\s+)?(?:transcripci[oó]n|grabaci[oó]n|dictado|consulta))/gi,
  /,?\s*no\s+se\s+transcribi[oó]/gi,
  /**
   * LA NOTA HABLANDO DE SÍ MISMA — el caso real del 3-ago-2026.
   *
   * Salió en producción: «no se refiere motivo clínico **en este fragmento de
   * consulta**; la entrevista corresponde a la elaboración de historia clínica».
   * Eso no es una nota clínica: es el modelo describiendo su entrada. Y ninguno
   * de los cuatro patrones de arriba lo cazaba.
   *
   * En un expediente, una nota que se describe a sí misma se lee como si el
   * médico no hubiera atendido.
   */
  /,?\s*en\s+(?:est[ea]|el|la)\s+(?:fragmento|segmento|porci[oó]n|parte|tramo)\s+(?:de\s+(?:la\s+)?(?:consulta|conversaci[oó]n|entrevista|grabaci[oó]n|audio|transcripci[oó]n))?/gi,
  /,?\s*(?:seg[uú]n|de\s+acuerdo\s+(?:a|con))\s+(?:la\s+)?(?:transcripci[oó]n|grabaci[oó]n|el\s+audio|el\s+dictado)/gi,
  /,?\s*(?:no\s+se\s+dispone\s+del?|no\s+hay)\s+(?:audio|grabaci[oó]n|transcripci[oó]n)(?:\s+(?:completa|disponible))?/gi,
  /,?\s*(?:el\s+)?(?:fragmento|audio|dictado)\s+(?:proporcionado|recibido|analizado)/gi,
]

export function sanitizarProsa(texto: string | undefined | null): string {
  if (!texto) return ''
  let t = String(texto)
  for (const re of PATRONES) t = t.replace(re, '')
  return t
    .replace(/\(\s*\)/g, '')          // paréntesis que quedaron vacíos
    .replace(/\s+([;,.)])/g, '$1')    // espacio antes de puntuación
    .replace(/\(\s+/g, '(')           // espacio tras "("
    .replace(/\s{2,}/g, ' ')          // espacios dobles
    .replace(/\s*;\s*;/g, ';')        // punto y coma dobles
    .trim()
}
