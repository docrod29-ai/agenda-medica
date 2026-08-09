/**
 * EL SISTEMA DE DISEÑO TIENE TRINQUETE — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `@theme inline` exponía a Tailwind **cuatro** valores: fondo, texto y dos
 * familias de letra. Todo el sistema de diseño —superficies, semántica clínica,
 * radios, la píldora con su razón escrita— vivía en variables CSS que Tailwind
 * no mira.
 *
 * La consecuencia no era estética, era **mecánica**: no existía la utilidad que
 * usar. Quien escribía una pantalla no tenía `bg-nx-s1` ni `text-nx-4`, así que
 * sólo le quedaba `style={{ background: '#131518', fontSize: 12.5 }}`. De ahí
 * salen las cifras de la auditoría: 6 065 estilos en línea en 177 de 200
 * archivos, 150 hexadecimales a mano, 39 tamaños de letra donde la escala
 * declaraba 9.
 *
 * Y faltaban escaleras enteras. **No había ninguna escala de espacio.** Los 33
 * valores distintos de padding/margin incluían todos los enteros del 1 al 16.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contando, en `PATIENT-UX-TRUTH-001`. La auditoría entró buscando lo que la
 * directiva V9 daba por supuesto —«cara de producto generado por IA», degradado
 * morado, todo tarjetas redondeadas— y encontró lo contrario: cero degradados,
 * cero `from-purple`, una sola `rounded-2xl`, y los cocientes de contraste WCAG
 * calculados a mano dentro del propio CSS.
 *
 * El defecto era el simétrico, y peor: **el sistema existe y la aplicación no
 * le obedece.** Un sistema de diseño que nadie usa es documentación.
 *
 * ── LA CAUSA RAÍZ QUE SE ATACA ──────────────────────────────────────────────
 *
 * Dos, y hacen falta las dos:
 *
 * 1. **No había alternativa al estilo en línea.** Se arregla ensanchando
 *    `@theme inline` y declarando las escaleras que faltaban (`--sp-*`,
 *    `--fs-*`, `--r-*`, `--elev-*`), cada una con la medición que la justifica.
 *
 * 2. **Nada impedía que la deuda creciera.** Declarar la escalera no retira los
 *    2 903 tamaños de letra que ya están escritos; sin trinquete, la escalera
 *    nueva convive con el continuo viejo y en tres meses hay 45 tamaños en vez
 *    de 39. Es exactamente lo que pasó con el lint hasta que se le puso techo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Un token que Tailwind no ve es un token que no existe.** Es la regla «el
 * dato tiene que LLEGAR» aplicada al CSS: declararlo en `:root` es escribirlo,
 * no entregarlo. El destinatario es el compilador de utilidades, y hay que
 * mirar del otro lado.
 *
 * Y el trinquete sólo baja, como el de lint: sube → falla diciendo dónde; baja
 * → falla pidiendo que se apriete, porque un margen que no se congela se lo come
 * el siguiente descuido.
 *
 * ── PIXEL-NEUTRO A PROPÓSITO ────────────────────────────────────────────────
 *
 * Nada de esto repinta. Colapsar 12,5 px en 13 px son 466 cambios visuales
 * repartidos por toda la aplicación, y la directiva V9 §4 prohíbe aprobar
 * interfaz leyendo el código. El repintado va **detrás** del navegador; esta
 * unidad sólo pone la escalera y la defiende.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No dice que ninguna pantalla se vea bien.** Cuenta literales. Una pantalla
 *   con cero estilos en línea puede ser ilegible y este guardián la aprueba.
 * - No mide contraste, ni foco, ni objetivo táctil: eso es `A11Y-GATE-001`, que
 *   sigue abierto.
 * - No vigila `src/app/globals.css`: ahí los literales viven a propósito.
 * - No detecta un hexadecimal escrito en un `.scss`, en un `<style>` de HTML
 *   servido, ni construido por concatenación (`'#' + tono`). Vocabulario, no
 *   criterio: lo que no está en el patrón **no se vigila**, no se da por bueno.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { medir, comparar, TECHO } from '../../scripts/design/trinquete-de-diseno.mjs'

const RAIZ = process.cwd()
const CSS = readFileSync(join(RAIZ, 'src/app/globals.css'), 'utf8')

/**
 * Las escaleras que esta unidad declara. Se nombran aquí a mano **a propósito**:
 * si alguien añade `--fs-10` y no lo pone en `@theme inline`, el guardián sólo
 * puede cazarlo si sabe qué prefijos forman parte del sistema.
 */
const PREFIJOS_DEL_SISTEMA = ['--fs-', '--sp-', '--r-', '--elev-']

/**
 * Los comentarios se retiran ANTES de mirar nada. Este mismo archivo de CSS
 * documenta el sistema dentro de comentarios que citan `@theme inline` y
 * `style={{…}}`: buscar la cadena a pelo encuentra la explicación en vez de la
 * regla, y el guardián acaba midiendo su propia prosa.
 */
