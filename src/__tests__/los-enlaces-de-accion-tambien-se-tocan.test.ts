/**
 * GOLDEN — los enlaces que son ACCIONES también se pueden tocar.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `.claude/rules/design-system.md` pone «objetivo táctil por debajo de 44×44»
 * entre los mínimos que FALLAN la compuerta. Medido a 390 px con hit-testing:
 * **doce** enlaces de acción por debajo de 44 px de alto. Entre ellos los dos
 * que conectan las dos puertas del producto:
 *
 *   · portada → «Inicia sesión aquí →»  129×18
 *   · login   → «Crea una gratis →»     113×18
 *
 * Dieciocho píxeles de alto en un teléfono. Son literalmente el camino de ida
 * y vuelta entre registrarse y entrar.
 *
 * ── POR QUÉ EXISTÍA ─────────────────────────────────────────────────────────
 *
 * No es un olvido nuevo: `v15-a11y-tactiles-de-enlace` ya lo había cerrado
 * para `a.nx-ident` y `.nx-cta-aviso`, y **declaró lo que no cubría** — «un
 * enlace nuevo con otra clase no está vigilado por esto». La causa raíz que
 * aquel guardián nombra sigue en pie: el bloque `@media (pointer: coarse)` de
 * `globals.css` cubre `.btn`, `button`, `select`, `input` y `textarea`, pero
 * **nunca cubrió `<a>`**. Todo control que sea un enlace nace sin mínimo
 * táctil.
 *
 * ── LA REGLA, QUE ES LA QUE YA HABÍA ────────────────────────────────────────
 *
 * No se pone `min-height`: engordaría lo visible y movería la maqueta. Se
 * estira el ÁREA DE GOLPE con un pseudo invisible centrado
 * (`max(100%, 44px)`), y **sólo en puntero grueso** — en escritorio el clic
 * fino no lo necesita y estirarlo robaría clics de selección de texto.
 *
 * Aquí sólo se añade la nueva familia al mismo mecanismo.
 *
 * ── CÓMO SE MIDE, Y LA TRAMPA QUE TRAE ──────────────────────────────────────
 *
 * `getBoundingClientRect` **no ve el pseudo**: una radiografía que lea rects
 * vuelve a ver 18 px donde el dedo sí llega. Aquel guardián lo dejó escrito y
 * este carril tropezó igual dos veces antes de obedecerlo:
 *
 *   1. leyendo rects en vez de hit-testear;
 *   2. hit-testeando elementos **por debajo del pliegue**, donde
 *      `elementFromPoint` no ve nada.
 *
 * El instrumento correcto está en `scripts/carril-excelencia/tactiles.mjs`:
 * trae el elemento a la pantalla, y busca el alcance real hacia arriba y hacia
 * abajo en vez de suponerlo simétrico — el pseudo se sesga 2 px hacia el
 * pulgar a propósito.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - Esto comprueba que la clase esté puesta y que la regla exista dentro del
 *   bloque de puntero grueso. Los píxeles los mide el arnés, no CI.
 * - Quedan dos enlaces del pie por debajo (40 y 42 px medidos): sus pseudos se
 *   pisan entre sí en una fila apretada. Está declarado en el acta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const CSS = leer('src/app/globals.css')
const PORTADA = leer('src/app/page.tsx')
const LOGIN = leer('src/app/login/page.tsx')
/** El héroe salió de `page.tsx` a su propio componente con el rediseño. */
const HEROE = leer('src/components/landing/HeroConsulta.tsx')

