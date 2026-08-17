/**
 * V15 §5 CAPA 4 / §21 — LA LENTE CONTEXTUAL EXISTE, Y ES UNA LENTE.
 *
 * ── QUÉ FALTABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * §5 pide un shell de CUATRO capas. `V15-SHELL-GREYBOX-001` construyó tres
 * —franja de instrumentos, riel de flujo, lienzo clínico— y cerró sin la
 * cuarta. No fue un olvido silencioso: RTC-12(a), al unificar el lienzo de
 * página, dejó el hueco escrito y con sitio físico reservado —«no decide qué
 * vive en el ancho que queda a la derecha; el lienzo lo reserva, hoy está
 * vacío»— y el estado de V15 nombró la Capa 4 como la tarea siguiente, con la
 * condición de MEDIR antes de construir.
 *
 * La medición (`scripts/design/medir-lente-contextual-v15.mjs`, acta
 * `docs/design/capturas/v15-lente-contextual/acta-antes.json`) contestó las
 * cuatro preguntas de §21 sobre el patrón que ya existía:
 *
 *   ALCANCE   inspeccionar la fuente de un hecho existe en 1 de 6 superficies.
 *   CAPA 4    existe en 0 de 6.
 *   SITIO     abrir la procedencia hace crecer la nota de 2141 a 2656px en
 *             escritorio y de 2666 a 3271 en el teléfono; «¿de dónde salió
 *             esto?», a 3013 y 3886. El disparador no se mueve —está encima de
 *             lo que despliega—, pero todo lo que había debajo baja entre 515
 *             y 1220px.
 *   VUELTA    **Escape no cierra ninguno de los dos, en ninguno de los dos
 *             anchos.** Se abre con el ratón y se cierra sólo con el ratón.
 *
 * O sea: el patrón de hoy cumple «no navega fuera» y «el foco no se pierde», y
 * falla «no pierdas el sitio» y «vuelve». Por eso NO se declaró cumplido, que
 * era la otra salida que el estado dejaba abierta.
 *
 * Y de paso, sin buscarlo: `SelloProcedencia` no declaraba `aria-expanded` (el
 * acta lo leyó `null`), así que su disparador se anunciaba como un botón que
 * no dice que abra nada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Cerrada no renderiza NADA.** §5 prohíbe por su nombre el copiloto
 *    permanentemente abierto. Si el panel puede existir vacío, alguien acabará
 *    dejándolo abierto «por si acaso» y deja de ser una lente.
 * 2. **No es un modal**: sin `role="dialog"`, sin velo, sin trampa de foco y
 *    sin bloquear el desplazamiento. Un modal obliga a elegir entre el hecho y
 *    su fuente, que es lo que §21 quiere evitar.
 * 3. **Escape cierra y el foco VUELVE** al control que abrió (§21, «return
 *    exactly where you were»), y sólo si ese control sigue en el documento:
 *    robarle el foco al body es peor que dejarlo donde el navegador lo puso.
 * 4. **Una a la vez.** El nombre del evento se declara UNA vez, dentro de la
 *    pieza; ningún consumidor teclea la cadena — la lección de `estoy-grabando`.
 * 5. **El contenido lo renderiza el consumidor** (`children` por portal), no se
 *    guarda una copia en el estado de la lente: una lente que guarda una copia
 *    enseñaría la foto de un dato clínico, no el dato.
 * 6. **La geometría vive en la HOJA** (lección `nx-stat-grid`): un `position` o
 *    un `width` en línea vencerían a la hoja en silencio y ningún contador de
 *    CSS los vería.
 * 7. **La hoja inferior va EN FLUJO**, hermana de `<main>` dentro de la columna
 *    del shell. Nada de `position: fixed` con un `bottom` a mano para esquivar
 *    el BottomNav: ése es el número mágico que este repositorio ya pagó cuatro
 *    veces (los bottoms 78/92/120/136 que mató RTC-32).
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Contra el árbol previo fallan los casos 1, 2, 3, 5, 6, 7, 8 y 9 (la pieza no
 * existe). Reversiones quirúrgicas sobre el árbol nuevo, comprobadas en rojo
 * una a una: quitar `:empty` de la hoja rompe el 4; devolver el detalle en
 * línea a `SelloProcedencia` rompe el 7; quitar la vuelta del foco rompe el 3.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es un guardián de FUENTE (el repo no usa @testing-library/react). Que la
 *   lente NO tape el hecho, que la nota no se mueva al abrirla y que Escape la
 *   cierre de verdad se mide en navegador real con
 *   `medir-lente-contextual-v15.mjs`, fase «despues».
 * · No dice nada de CUÁNTAS superficies enseñan su fuente. Sigue siendo 1 de 6:
 *   esta rebanada construye la capa y muda a sus dos consumidores; llevar la
 *   procedencia al expediente, a resultados y a la cola de cierre es trabajo
 *   declarado y no hecho.
 * · No puntúa §29: quien implementa no puede ser el juez.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const LENTE = leer('src/components/LenteContextual.tsx')
const CSS = leer('src/app/globals.css')
const LAYOUT = leer('src/app/(dashboard)/layout.tsx')
const SELLO = leer('src/components/SelloProcedencia.tsx')
const DEDONDE = leer('src/components/DeDondeSalioEsto.tsx')

/** El cuerpo del componente, sin la cabecera de comentario que lo explica.
    Sin esto, un guardián que busca «position: fixed» se caza a sí mismo
    leyendo la prosa que explica por qué NO va en línea — la ceguera de
    `grafo-de-dependencias`, cazada ya cuatro veces en esta iteración. */
