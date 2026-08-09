/**
 * GOLDEN — V9 · DESIGN-SYSTEM-001 · la compuerta del sistema de diseño.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La auditoría `PATIENT-UX-TRUTH-001` esperaba encontrar «cara de producto
 * generado por IA» y encontró lo contrario: cero degradados morados, una
 * `rounded-2xl` en toda la aplicación, y una identidad con el contraste WCAG
 * calculado a mano y escrito en el propio CSS.
 *
 * El defecto era el simétrico: **el sistema de diseño existía y la aplicación no
 * le obedecía.** 6 065 estilos en línea en el 88,5 % de los archivos, 146
 * hexadecimales a mano, ~2 900 `fontSize` en línea con 39 valores para una
 * escala que declara seis, ~20 radios para una escala que declaraba dos.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Contando. Y contando también la causa: `@theme inline` exponía **cuatro**
 * tokens a Tailwind. Todo lo demás vivía en variables CSS que Tailwind no ve,
 * así que no había utilidades que usar y el código **no tenía alternativa** al
 * estilo en línea. No era dejadez: era mecánica.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Primero se da la alternativa (esta unidad ensancha `@theme inline` y declara
 * las escalas de radio y espacio), y después se cierra la puerta con un
 * trinquete que **sólo baja** — el mismo patrón que ya funciona en lint. Exigir
 * cero hoy pondría el gate en rojo el primer día, y un gate que nadie puede
 * poner en verde acaba en `continue-on-error`.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - **No dice si la pantalla está bien.** Un archivo puede usar todos los tokens
 *   y ser ilegible. Eso se juzga mirando el producto —`.claude/rules/design-system.md`:
 *   no se aprueba una interfaz leyendo el código— y es `VISUAL-EXCELLENCE-001`.
 * - **No mide accesibilidad.** Ni contraste real, ni foco, ni objetivo táctil.
 *   Es `A11Y-GATE-001`, y necesita `axe` sobre el producto corriendo.
 * - **No cuenta `globals.css`.** Ahí los hexadecimales son los tokens: es la
 *   fuente de verdad, no deuda.
 * - **No cuenta las pruebas.** Un golden que reproduce un color a mano lo hace a
 *   propósito.
 * - **No mide adopción de los primitivos** de `components/ui/` (24 % hoy). Se
 *   puede escribir una pantalla entera con tokens y sin un solo `<Button>`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { medir, comparar, TECHO } from '../../scripts/design/trinquete-de-diseno.mjs'

const techo = JSON.parse(readFileSync(join(process.cwd(), TECHO), 'utf8'))
const medida = medir()

describe('el trinquete de diseño', () => {
  it('el techo existe y está declarado', () => {
    expect(existsSync(join(process.cwd(), TECHO))).toBe(true)
    expect(techo.porQue).toMatch(/BAJAR/)
  })

  it('no se añadió deuda de diseño', () => {
    const { subieron } = comparar(medida, techo)
    expect(
      subieron,
      subieron.map(s => `${s.cifra}: techo ${s.tope} → hoy ${s.hoy}`).join(' · ') +
      ' — usa los tokens: colores en globals.css, tamaños en `.t-*`, radio en `--r-*`, espacio en `--e-*`.',
    ).toEqual([])
  })

  it('si bajó, se aprieta el trinquete (un trinquete que no se aprieta es un tope)', () => {
    const { bajaron } = comparar(medida, techo)
    expect(
      bajaron,
      bajaron.map(b => `${b.cifra}: techo ${b.tope} → hoy ${b.hoy}`).join(' · ') +
      ' — corre `node scripts/design/trinquete-de-diseno.mjs --actualizar`.',
    ).toEqual([])
  })

  /**
   * PROBADO AL REVÉS. Sin este caso, `comparar` podría devolver siempre listas
   * vacías —un `return { subieron: [], bajaron: [] }`— y los dos casos de arriba
   * pasarían para siempre sin comprobar nada.
   */
  it('el comparador DETECTA una subida (si no, los dos casos de arriba no prueban nada)', () => {
    const peor = { ...medida, hexCrudos: medida.hexCrudos + 1 }
    expect(comparar(peor, techo).subieron).toEqual([
      { cifra: 'hexCrudos', tope: techo.hexCrudos, hoy: techo.hexCrudos + 1 },
    ])
  })

  it('y DETECTA una bajada', () => {
    const mejor = { ...medida, radioEnLinea: medida.radioEnLinea - 1 }
    expect(comparar(mejor, techo).bajaron).toEqual([
      { cifra: 'radioEnLinea', tope: techo.radioEnLinea, hoy: techo.radioEnLinea - 1 },
    ])
  })
})