describe('la nueva familia usa el mecanismo que ya existía', () => {
  it('el pseudo de golpe cubre también `.nx-enlace-tactil`', () => {
    /**
     * ESTE CASO CAMBIÓ DE FORMA, NO DE REGLA (REG-442).
     *
     * Pedía la lista de selectores LITERAL —`a.nx-ident, .nx-cta-aviso,
     * .nx-enlace-tactil { position: relative`— y por eso se puso rojo el día
     * que la familia creció: `.cita-principal`, la fila de cita de «Hoy», entró
     * al pseudo porque se tocaba en 39 px y cada fila abre un paciente.
     *
     * Añadir un miembro a esta familia no es una regresión: es exactamente lo
     * que el guardián original pedía que pasara cuando dijo «un enlace nuevo con
     * otra clase no está vigilado por esto». Lo que sí hay que seguir
     * comprobando —y ahora se comprueba de verdad— es que **cada** clase de la
     * familia lleve su `position: relative`: sin él, el pseudo absoluto se ancla
     * al primer ancestro posicionado y el estirón cae en otro sitio, sin que
     * falle nada visible.
     */
    expect(CSS).toMatch(/\.nx-enlace-tactil::before/)
    const iRel = CSS.indexOf('position: relative; z-index: 1;')
    expect(iRel, 'ya no está la regla que ancla el pseudo').toBeGreaterThan(0)
    const lista = CSS.slice(CSS.lastIndexOf('\n', iRel), iRel)
    for (const clase of ['a.nx-ident', '.nx-cta-aviso', '.nx-enlace-tactil']) {
      expect(lista, `${clase} salió de la regla que ancla el pseudo`).toContain(clase)
    }
  })

  it('y vive DENTRO del bloque de puntero grueso — fuera robaría clics', () => {
    /**
     * Es la guarda de alcance que el guardián original ya exigía para las
     * otras dos familias: en escritorio el clic fino no necesita 44 px, y
     * estirar el área le quitaría al usuario la selección de texto vecina.
     */
    const iCoarse = CSS.indexOf('@media (pointer: coarse)')
    const iRegla = CSS.indexOf('.nx-enlace-tactil::before')
    expect(iCoarse).toBeGreaterThan(-1)
    expect(iRegla).toBeGreaterThan(iCoarse)
    // …y antes de que ese bloque cierre: se busca el siguiente @media.
    const iSiguienteMedia = CSS.indexOf('@media', iCoarse + 10)
    expect(iRegla, 'la regla quedó fuera del bloque coarse').toBeLessThan(iSiguienteMedia)
  })

  it('el pseudo sigue midiendo al menos 44 y sin contenido visible', () => {
    const i = CSS.indexOf('.nx-enlace-tactil::before')
    const bloque = CSS.slice(i, CSS.indexOf('}', i))
    expect(bloque).toContain("content: ''")
    expect(bloque).toMatch(/width: max\(100%, 44px\)/)
    expect(bloque).toMatch(/height: max\(100%, 44px\)/)
  })
})

describe('los caminos entre las dos puertas del producto', () => {
  /**
   * EL CAMINO A LA SESIÓN SE PUEDE TOCAR — el requisito, no la etiqueta.
   *
   * Nació apuntando al literal «Inicia sesión aquí →». La transformación de
   * producto reescribió la portada y ese texto pasó a «Ya tengo cuenta»: el
   * caso se puso rojo sin que el blanco de toque hubiera empeorado.
   *
   * Se reescribe como REGLA: el enlace de texto que lleva a `/login` desde la
   * portada tiene que llevar la clase, se llame como se llame. Probado al
   * revés quitándosela — falla.
   */
  it('el camino de la portada a la sesión se puede tocar', () => {
    const enlaces = [...HEROE.matchAll(/<Link[^>]*href="\/login"[^>]*>/g)].map(m => m[0])
    expect(enlaces.length, 'la portada perdió el camino a iniciar sesión').toBeGreaterThan(0)
    for (const e of enlaces) {
      expect(e, `enlace a login de 18 px de alto: ${e}`).toContain('nx-enlace-tactil')
    }
  })

  it('«Crea una gratis →» del inicio de sesión, también', () => {
    const i = LOGIN.indexOf('Crea una gratis')
    const etiqueta = LOGIN.slice(LOGIN.lastIndexOf('<Link', i), i)
    expect(etiqueta, 'el enlace a registro sigue midiendo 18px de alto').toContain('nx-enlace-tactil')
  })

  /**
   * Y TODOS LOS DEMÁS. El caso anterior contaba: «al menos once». Contar ata el
   * guardián al TAMAÑO de la página — al rediseñarla, con menos enlaces de
   * texto y más botones de verdad, la cuenta bajó a dos sin que ningún blanco
   * de toque hubiera encogido.
   *
   * La regla que importa no es cuántos hay: es que **ninguno se quede sin**.
   * Se listan los `<Link>` que rinden texto pelado —sin `btn`, que ya mide 44—
   * y se exige la clase en todos.
   */
  it('y los demás enlaces de acción de la portada', () => {
    const desnudos: string[] = []
    for (const fuente of [PORTADA, HEROE]) {
      for (const m of fuente.matchAll(/<Link[^>]*>/g)) {
        const e = m[0]
        // Ya mide 44 de alto por ser botón — incluida la forma con plantilla,
        // `className={\`btn ${…}\`}`, que la versión anterior de este filtro no
        // veía porque sólo miraba comillas dobles.
        if (/className=(?:"[^"]*|\{`[^`]*)\bbtn\b/.test(e)) continue
        if (/nx-nav-|nx-plan|nx-hero-acciones/.test(e)) continue // filas y botones con su propio alto
        if (!e.includes('nx-enlace-tactil')) desnudos.push(e.slice(0, 90))
      }
    }
    expect(desnudos, `enlaces de texto sin blanco de toque:\n${desnudos.join('\n')}`).toEqual([])
  })
})
