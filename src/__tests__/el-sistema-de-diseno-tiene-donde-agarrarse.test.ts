/**
 * EL SISTEMA DE DISEÑO EXISTÍA Y LA APLICACIÓN NO LE OBEDECÍA — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `PATIENT-UX-TRUTH-001` fue a buscar «cara de producto generado por IA» —lo que
 * la directiva daba por supuesto— y encontró lo contrario: cero degradados
 * morados, **una** tarjeta `rounded-2xl` en toda la aplicación, y una identidad
 * declarada con los cocientes de contraste WCAG calculados a mano dentro del
 * propio CSS.
 *
 * El defecto era el opuesto y peor: **el sistema existía y nadie lo usaba.**
 *
 *   6 191 `style={{` en 180 de 208 archivos de interfaz
 *   1 096 hexadecimales escritos a mano (131 distintos)
 *   2 899 `fontSize` en línea, con 39 tamaños — y medios píxeles
 *   1 238 `borderRadius` en línea, con 25 valores
 *
 * ── LA CAUSA RAÍZ: ERA MECÁNICA, NO DE DISCIPLINA ───────────────────────────
 *
 * `@theme inline` exponía a Tailwind **cuatro** valores: fondo, primer plano y
 * las dos familias tipográficas. Todo lo demás vivía en variables CSS que
 * Tailwind no mira, así que **no existían utilidades que usar**.
 *
 * Nadie escribe `style={{ fontSize: 13 }}` por gusto. Lo escribe porque
 * `text-cuerpo` no existe. Repintar 78 pantallas sin arreglar esto habría sido
 * repintarlas dos veces — y por eso `DESIGN-SYSTEM-001` va ANTES que
 * `VISUAL-EXCELLENCE-001`, no por orden alfabético.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contando. El primer recuento se hizo en la auditoría de V9 y está en
 * `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md`; `scripts/design/trinquete-de-diseno.mjs`
 * lo convierte en un instrumento que se puede volver a correr, que es la
 * diferencia entre un hallazgo y una compuerta.
 *
 * ── LA PRUEBA DE QUE EL ENFOQUE FUNCIONA ────────────────────────────────────
 *
 * `--r-pill`. La píldora estaba escrita de cinco formas (100, 999, 9999, 99,
 * 50). Se creó **un** token con su razón escrita, y hoy tiene 131 usos. Un token
 * bien puesto sí se adopta aquí; lo que faltaba era ponerlos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un trinquete, no un objetivo. «Cero estilos en línea» no se cumple nunca y se
 * ignora al mes; «hoy no peor que ayer» lleva meses funcionando en
 * `lint-trinquete.mjs`. **Una pantalla nueva escrita con estilos en línea sube
 * el número y pone esta prueba en rojo** — que es exactamente lo que pide la
 * condición de terminado de la iteración.
 *
 * Y las escalas se nombran por su PAPEL, no por su tamaño: mientras el token se
 * llame `--t-12`, la siguiente pantalla se inventará un 12,75 porque «se veía
 * mejor». `--t-cuerpo` obliga a decir qué manda en la pantalla, que es el
 * principio de JERARQUÍA de la directiva.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No dice que la interfaz esté bien.** Son recuentos sobre el código: no
 *   miden jerarquía real, ni contraste en pantalla, ni si una pantalla tiene un
 *   solo propósito. La directiva V9 §4 es explícita — *no se aprueba interfaz
 *   leyendo código*. Nadie ha abierto todavía una pantalla.
 * - **No comprueba que las utilidades se emitan.** Que `text-cuerpo` esté en el
 *   tema no prueba que Tailwind genere la clase. Eso se verificó **a mano el
 *   9-ago-2026**, corriendo el CLI real de Tailwind 4.3.3 sobre este mismo
 *   bloque `@theme`: salieron `.text-cuerpo`, `.p-e12`, `.rounded-tarjeta`,
 *   `.bg-superficie`, `.text-texto-2`, `.shadow-2`, `.gap-e8` y `.border-borde`,
 *   y en la misma pasada se comprobó que `px-2`, `p-6` y `rounded-md` **siguen
 *   valiendo lo de siempre** (de ahí la `e` de la escala de espacio: sin ella,
 *   los 57 usos que la aplicación ya tiene de la escala numérica de Tailwind
 *   habrían cambiado de tamaño en silencio). Esa comprobación **no está
 *   automatizada**: correr el CLI dentro de vitest sería lento y frágil.
 * - **No mide adopción.** Que el techo no suba no significa que nadie use los
 *   tokens: significa que la deuda no crece. Bajar el techo es el trabajo de las
 *   iteraciones siguientes.
 * - **No cubre accesibilidad.** `A11Y-GATE-001` sigue abierto: hoy hay una sola
 *   prueba de accesibilidad y es una expresión regular sobre `layout.tsx`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
// El instrumento es JS puro a propósito: corre con `node` pelado, sin transpilar.
import { archivosDeInterfaz, medir, tokensQueTailwindVe, comparar } from '../../scripts/design/trinquete-de-diseno.mjs'

/** Las medidas son un mapa de nombre → número; el script no lleva tipos. */
type Medidas = Record<string, number>

