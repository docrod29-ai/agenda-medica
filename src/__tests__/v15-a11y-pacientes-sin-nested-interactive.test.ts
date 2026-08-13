/**
 * Las filas de /pacientes ya no anidan un control dentro de otro —
 * V15-A11Y-001, 3ª rebanada.
 *
 * QUÉ FALLABA: cada fila del directorio era `role="button"` (activable) con
 * el botón «Editar» DENTRO. Axe lo midió como `nested-interactive` ×5 (un
 * nodo por fila de «Recientes») en CADA medición de /pacientes de la rama —
 * los dos temas y móvil. Para un lector de pantalla, un botón dentro de un
 * botón es un árbol ilegible: ¿qué activa Enter?; para el teclado, la fila
 * y el botón interior eran dos paradas donde el interior dependía de un
 * stopPropagation para no disparar al exterior.
 *
 * CÓMO SE DESCUBRIÓ: primera medición axe de /pacientes en la rama
 * (V15-VISUAL-SYSTEM-001, 4ª rebanada, arnés
 * `capturar-roles-pacientes-v15.mjs`), anotada a `V15-A11Y-001` como
 * PREEXISTENTE: el defecto es anterior a V15 — la rebanada de roles no
 * añadió interactivos. El inventario de deuda a11y (1ª rebanada de esta
 * iteración) la llevaba como la familia del botón «Editar». (La etiqueta
 * «color-contrast» que esa entrada del inventario arrastraba era una
 * conflación: los nodos de contraste de aquella medición eran del
 * TrialBanner, pagados en VISUAL-SYSTEM 6ª; el Editar mide ≈7.6:1 oscuro /
 * ≈6.1:1 claro. La familia real del Editar siempre fue nested-interactive.)
 *
 * CAUSA RAÍZ: el patrón «fila clicable con acción secundaria dentro» se
 * resolvió haciendo control a la CAJA en vez de al CONTENIDO. En cuanto la
 * caja es role="button", cualquier botón interior queda anidado por
 * construcción — no hay stopPropagation que lo arregle en el árbol de
 * accesibilidad.
 *
 * LA REGLA QUE LO HACE SEGURO: acción extendida (`.nx-fila-abrir` en
 * globals.css). La identidad del paciente es un `<button>` nativo cuyo
 * ::after estira el área de golpe sobre la fila entera; «Editar» es su
 * HERMANO con position:relative + z-index por encima del velo. El DOM queda
 * plano — dos botones hermanos, cero anidamiento —, el ratón conserva el
 * gesto exacto (clic en cualquier punto de la fila abre el expediente), el
 * teclado gana un orden honesto (identidad → Editar) y la etiqueta
 * accesible es la misma de siempre.
 *
 * QUÉ NO CUBRE: que axe mida 0 `nested-interactive` de verdad, que el clic
 * en la fila navegue al expediente, que Editar abra el modal SIN navegar y
 * que el anillo de foco se pinte sobre la fila lo mide el arnés de
 * navegador real de esta corrida
 * (`scripts/design/capturar-fila-sin-anidado-v15.mjs`) en los dos temas y
 * en móvil. Tampoco toca las otras superficies con `activable` (calendario,
 * camas, UCI, Table.tsx): ahí la caja activable no tiene controles dentro —
 * si algún día los gana, ese será su propio defecto y su propia rebanada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PAGINA = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/pacientes/page.tsx'),
  'utf8',
)
const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

const inicioFila = PAGINA.indexOf('function PacienteRow')
const finFila = PAGINA.indexOf('function PatientModal')
const FILA = PAGINA.slice(inicioFila, finFila)

describe('la fila de /pacientes no anida controles (nested-interactive ×5 muere)', () => {
  it('el segmento de la fila existe donde el test lo espera', () => {
    expect(inicioFila).toBeGreaterThan(-1)
    expect(finFila).toBeGreaterThan(inicioFila)
  })

  it('la fila contenedora ya NO es role="button": activable salió de la fila', () => {
    // Falla contra el árbol previo: la fila abría con {...activable(onAbrir…)}.
    expect(FILA).not.toContain('activable(')
    expect(PAGINA).not.toContain("from '@/lib/ui/activable'")
  })

  it('el control que abre es el botón de la identidad, estirado sobre la fila', () => {
    // Falla contra el árbol previo: no existía .nx-fila-abrir.
    expect(FILA).toMatch(/<button\s+type="button"\s+className="nx-fila-abrir"/)
    expect(FILA).toMatch(/aria-label=\{`Abrir el expediente de \$\{p\.nombre\}`\}/)
    // El velo necesita un ancestro posicionado: la fila es position:relative.
    expect(FILA).toMatch(/position: 'relative',\s*\n\s*display: 'flex'/)
  })

  it('«Editar» es HERMANO por encima del velo, no hijo del control que abre', () => {
    // Falla contra el árbol previo: Editar no llevaba z-index.
    const editar = FILA.slice(FILA.indexOf('onEditar()'), FILA.indexOf('</button>', FILA.indexOf('onEditar()')))
    expect(editar).toContain("position: 'relative', zIndex: 1")
    // Y Editar NO vive dentro del botón que abre: el botón de la identidad
    // se cierra antes de que Editar empiece.
    const cierreAbrir = FILA.indexOf('</button>')
    const inicioEditar = FILA.indexOf('onEditar()')
    expect(cierreAbrir).toBeGreaterThan(-1)
    expect(cierreAbrir).toBeLessThan(inicioEditar)
  })

  it('el patrón vive en globals.css: velo inset 0 y anillo de foco sobre la fila', () => {
    // Falla contra el árbol previo: la clase no existía.
    expect(CSS).toMatch(/\.nx-fila-abrir::after \{ content: ''; position: absolute; inset: 0;/)
    expect(CSS).toMatch(/\.nx-fila-abrir:focus-visible::after \{\s*\n\s*outline: 2px solid var\(--nexus\);/)
  })
})

describe('freeze funcional — la rebanada es de estructura accesible, no de conducta', () => {
  it('abrir sigue siendo onAbrir y Editar sigue frenando la propagación', () => {
    // Actualizado por V15-MOTION-001 (5ª rebanada): el botón sigue llamando a
    // onAbrir — el gesto y la estructura accesible no cambian — pero ahora le
    // ENTREGA el .nx-ident de la fila, el objeto compartido de la coreografía
    // de continuidad de §20 (fila → <h1> del Patient Anchor).
    expect(FILA).toMatch(/className="nx-fila-abrir"\s+onClick=\{e => onAbrir\(e\.currentTarget\.querySelector<HTMLElement>\('\.nx-ident'\)\)\}/)
    expect(FILA).toMatch(/onClick=\{e => \{ e\.stopPropagation\(\); onEditar\(\) \}\}/)
  })

  it('la identidad sigue siendo span.nx-ident y el metadato .nx-meta', () => {
    expect(FILA).toMatch(/<span className="nx-ident"[^>]*>\{p\.nombre\}<\/span>/)
    expect(FILA).toMatch(/className="nx-meta"/)
  })

  it('Editar sólo existe en modo médico, como siempre', () => {
    expect(FILA).toMatch(/\{mode === 'medico' && \(\s*\n\s*<button\s*\n\s*onClick=\{e => \{ e\.stopPropagation\(\); onEditar\(\) \}\}/)
  })
})
