/**
 * V15-A11Y-001, sexta rebanada — los dos táctiles chicos que eran ENLACES:
 * la identidad de paciente en /pendientes y el CTA del TrialBanner.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * La radiografía de trabajos móviles de Fase 9 (V15-MOBILE-001, 3ª rebanada)
 * midió con Playwright dos objetivos táctiles por debajo del mínimo de §24:
 *
 *   · «Activar plan →» del TrialBanner: 100×24;
 *   · el enlace de paciente en /pendientes (a.nx-ident): 156×20.
 *
 * La 4ª rebanada de A11Y pagó el tercero de esa lista (el toggle de tema,
 * 34×44 → 44×44) y dejó estos dos anotados. La causa raíz es una sola: el
 * bloque `@media (pointer: coarse)` de globals.css cubre `.btn`, `button`,
 * `select`, `input` y `textarea` — pero NUNCA cubrió `<a>`. Todo control que
 * fuera un enlace quedaba sin mínimo táctil por construcción.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un `min-height: 44px` aquí NO sirve: la píldora del banner pinta su fondo
 * sobre el padding (engordaría lo visible y el alto del shell) y la identidad
 * vive en una fila alineada por línea de base. El área de GOLPE se estira con
 * un pseudo invisible centrado (`::before`, `max(100%, 44px)`) — el mismo
 * mecanismo que `.nx-fila-abrir::after` (3ª rebanada): el hit-testing del
 * navegador atribuye el pseudo a su elemento, así que el tap de 44px llega al
 * enlace sin mover un píxel de lo visible. Sólo en puntero grueso: en
 * escritorio el clic fino no necesita 44px y estirarlo robaría clics de
 * selección de texto al título vecino.
 *
 * Probado al revés (git stash del cambio): los casos 1, 2 y 4 fallan contra
 * el árbol previo; el 3 (guardia de alcance: la regla no puede vivir FUERA
 * del bloque coarse) y los de freeze (5a/5b) pasan antes y después.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles: el área efectiva de 44px la mide el arnés real
 *   (capturar-tactiles-de-enlace-v15.mjs) con elementFromPoint + tap real,
 *   porque el pseudo NO aparece en getBoundingClientRect — una radiografía
 *   futura que sólo lea rects volverá a ver 156×20 y debe hit-testear.
 * · No cubre OTROS enlaces chicos fuera de estas dos familias (a.nx-ident,
 *   .nx-cta-aviso): un enlace nuevo con otra clase no está vigilado por esto.
 * · No cubre el comportamiento de puntero fino más allá de exigir que la
 *   regla viva DENTRO del bloque coarse.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')
const css = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8')
const layout = readFileSync(
  join(RAIZ, 'src', 'app', '(dashboard)', 'layout.tsx'),
  'utf8',
)
const pendientes = readFileSync(
  join(RAIZ, 'src', 'app', '(dashboard)', 'pendientes', 'page.tsx'),
  'utf8',
)

/** El bloque `@media (pointer: coarse)` completo, por conteo de llaves. */
function bloqueCoarse(hoja: string): string {
  const inicio = hoja.indexOf('@media (pointer: coarse)')
  expect(inicio, 'globals.css debe conservar su bloque de puntero grueso').toBeGreaterThan(-1)
  let profundidad = 0
  for (let i = hoja.indexOf('{', inicio); i < hoja.length; i++) {
    if (hoja[i] === '{') profundidad++
    if (hoja[i] === '}') profundidad--
    if (profundidad === 0) return hoja.slice(inicio, i + 1)
  }
  throw new Error('bloque coarse sin cerrar')
}

