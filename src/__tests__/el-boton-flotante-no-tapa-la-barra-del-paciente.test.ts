/**
 * GOLDEN — el botón flotante no se pone encima de la barra del paciente.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Midiendo por primera vez `/mi/[token]` —el portal del paciente—, que este
 * carril nunca había mirado. Hizo falta acuñar un token HMAC con el mismo
 * secreto que el servidor; hasta entonces la superficie estaba sin medir por no
 * poder entrar en ella.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * A 390px, axe marcó el destino **«Perfil»** como objetivo táctil insuficiente.
 * No por pequeño —la caja mide 78×59— sino por **tapado**: `.theme-toggle`
 * (fijo, `bottom: 16px; right: 16px`, z-index 199) le caía encima y dejaba
 * **22px útiles**.
 *
 * Comprobado en el navegador con `elementFromPoint`: en el centro del botón
 * «Perfil» contestaba `BUTTON.theme-toggle`. **El paciente toca su perfil y lo
 * que pasa es que cambia el color de la pantalla.**
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La regla RTC-32 de `globals.css` retiró la convivencia entre botones
 * flotantes razonando que sólo quedaba el toggle «fuera del shell —login,
 * registro, marketing—», donde flota sobre formularios. La lista era correcta y
 * estaba **incompleta**: el portal del paciente también vive fuera del shell, y
 * allí debajo no hay un formulario sino su barra de destinos.
 *
 * Una regla retirada porque su causa desapareció en las superficies que alguien
 * enumeró, con una superficie que no estaba en la lista. Es la familia que este
 * carril lleva encontrando toda la vuelta, y esta vez le tocó al paciente.
 *
 * ── POR QUÉ ESTE CASO NO ES UNA TAUTOLOGÍA ──────────────────────────────────
 *
 * No basta con comprobar que la regla existe: hay que comprobar que **hace
 * falta**. Por eso el caso central compara el `bottom` de base del toggle con
 * el alto de la barra: mientras el primero sea menor, sin la regla habría
 * choque. Si mañana alguien mueve el toggle a otro sitio y la regla sobra, este
 * caso lo dirá en vez de quedarse pidiendo algo inútil.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando la regla de `globals.css`, cae. Quitando la clase de la barra en el
 * portal, cae (la regla seguiría escrita y **no se aplicaría a nada**, que es
 * la forma silenciosa de este defecto).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Escáner de fuente: no abre el navegador. El solape se midió a mano —antes
 *   `elementFromPoint` daba el toggle, después da el botón— y **eso no está
 *   automatizado**.
 * · Sólo mira ESTE choque. Otros elementos fijos del portal no se revisan.
 * · No juzga los 60px: son el alto medido de la barra hoy, a 390px.
 * · **Sólo cubre el choque del TELÉFONO.** En escritorio la barra pasó a ser
 *   una dársena centrada y el toggle vuelve a `bottom: 24px`; que no se toquen
 *   ahí se midió con `arnes:nada-tapa` a 1440, no lo comprueba este archivo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const CSS = readFileSync('src/app/globals.css', 'utf8')
const PORTAL = readFileSync('src/app/mi/[token]/page.tsx', 'utf8')

/** El `bottom` de base del botón flotante, en píxeles. */
function bottomDeBase(): number {
  const bloque = CSS.slice(CSS.indexOf('.theme-toggle {'))
  const m = bloque.slice(0, bloque.indexOf('}')).match(/bottom:\s*(\d+)px/)
  return m ? Number(m[1]) : NaN
}

