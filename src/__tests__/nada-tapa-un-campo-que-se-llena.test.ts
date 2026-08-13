/**
 * NADA TAPA UN CAMPO QUE SE ESTÁ LLENANDO — REG-236 · I-13.
 *
 * ── CÓMO SE ENCONTRÓ ────────────────────────────────────────────────────────
 *
 * El médico mandó tres capturas de la consulta en su iPhone. En una, el botón
 * flotante de ayuda estaba **encima del campo Peso**; en otra, **encima de
 * Exploración física**.
 *
 * ── POR QUÉ NINGÚN BARRIDO LO CAZÓ ──────────────────────────────────────────
 *
 * Porque el instrumento no lo buscaba. El medidor que se usó en las catorce
 * pantallas públicas hacía dos cosas que juntas lo hacían ciego a esto:
 *
 *   1. **Saltaba los elementos `position: fixed`** al buscar desbordes — con
 *      razón: un elemento fijo nunca «desborda», está anclado a la ventana.
 *   2. **No comprobaba si un elemento TAPA a otro.** Medía contraste, tamaño de
 *      toque, etiquetas y desborde. Encimarse no estaba en la lista.
 *
 * Es un hueco del instrumento, no del producto, y por eso vale la pena
 * escribirlo: **una auditoría sólo encuentra lo que sabe buscar**.
 *
 * ── POR QUÉ NO SE ARREGLA MOVIÉNDOLOS ───────────────────────────────────────
 *
 * Con `position: fixed` y `right: 16px`, en una pantalla de 390 px el botón cae
 * SIEMPRE dentro de la columna del formulario. No hay sitio a donde moverlo, y
 * reservarle margen le robaría ancho a la nota — que es lo que el médico lee.
 *
 * La solución es de MOMENTO, no de sitio: mientras un campo tiene el foco, se
 * apartan. Vuelven al soltar. El botón de ayuda sirve para cuando uno está
 * perdido, no para cuando está escribiendo un peso.
 *
 * ── POR QUÉ CON `:has()` Y NO CON JAVASCRIPT ────────────────────────────────
 *
 * Cero código que mantener, cero escuchadores que quitar al desmontar, cero
 * estado que se quede pegado si algo falla. Y donde `:has()` no exista, la regla
 * simplemente no aplica: se queda el comportamiento de hoy, que es el peor caso
 * — no el único.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('los botones flotantes se apartan mientras se escribe', () => {
  it('la regla existe y cubre los tres tipos de campo', () => {
    const bloque = /html:has\(input:focus, textarea:focus, select:focus\)/g
    expect(css.match(bloque)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('cubre los DOS botones: el de ayuda y el de tema', () => {
    /**
     * Los dos son `position: fixed` a la derecha. Arreglar uno y dejar el otro
     * sería mover el problema tres centímetros.
     */
    expect(css).toMatch(/html:has\([^)]*\) \.theme-toggle/)
    expect(css).toMatch(/html:has\([^)]*\) \.boton-ayuda-fab/)
  })

  it('además de invisibles, dejan de estorbar al dedo', () => {
    // `opacity: 0` sin `pointer-events: none` deja un botón invisible que sigue
    // robando el toque — peor que verlo.
    const bloque = css.slice(css.indexOf('LOS BOTONES FLOTANTES NO TAPAN'))
    expect(bloque).toMatch(/opacity: 0;\s*\n\s*pointer-events: none;/)
  })

  it('sólo en pantalla estrecha, que es donde el problema existe', () => {
    /**
     * En escritorio hay sitio de sobra y el botón no tapa nada. Esconderlo ahí
     * sería quitar una ayuda por un problema que no tiene esa pantalla.
     */
    const bloque = css.slice(css.indexOf('LOS BOTONES FLOTANTES NO TAPAN'))
    expect(bloque).toMatch(/@media \(max-width: 900px\)/)
  })

  it('la transición existe, para que no sea un parpadeo', () => {
    // V15-MOTION-001 (1ª rebanada): la duración dejó de escribirse a mano
    // (140ms ease) y habla los tokens de movimiento. Lo que este caso protege
    // no es la cifra: es que el fade EXISTA — el guardián sigue al mecanismo,
    // como el del alto táctil de la franja y el del aviso push antes que él.
    expect(css).toMatch(/\.theme-toggle, \.boton-ayuda-fab \{ transition: opacity var\(--mov-rapido\) var\(--mov-curva\); \}/)
  })

  it('queda escrito POR QUÉ ningún barrido lo cazó', () => {
    /**
     * El hueco era del instrumento: saltaba los elementos fijos y no
     * comprobaba si algo tapa a otra cosa. Si no queda escrito, el próximo
     * barrido vuelve a ser ciego a lo mismo.
     */
    expect(css).toMatch(/SALTABA los elementos fijos/)
    expect(css).toMatch(/no comprobaba si algo\s*\n?\s*TAPA a otra cosa/)
  })
})