const CODIGO_LENTE = LENTE.slice(LENTE.indexOf("import {"))

describe('§5 Capa 4 — la lente contextual', () => {
  it('1 · cerrada no renderiza nada: no puede quedarse abierta «por si acaso»', () => {
    expect(CODIGO_LENTE).toMatch(/if \(!abierta[^)]*\) return null/)
    // Y lo que se pinta se pinta por PORTAL, no en el sitio del consumidor:
    // si no, el panel viviría dentro del flujo de la nota otra vez.
    expect(CODIGO_LENTE).toContain('createPortal(')
  })

  it('2 · no es un modal: sin diálogo, sin velo, sin trampa de foco, sin bloquear el scroll', () => {
    expect(CODIGO_LENTE).not.toContain("role=\"dialog\"")
    expect(CODIGO_LENTE).not.toMatch(/aria-modal/)
    expect(CODIGO_LENTE).not.toMatch(/overflow\s*=\s*'hidden'|body\.style\.overflow/)
    expect(CODIGO_LENTE).not.toMatch(/modal-overlay|backdrop|inset: 0/)
    // Es contexto: se anuncia como región complementaria con nombre propio.
    expect(CODIGO_LENTE).toContain('role="complementary"')
    expect(CODIGO_LENTE).toContain('aria-labelledby=')
  })

  it('3 · Escape cierra, y el foco vuelve al control que abrió — si sigue vivo', () => {
    expect(CODIGO_LENTE).toMatch(/e\.key === 'Escape'/)
    expect(CODIGO_LENTE).toMatch(/document\.addEventListener\('keydown'/)
    // La vuelta, y su condición: sólo si el invocador sigue en el documento.
    // `preventScroll` es parte del invariante: si el foco arrastra la vista por
    // su cuenta, el desplazamiento que se restaura debajo ya no es el que había.
    expect(CODIGO_LENTE).toMatch(/document\.body\.contains\(previo\)[^\n]*previo\.focus\(\{ preventScroll: true \}\)/)
    expect(CODIGO_LENTE).toMatch(/scrollport\.scrollTop = scrollPrevio/)
    // El foco ENTRA al título, no al primer control: lo primero que hay que
    // oír es QUÉ se abrió.
    expect(CODIGO_LENTE).toMatch(/tituloRef\.current\?\.focus\(\)/)
    expect(CODIGO_LENTE).toMatch(/tabIndex=\{-1\}/)
  })

  it('4 · el hueco del shell existe, está entre <main> y el pulgar, y vacío no ocupa nada', () => {
    expect(LAYOUT).toContain('id="nx-lente-hueco"')
    const hueco = LAYOUT.indexOf('id="nx-lente-hueco"')
    const finMain = LAYOUT.indexOf('</main>')
    const pulgar = LAYOUT.indexOf('bottom-nav-wrap')
    expect(finMain).toBeGreaterThan(-1)
    expect(pulgar).toBeGreaterThan(-1)
    expect(hueco).toBeGreaterThan(finMain)
    expect(hueco).toBeLessThan(pulgar)
    // Sin esta regla, TODAS las pantallas cargarían con un hueco flex vacío.
    expect(CSS).toContain('.nx-lente-hueco:empty { display: none; }')
  })

  it('5 · una a la vez, y el nombre del evento se declara UNA sola vez', () => {
    expect(CODIGO_LENTE).toMatch(/const EVENTO_LENTE_ABIERTA = 'nx:lente-abierta'/)
    for (const [nombre, fuente] of [
      ['SelloProcedencia', SELLO], ['DeDondeSalioEsto', DEDONDE], ['layout', LAYOUT],
    ] as const) {
      expect(fuente, `${nombre} teclea la cadena del evento a mano`)
        .not.toContain("'nx:lente-abierta'")
    }
  })

  it('6 · la geometría vive en la hoja, no en el JSX (lección nx-stat-grid)', () => {
    for (const clase of ['.nx-lente-hueco', '.nx-lente', '.nx-lente-cuerpo', '.nx-lente-cabecera']) {
      expect(CSS, `${clase} no está declarada en la hoja`)
        .toMatch(new RegExp(`\\${clase}[\\s,{:]`))
    }
    // Ni una sola propiedad de posición o tamaño en línea en la pieza.
    expect(CODIGO_LENTE).not.toMatch(/style=\{\{/)
    expect(CODIGO_LENTE).not.toMatch(/position:\s*'fixed'/)
  })

  it('7 · los dos consumidores abren en la lente y ya no despliegan en línea', () => {
    for (const [nombre, fuente] of [
      ['SelloProcedencia', SELLO], ['DeDondeSalioEsto', DEDONDE],
    ] as const) {
      expect(fuente, `${nombre} no usa la pieza`)
        .toMatch(/import \{ Lente \} from '@\/components\/LenteContextual'/)
      expect(fuente, `${nombre} no monta la lente`).toContain('<Lente')
      // El detalle YA NO cuelga de un `{abierto && (` dentro de la tira: eso
      // era exactamente lo que empujaba la nota entre 515 y 1220px.
      expect(fuente, `${nombre} sigue desplegando en línea`)
        .not.toMatch(/\{abierto && \(/)
      // Y la vuelta del foco necesita saber a QUIÉN vuelve.
      expect(fuente, `${nombre} no le pasa su disparador a la lente`)
        .toMatch(/invocador=\{disparador\}/)
    }
  })

  it('8 · los dos disparadores dicen que abren algo (aria-expanded)', () => {
    for (const [nombre, fuente] of [
      ['SelloProcedencia', SELLO], ['DeDondeSalioEsto', DEDONDE],
    ] as const) {
      expect(fuente, `${nombre} no declara aria-expanded`)
        .toMatch(/aria-expanded=\{abierto\}/)
    }
  })

  it('9 · el contenido sigue vivo: lo renderiza el consumidor, no lo copia la lente', () => {
    // `children`, no un `contenido` guardado en estado. Una lente que guarda
    // una copia enseña la foto de un dato clínico, no el dato.
    expect(CODIGO_LENTE).toMatch(/children: React\.ReactNode/)
    expect(CODIGO_LENTE).toContain('{children}')
    expect(CODIGO_LENTE).not.toMatch(/useState<[^>]*ReactNode/)
  })

  it('10 · la hoja inferior va en FLUJO: ningún `bottom` a mano para esquivar el pulgar', () => {
    const bloque = CSS.slice(CSS.indexOf('.nx-lente-hueco:empty'), CSS.indexOf('/* ── Bottom Nav'))
    expect(bloque.length).toBeGreaterThan(200)
    // El régimen ancho SÍ es fixed (ocupa el canalón que el lienzo reserva) y
    // ahí `bottom: 0` es el borde de la ventana, no un cálculo de chrome.
    expect(bloque).toMatch(/@media \(min-width: 1200px\)/)
    // Lo que no puede aparecer es un bottom con número: el claro del BottomNav
    // calculado a mano es la familia de parches que RTC-32 mató.
    // `[;{\s]` delante a propósito: sin el borde, `border-bottom: 1px` cazaba
    // el guardián a sí mismo — la vara medía la propiedad equivocada.
    expect(bloque).not.toMatch(/[;{\s]bottom:\s*\d*[1-9]\d*(px|rem|em)/)
    expect(bloque).not.toMatch(/calc\([^)]*bottom-nav/)
  })

  it('11 · en escritorio la lente ACOPLA: el shell cede el ancho, no lo tapa', () => {
    // La aritmética del shell (riel 224 + lienzo 1100 centrado + lectura 820)
    // dice que un panel de 400 flotando cruza el borde del texto en TODOS los
    // anchos reales: a 1200 taparía 268px, a 1440 unos 86, y hasta ~1920 no
    // dejaría libre la columna de lectura. Por eso el shell cede el ancho.
    // Si alguien quita este `padding-right` para «no mover el texto», el panel
    // vuelve a caer encima del hecho que explica.
    expect(CSS).toMatch(/\.nx-app-shell:has\(\.nx-lente\)\s*\{\s*padding-right:\s*var\(--nx-lente-ancho\)/)
    expect(CSS).toMatch(/--nx-lente-ancho:\s*min\(/)
    // Y el ancho del panel y lo que el shell cede son EL MISMO valor: dos
    // números que tienen que coincidir y viven en dos sitios acaban divergiendo
    // — la regla cardinal de este repositorio.
    const bloque = CSS.slice(CSS.indexOf('@media (min-width: 1200px)', CSS.indexOf('.nx-lente-hueco:empty')))
    expect(bloque.slice(0, 600)).toMatch(/width:\s*var\(--nx-lente-ancho\)/)
  })
})