describe('la barra de destinos del paciente sigue siendo lo que la regla espera', () => {
  /**
   * ── POR QUÉ ESTOS DOS CASOS CAMBIARON DE SITIO, Y NO DE EXIGENCIA ──────────
   *
   * Pedían `position: 'fixed', left: 0, right: 0, bottom: 0` y
   * `repeat(5, 1fr)` **dentro del JSX**. Eran ciertos, y por eso mismo eran el
   * problema: mientras la colocación viviera en un `style` en línea, la barra
   * no podía comportarse distinto en un escritorio —un estilo en línea gana a
   * toda media query— y a 1440 salía de 1440 × 60 con el destino activo en una
   * losa cian de 288 px bajo una columna de 560. Un guardián que exige el
   * estilo en línea es un guardián que impide arreglarlo.
   *
   * Lo que la regla del toggle necesita saber sigue siendo lo mismo: que la
   * barra existe, que va **fija abajo en el teléfono** —que es el ancho donde
   * se midió el choque, 390px— y que tiene cinco destinos, que es lo que la
   * hace alta. Eso se comprueba ahora donde vive: en la hoja.
   */
  it('existe, es fija y va abajo en el teléfono', () => {
    expect(PORTAL, 'la barra perdió su ancla de estilo').toContain('className="mi-barra-destinos"')
    expect(PORTAL, 'volvió la colocación en línea, que impide la forma de escritorio')
      .not.toMatch(/mi-barra-destinos" style=/)
    const base = CSS.slice(CSS.indexOf('.mi-barra-destinos {'))
    const bloque = base.slice(0, base.indexOf('}'))
    expect(bloque, 'la barra dejó de ir fija abajo').toMatch(/position: fixed/)
    expect(bloque).toMatch(/bottom: 0/)
    expect(bloque).toMatch(/left: 0/)
    expect(bloque).toMatch(/right: 0/)
  })

  it('sigue teniendo cinco destinos, que es lo que la hace tan alta', () => {
    // Si bajara a menos, el alto cambiaría y el número de la regla también.
    // Se cuenta en el JSX —que es donde se declaran— y se comprueba que la
    // rejilla de la hoja siga repartiéndose entre los mismos cinco.
    const destinos = (PORTAL.match(/\{ id: '\w+' as const,/g) ?? []).length
    expect(destinos, 'cambió el número de destinos del portal').toBe(5)
    expect(CSS).toMatch(/grid-template-columns: repeat\(5, 1fr\)/)
  })

  it('y en escritorio NO es la misma barra estirada — ahí el choque es otro', () => {
    /**
     * El desplazamiento del toggle está calculado para la barra del TELÉFONO,
     * pegada al borde y de lado a lado. En escritorio la barra es una dársena
     * centrada sobre la columna de contenido, así que ni se tocan y el toggle
     * vuelve a su sitio. Si algún día la barra volviera a ser una sola forma,
     * este caso lo diría — y habría que rehacer el número de la regla.
     */
    const i = CSS.indexOf('@media (min-width: 900px) {\n  .mi-barra-destinos {')
    expect(i, 'la barra volvió a tener una sola forma').toBeGreaterThan(-1)
    expect(CSS.slice(i, i + 320)).toMatch(/transform: translateX\(-50%\)/)
    expect(CSS, 'el toggle se quedó apartado donde ya no hace falta')
      .toMatch(/@media \(min-width: 900px\) \{\s*html:has\(\.mi-barra-destinos\) \.theme-toggle \{/)
  })
})

describe('el botón flotante no tapa la barra', () => {
  it('la regla existe y aparta el toggle por encima de la barra', () => {
    expect(CSS, 'volvió a caer sobre la barra del paciente')
      .toMatch(/html:has\(\.mi-barra-destinos\) \.theme-toggle \{[^}]*bottom:\s*calc\(/)
  })

  it('lo aparta al menos el alto REAL de la barra, medido a 390px', () => {
    const m = CSS.match(/html:has\(\.mi-barra-destinos\) \.theme-toggle \{[^}]*bottom:\s*calc\((\d+)px/)
    expect(m, 'la regla dejó de declarar su desplazamiento en px').not.toBeNull()
    // 60px es lo que mide la barra hoy. Menos que eso vuelve a solapar.
    expect(Number(m![1])).toBeGreaterThanOrEqual(60)
  })

  it('y la regla HACE FALTA: sin ella el toggle caería dentro de la barra', () => {
    /**
     * Éste es el caso que impide que esto se convierta en una prueba que sólo
     * comprueba su propio arreglo. Mientras el `bottom` de base sea menor que
     * el alto de la barra, la regla está corrigiendo un choque real.
     */
    const base = bottomDeBase()
    expect(base, 'no se pudo leer el bottom de base de .theme-toggle').not.toBeNaN()
    expect(
      base,
      `el toggle ya no caería sobre una barra de 60px (bottom base ${base}px): ` +
      'si de verdad se movió, esta regla sobra y hay que retirarla, no dejarla puesta',
    ).toBeLessThan(60)
  })

  it('el porqué queda escrito donde se lee la regla', () => {
    // Sin esto, dentro de seis meses parece un número mágico y se borra.
    // Tolerante al salto de línea: el comentario va justificado a 78 columnas
    // y la frase se parte. Pedirla en una línea ataba la prueba al ancho del
    // párrafo, no a lo que dice.
    expect(CSS).toMatch(/22px\s+útiles/)
    expect(CSS).toMatch(/portal del paciente\s+también vive fuera/)
  })
})
