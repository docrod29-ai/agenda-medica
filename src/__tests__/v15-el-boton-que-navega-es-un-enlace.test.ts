/**
 * EL CONTROL QUE NAVEGA ES UN ENLACE, NO UN BOTÓN DENTRO DE UNO —
 * V15-A11Y-001, rebanada «el botón que navega».
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Ocho sitios del producto pintaban `<Link><Button>…</Button></Link>`: un
 * `<button>` DENTRO de un `<a>`. Uno de ellos era el CTA del héroe NOW de Hoy
 * («Iniciar consulta»), o sea la ACCIÓN PRIMARIA de la pantalla que el médico
 * abre a las nueve de la mañana; otro, la cabecera de `/pacientes`.
 *
 * Medido en navegador real (`scripts/design/medir-boton-que-navega-v15.mjs`,
 * acta `docs/design/capturas/v15-boton-que-navega/acta-antes.json`, build de
 * producción + emuladores + siembra, 1440 y 390):
 *
 *   · **DOS paradas de teclado para UN destino** en el CTA del héroe, en los
 *     dos anchos. El médico tabula, cree que llegó al control, vuelve a
 *     tabular y sigue en el mismo sitio.
 *   · El mismo nombre accesible dos veces —«Iniciar consulta» como enlace y
 *     «Iniciar consulta» como botón—, y los dos navegan: el clic del botón
 *     burbujea hasta el `<a>`.
 *   · **HTML inválido**: el modelo de contenido de `<a>` es transparente pero
 *     prohíbe contenido interactivo dentro. Ningún navegador se queja, así que
 *     el árbol de accesibilidad queda a interpretación de cada lector.
 *
 * §24 llama BLOQUEANTE a un defecto de accesibilidad sobre una acción clínica
 * crítica. Éste lo es.
 *
 * ── CÓMO SE DESCUBRIÓ, Y LA CORRECCIÓN QUE TRAJO ────────────────────────────
 *
 * El acta de §21 en Hoy lo dejó anotado como deuda: «`anidados: 2` en Hoy (…)
 * uno es el CTA del héroe NOW». Aquel acta lo llamó `nested-interactive`, la
 * regla de axe. **No lo es**, y esta rebanada lo midió con axe-core de verdad
 * en vez de con el nombre de la regla escrito en un comentario:
 * `nested-interactive` sólo casa con roles `childrenPresentational` (botón,
 * casilla, pestaña…) y **`link` no es uno**. axe devuelve **0 nodos** sobre
 * `<a><button></button></a>`, antes y después del arreglo.
 *
 * Eso es justamente por qué este guardián es ESTÁTICO y existe: la vara
 * automática que el proyecto ya tenía no podía cazar esta familia. La que sí
 * midió axe fue otra —`role="button"` con un botón dentro, en las filas de
 * `/pacientes`— y vive en `v15-a11y-pacientes-sin-nested-interactive.test.ts`.
 * Son dos defectos distintos con dos guardianes distintos.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * `Button` sólo sabía pintar un `<button>`. Quien necesitaba un control que
 * navegara no tenía dónde pedirlo, así que envolvía: el patrón se copió a
 * ocho sitios porque era el único que había.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `ButtonLink` (`src/components/ui/Button.tsx`): un control que navega es UN
 * enlace, y parece un botón porque lo dice la HOJA. `Button` y `ButtonLink`
 * comparten `clasesDeBoton()` — UNA composición de clases para los dos, para
 * que no empiecen idénticos y diverjan a la tercera edición (REG-318).
 *
 * Y la apariencia se mudó a la hoja: `.btn` y `.prox-hero-cta` llevan su
 * `text-decoration: none`. Estaba en línea, sitio por sitio, y tres sitios no
 * se acordaban. Además el `flex-shrink: 0` en línea del héroe dejaba MUERTA
 * la regla `.prox-hero > a { flex-shrink: 1 }` de la media query — un estilo
 * en línea le gana a la hoja en silencio, que es la lección de `nx-stat-grid`.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No prueba que un lector de pantalla lo anuncie bien: prueba que el árbol
 *   ya no tiene un control dentro de otro, que es la condición previa.
 * · No cuenta las paradas de teclado — eso sólo se puede medir en un navegador
 *   y lo hace el arnés de esta corrida, en 1440 y en 390.
 * · No vigila `<a>` de terceros ni el HTML del portal del paciente: el barrido
 *   es sobre `src/app/**` y `src/components/**`, que es donde vive la interfaz
 *   del médico.
 * · No dice nada sobre `role="button"` con controles dentro — ésa es la otra
 *   familia, con su propio guardián.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const BOTON = readFileSync(join(RAIZ, 'src/components/ui/Button.tsx'), 'utf8')
const BARRIL = readFileSync(join(RAIZ, 'src/components/ui/index.ts'), 'utf8')
const CSS = readFileSync(join(RAIZ, 'src/app/globals.css'), 'utf8')
const HOY = readFileSync(join(RAIZ, 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8')
const P404 = readFileSync(join(RAIZ, 'src/app/not-found.tsx'), 'utf8')

/** Los comentarios explican el defecto: no pueden CONTAR como el defecto. */
function sinComentarios(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function tsxDe(dir: string, salida: string[] = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) tsxDe(p, salida)
    else if (p.endsWith('.tsx')) salida.push(p)
  }
  return salida
}

