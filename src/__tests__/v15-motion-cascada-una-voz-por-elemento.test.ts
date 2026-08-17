/**
 * La cascada del cross-fade de tema respeta la voz de los controles — una
 * voz POR ELEMENTO. V15-MOTION-001 (§43 orden 14, §18 paso 8), segunda
 * rebanada.
 *
 * QUÉ FALLABA: la regla agrupada del cross-fade de tema (`html, body, .card,
 * …, .input, .btn, .nav-item, .tab`) venía DESPUÉS de las reglas base y —
 * como `transition` es un shorthand — las REEMPLAZABA enteras: `.btn` perdía
 * su fade de opacity (el atenuado de disabled aparecía a golpe), `.input`
 * perdía box-shadow (el halo de foco no fundía) y los cuatro controles
 * respondían al hover a 200ms en vez de su papel rapido (120ms). Además el
 * fade de los botones flotantes (`.theme-toggle, .boton-ayuda-fab`)
 * sombreaba el shorthand propio del toggle: su hover (color, scale) no
 * transicionaba nada. Y `.card-hover`/`.kpi-card`, cuyo shorthand de
 * micro-interacción también reemplaza a la regla agrupada, perdían el fade
 * de `color` al cambiar de tema.
 *
 * CÓMO SE DESCUBRIÓ: el arnés de la primera rebanada de MOTION-001
 * (`medir-motion-tokens-v15.mjs`) midió la CASCADA real con getComputedStyle
 * y la encontró distinta de lo que el texto de las reglas base prometía —
 * .btn computaba «normal ×3» en vez de «rapido ×4». El hallazgo quedó
 * anotado como preexistente y esta rebanada lo paga.
 *
 * CAUSA RAÍZ: CSS no distingue POR QUÉ cambió una propiedad — un elemento
 * sólo puede tener UNA velocidad por propiedad, gane el tema o gane el
 * hover — y la regla del tema se escribió como si se sumara a las bases,
 * cuando el shorthand posterior sustituye al anterior entero.
 *
 * LA REGLA QUE LO HACE SEGURO: el cross-fade de tema lo cargan las
 * SUPERFICIES (`html, body, .card, .modal, .topbar, .sidebar`); los
 * CONTROLES (.btn, .input, .nav-item, .tab) conservan su voz propia — sus
 * propiedades de tema ya transicionan ahí, con papel rapido — y toda clase
 * con shorthand propio (.theme-toggle, .card-hover, .kpi-card) lleva TODAS
 * sus propiedades en esa única voz.
 *
 * QUÉ NO CUBRE: el valor COMPUTADO en el navegador (lo mide el arnés
 * `scripts/design/medir-motion-tokens-v15.mjs`, actualizado a la cascada
 * nueva); las transiciones INLINE de los TSX (inventario de 28 en el estado
 * V15 — rebanada siguiente); y la política para una futura regla agrupada
 * nueva: este guardián vigila la del tema, no genera la prohibición general
 * de agrupar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/** Bloques `selector { cuerpo }` de la hoja, sin comentarios en el selector. */
const bloques = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(),
  cuerpo: m[2],
}))

const reglaDelTema = bloques.find(
  (b) => b.selector.startsWith('html, body') && /transition\s*:/.test(b.cuerpo),
)