/**
 * EL MISMO COLOR ESCRITO DE DOS FORMAS — techo CERO, y por qué merece uno propio.
 *
 * `#3d5afe` y `#3D5AFE` convivían: 98 y 24 usos del azul de marca. Con siete
 * valores así, cualquier recuento de colores miente por exceso —146 distintos
 * cuando eran 139— y la reparación es pura: CSS no distingue mayúsculas, así que
 * no cambia un píxel. Es la única cifra de este trinquete que nace en cero, y
 * por eso es la única que puede exigirse sin margen.
 */
describe('un color, una escritura', () => {
  it('ningún hexadecimal se escribe en dos mayúsculas', () => {
    expect(
      medida.detalle.enDosCajas,
      `escritos de dos formas: ${medida.detalle.enDosCajas.join(', ')}`,
    ).toEqual([])
  })
})

/**
 * LO QUE TAILWIND VE — la causa raíz, con guardián.
 *
 * Si alguien vuelve a estrechar `@theme inline`, las utilidades desaparecen y el
 * estilo en línea vuelve a ser la única salida. El trinquete de arriba lo
 * detectaría **meses después**, cuando la deuda ya hubiera subido.
 */
describe('@theme inline expone el sistema, no cuatro tokens', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')
  const bloque = css.slice(css.indexOf('@theme inline'), css.indexOf('@theme inline') + 3000)

  it('los colores del tema son utilidades', () => {
    for (const t of ['--color-canvas', '--color-s1', '--color-s2', '--color-s3',
      '--color-linea', '--color-principal', '--color-secundario', '--color-terciario',
      '--color-nexus', '--color-nexus-solido']) {
      expect(bloque, `falta ${t} en @theme inline`).toContain(t)
    }
  })

  it('el radio y el espacio también', () => {
    for (const t of ['--radius-md', '--radius-lg', '--radius-pill', '--spacing-e4', '--spacing-e6']) {
      expect(bloque, `falta ${t} en @theme inline`).toContain(t)
    }
  })

  it('cada token APUNTA a su variable, no copia el valor', () => {
    // Copiar el hexadecimal aquí crearía un segundo sitio que hay que acordarse
    // de cambiar cuando el tema claro lo redefina: familia `depende_de_recordar`.
    const lineas = bloque.split('\n').filter(l => /^\s*--(color|radius|spacing)-/.test(l))
    expect(lineas.length).toBeGreaterThan(20)
    for (const l of lineas) {
      expect(l, `${l.trim()} no referencia una variable`).toMatch(/var\(--/)
    }
  })
})

/**
 * LAS ESCALAS EXISTEN Y ESTÁN RAZONADAS.
 *
 * No se comprueban los VALORES —eso sería copiar el archivo en una prueba— sino
 * que los peldaños existan y que la escala no se haya declarado sin decir de
 * dónde sale. Una escala sin razón escrita se cambia por gusto a los seis meses.
 */
describe('las escalas de radio y espacio', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')

  it('el radio tiene seis peldaños además de la píldora y el círculo', () => {
    for (const t of ['--r-xs', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-2xl', '--r-pill', '--r-circulo']) {
      expect(css, `falta ${t}`).toContain(`${t}:`)
    }
  })

  it('el espacio tiene diez', () => {
    for (let i = 1; i <= 10; i++) expect(css, `falta --e-${i}`).toContain(`--e-${i}:`)
  })

  it('las dos escalas dicen de dónde salen (medidas, no inventadas)', () => {
    expect(css).toMatch(/LA ESCALA DE RADIO/)
    expect(css).toMatch(/LA ESCALA DE ESPACIO/)
    expect(css).toMatch(/Medido[^.]*9-ago-2026|9-ago-2026/)
  })

  it('la escala tipográfica cubre los dos tamaños más usados que no tenían peldaño', () => {
    // 13 px (536 usos) y 11 px (292) eran los más escritos a mano sin clase.
    expect(css).toContain('.t-body-sm')
    expect(css).toContain('.t-micro')
  })
})
