/**
 * FORMATO DE LA NOTA DE UCI — narrativa o lista, sin cambiar una palabra.
 *
 * El Dr., el 30-jul-2026: «me gustaría que tuviera todos los datos pero más
 * compacta, no en lista, más de manera narrativa clínica».
 *
 * ── POR QUÉ ESTO NO USA IA ───────────────────────────────────────────────────
 *
 * La tentación es mandarle la sección a un modelo y pedirle «redáctalo bonito».
 * Y ahí es donde una nota clínica se estropea: el modelo reordena, resume, elige
 * qué omitir y de paso puede tocar una cifra. Se pagaría por el privilegio de
 * revisar cada palabra.
 *
 * No hace falta. Cada dato que produce `nota.ts` YA es una oración completa con
 * su punto: «PEEP 8 cmH₂O.», «Driving pressure 15 cmH₂O (dentro de meta).». El
 * aspecto de lista viene sólo de que cada una va en su propio renglón.
 *
 * Así que la narrativa es **unirlas en párrafo**. Mismas palabras, mismas cifras,
 * mismo orden; cambia el salto de línea por un espacio. Nada que revisar.
 *
 * ── LO QUE NO SE MEZCLA EN EL PÁRRAFO ────────────────────────────────────────
 *
 * Las advertencias. Una línea que empieza con ⚠ es una alerta de seguridad —
 * «GCS 13 en paciente intubado es incoherente»— y enterrarla a media frase es
 * exactamente cómo se deja de leer. Van aparte, después del párrafo.
 *
 * Módulo PURO.
 */

export interface SeccionTexto { key: string; label: string; value: string }

export type FormatoNota = 'narrativa' | 'lista'

/** Una línea es advertencia si empieza con el símbolo de aviso. */
const esAdvertencia = (l: string) => /^\s*[⚠!]/.test(l)

/**
 * Una línea es un ENCABEZADO interno del médico si no acaba en punto y es corta:
 * «Signos vitales», «Sedoanalgesia». En narrativa estorban dentro del párrafo,
 * pero tirarlas perdería la estructura que él escribió, así que abren párrafo.
 */
const esSubtitulo = (l: string) => {
  const t = l.trim()
  return t.length > 0 && t.length <= 40 && !/[.:;]$/.test(t) && !/^\s*[*·•-]/.test(t)
}

/**
 * Convierte el texto de una sección en prosa.
 *
 * @param texto las líneas tal como las produjo `nota.ts`.
 * @returns el mismo contenido en párrafos. Las advertencias quedan aparte.
 */
export function aNarrativa(texto: string): string {
  if (!texto?.trim()) return ''
  const lineas = texto.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '')

  const parrafos: string[] = []
  let actual: string[] = []
  const cerrar = () => { if (actual.length) { parrafos.push(actual.join(' ')); actual = [] } }

  for (const l of lineas) {
    if (esAdvertencia(l)) { cerrar(); parrafos.push(l.trim()); continue }
    if (esSubtitulo(l)) { cerrar(); actual.push(`${l.trim()}:`); continue }
    // Una viñeta suelta pierde el bullet al entrar en la prosa.
    actual.push(l.trim().replace(/^[*·•-]\s*/, ''))
  }
  cerrar()
  return parrafos.join('\n\n')
}

/**
 * Aplica el formato elegido a todas las secciones.
 *
 * `lista` devuelve exactamente lo que había: es el comportamiento de siempre y
 * no se toca, porque hay médicos que prefieren leer por renglones.
 */
export function formatear<T extends SeccionTexto>(secciones: T[], formato: FormatoNota): T[] {
  if (formato === 'lista') return secciones
  return secciones.map(s => ({ ...s, value: aNarrativa(s.value) }))
}

/**
 * ¿Cuánto se compacta? Para poder DECIRLO en la pantalla en vez de prometerlo.
 */
export function renglonesAhorrados(secciones: SeccionTexto[]): number {
  const cuenta = (xs: SeccionTexto[]) =>
    xs.reduce((n, s) => n + s.value.split('\n').filter(l => l.trim()).length, 0)
  return Math.max(0, cuenta(secciones) - cuenta(formatear(secciones, 'narrativa')))
}

export const POR_QUE_NO_LA_REDACTA_UN_MODELO =
  'Cada dato que produce la nota ya es una oración completa. La narrativa sólo ' +
  'las une en párrafo: mismas palabras, mismas cifras, mismo orden. Pedirle a un ' +
  'modelo que «lo redacte bonito» le daría permiso de reordenar, resumir, omitir ' +
  'y tocar una cifra — y habría que revisar cada palabra. Las advertencias van ' +
  'aparte: enterrar un aviso de seguridad a media frase es cómo se deja de leer.'
