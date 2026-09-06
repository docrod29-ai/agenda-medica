/**
 * EL DINERO CABE EN UN TELÉFONO — y el trinquete que debía decirlo, pregunta
 * ahora del lado correcto de la frontera.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * Barriendo las 28 pantallas del panel a 390 px (unidad 98 del carril). En
 * `/finanzas`, `<main>` medía 390 px de ancho con **685 px de contenido**:
 * 295 px de pantalla —la tarjeta de **Transferencia** entera, con su importe y
 * su porcentaje— quedaban fuera de la vista. En la captura se ve el corte a
 * media tarjeta: «$90…», «1 cobr…».
 *
 * El médico que abre Finanzas en el teléfono ve dos de los tres métodos de
 * cobro y **nada le dice que hay un tercero**. No es una tarjeta fea: es una
 * cifra de dinero escondida.
 *
 * ── POR QUÉ NINGÚN GUARDIÁN LO VIO ──────────────────────────────────────────
 *
 * Esto es lo importante, y es de la familia «el dato tiene que LLEGAR».
 *
 * `/finanzas` YA estaba en la lista de rutas del `trinquete-de-interfaz`, YA se
 * medía a 390 px, y su contador `desborde` salía en **false** — verde, corrida
 * tras corrida, durante meses. Porque la pregunta era:
 *
 *     document.documentElement.scrollWidth > documentElement.clientWidth
 *
 * y el documento no se desbordaba: `<main>` lleva `overflow-x: auto` y se
 * tragaba el desborde. El contenido no desaparece del documento — se esconde
 * detrás de un arrastre lateral que en un teléfono nadie descubre. El guardián
 * estaba escrito, corría, y miraba el lado equivocado de la frontera.
 *
 * ── LA CAUSA RAÍZ DEL DESBORDE ──────────────────────────────────────────────
 *
 * Un hijo de rejilla vale por defecto `min-width: auto`, que significa «nunca
 * más angosto que tu contenido». Con una rejilla de columnas fijas
 * (`1.1fr 1fr 1fr`, `1fr 1fr`) escrita en el `style` inline —donde ningún
 * `@media` la alcanza— y un nombre largo dentro, la pista crece más que la
 * pantalla y se lleva la rejilla por delante.
 *
 * Y el nombre largo no es un caso raro aquí: un nombre mexicano trae cuatro o
 * cinco partes. «María Guadalupe de la Concepción Villaseñor Etchegaray» pedía
 * 301 px en una caja de 256.
 *
 * Lo peor del caso: el recorte del nombre **ya estaba escrito** en el código
 * (`textOverflow: ellipsis`, `maxWidth: 70%`) y no se aplicaba nunca, porque
 * sin `min-width: 0` el hijo no podía encoger. Código correcto, sin efecto.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. El trinquete pregunta por el desborde **a cada contenedor de scroll de
 *    dentro de `<main>`**, no sólo al documento.
 * 2. Las rejillas de columnas fijas de Finanzas llevan la utilidad responsiva
 *    del sistema, que las colapsa en pantalla de teléfono venciendo al estilo
 *    inline.
 * 3. Los hijos de esas rejillas llevan `min-width: 0`, que es lo que deja
 *    funcionar a la truncación ya escrita.
 *
 * Probado al revés: se quitó la clase de cada una de las tres rejillas y falla
 * el caso 1; se devolvió el trinquete a preguntar sólo por `documentElement` y
 * falla el 4; se quitó `min-width: 0` de las utilidades y fallan el 2 y el 3.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide píxeles**: que Finanzas quepa de verdad a 390 px lo dice el
 *   navegador (el arnés `el-telefono-medido-en-el-navegador` y el `trinquete-de-interfaz`), no este
 *   archivo. Una clase puesta no es una pantalla que cabe.
 * · **No cubre las otras ~50 rejillas de columnas fijas del producto.** El
 *   barrido de 390 px encontró que sólo Finanzas y Calendario se salían hoy;
 *   las demás caben con los datos de hoy, y eso puede cambiar con datos más
 *   largos. Quien las vigila es el barrido, no este golden.
 * · No juzga el umbral de 640 px ni la maqueta elegida (titular a lo ancho y
 *   el par debajo): son decisiones, no medidas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..', '..')
const FINANZAS = readFileSync(join(RAIZ, 'src/app/(dashboard)/finanzas/page.tsx'), 'utf8')
const CSS = readFileSync(join(RAIZ, 'src/app/globals.css'), 'utf8')
const TRINQUETE = readFileSync(join(RAIZ, 'scripts/carril-excelencia/trinquete-de-interfaz.mjs'), 'utf8')

/** TODOS los cuerpos de regla con ese selector exacto, concatenados.
 *
 * Leer sólo el primero deja pasar una segunda regla escrita más abajo, que en
 * CSS es justo la que gana. La primera versión de este ayudante hacía eso y su
 * prueba al revés salió en verde con el defecto puesto: no lo veía. */