const CSS = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')
const TECHO = JSON.parse(
  readFileSync(join(process.cwd(), 'docs', 'design', 'trinquete-de-diseno.json'), 'utf8'),
)

describe('el trinquete del diseño sólo baja', () => {
  it('ninguna medida está por encima del techo sellado', () => {
    const medidas: Medidas = { ...medir(archivosDeInterfaz()), tokensQueTailwindVe: tokensQueTailwindVe(CSS) }
    const { suben } = comparar(medidas)
    expect(
      suben,
      suben.length
        ? `Sube la deuda de diseño:\n  ${suben.join('\n  ')}\n\n` +
          'Se arregla el cambio, no se sube el techo. Los tokens están en ' +
          'globals.css (@theme inline) y hay utilidades para color, espacio, ' +
          'radio y tipografía.'
        : '',
    ).toEqual([])
  })

  it('el instrumento DETECTA una subida — no es de cartón', () => {
    /**
     * Sin esto, un error en `comparar` dejaría el trinquete siempre verde y
     * nadie se enteraría. Probado al revés: se le mete una medida peor que el
     * techo y tiene que quejarse.
     */
    const peor = { ...TECHO.techo, estiloEnLinea: TECHO.techo.estiloEnLinea + 1 }
    expect(comparar(peor).suben).toHaveLength(1)
  })

  it('y NO se queja cuando una medida mejora', () => {
    const mejor = { ...TECHO.techo, estiloEnLinea: TECHO.techo.estiloEnLinea - 1 }
    const { suben, bajan } = comparar(mejor)
    expect(suben).toEqual([])
    expect(bajan).toContain('estiloEnLinea')
  })

  it('`tokensQueTailwindVe` cuenta al revés: subir es mejorar', () => {
    // Es la única medida invertida, y confundirla dejaría el techo pidiendo que
    // el tema volviera a exponer cuatro valores.
    expect(TECHO.mejorSiSube).toContain('tokensQueTailwindVe')
    const menos = { ...TECHO.techo, tokensQueTailwindVe: 4 }
    expect(comparar(menos).suben.join()).toContain('tokensQueTailwindVe')
  })

  it('el número de archivos de interfaz es informativo, no un techo', () => {
    // Una pantalla NUEVA es trabajo legítimo. Lo que no puede crecer es la
    // deuda que trae dentro.
    expect(TECHO.informativas).toContain('archivosDeInterfaz')
    const masPantallas = { ...TECHO.techo, archivosDeInterfaz: TECHO.techo.archivosDeInterfaz + 5 }
    expect(comparar(masPantallas).suben).toEqual([])
  })

  it('el techo declara lo que su número NO dice', () => {
    // Un recuento sin esta advertencia se lee como un mapa del sistema cuando
    // sólo es un mapa de dónde se ha mirado.
    expect(TECHO.loQueNoDice).toContain('no se aprueba interfaz leyendo código')
  })
})

