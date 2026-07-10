/**
 * Utilidades de markdown ligero para las respuestas de IA.
 *
 * La IA responde con markdown (# títulos, **negritas**, - listas). Aquí:
 *  - limpiarMarkdown(): lo convierte a TEXTO PLANO limpio (para meterlo a la
 *    nota clínica, que se imprime como texto — sin #, sin **, sin símbolos).
 *
 * El render bonito (con negritas y títulos con estilo) lo hace <MiniMarkdown/>.
 */

/** Convierte markdown a texto plano legible (sin #, **, etc.). Para la nota. */
export function limpiarMarkdown(md: string): string {
  return md
    .replace(/\r/g, '')
    // Títulos "## Texto" → "Texto" (en su propia línea)
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    // Negritas/itálicas **x** *x* __x__ _x_ → x
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1$2')
    // Viñetas "- " o "* " → "• "
    .replace(/^\s*[-*]\s+/gm, '• ')
    // `código` → código
    .replace(/`([^`]+)`/g, '$1')
    // Enlaces [texto](url) → texto
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')
    // Colapsa 3+ saltos de línea
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