function reglaDe(selector: string, dentroDe = CSS): string {
  const cuerpos: string[] = []
  let desde = 0
  for (;;) {
    const i = dentroDe.indexOf(selector, desde)
    if (i < 0) break
    desde = i + selector.length
    // Sólo el selector EXACTO: `.nx-agenda-bloque` no es `.nx-agenda-bloque:hover`
    // ni `.nx-agenda-bloques`, y `.grid-2 > *` no es `.grid-2`.
    const resto = dentroDe.slice(desde)
    const m = /^\s*\{/.exec(resto)
    if (!m) continue
    const a = desde + m[0].length - 1
    const b = dentroDe.indexOf('}', a)
    if (b < 0) continue
    // …y que no sea la cola de otro selector (`.x .nx-agenda-bloque`, `a.grid-2`).
    const antes = dentroDe[i - 1]
    if (antes && /[a-zA-Z0-9_-]/.test(antes)) continue
    cuerpos.push(dentroDe.slice(a + 1, b))
  }
  return cuerpos.join('\n')
}

describe('el dinero cabe en un teléfono', () => {
  it('1 · ninguna rejilla de columnas fijas de Finanzas se queda sin recurso en el teléfono', () => {
    const lineas = FINANZAS.split('\n').filter(l => l.includes('gridTemplateColumns'))
    expect(lineas.length).toBeGreaterThan(0)
    for (const l of lineas) {
      // O la rejilla ya sabe encoger sola (auto-fit/minmax), o lleva la clase
      // que la colapsa: un `style` inline no lo alcanza ningún @media.
      const seEncogeSola = l.includes('auto-fit') || l.includes('auto-fill') || l.includes('minmax')
      const llevaClase = /className="(grid-2|grid-titular-par)"/.test(l)
      expect(seEncogeSola || llevaClase, `rejilla sin recurso en el teléfono:\n  ${l.trim()}`).toBe(true)
    }
  })

  it('2 · los hijos de .grid-2 pueden encoger', () => {
    expect(reglaDe('.grid-2 > *')).toContain('min-width: 0')
  })

  it('3 · los hijos de .grid-titular-par pueden encoger', () => {
    expect(reglaDe('.grid-titular-par > *')).toContain('min-width: 0')
  })

  it('4 · el trinquete pregunta por el desborde al contenedor que hace scroll, no sólo al documento', () => {
    const i = TRINQUETE.indexOf('desborde:')
    expect(i).toBeGreaterThan(-1)
    const bloque = TRINQUETE.slice(i, i + 900)
    // La pregunta al documento sigue estando —es la mitad del trabajo—…
    expect(bloque).toContain('scrollWidth')
    // …pero ya no es la única: también recorre los contenedores de scroll.
    expect(bloque).toMatch(/overflowX !== 'auto'|overflowX === 'auto'/)
    expect(bloque).toContain("querySelectorAll('main, main *')")
  })

  it('5 · el par que se compara sigue lado a lado en el teléfono', () => {
    // Apilar efectivo y transferencia en dos filas mataría la comparación,
    // que es justo para lo que el par existe.
    const re = /@media \(max-width: 640px\) \{([\s\S]*?)\n\}/g
    let cuerpo = ''
    for (const m of CSS.matchAll(re)) if (m[1].includes('.grid-titular-par')) cuerpo = m[1]
    expect(cuerpo).not.toBe('')
    expect(cuerpo.replace(/\s+/g, ' ')).toContain('minmax(0, 1fr) minmax(0, 1fr)')
    expect(cuerpo).toContain('grid-column: 1 / -1')
  })

  it('6 · el nombre del paciente en los desgloses puede encoger para poder truncarse', () => {
    const i = FINANZAS.indexOf("textOverflow: 'ellipsis'")
    expect(i).toBeGreaterThan(-1)
    expect(FINANZAS.slice(i - 120, i + 160)).toContain('minWidth: 0')
  })
})
