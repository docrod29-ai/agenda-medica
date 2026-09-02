/**
 * GOLDEN — el menú del sitio listaba «Evidencia» y «Seguridad» como destinos, y
 * al llegar a ellas el menú desaparecía.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contando, sobre las páginas SERVIDAS, cuántas salidas internas tiene cada
 * una. `/evidencia` —la página que existe para que alguien pueda comprobar lo
 * que decimos— tenía **una sola**: `/`. `/demo/razonamiento`, la demostración
 * del razonamiento clínico, tenía tres, y ninguna era el inicio, ni los
 * precios, ni entrar.
 *
 * De ahí salió el recuento: `NavPublica` estaba en **3 de las 11** páginas
 * públicas (`/`, `/precios`, `/demo`). Las otras ocho eran callejones a los que
 * se llega desde un buscador o desde un enlace compartido.
 *
 * Y lo más claro de todo: dos de esas ocho —`/evidencia` y `/seguridad`— son
 * **destinos del propio menú**. Se pulsaba «Evidencia» y se aterrizaba en una
 * página sin menú.
 *
 * ── POR QUÉ ES DEL ENCARGO Y NO UN CAPRICHO ─────────────────────────────────
 *
 * «LANDING → LOGIN → PRODUCTO debe sentirse como una sola experiencia.» Una
 * página del sitio sin la navegación del sitio no es una experiencia con un
 * fallo: es otra página web.
 *
 * ── LOS DOS DEFECTOS QUE SALIERON AL PONERLO ────────────────────────────────
 *
 * **1. El menú heredaba la columna de lectura.** En `/privacidad` y
 * `/terminos` la raíz ES la columna de 780 px, así que el menú salía apretado,
 * con «Cómo funciona» y «Ver el producto» partidos en dos renglones. Se vio en
 * la captura, no en el diff.
 *
 * **2. El menú quedaba DENTRO de `<main>`.** Medido: `main .nx-nav-publica`
 * daba 1 en cuatro páginas. Un landmark de navegación dentro del landmark de
 * contenido principal le miente a quien recorre la página por landmarks — y es
 * el mismo tipo de defecto que este carril ya arregló en el portal del
 * paciente, donde seis bloques quedaban fuera de todo landmark.
 *
 * ── Y UNO PRE-EXISTENTE QUE APARECIÓ AL MIRAR LA CONSOLA ────────────────────
 *
 * `/privacidad` y `/terminos` envolvían **todo** hijo de `Section` en un `<p>`,
 * y la sección 7 le pasa una `<ul>`. Un `<ul>` dentro de un `<p>` es HTML
 * inválido: el navegador saca la lista fuera del párrafo, así que el árbol del
 * servidor y el del cliente no coinciden. En la consola, medido:
 *
 *     In HTML, <ul> cannot be a descendant of <p>. This will cause a
 *     hydration error.
 *     Hydration failed because the server rendered HTML didn't match the client.
 *
 * No es cosmético: React descarta el árbol del servidor y vuelve a pintar en
 * cliente. En un aviso de privacidad —un documento legal— lo que se ve podía
 * dejar de ser lo que se sirvió. Estaba ahí desde antes; se vio porque el arnés
 * de esta unidad lee la consola.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando `<NavPublica />` de cualquiera de las ocho, falla el primer bloque.
 * Devolviendo el `<p>` envolvente a `Section`, falla el último.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **Es un guardián de fuente.** Que el menú salga a lo ancho, fuera de
 *   `<main>`, sin desborde y con axe limpio se mide en el navegador con
 *   `scripts/ausculta-transformacion/el-sitio-es-un-sitio.mjs` (44 de 44
 *   combinaciones limpias). Eso NO corre en CI y se dice.
 * · **No cubre `/login` ni `/registro`.** Son las puertas, y están sin cromo a
 *   propósito: un menú con cinco destinos al lado del campo de la contraseña es
 *   una invitación a irse. Esa decisión es de otra unidad y aquí se respeta.
 * · **No cubre `/setup` ni `/superadmin`**, que no son públicas.
 * · No juzga el CONTENIDO de ninguna de las ocho páginas; sólo que sean parte
 *   del sitio.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/**
 * Las páginas públicas de CONTENIDO. No están las puertas (`/login`,
 * `/registro`) ni lo que no es público (`/setup`, `/superadmin`).
 */
const PAGINAS_DEL_SITIO = [
  'src/app/page.tsx',
  'src/app/precios/page.tsx',
  'src/app/demo/page.tsx',
  'src/app/evidencia/page.tsx',
  'src/app/seguridad/page.tsx',
  'src/app/arquitectura/page.tsx',
  'src/app/operacion/page.tsx',
  'src/app/contacto/page.tsx',
  'src/app/paquetes/page.tsx',
  'src/app/privacidad/page.tsx',
  'src/app/terminos/page.tsx',
]

