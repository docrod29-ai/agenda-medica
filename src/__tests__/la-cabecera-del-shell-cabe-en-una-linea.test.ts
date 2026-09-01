/**
 * GOLDEN — el nombre del consultorio envolvía a dos renglones en TODAS las
 * pantallas, y el arreglo se hizo primero en el componente equivocado.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Levantando el arnés del emulador y mirando las capturas
 * (`docs/audit/ausculta-transformacion/interno/`). «Consultorio de Medicina
 * Interna» —un nombre corriente, no un caso extremo— envolvía a dos renglones
 * y empujaba el nombre de la médica contra el borde del bloque. Medido en el
 * navegador: el rótulo ocupaba **42 px de alto** en vez de 21.
 *
 * Es la cabecera del shell, así que el defecto aparecía en las ocho pantallas
 * capturadas y en los dos anchos — en cada pantalla del producto a la vez.
 *
 * ── LA PARTE QUE IMPORTA: EL ARREGLO NO FUNCIONÓ A LA PRIMERA ───────────────
 *
 * Se corrigió en `Sidebar.tsx`, se volvió a medir… y el rótulo seguía a 42 px.
 * A 1440 quien pinta esa cabecera **no es `Sidebar`: es `FlowRail`**, que lleva
 * el mismo bloque copiado. Es exactamente la familia que el propio `FlowRail`
 * tiene escrita treinta líneas más abajo, a propósito de otro defecto: «la
 * lección se aprende en un componente y no en el de al lado».
 *
 * Si no se hubiera vuelto a medir en el navegador, este arreglo se habría dado
 * por hecho —el diff se veía bien— y no habría cambiado un píxel. Es «el dato
 * tiene que LLEGAR» aplicado a una corrección visual.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * El recorte baja a **`.sidebar-logo`**, la clase que los dos comparten, para
 * que no haya un tercer componente al que se le olvide. Lo que sí vive en cada
 * componente es el `title`: recortar sin dejar el nombre entero a un puntero de
 * distancia sería esconder información, no ordenarla.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando la regla de `.sidebar-logo`, el primer caso falla; quitando el
 * `title` de cualquiera de los dos componentes, el segundo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No mide el alto renderizado.** Que pasara de 42 a 21 px lo dijo
 *   `scripts/ausculta-transformacion/medir-sidebar.mjs` contra la app servida
 *   sobre el emulador; esto vigila que la regla y su portador sigan existiendo.
 * · No comprueba los demás sitios donde aparece el nombre del consultorio
 *   (`InstrumentStrip`, que ya recortaba por su cuenta desde antes).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const CSS = leer('src/app/globals.css')

/** Los dos componentes que pintan la cabecera del shell. */
const CABECERAS = ['src/components/Sidebar.tsx', 'src/components/FlowRail.tsx']

describe('la cabecera del shell cabe en una línea', () => {
  it('el recorte vive en la clase compartida, no en un componente', () => {
    expect(CSS).toContain('.sidebar-logo > div:last-child { min-width: 0; }')
    const bloque = CSS.slice(CSS.indexOf('.sidebar-logo > div:last-child > div {'))
      .slice(0, 200)
    expect(bloque).toContain('white-space: nowrap')
    expect(bloque).toContain('text-overflow: ellipsis')
    // `min-width: 0` es lo que permite que un hijo de flex encoja por debajo
    // de su contenido; sin él `text-overflow` no recorta nada.
    expect(CSS).toMatch(/\.sidebar-logo > div:last-child \{ min-width: 0; \}/)
  })

  it('los DOS componentes que pintan la cabecera existen y la comparten', () => {
    /**
     * El caso que habría cazado el arreglo a medias: si mañana alguien mueve
     * el recorte de vuelta a un componente, el otro se queda atrás y nadie lo
     * ve hasta volver a mirar el navegador.
     */
    const sinClase = CABECERAS.filter(p => !leer(p).includes('className="sidebar-logo"'))
    expect(sinClase, `dejaron de compartir la clase: ${sinClase.join(', ')}`).toEqual([])
  })

  it('y los dos dejan el nombre entero a un puntero de distancia', () => {
    // Recortar sin `title` es esconder información, no ordenarla.
    const sinTitulo = CABECERAS.filter(
      p => !leer(p).includes("title={config.nombreClinica || 'Ausculta'}"),
    )
    expect(sinTitulo, `recortan sin decir el nombre completo: ${sinTitulo.join(', ')}`).toEqual([])
  })

  it('ninguno vuelve a recortar por su cuenta en línea', () => {
    /**
     * Dos implementaciones del mismo recorte es la forma de que un día dejen
     * de ser la misma. Si el estilo en línea vuelve, la clase deja de ser la
     * fuente y el próximo componente vuelve a nacer sin él.
     */
    const conCopia = CABECERAS.filter(p => {
      const limpio = leer(p).replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
      // SÓLO el bloque de la cabecera: `FlowRail` recorta también una pista
      // suya más abajo, y eso es otro elemento con otro motivo.
      const i = limpio.indexOf('className="sidebar-logo"')
      const bloque = i === -1 ? '' : limpio.slice(i, limpio.indexOf('</div>', limpio.indexOf('</div>', i) + 1) + 600)
      return /textOverflow:\s*'ellipsis'/.test(bloque)
    })
    expect(conCopia, `volvió la copia del recorte: ${conCopia.join(', ')}`).toEqual([])
  })
})
