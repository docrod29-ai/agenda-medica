/**
 * RTC-18 — el Clinical Spine deja de vestirse de filtro.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * §7 pide un elemento **longitudinal**: un riel para moverse por el expediente
 * de un paciente. Estaba pintado como una fila de píldoras rellenas,
 * indistinguible de los filtros de `/pacientes` y de los de la propia historia
 * clínica, dos filas más abajo.
 *
 * ── CÓMO SE DESCUBRIÓ, Y QUÉ DIJO LA MEDICIÓN ───────────────────────────────
 *
 * El equipo rojo lo escribió (RT-15). La 4ª pasada de §29 nombró «las píldoras
 * de filtro» como el residuo más caro, y la tentación era convertirlas en
 * frases porque `/pendientes` —la superficie que puntúa 1.0— usa frases. Antes
 * de tocar nada se contaron, en las seis superficies:
 *
 *              píldoras  filas  con dato  sólo etiqueta  alto del pliegue
 *   4 de 6         0       0       —           —              0px
 *   pacientes      3       1       2           1            102px
 *   expediente     8       3       3           5            270px
 *
 * O sea: **no había «exceso de píldoras» en el producto**. Cuatro superficies
 * no tenían ninguna y la fila de `/pacientes` lleva conteos —un filtro que
 * dice cuántos hay informa—. El outlier era `/expediente`, y sus tres filas
 * hacían **tres trabajos distintos vestidos igual**: este riel (navegación),
 * el filtro de la historia, y los chips de diagnósticos (datos).
 *
 * El defecto no era la cantidad: era **la silueta compartida**. Si no se
 * cuenta, se convierte en frases un filtro que sirve y se deja intacto el
 * defecto de verdad.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Lo que NAVEGA habla el idioma de navegación de este producto —`.nav-item`:
 *    barra de acento en el activo, texto que sube de peso— y no el de un
 *    control de filtro. La barra va debajo porque el riel es horizontal; en el
 *    FlowRail va al costado. Misma gramática, distinta orientación.
 * 2. Sin relleno: un fondo sólido compite con los datos que tiene al lado.
 * 3. §24: 44px de objetivo táctil. Como píldora venía con 32 y nadie lo miró
 *    porque parecía un chip; como riel se mide con la vara de la navegación.
 * 4. **El corte cae entre ítems**, no a media palabra (RT-15): en vez de tapar
 *    el corte con un degradado —que además sería deuda nueva del trinquete— se
 *    hace que no pueda cortar mal, anclando el desplazamiento al principio de
 *    cada ítem.
 * 5. El riel trae el activo a la vista: un indicador de posición que señala un
 *    sitio fuera de la parte visible no indica nada.
 *
 * ── LO MEDIDO ───────────────────────────────────────────────────────────────
 *
 *   /expediente, píldoras en el primer pliegue
 *     escritorio  8 en 3 filas (270px)  →  4 en 2 filas (134px)
 *     móvil       5 en 2 filas (220px)  →  1 en 1 fila  (44px)
 *
 * Lo que queda son los filtros de la historia y un chip de diagnóstico: cosas
 * que SÍ son filtros y datos, ahora distinguibles de lo que navega.
 *
 * Probado al revés: devolviendo el radio de píldora falla el caso 1; quitando
 * la barra de acento falla el 2; bajando el táctil a 32 falla el 3; quitando
 * el `scroll-snap` falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No toca los filtros de `/pacientes`**, y es deliberado: la medición dice
 *   que informan. Copiar la forma de `/pendientes` sin mirar el trabajo habría
 *   sido repintar.
 * · No cubre la fila de tarjetas-estadística del expediente (el otro residuo
 *   que nombró la 4ª pasada).
 * · No mide contraste: la barra de acento sobre `var(--nexus)` hereda el token
 *   ya medido en los dos temas, pero este guardián no lo comprueba.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SPINE = readFileSync(join(process.cwd(), 'src/components/expediente/ClinicalSpine.tsx'), 'utf8')

describe('RTC-18 — lo que navega no se viste de filtro', () => {
  it('1 · el riel ya no usa forma de píldora', () => {
    expect(SPINE).not.toContain("borderRadius: 'var(--r-pill)'")
  })

  it('2 · habla el idioma de navegación: barra de acento y peso, no relleno', () => {
    expect(SPINE).toMatch(/boxShadow: seleccionado \? 'inset 0 -2px 0 0 var\(--nexus\)' : 'none'/)
    expect(SPINE).toMatch(/fontWeight: seleccionado \? 600 : 500/)
    expect(SPINE).toMatch(/color: seleccionado \? 'var\(--text\)' : 'var\(--text2\)'/)
    // Sin fondo sólido: competía con los datos de al lado.
    expect(SPINE).not.toMatch(/background: seleccionado \? 'var\(--nexus-solido\)'/)
  })

  it('3 · §24: el objetivo táctil es de navegación, no de chip', () => {
    expect(SPINE).toMatch(/minHeight: 44/)
    expect(SPINE).not.toMatch(/minHeight: 32/)
  })

  it('4 · el corte cae entre ítems, y sin añadir un degradado', () => {
    expect(SPINE).toMatch(/scrollSnapType: 'x proximity'/)
    expect(SPINE).toMatch(/scrollSnapAlign: 'start'/)
    // El trinquete de diseño cuenta cada `linear-gradient(`: tapar el corte con
    // un degradado habría sido deuda nueva para esconder el defecto.
    expect(SPINE).not.toMatch(/(?:linear|radial|conic)-gradient\(/)
  })

  it('5 · el riel trae el activo a la vista — moviendo SÓLO el riel (REG-342)', () => {
    /**
     * ESTA ASERCIÓN CERTIFICABA EL DEFECTO. Decía:
     *
     *     expect(SPINE).toMatch(/block: 'nearest', inline: 'nearest'/)
     *
     * es decir, exigía la llamada a `scrollIntoView` que causaba el rebote de
     * scroll en iPhone (REG-342): el observador se dispara PORQUE el médico está
     * bajando, y `scrollIntoView` mueve todos los ancestros scrollables, así que
     * subía `<main>` para enseñar un riel que ya había salido por arriba.
     *
     * La INTENCIÓN de la prueba era buena y se conserva entera: un indicador de
     * posición que señala un sitio fuera de la parte visible del riel no indica
     * nada. Lo que cambia es el medio — se mueve el `scrollLeft` del riel, un
     * contenedor y un eje— y con él la aserción. La aritmética se prueba aparte,
     * con números, en `el-riel-no-arrastra-la-pagina`.
     */
    expect(SPINE).toMatch(/destinoDelRiel\(\{/)
    expect(SPINE).toMatch(/riel\.scrollTo\(\{ left: destino/)
    expect(SPINE).toMatch(/data-spine-target="spine-\$\{activo\}"/)
  })

  it('6 · sigue sin abrir fuentes de datos propias', () => {
    // La razón de ser del componente: cada conteo llega ya calculado por quien
    // lo llama. Una entidad, una fuente de verdad.
    expect(SPINE).not.toMatch(/useEffect\([^)]*fetch|getDocs|collection\(/)
  })
})