describe('V15-A11Y-001 · 6ª rebanada — táctiles de enlace (a.nx-ident, .nx-cta-aviso y .nx-enlace-tactil)', () => {
  const coarse = bloqueCoarse(css)

  it('1. el bloque de puntero grueso estira el golpe de estos enlaces con un pseudo', () => {
    /**
     * La lista de familias CRECIÓ, y eso es lo que esta prueba quería que
     * pasara. Su propio «qué no cubre» decía: «un enlace nuevo con otra clase
     * no está vigilado por esto». El carril de excelencia midió doce enlaces
     * de acción por debajo de 44 px —entre ellos «Inicia sesión aquí →» de la
     * portada y «Crea una gratis →» del login, a 18 px de alto— y los añadió
     * al MISMO mecanismo como `.nx-enlace-tactil`.
     *
     * Se comprueba por familia y no con la lista literal: congelar el texto
     * exacto del selector hacía fallar la prueba por añadir una familia, que
     * es justo lo que hay que poder hacer sin romper nada.
     */
    for (const familia of ['a\\.nx-ident', '\\.nx-cta-aviso', '\\.nx-enlace-tactil']) {
      expect(coarse, `${familia} sin position: relative`).toMatch(
        new RegExp(`${familia}[^{]*\\{[^}]*position:\\s*relative`),
      )
      expect(coarse, `${familia} sin pseudo de golpe`).toMatch(new RegExp(`${familia}::before`))
    }
  })

  it('2. el pseudo mide al menos 44px en los dos ejes, sesgado 2px hacia el pulgar', () => {
    const pseudo = coarse.slice(coarse.indexOf('a.nx-ident::before'))
    expect(pseudo).toMatch(/width:\s*max\(100%,\s*44px\)/)
    expect(pseudo).toMatch(/height:\s*max\(100%,\s*44px\)/)
    // El sesgo de 2px no es decorativo: el corredor del CTA del banner está
    // limitado ARRIBA por la topbar pegajosa (que debe ganar) — los 44 sólo
    // caben enteros si el estirón crece hacia abajo, hacia el pulgar.
    expect(pseudo).toMatch(/top:\s*calc\(50%\s*\+\s*2px\)/)
    expect(pseudo).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/)
  })

  it('3. la regla vive DENTRO del bloque coarse — el escritorio de puntero fino no se estira', () => {
    // Fuera del bloque coarse no puede existir otra regla que estire estos
    // enlaces: la única aparición de .nx-cta-aviso en la hoja es la del bloque.
    const fueraDelBloque = css.replace(coarse, '')
    expect(fueraDelBloque).not.toMatch(/\.nx-cta-aviso/)
    expect(fueraDelBloque).not.toMatch(/a\.nx-ident::before/)
  })

  it('4. las DOS variantes del TrialBanner llevan .nx-cta-aviso (vencida y cuenta regresiva)', () => {
    const ctas = layout.match(/className="nx-cta-aviso"/g) ?? []
    expect(ctas.length).toBe(2)
    // Y ninguna perdió su destino: las dos siguen llevando a la suscripción.
    const conDestino = layout.match(/href="\/configuracion\?tab=suscripcion"\s+className="nx-cta-aviso"/g) ?? []
    expect(conDestino.length).toBe(2)
  })

  it('5a. freeze: la identidad de /pendientes sigue siendo un Link con .nx-ident al expediente', () => {
    // Tarjeta viva y TarjetaCerrada: dos apariciones del mismo patrón.
    // Actualizado por V15-MOTION-001 (5ª rebanada): el Link pasó a multilínea
    // al ganar el onClick de la coreografía de §20 — el destino y la clase no
    // cambian, sólo la forma del JSX.
    const enlaces = pendientes.match(/Link\s+href=\{`\/expediente\/\$\{t\.patientId\}`\}\s+className="nx-ident"/g) ?? []
    expect(enlaces.length).toBe(2)
  })

  it('5b. freeze: el mínimo táctil de botones e inputs del bloque coarse sigue intacto', () => {
    expect(coarse).toMatch(/button:not\(\.mobile-topbar-btn\)\s*\{\s*min-height:\s*44px\s*!important;?\s*\}/)
    expect(coarse).toMatch(/\.btn-icon\s*\{\s*min-height:\s*44px\s*!important;\s*min-width:\s*44px\s*!important;?\s*\}/)
  })
})
