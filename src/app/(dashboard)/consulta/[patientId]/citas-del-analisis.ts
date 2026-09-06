/**
 * LAS CITAS DEL ANÁLISIS, COMPROBADAS ANTES DE ENTRAR A LA NOTA — RT-004.
 *
 * ── QUÉ FALLABA (Panel de Lujo 2026-09, equipo rojo) ────────────────────────
 *
 * «Análisis basado en evidencia» pegaba el texto del modelo en una sección de la
 * nota y le añadía debajo un bloque «Referencias:» con PMIDs reales de PubMed.
 * Entre una cosa y la otra no había NINGUNA comprobación: un «[4]» con dos
 * referencias entraba literal, con el aspecto exacto que un médico lee como
 * «esto está respaldado», a una nota que se firma y que es inmutable.
 *
 * `limpiarMarkdown` no lo resuelve —sólo colapsa `[texto](url)`—, y la
 * comprobación determinista de rango existía como función LOCAL de otra
 * pantalla (`/consultor`), así que el segundo consumidor de la misma ruta nació
 * sin ella.
 *
 * ── QUÉ HACE ────────────────────────────────────────────────────────────────
 *
 * Marca. No borra. Una afirmación sin respaldo bibliográfico puede seguir siendo
 * buen razonamiento clínico —consenso, fisiopatología, experiencia—; lo que no
 * puede es seguir pareciendo respaldada. Es el criterio que ya fijó
 * `src/lib/evidencia/verificar-la-cita.ts`.
 *
 * ── QUÉ NO HACE ─────────────────────────────────────────────────────────────
 *
 * No comprueba que un `[n]` DENTRO de rango diga lo que la frase afirma: para
 * eso hace falta el PASAJE literal del artículo y `verificarAfirmaciones`, que
 * es el módulo canónico y ya existe — pero la ruta que alimenta a esta pantalla
 * (`/api/consultor-evidencia`) no devuelve pasajes. Queda declarado como la
 * parte (c) de RT-004.
 *
 * Módulo PURO.
 */

/** Números de cita `[n]` presentes en el texto, sin repetir y en orden. */
export function citasEnTexto(texto: string): number[] {
  const s = new Set<number>()
  for (const m of texto.matchAll(/\[(\d{1,2})\]/g)) s.add(parseInt(m[1], 10))
  return [...s].sort((a, b) => a - b)
}

export interface AnalisisComprobado {
  /** El texto con las citas sin fuente marcadas y, si hace falta, su encabezado. */
  texto: string
  /** Las citas que no corresponden a ninguna referencia. */
  fueraDeRango: number[]
  /** `true` si el análisis citó sin que hubiera una sola fuente contra la que comprobar. */
  sinFuentes: boolean
}

/**
 * Comprueba los `[n]` del análisis contra el número de referencias que lo
 * acompañan y devuelve el texto listo para escribirse en la nota.
 */
export function comprobarCitasDelAnalisis(texto: string, cuantasReferencias: number): AnalisisComprobado {
  const citadas = citasEnTexto(texto)
  const fueraDeRango = citadas.filter(n => n < 1 || n > cuantasReferencias)
  let out = texto
  for (const n of fueraDeRango) out = out.split(`[${n}]`).join(`[${n} — sin fuente]`)

  const sinFuentes = cuantasReferencias === 0 && citadas.length > 0
  if (sinFuentes) {
    out = 'No se pudo consultar PubMed en este análisis: las citas que aparecen abajo NO tienen '
      + 'fuente que las respalde. Revísalas antes de firmar.\n\n' + out
  } else if (fueraDeRango.length > 0) {
    out = `Revisar antes de firmar: ${fueraDeRango.length} cita${fueraDeRango.length === 1 ? '' : 's'} `
      + `(${fueraDeRango.map(n => `[${n}]`).join(', ')}) no corresponde${fueraDeRango.length === 1 ? '' : 'n'} `
      + `a ninguna de las ${cuantasReferencias} referencias de abajo; quedan marcadas en el texto.\n\n` + out
  }
  return { texto: out, fueraDeRango, sinFuentes }
}
