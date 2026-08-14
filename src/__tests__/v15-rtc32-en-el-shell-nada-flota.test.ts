/**
 * RTC-32 (V15-ORIGINALITY-REDTEAM-001; tercer residuo de la 4ª pasada de §29;
 * §5, §16, §29, §41) — en el shell del dashboard NO flota cromo de sistema, en
 * ningún ancho.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * RTC-05 sacó los dos widgets de esquina del arco del pulgar en MÓVIL y dejó
 * escrito, en su propio «qué no cubre», que el escritorio quedaba sin juzgar:
 * «en escritorio la esquina no ocluye la columna clínica». Esa frase fue
 * durante un día la razón por la que nadie los miraba.
 *
 * La 4ª pasada de §29 los nombró como uno de los tres residuos que impedían
 * bajar de 1.5: «ahora que no quedan defectos mayores, son lo que más se
 * parece a otro producto». Los otros dos se pagaron (RTC-18 y la fila de KPIs
 * del expediente); éste no.
 *
 * Y la medición en navegador real —`scripts/design/medir-cromo-flotante-v15.mjs`,
 * acta `docs/design/capturas/v15-cromo-flotante/medicion-antes.json`— dijo cuál
 * era el defecto, que NO era el que se suponía:
 *
 *  · La OCLUSIÓN no se reproduce en escritorio. El FAB cae sobre el envoltorio
 *    de la página, nunca sobre texto clínico. RTC-05 tenía razón, y por eso
 *    ése no es el motivo del cambio — se declara para que nadie lo cite mal.
 *  · Lo que sí se midió es el PESO: el FAB se pintaba con `--nexus-solido`,
 *    **el mismo relleno que la acción primaria de la pantalla**. En 6 de 6
 *    superficies había DOS rellenos de marca —el defecto que RTC-06 pagó
 *    dentro del contenido de Hoy mientras el cromo lo repetía por encima de
 *    todas— y en `/operaciones` la ayuda era el ÚNICO relleno de marca: lo más
 *    enfático de la pantalla de administración era el botón de ayuda.
 *  · El control era MÓVIL: en los mismos 6 recorridos a 390px flotaban CERO
 *    widgets, con las dos capacidades intactas y al mismo coste (1 gesto).
 *    El estado objetivo no había que imaginarlo: estaba medido al lado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. En el shell (`body:has(.bottom-nav-wrap)`) el toggle de tema no se pinta,
 *    SIN media query: el alcance es el shell, no el ancho. Fuera —login,
 *    registro, marketing— sigue flotando, porque allí no hay ni columna
 *    clínica ni riel con pie donde alojarlo.
 * 2. El FAB de ayuda no existe: ni el elemento ni la clase. Ocultarlo por CSS
 *    dejaba el botón en el árbol de accesibilidad de quien no aplica la hoja.
 * 3. La capacidad SE MUDA, NO SE AMPUTA, y a los DOS roles: pie del riel en
 *    `FlowRail` (médico) y en `Sidebar` (asistente), más la topbar en móvil.
 * 4. El disparador va FUERA del `<nav>` de los ≤5 contextos (§14): abre un
 *    panel, no lleva a un sitio. Un botón dentro del nav sería un sexto
 *    destino contado por cualquier vara que cuente hijos del nav.
 * 5. Los tres sitios usan `DisparadorAyuda`, que trae dentro el nombre del
 *    evento y la compuerta `useGrabando` (§8.5). Ninguno teclea la cadena:
 *    la lección de `estoy-grabando` —una cadena repetida en dos archivos es
 *    una compuerta que se abre sola.
 * 6. Con la causa muere la familia de parches de convivencia por-pantalla
 *    (bottom 78/92/120/136, el arbitraje con el aviso de push, el apartado al
 *    enfocar un campo dentro del shell). Una regla que arbitra entre dos cosas
 *    de las que una desapareció no protege nada.
 *
 * Probado al revés, y medido, no supuesto:
 *
 *  · Contra el árbol PREVIO al arreglo fallan los SIETE casos.
 *  · Reversión quirúrgica ×2 sobre el árbol nuevo: devolverle la media query a
 *    la regla del toggle rompe **sólo el 2**; mover el disparador DENTRO del
 *    `<nav>` rompe el **4** (sexto destino) y también el **3**, porque al
 *    entrar en el nav sale del pie — las dos quejas son ciertas y se dejan las
 *    dos: si una se callara, la otra tendría que cubrir un defecto que no es
 *    el suyo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es un guardián de FUENTE. Que en el navegador no flote nada, que el panel
 *   se abra donde se pulsó y que el disparador vuelva al detener lo mide
 *   `medir-cromo-flotante-v15.mjs` y la mitad de escritorio —invertida con su
 *   porqué— de `capturar-pulgar-y-fabs-v15.mjs`.
 * · No puntúa §29: quien implementa no puede ser el juez (lección de la 5ª
 *   pasada). El panel independiente sigue pendiente.
 * · No dice nada del toggle FUERA del shell (login/marketing), que sigue
 *   flotando a propósito.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const AYUDA = leer('src/components/BotonAyuda.tsx')
const RIEL = leer('src/components/FlowRail.tsx')
const SIDEBAR = leer('src/components/Sidebar.tsx')
const LAYOUT = leer('src/app/(dashboard)/layout.tsx')
const CSS = leer('src/app/globals.css')

describe('RTC-32 — en el shell no flota cromo de sistema', () => {
  it('1 · el FAB de ayuda no existe: ni elemento ni clase', () => {
    expect(AYUDA).not.toContain('boton-ayuda-fab')
    // Y no queda escondido por hoja: la clase no se declara en ningún sitio.
    expect(CSS).not.toMatch(/^\s*\.boton-ayuda-fab\s*\{/m)
  })

  it('2 · el toggle de tema no se pinta en el shell, en NINGÚN ancho', () => {
    const regla = 'body:has(.bottom-nav-wrap) .theme-toggle { display: none; }'
    const idx = CSS.indexOf(regla)
    expect(idx).toBeGreaterThan(-1)
    // La regla vive FUERA de cualquier media query: el alcance es el shell, no
    // el ancho. Si volviera a envolverse, el escritorio recuperaría el FAB en
    // silencio — que es exactamente como llegó hasta RTC-32.
    const bloqueAnterior = CSS.slice(0, idx)
    const ultimaApertura = bloqueAnterior.lastIndexOf('@media')
    const ultimoCierre = bloqueAnterior.lastIndexOf('\n}')
    expect(ultimoCierre).toBeGreaterThan(ultimaApertura)
  })

  it('3 · la capacidad se muda: hay disparador en el pie de los DOS rieles', () => {
    for (const [nombre, fuente] of [['FlowRail', RIEL], ['Sidebar', SIDEBAR]] as const) {
      expect(fuente, `${nombre} perdió la ayuda`).toContain('<DisparadorAyuda')
      expect(fuente, `${nombre} no importa la pieza compartida`)
        .toMatch(/import \{ DisparadorAyuda \} from '@\/components\/BotonAyuda'/)
      // En el PIE: después del `borderTop` que abre la zona subordinada.
      const pie = fuente.lastIndexOf('borderTop')
      expect(fuente.indexOf('<DisparadorAyuda'), `${nombre}: la ayuda no está en el pie`)
        .toBeGreaterThan(pie)
    }
  })

  it('4 · el disparador NO cuenta como sexto destino: va fuera del <nav>', () => {
    const finNav = RIEL.indexOf('</nav>')
    expect(finNav).toBeGreaterThan(-1)
    expect(RIEL.indexOf('<DisparadorAyuda')).toBeGreaterThan(finNav)
  })

  it('5 · los tres sitios usan la pieza compartida; nadie teclea el evento', () => {
    expect(AYUDA).toMatch(/export function DisparadorAyuda/)
    // La compuerta de §8.5 y el nombre del evento viven DENTRO de la pieza.
    const pieza = AYUDA.slice(AYUDA.indexOf('export function DisparadorAyuda'),
      AYUDA.indexOf('export function BotonAyuda'))
    expect(pieza).toContain('useGrabando()')
    expect(pieza).toMatch(/if \(grabando\) return null/)
    expect(pieza).toContain('EVENTO_ABRIR_AYUDA')
    for (const [nombre, fuente] of [['FlowRail', RIEL], ['Sidebar', SIDEBAR], ['layout', LAYOUT]] as const) {
      expect(fuente, `${nombre} teclea la cadena del evento a mano`).not.toContain("'nx:abrir-ayuda'")
    }
  })

  it('6 · el layout ya no arma el trigger a mano: usa la pieza', () => {
    expect(LAYOUT).toMatch(/import \{ BotonAyuda, DisparadorAyuda \} from '@\/components\/BotonAyuda'/)
    expect(LAYOUT).not.toContain('new Event(EVENTO_ABRIR_AYUDA)')
  })

  it('7 · murió la familia de parches de convivencia con los flotantes', () => {
    // El número mágico del lienzo de /chat (el toggle sobre «Enviar»).
    expect(CSS).not.toContain('body:has(.nx-lienzo-completo) .theme-toggle')
    // El arbitraje con el aviso de push (la X que el FAB tapaba).
    expect(CSS).not.toContain('body:has(.nx-push-optin) .boton-ayuda-fab')
    // Y la serie entera de bottoms a mano.
    for (const n of ['bottom: 78px', 'bottom: 92px', 'bottom: 120px', 'bottom: 136px']) {
      expect(CSS, `revivió ${n}`).not.toContain(n)
    }
  })
})