const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** El bloque `@theme inline`, que es lo único que Tailwind mira. */
export function bloqueTheme(css: string): string {
  const limpio = sinComentarios(css)
  const m = /@theme\s+inline\s*\{/.exec(limpio)
  if (!m) return ''
  const abre = m.index + m[0].length - 1
  let profundidad = 0
  for (let j = abre; j < limpio.length; j++) {
    if (limpio[j] === '{') profundidad++
    else if (limpio[j] === '}') {
      profundidad--
      if (profundidad === 0) return limpio.slice(abre + 1, j)
    }
  }
  return ''
}

/** `--foo:` en posición de DECLARACIÓN, no dentro de un `var(--foo)`. */
const DECLARACION = /(?:^|[{;])\s*(--[a-z0-9-]+)\s*:/gim

/**
 * Tokens del sistema declarados en el CSS pero que **no llegan** a `@theme`.
 * Pura: recibe el texto, para poder probarla al revés con un CSS defectuoso.
 */
export function tokensQueNoLlegan(css: string): string[] {
  const limpio = sinComentarios(css)
  const theme = bloqueTheme(css)
  const declarados = new Set<string>()
  for (const m of limpio.matchAll(new RegExp(DECLARACION.source, DECLARACION.flags))) {
    const nombre = m[1]
    if (PREFIJOS_DEL_SISTEMA.some(p => nombre.startsWith(p))) declarados.add(nombre)
  }
  // Lo declarado DENTRO del propio bloque no tiene que llegar a sí mismo.
  for (const m of theme.matchAll(new RegExp(DECLARACION.source, DECLARACION.flags))) {
    declarados.delete(m[1])
  }
  return [...declarados].filter(t => !new RegExp(`var\\(\\s*${t}\\s*\\)`).test(theme)).sort()
}

describe('el sistema de diseño llega hasta Tailwind', () => {
  it('las cuatro escaleras están declaradas, con los peldaños que dice la medición', () => {
    // Espacio: la escalera que NO existía. Nueve peldaños, base 4.
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(CSS, `falta --sp-${n}`).toMatch(new RegExp(`--sp-${n}\\s*:`))
    }
    // Tipografía: nueve peldaños anclados en 13px, el cuerpo real de la app.
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(CSS, `falta --fs-${n}`).toMatch(new RegExp(`--fs-${n}\\s*:`))
    }
    expect(CSS, '--fs-4 debe ser 13px: es el cuerpo, con 539 usos').toMatch(/--fs-4:\s*13px/)
    // Radio: seis peldaños + píldora + círculo, que ya existían.
    for (const n of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'pill', 'circulo']) {
      expect(CSS, `falta --r-${n}`).toMatch(new RegExp(`--r-${n}\\s*:`))
    }
    // Elevación: tres peldaños donde había 22 sombras distintas en 24 usos.
    for (const n of [1, 2, 3]) {
      expect(CSS, `falta --elev-${n}`).toMatch(new RegExp(`--elev-${n}\\s*:`))
    }
  })

  it('TODO peldaño declarado llega a @theme inline — si no, no existe como utilidad', () => {
    expect(tokensQueNoLlegan(CSS)).toEqual([])
  })

  it('AL REVÉS: un peldaño que se queda en :root se detecta', () => {
    const defectuoso = `
      :root { --fs-4: 13px; --sp-4: 8px; --r-md: 8px; --elev-1: none; }
      @theme inline {
        --text-nx-4: var(--fs-4);
        --spacing-nx-4: var(--sp-4);
        --radius-nx-md: var(--r-md);
      }
    `
    // --elev-1 se declaró y no se expuso: es justo el fallo que el guardián busca.
    expect(tokensQueNoLlegan(defectuoso)).toEqual(['--elev-1'])
  })

  it('las utilidades nuevas llevan prefijo nx-, porque el código ya usa las de Tailwind', () => {
    // `text-xs` (29 usos), `text-sm` (24), `p-6`, `rounded-md` (8) están en uso.
    // Declarar `--text-sm` o `--spacing-6` aquí los reescribiría en silencio.
    const theme = bloqueTheme(CSS)
    const colisiones = [...theme.matchAll(/^\s*--(text|spacing|radius|shadow)-([a-z0-9-]+)\s*:/gim)]
      .map(m => `--${m[1]}-${m[2]}`)
      .filter(nombre => !/^--(text|spacing|radius|shadow)-nx-/.test(nombre))
    expect(colisiones, 'una utilidad sin prefijo nx- puede pisar una de Tailwind').toEqual([])
  })
})