/** `<Link …>` o `<a …>` con un `<button>`/`<Button>` como primer hijo. */
const ENVUELVE = /<(Link|a)(\s[^>]*)?>\s*<(button|Button)\b/

describe('ningún enlace envuelve a un botón (el árbol que axe no ve)', () => {
  const archivos = [...tsxDe(join(RAIZ, 'src/app')), ...tsxDe(join(RAIZ, 'src/components'))]

  it('el barrido mira de verdad la interfaz del médico', () => {
    // Un barrido que no encuentra archivos pasa siempre: eso no es un guardián.
    expect(archivos.length).toBeGreaterThan(100)
    expect(archivos).toContain(join(RAIZ, 'src/app/(dashboard)/dashboard/page.tsx'))
  })

  it('cero sitios en src/app y src/components', () => {
    // Falla contra el árbol previo: eran 8 (Hoy ×3, /pacientes ×3, 404 ×1,
    // y el CTA del héroe). Se listan los culpables para que el rojo diga dónde.
    const culpables = archivos.filter(f => ENVUELVE.test(sinComentarios(readFileSync(f, 'utf8'))))
      .map(f => f.replace(RAIZ + '/', ''))
    expect(culpables).toEqual([])
  })
})

describe('`ButtonLink` es el sitio donde se pide un control que navega', () => {
  it('existe, se exporta por el barril y pinta un `Link`, no un `button`', () => {
    expect(BOTON).toMatch(/export const ButtonLink = forwardRef<HTMLAnchorElement/)
    expect(BARRIL).toContain("export { Button, ButtonLink } from './Button'")
    const cuerpo = BOTON.slice(BOTON.indexOf('export const ButtonLink'))
    expect(sinComentarios(cuerpo)).not.toMatch(/<button\b/)
    expect(cuerpo).toMatch(/<Link\b/)
  })

  it('los dos controles comparten UNA composición de clases', () => {
    // Falla si `ButtonLink` se escribe su propia lista: dos moldes para el
    // mismo aspecto divergen (REG-318). `'btn'` sólo puede nombrarse una vez.
    expect(BOTON).toMatch(/function clasesDeBoton\(/)
    expect(BOTON.match(/clasesDeBoton\(/g)?.length).toBe(3)  // definición + 2 usos
    expect(BOTON.match(/'btn'/g)?.length).toBe(1)
  })

  it('no finge que un enlace se puede deshabilitar', () => {
    // `pointer-events: none` esconde un control del teclado en vez de
    // anunciarlo: la ausencia de `disabled`/`loading` aquí es deliberada.
    const cuerpo = sinComentarios(BOTON.slice(BOTON.indexOf('interface ButtonLinkProps')))
    expect(cuerpo).not.toMatch(/\bloading\b/)
    expect(cuerpo).not.toMatch(/\bdisabled\b/)
  })
})

describe('la apariencia vive en la HOJA, no en el JSX (lección nx-stat-grid)', () => {
  it('`.btn` trae su `text-decoration: none`: el enlace no la pide sitio a sitio', () => {
    // Falla contra la hoja previa: `.btn` no lo declaraba y cada `<a className="btn">`
    // tenía que acordarse en línea. Tres no se acordaban.
    const btn = CSS.slice(CSS.indexOf('\n.btn {'), CSS.indexOf('.btn:disabled'))
    expect(btn).toMatch(/text-decoration: none;/)
  })

  it('`.prox-hero-cta` trae las dos que estaban en línea sobre el enlace', () => {
    const cta = CSS.slice(CSS.indexOf('.prox-hero-cta {'), CSS.indexOf('.prox-hero-cta:hover'))
    expect(cta).toMatch(/text-decoration: none;/)
    expect(cta).toMatch(/flex-shrink: 0;/)
  })

  it('y por eso `.prox-hero > a { flex-shrink: 1 }` vuelve a estar viva', () => {
    // La media query existía y no pintaba nada: un `flexShrink: 0` en línea le
    // ganaba en silencio. Sin esta pareja de casos, el arreglo se puede
    // deshacer devolviendo el estilo en línea sin que nada se ponga rojo.
    expect(CSS).toMatch(/\.prox-hero > a \{ width: 100%; flex-shrink: 1; \}/)
    // El enlace del héroe ya no lleva NINGÚN `style` en línea: si vuelve uno,
    // vuelve el riesgo de que pise a la hoja sin que nadie lo note.
    const enlaceDelHeroe = HOY.slice(HOY.indexOf('<Link\n        href={`/consulta/'))
    expect(enlaceDelHeroe.slice(0, enlaceDelHeroe.indexOf('onClick'))).not.toMatch(/style=/)
  })
})

describe('freeze funcional — la rebanada es de estructura accesible, no de conducta (§42)', () => {
  it('el CTA del héroe sigue llevando a la consulta de ESE paciente', () => {
    const heroe = HOY.slice(HOY.indexOf('function ProxHero'))
    expect(heroe).toMatch(/href=\{`\/consulta\/\$\{appt\.pacienteId\}`\}/)
    expect(heroe).toMatch(/className="prox-hero-cta"/)
    expect(heroe).toMatch(/Iniciar consulta/)
  })

  it('y sigue coreografiando la continuidad de §20, sólo en el clic simple', () => {
    const heroe = HOY.slice(HOY.indexOf('function ProxHero'))
    expect(heroe).toMatch(/if \(!esClickDeNavegacionSimple\(e\)\) return/)
    expect(heroe).toMatch(/e\.currentTarget\.closest\('\.prox-hero'\)\?\.querySelector<HTMLElement>\('\.nx-ident'\)/)
    expect(heroe).toMatch(/navegarConContinuidad\(\(\) => router\.push\(`\/consulta\/\$\{appt\.pacienteId\}`\), origen\)/)
  })

  it('el 404 conserva su aspecto: el estilo del botón se mudó al enlace entero', () => {
    const bloque = P404.slice(P404.indexOf('<Link href="/dashboard"'))
    expect(bloque).toMatch(/border: '1px solid rgba\(242,239,233,0\.14\)'/)
    expect(bloque).toMatch(/padding: '12px 22px'/)
    expect(bloque).toMatch(/minWidth: 140/)
    // Un <a> es inline: sin esto el relleno vertical no lo levantaría a la
    // misma altura que el «Reintentar» de al lado.
    expect(bloque).toMatch(/display: 'inline-flex'/)
    expect(bloque).toMatch(/textDecoration: 'none'/)
  })
})
