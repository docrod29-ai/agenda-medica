/**
 * V15-ORIGINALITY-REDTEAM-001 — la deuda táctil que RTC-32 declaró y no pagó:
 * los destinos del riel con el dedo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En un ancho de puntero grueso donde el riel de escritorio SÍ está en pantalla
 * (enciende a ≥769px; un iPad horizontal son 1024), los siete `.nav-item` del
 * riel medían dos alturas distintas según su ETIQUETA HTML:
 *
 *   <button> «Ayuda» · «Cerrar sesión» · las 18 secciones de /configuracion → 44
 *   <a>      «Hoy» · «Paciente» · «Encuentro» · «Seguimiento»              → 36.3
 *   <a>      «Operaciones» (subordinado, 12px)                             → 34
 *
 * Es decir: con el dedo, **cerrar la sesión era un blanco más grande que entrar
 * al encuentro**. RTC-32 se negó explícitamente a crear esa inversión subiendo
 * sólo el disparador de ayuda («haría la ayuda más prominente que los destinos
 * clínicos, que es lo contrario de esta rebanada») — pero la inversión ya
 * existía por otra puerta, y nadie la había medido.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * RTC-32 dejó escrito «el disparador del riel mide 207×36, por debajo del
 * mínimo de §24; si 36 es deuda, es deuda del riel entero». Al ir a pagarla,
 * `scripts/design/medir-tactiles-del-riel-v15.mjs` midió el riel en TRES
 * regímenes (1440 con ratón, 1024 con puntero grueso, 1280×720 corto) en vez de
 * uno solo. La respuesta cambió el diagnóstico: con ratón no hay defecto —la
 * doctrina de la 6ª rebanada de `V15-A11Y-001` ya decía que el mínimo de 44 es
 * una regla de puntero grueso—, y con el dedo el defecto era peor que el
 * denunciado, porque era desigual.
 *
 * ── LA CAUSA RAÍZ, Y ES LA TERCERA VEZ ──────────────────────────────────────
 *
 * El bloque `@media (pointer: coarse)` cubría `button`, `.btn`, `.btn-icon`,
 * `select`, `input`, `textarea` — y **nunca cubrió `<a>`**. Es exactamente la
 * causa raíz que la 6ª rebanada pagó para `a.nx-ident` y `.nx-cta-aviso`. Los
 * cuatro contextos clínicos del riel son `<a>` (son rutas: `Link` de Next).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `.nav-item { min-height: 44px }` DENTRO del bloque coarse. Aquí sí vale un
 * `min-height` —y no el pseudo invisible que necesitaron los otros dos
 * enlaces— porque en el riel lo visible y el área de golpe son la misma caja:
 * la fila entera pinta su fondo en hover/activo y la columna ya tiene scroll
 * propio (`.sidebar { overflow-y: auto }`), así que crecer no corta nada.
 *
 * Probado al revés (quitando la regla del bloque): fallan los casos 1 y 2.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles: eso lo hace el arnés real, en navegador, y su acta vive en
 *   `docs/design/capturas/v15-tactiles-del-riel/`.
 * · No juzga el escritorio de puntero fino: ahí 207×36 se queda, a propósito, y
 *   el caso 3 vigila que la regla no se escape del bloque.
 * · No cubre el cajón de la ASISTENTE (≤768px), que usa los MISMOS `.nav-item`
 *   y por tanto hereda el arreglo — pero no está medido en navegador porque la
 *   siembra de capturas sólo trae cuenta de médico. Declarado, no verificado.
 * · No vigila `.nav-item` nuevos que traigan `min-height` inline: un inline
 *   vencería a esta hoja en silencio (la lección `nx-stat-grid`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')
const css = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8')
const flowRail = readFileSync(join(RAIZ, 'src', 'components', 'FlowRail.tsx'), 'utf8')

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

describe('V15 · RTC-32 (deuda declarada) — el riel con el dedo', () => {
  const coarse = bloqueCoarse(css)

  it('1. con puntero grueso, TODO .nav-item mide al menos 44px de alto', () => {
    expect(coarse).toMatch(/\.nav-item\s*\{\s*min-height:\s*44px;?\s*\}/)
  })

  it('2. el mínimo alcanza a los ENLACES, que era el hueco: la regla no se limita a button', () => {
    // La regla que ya existía (`button:not(.mobile-topbar-btn)`) no puede ser
    // la única fuente del mínimo en el riel: si lo fuera, los cuatro contextos
    // clínicos —que son <a>— volverían a quedarse en 36 mientras «Cerrar
    // sesión» se queda en 44. El selector pagado tiene que ser de CLASE, sin
    // etiqueta delante que lo ate a un solo tipo de elemento.
    const regla = coarse.match(/(^|[\s{};])([a-z]*)\.nav-item\s*\{\s*min-height:\s*44px/m)
    expect(regla, 'falta la regla de clase para .nav-item en el bloque coarse').toBeTruthy()
    expect(regla![2], '.nav-item no puede ir atado a una etiqueta (button.nav-item dejaría fuera a los <a>)').toBe('')
  })

  it('3. la regla vive DENTRO del bloque coarse — el escritorio de ratón no se infla', () => {
    // Con ratón, 207×36 es un objetivo de ratón, no un objetivo táctil: la
    // doctrina es la de la 6ª rebanada de V15-A11Y-001. Si esta regla se
    // escapara del bloque, el riel entero engordaría 8px por fila en todos los
    // escritorios sin que §24 lo pidiera.
    const fueraDelBloque = css.replace(coarse, '')
    expect(fueraDelBloque).not.toMatch(/\.nav-item\s*\{[^}]*min-height/)
  })

  it('4. freeze: los cuatro contextos clínicos siguen siendo <a> — que es POR QUÉ la regla de button no bastaba', () => {
    // Si mañana `RailLink` dejara de renderizar un `Link`, la regla de button
    // volvería a cubrirlos y este pago se volvería redundante… o, si pasaran a
    // un `<div>` con rol, no los cubriría NINGUNA de las dos. Las dos noticias
    // importan y por eso el acoplamiento se vigila aquí, no se recuerda.
    expect(flowRail).toMatch(/<Link\s+href=\{href\}/)
    expect(flowRail).toContain("className={`nav-item${activo ? ' active' : ''}`}")
  })

  it('5. freeze: el mínimo de los <button> del bloque sigue en pie', () => {
    // Es la otra mitad de la igualdad. Si esta regla desapareciera, «Ayuda» y
    // «Cerrar sesión» caerían a 36 y la inversión se invertiría — el riel
    // volvería a tener dos alturas, sólo que al revés.
    expect(coarse).toMatch(/button:not\(\.mobile-topbar-btn\)\s*\{\s*min-height:\s*44px\s*!important;?\s*\}/)
  })
})
