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
  /,?\s*(?:no\s+(?:se\s+)?especificad[oa]s?\s+en\s+(?:la\s+)?(?:transcripci[oó]n|grabaci[oó]n|dictado))/gi,
  /,?\s*no\s+se\s+transcribi[oó]/gi,
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