describe('el tema expone sus tokens: ya hay alternativa al estilo en línea', () => {
  it('Tailwind ve mucho más que los cuatro valores del principio', () => {
    /**
     * Ésta es la que muerde. Antes del arreglo esto valía 4 y el código no tenía
     * de dónde agarrarse. Probada al revés: dejando `@theme inline` como estaba,
     * falla.
     */
    expect(tokensQueTailwindVe(CSS)).toBeGreaterThanOrEqual(40)
  })

  it('hay utilidades de color, espacio, radio y tipografía', () => {
    const bloque = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? ''
    for (const familia of ['--color-', '--spacing-', '--radius-', '--text-', '--shadow-']) {
      expect((bloque.match(new RegExp(familia, 'g')) ?? []).length, familia).toBeGreaterThanOrEqual(3)
    }
  })

  it('el tema no CONGELA valores: apunta a las variables, que siguen al tema', () => {
    /**
     * Si una entrada llevara el hexadecimal escrito, esa utilidad se quedaría
     * con el color del modo oscuro también en claro. Es el mismo modo de fallo
     * que ya costó el contraste del azul de relleno: una corrección aplicada a
     * un solo tema.
     */
    const bloque = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? ''
    const congelados = bloque
      .split('\n')
      .filter(l => /^\s*--color-/.test(l) && /#[0-9a-fA-F]{3,8}/.test(l))
    expect(congelados, 'un color del tema no se escribe a mano aquí').toEqual([])
  })
})

describe('las tres escalas están declaradas, y con jerarquía', () => {
  it('la escala de espacio existe y es una escala, no un continuo', () => {
    const valores = [...CSS.matchAll(/--esp-(\d+):\s*(\d+)px/g)].map(m => Number(m[2]))
    expect(valores.length).toBeGreaterThanOrEqual(10)
    // Ni un solo paso impar: 5, 7, 9, 11 y 13 son justo el ruido que se quita.
    expect(valores.filter(v => v % 2 !== 0)).toEqual([])
    // Ordenada y sin repetidos: una escala con dos veces el mismo paso no lo es.
    expect([...valores].sort((a, b) => a - b)).toEqual(valores)
    expect(new Set(valores).size).toBe(valores.length)
  })

  it('la escala de radio tiene cinco pasos, más la píldora y el círculo', () => {
    for (const t of ['--r-xs', '--r-s', '--r-m', '--r-l', '--r-xl', '--r-pill', '--r-circulo']) {
      expect(CSS, t).toContain(`${t}:`)
    }
  })

  it('la escala tipográfica se nombra por PAPEL, no por tamaño', () => {
    /**
     * `--t-12` invita a inventarse un `--t-12-5`. `--t-cuerpo` obliga a decir
     * qué manda en la pantalla — y eso es jerarquía, que es lo que pide la
     * directiva. Si alguien añade un token con el tamaño en el nombre, esto se
     * pone rojo.
     */
    const nombres = [...CSS.matchAll(/--t-([\w-]+):\s*[\d.]+px/g)].map(m => m[1])
    expect(nombres.length).toBeGreaterThanOrEqual(8)
    expect(nombres.filter(n => /\d/.test(n)), 'un tamaño no es un papel').toEqual([])
    for (const papel of ['micro', 'caption', 'cuerpo', 'titulo', 'display']) {
      expect(nombres.some(n => n.startsWith(papel)), papel).toBe(true)
    }
  })

  it('los tamaños son enteros: medio píxel no es jerarquía', () => {
    const px = [...CSS.matchAll(/--t-[\w-]+:\s*([\d.]+)px/g)].map(m => Number(m[1]))
    expect(px.filter(v => !Number.isInteger(v))).toEqual([])
  })

  it('sólo hay TRES sombras, y significan altura', () => {
    // La directiva V9 prohíbe el «exceso de sombras». Una cuarta altura no se
    // distingue de la tercera: sería decoración, no información.
    const alturas = new Set([...CSS.matchAll(/--sombra-(\d):/g)].map(m => m[1]))
    expect([...alturas].sort()).toEqual(['1', '2', '3'])
  })

  it('las sombras están definidas en los tres bloques de tema', () => {
    /**
     * Oscuro, claro por atributo y claro por preferencia del sistema. Si un tema
     * se queda sin ellas, `var()` hereda y la mancha vuelve SÓLO en ese tema —
     * que es exactamente como nació el fallo de contraste del azul.
     */
    expect((CSS.match(/--sombra-1:/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})
