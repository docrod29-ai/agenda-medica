/**
 * LA CMI TAL COMO LA REPORTA EL LABORATORIO — con su símbolo.
 *
 * ── POR QUÉ ESTÁ AQUÍ Y NO EN LA PANTALLA ────────────────────────────────────
 *
 * Esta función vivía dentro de `antibiograma/page.tsx`. El camino MANUAL —el
 * médico teclea la CMI— la usaba y conservaba el símbolo; el camino de la FOTO
 * —`vision.ts`, que es la función estrella— no la veía siquiera: reenviaba el
 * número pelado y **nunca asignaba `cmiCensurada`**.
 *
 * El mismo reporte daba dos respuestas distintas según cómo entrara:
 *
 *   | camino  | entrada al motor            | categoría |
 *   |---------|-----------------------------|-----------|
 *   | foto    | `{ cmi: 2 }`                | **S**     |
 *   | manual  | `{ cmi: 2, censurada: '>' }`| **I**     |
 *
 * La decisión del Dr. —«una CMI es un intervalo, no un número»— se aplicaba sólo
 * cuando teclea, y se saltaba en silencio cuando fotografía.
 *
 * Con una implementación por camino, esto vuelve a pasar. Por eso hay una sola.
 *
 * ── POR QUÉ EL SÍMBOLO ES INFORMACIÓN CLÍNICA ────────────────────────────────
 *
 * Antes se tiraba el `<`/`>`/`≤`/`≥` y sólo se devolvía el número. Eso hacía que
 * «>500» en el tamiz de gentamicina de alto nivel se comparara como 500 contra
 * un umbral estricto `> 500`: daba falso, el HLAR no se declaraba, y en su lugar
 * se imprimía la didáctica de que el aminoglucósido «aporta por sinergia» — el
 * consejo contrario al correcto en endocarditis.
 *
 * «>16» significa que el valor real está **por encima** del rango probado. No es
 * 16.
 *
 * Módulo PURO.
 */

export interface CmiLeida {
  valor: number
  /** El símbolo, si lo había. `undefined` = valor exacto. */
  censurada?: '>' | '<'
}

/**
 * Lee la CMI del reporte conservando el símbolo.
 *
 * Acepta `"≤0.5"`, `"< 0.5"`, `">16"`, `"≥ 16"`, `"2/38"` (TMP-SMX: toma el
 * componente activo, que es el del punto de corte) y `"0,5"` con coma decimal.
 *
 * @returns `null` cuando no hay número que leer. **No se inventa un valor**: una
 *   CMI ausente y una CMI de cero son cosas distintas, y confundirlas cambia la
 *   categoría.
 */
export function parseCMI(s: string | number | undefined | null): CmiLeida | null {
  if (s === null || s === undefined) return null
  if (typeof s === 'number') return Number.isFinite(s) ? { valor: s } : null
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const censurada = /^[>≥]/.test(t) ? '>' as const : /^[<≤]/.test(t) ? '<' as const : undefined
  // Razón X/Y (p. ej. TMP-SMX «≤2/38») → el primer número es el componente
  // activo, que es contra el que está definido el punto de corte.
  const ratio = t.match(/^[<≤>≥=]?\s*([\d.]+)\s*\/\s*[\d.]+/)
  if (ratio) {
    const n = Number(ratio[1])
    return Number.isFinite(n) ? { valor: n, censurada } : null
  }
  const m = t.match(/[<≤>≥=]?\s*([\d.]+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? { valor: n, censurada } : null
}

export const POR_QUE_UNA_SOLA_IMPLEMENTACION =
  'El camino manual conservaba el símbolo y el de la foto no lo miraba siquiera: ' +
  'el mismo reporte daba S por foto e I tecleado. Con una implementación por ' +
  'camino esto vuelve a pasar, y vuelve a pasar en silencio — nadie compara los ' +
  'dos resultados del mismo antibiograma.'