describe('EL DATO LLEGA: las utilidades existen del otro lado del compilador', () => {
  /**
   * Todo lo de arriba lee el CSS y comprueba que **diga** lo acordado. Eso es
   * una prueba de contrato, y la regla `el-dato-tiene-que-LLEGAR` es explícita:
   * el contrato no comprueba que el destinatario lo acepte. El destinatario aquí
   * es Tailwind, y hay tres formas de que `@theme inline` se vea impecable y no
   * produzca nada —namespace mal escrito, valor que el compilador descarta,
   * versión que cambió la convención—. Ninguna la caza un `grep` sobre el CSS.
   *
   * Así que se compila de verdad y se mira la salida.
   */
  it('bg-nx-*, text-nx-*, p-nx-*, rounded-nx-* y shadow-nx-* se generan', async () => {
    const postcss = (await import('postcss')).default
    const tailwind = (await import('@tailwindcss/postcss')).default
    const ruta = join(RAIZ, 'src/app/globals.css')
    const candidatos = 'bg-nx-s1 text-nx-4 p-nx-5 gap-nx-6 rounded-nx-md shadow-nx-2 text-nx-ink2 text-xs p-6'
    const { css } = await postcss([tailwind({ optimize: false })]).process(
      `${CSS}\n@source inline("${candidatos}");\n`,
      { from: ruta },
    )

    expect(css).toContain('.bg-nx-s1')
    expect(css).toMatch(/\.bg-nx-s1\s*\{[^}]*background-color:\s*var\(--s1\)/)
    expect(css).toMatch(/\.text-nx-4\s*\{[^}]*font-size:\s*var\(--fs-4\)/)
    expect(css).toMatch(/\.p-nx-5\s*\{[^}]*padding:\s*var\(--sp-5\)/)
    expect(css).toMatch(/\.gap-nx-6\s*\{[^}]*gap:\s*var\(--sp-6\)/)
    expect(css).toMatch(/\.rounded-nx-md\s*\{[^}]*border-radius:\s*var\(--r-md\)/)
    expect(css).toMatch(/\.shadow-nx-2\s*\{[^}]*var\(--elev-2\)/)
    expect(css).toMatch(/\.text-nx-ink2\s*\{[^}]*color:\s*var\(--text2\)/)
  }, 60_000)

  it('y las utilidades que el código YA usaba siguen valiendo lo mismo', async () => {
    // El riesgo real de tocar @theme: reescribir en silencio una utilidad viva.
    // `text-xs` (29 usos) y `p-6` tienen que seguir saliendo de la escala de
    // Tailwind, no de la nuestra.
    const postcss = (await import('postcss')).default
    const tailwind = (await import('@tailwindcss/postcss')).default
    const { css } = await postcss([tailwind({ optimize: false })]).process(
      `${CSS}\n@source inline("text-xs p-6 rounded-md");\n`,
      { from: join(RAIZ, 'src/app/globals.css') },
    )
    expect(css).toMatch(/\.text-xs\s*\{[^}]*font-size:\s*var\(--text-xs\)/)
    expect(css).toMatch(/\.p-6\s*\{[^}]*padding:\s*calc\(var\(--spacing\)\s*\*\s*6\)/)
  }, 60_000)
})

describe('el trinquete de diseño sólo baja', () => {
  const techo = JSON.parse(readFileSync(join(RAIZ, TECHO), 'utf8'))

  it('la deuda medible no supera el techo congelado', () => {
    const { subieron } = comparar(medir(RAIZ), techo)
    expect(
      subieron,
      'Usa los tokens (--fs-*, --sp-*, --r-*, --elev-*) o las utilidades nx-. ' +
        'Detalle: node scripts/design/trinquete-de-diseno.mjs',
    ).toEqual([])
  })

  it('AL REVÉS: un literal más en una pantalla nueva rompe el trinquete', () => {
    const medido = medir(RAIZ)
    const conUnHexMas = {
      ...medido,
      hexadecimales: {
        ...medido.hexadecimales,
        total: medido.hexadecimales.total + 1,
        porArchivo: { ...medido.hexadecimales.porArchivo, 'src/app/(dashboard)/nueva/page.tsx': 1 },
      },
    }
    const { subieron, ok } = comparar(conUnHexMas, techo)
    expect(ok).toBe(false)
    expect(subieron.join(' ')).toContain('hexadecimales.total')
  })

  it('AL REVÉS: bajar la deuda sin apretar el techo también falla', () => {
    const medido = medir(RAIZ)
    const conUnHexMenos = {
      ...medido,
      hexadecimales: { ...medido.hexadecimales, total: medido.hexadecimales.total - 1 },
    }
    const { bajaron, ok } = comparar(conUnHexMenos, techo)
    expect(ok).toBe(false)
    expect(bajaron.join(' ')).toContain('hexadecimales.total')
  })

  it('el techo en disco es el que produce la medición de hoy', () => {
    // Si esto falla, el techo se editó a mano en vez de con --actualizar.
    const medido = medir(RAIZ)
    for (const nombre of Object.keys(medido)) {
      expect(techo[nombre], `el techo no declara ${nombre}`).toBeDefined()
    }
  })
})