/** Las puertas: sin cromo a propósito. Si les entrara el menú, se sabría. */
const PUERTAS = ['src/app/login/page.tsx', 'src/app/registro/page.tsx']

describe('las once páginas públicas son un sitio', () => {
  it('todas existen — la lista no se quedó atrás del árbol', () => {
    const perdidas = PAGINAS_DEL_SITIO.filter(p => !existsSync(join(process.cwd(), p)))
    expect(perdidas, `la lista nombra páginas que ya no están: ${perdidas.join(', ')}`).toEqual([])
  })

  it('todas llevan la navegación del sitio, y la PINTAN', () => {
    /**
     * Las dos cosas, y no sólo el import: la primera versión de este caso
     * miraba únicamente `from '…/NavPublica'`, y al probarlo al revés
     * —quitando el `<NavPublica />` del JSX y dejando el import— **siguió en
     * verde**. Un import sin uso es exactamente la deuda que persigue
     * `modulos-sin-conectar`: escrito y sin conectar.
     */
    const sinMenu = PAGINAS_DEL_SITIO.filter(p => {
      const s = leer(p)
      return !s.includes("from '@/components/landing/NavPublica'") || !s.includes('<NavPublica />')
    })
    expect(
      sinMenu,
      `páginas públicas sin menú (eran 8 de 11):\n${sinMenu.join('\n')}`,
    ).toEqual([])
  })

  it('y el menú no se pinta dentro de <main>', () => {
    /**
     * Medido en el navegador antes del arreglo: `main .nx-nav-publica` daba 1
     * en cuatro páginas. Aquí se caza la forma —`<NavPublica />` después de un
     * `<main`— porque es la que lo produce.
     */
    const dentro = PAGINAS_DEL_SITIO.filter(p => {
      const s = leer(p).replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
      const iMain = s.indexOf('<main')
      const iNav = s.indexOf('<NavPublica />')
      return iMain > -1 && iNav > iMain
    })
    expect(dentro, `el menú quedó dentro de <main>:\n${dentro.join('\n')}`).toEqual([])
  })

  it('cada destino que el menú anuncia lleva a una página que existe y tiene menú', () => {
    /**
     * Éste es el caso que impide que el defecto vuelva por el otro lado: el
     * menú listaba «Evidencia» y «Seguridad» y ninguna de las dos lo tenía.
     * Un destino del menú que aterriza fuera del sitio es peor que no ofrecerlo.
     */
    const NAV = leer('src/components/landing/NavPublica.tsx')
    const destinos = [...NAV.matchAll(/href: '(\/[^'#]*)(?:#[^']*)?'/g)]
      .map(m => m[1]).filter(h => h !== '/')
    expect(destinos.length, 'el menú se quedó sin destinos').toBeGreaterThanOrEqual(3)
    for (const d of destinos) {
      const archivo = `src/app${d}/page.tsx`
      expect(existsSync(join(process.cwd(), archivo)), `el menú lleva a ${d}, que no existe`).toBe(true)
      expect(
        leer(archivo).includes("from '@/components/landing/NavPublica'"),
        `el menú lleva a ${d}, y ${d} no tiene menú`,
      ).toBe(true)
    }
  })

  it('las puertas siguen SIN menú, que es una decisión y no un olvido', () => {
    // Cinco destinos al lado del campo de la contraseña son una invitación a
    // irse. Si alguien «completara» el sitio metiéndolo aquí, esto lo diría.
    for (const p of PUERTAS) {
      expect(leer(p), `${p} ganó un menú que no debe tener`).not.toContain('NavPublica')
    }
  })
})

describe('las páginas legales no rompen la hidratación', () => {
  it('Section no envuelve a sus hijos en un <p>', () => {
    // La sección 7 le pasa una <ul>. Un <ul> dentro de un <p> es HTML inválido
    // y el navegador la saca fuera: el árbol del servidor deja de coincidir con
    // el del cliente y React vuelve a pintar. En un documento legal.
    for (const p of ['src/app/privacidad/page.tsx', 'src/app/terminos/page.tsx']) {
      const s = leer(p)
      const m = s.match(/function Section\(\{ titulo, children \}[\s\S]*?\n\}/)
      expect(m, `${p} perdió su Section`).toBeTruthy()
      expect(m![0], `${p} vuelve a envolver los hijos en un <p>`)
        .not.toMatch(/<p style=\{\{ margin: 0 \}\}>\{children\}<\/p>/)
      expect(m![0]).toContain('{children}')
    }
  })

  it('y la <ul> que lo destapó sigue ahí — sin ella el arreglo no se prueba', () => {
    expect(leer('src/app/privacidad/page.tsx'), 'desapareció la lista de encargados')
      .toMatch(/<Section titulo="7\. Transferencias y encargados">[\s\S]{0,400}<ul/)
  })
})