describe('el cross-fade de tema es de las superficies, no de los controles', () => {
  it('la regla agrupada existe y cubre exactamente las superficies', () => {
    expect(reglaDelTema).toBeDefined()
    expect(reglaDelTema!.selector).toBe('html, body, .card, .modal, .topbar, .sidebar')
  })

  it('ningún control vive en la regla del tema — recuperan su voz base', () => {
    for (const control of ['.btn', '.input', '.nav-item', '.tab', '.kpi-card']) {
      expect(reglaDelTema!.selector.split(',').map((s) => s.trim())).not.toContain(control)
    }
  })

  it('la voz base de cada control cubre sus propiedades de tema con papel rapido', () => {
    // Si un control saliera de la regla del tema SIN tener fondo/color/borde
    // en su propia voz, el cambio de tema lo haría saltar a golpe. Se exige
    // que la voz que queda cubra lo que el tema pinta en cada uno.
    const vozDe = (clase: string) =>
      bloques.find((b) => b.selector === clase && /transition\s*:/.test(b.cuerpo))?.cuerpo ?? ''
    const btn = vozDe('.btn')
    expect(btn).toMatch(/background var\(--mov-rapido\)/)
    expect(btn).toMatch(/(?<![\w-])color var\(--mov-rapido\)/)
    expect(btn).toMatch(/border-color var\(--mov-rapido\)/)
    expect(btn).toMatch(/opacity var\(--mov-rapido\)/)
    const input = vozDe('.input')
    expect(input).toMatch(/border-color var\(--mov-rapido\)/)
    expect(input).toMatch(/box-shadow var\(--mov-rapido\)/)
    expect(input).toMatch(/background var\(--mov-rapido\)/)
    const navItem = vozDe('.nav-item')
    expect(navItem).toMatch(/background var\(--mov-rapido\)/)
    expect(navItem).toMatch(/(?<![\w-])color var\(--mov-rapido\)/)
    const tab = vozDe('.tab')
    expect(tab).toMatch(/(?<![\w-])color var\(--mov-rapido\)/)
    expect(tab).toMatch(/border-color var\(--mov-rapido\)/)
  })
})

describe('las clases con shorthand propio llevan TODAS sus propiedades en él', () => {
  it('.theme-toggle: una sola voz, con opacity dentro y sin regla que la sombree', () => {
    const conTransition = bloques.filter(
      (b) => b.selector.split(',').some((s) => s.trim() === '.theme-toggle') && /transition\s*:/.test(b.cuerpo),
    )
    expect(conTransition).toHaveLength(1)
    const voz = conTransition[0].cuerpo
    expect(voz).toMatch(/background var\(--mov-rapido\)/)
    expect(voz).toMatch(/(?<![\w-])color var\(--mov-rapido\)/)
    expect(voz).toMatch(/transform var\(--mov-normal\)/)
    expect(voz).toMatch(/opacity var\(--mov-rapido\)/)
  })

  it('el FAB de ayuda ya no tiene voz porque ya no tiene cuerpo (RTC-32)', () => {
    /**
     * La 2ª rebanada de V15-MOTION-001 separó las voces: el FAB llevaba su
     * fade en una regla propia y el toggle dentro de SU shorthand, porque la
     * regla compartida que tenían antes sombreaba el shorthand entero.
     *
     * RTC-32 retiró el FAB del producto. El invariante «una voz por elemento»
     * no se relaja: se comprueba que no quede la regla huérfana de un elemento
     * que ya no existe, que es la otra forma de romperlo — una voz sin cuerpo
     * es exactamente lo que hace que la siguiente lectura del archivo crea que
     * el elemento sigue ahí.
     */
    expect(css).not.toContain('.boton-ayuda-fab')
  })

  it('.card-hover y .kpi-card incluyen color — no pierden el cross-fade de tema', () => {
    for (const clase of ['.card-hover', '.kpi-card']) {
      const voz = bloques.find((b) => b.selector === clase && /transition\s*:/.test(b.cuerpo))
      expect(voz, `${clase} sin voz de transición`).toBeDefined()
      expect(voz!.cuerpo).toMatch(/(?<![\w-])color var\(--mov-normal\)/)
    }
  })
})

describe('freeze — lo que la rebanada NO debe tocar', () => {
  it('las superficies del tema siguen fundiendo fondo, color y borde a normal', () => {
    expect(reglaDelTema!.cuerpo).toMatch(/background-color var\(--mov-normal\)/)
    expect(reglaDelTema!.cuerpo).toMatch(/(?<![\w-])color var\(--mov-normal\)/)
    expect(reglaDelTema!.cuerpo).toMatch(/border-color var\(--mov-normal\)/)
  })

  it('el apagador de §24 y el opt-out de .cita-fila siguen intactos', () => {
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(css).toMatch(/\.cita-fila\s*\{\s*transition:\s*none;?\s*\}/)
  })

  it('el estado :active del botón sigue hablando --mov-presion', () => {
    expect(css).toMatch(/transition-duration:\s*var\(--mov-presion\)/)
  })
})
