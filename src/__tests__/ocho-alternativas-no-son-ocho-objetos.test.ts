/**
 * GOLDEN — el tipo de consulta es UN control, no ocho tarjetas.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Los ocho tipos de consulta eran ocho rectángulos con borde propio, del mismo
 * tamaño y el mismo peso visual, uno al lado de otro. Medido: ocho cajas de
 * 179×56 a 1440 px, ocho de 292×56 a 390.
 *
 * Dos cosas mal, y la segunda es la que importa:
 *
 *  1. Leídas de golpe son **inventario** — §6 del encargo: las tarjetas indican
 *     agrupación con sentido, no decoran contenido.
 *  2. Era **falso como modelo**: no son ocho cosas, son ocho formas de
 *     contestar UNA pregunta. Un control, no un catálogo. Y como eran ocho
 *     `<button>` sueltos, quien navega con teclado tabulaba ocho veces y el
 *     lector anunciaba ocho botones sin relación entre sí.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * El borde estaba en cada opción en vez de en el grupo. Ese único detalle es lo
 * que convierte un control en un catálogo: si cada alternativa tiene su caja,
 * el ojo cuenta ocho objetos antes de entender que sólo puede elegir uno.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Las alternativas de una elección comparten caja. El borde lo lleva el grupo,
 * la separación la llevan las líneas internas, y lo único que se destaca es la
 * opción elegida — que es la información que hay que ver de un vistazo.
 *
 * Y si es una elección, se declara como tal: `radiogroup` + `radio` +
 * `aria-checked`.
 *
 * ── EL MISMO ERROR MÍO, POR SEGUNDA VEZ ─────────────────────────────────────
 *
 * La primera versión pintaba el fondo de la opción elegida **en línea**. Un
 * estilo en línea gana a `:hover`, así que el resaltado al pasar el ratón
 * quedaba muerto — exactamente el defecto de la unidad 22, cometido otra vez y
 * en otro archivo. Ahora el estado va por `data-elegido` y lo pinta la hoja.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el borde a cada opción, cae. Quitando el `radiogroup`, cae.
 * Devolviendo el fondo a la línea, cae el caso de la cascada.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No prueba el recorrido con flechas dentro del grupo — `role=radio` lo
 *   promete y el navegador no lo implementa solo; queda declarado como riesgo.
 * · No juzga si ocho tipos son demasiados: eso es configuración del consultorio,
 *   no diseño.
 * · No mide la fatiga de tarjeta del resto de la pantalla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/app/(dashboard)/asistente/page.tsx', 'utf8')
const cuerpo = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
const HOJA = readFileSync('src/app/globals.css', 'utf8')

/** El bloque del selector de tipo. */
function selector(): string {
  const i = cuerpo.indexOf('role="radiogroup"')
  expect(i, 'el selector declara un radiogroup').toBeGreaterThan(-1)
  return cuerpo.slice(i, i + 2200)
}

describe('ocho alternativas no son ocho objetos', () => {
  it('el borde lo lleva el grupo, no cada opción', () => {
    const s = selector()
    // El contenedor tiene borde…
    expect(s).toMatch(/border: '1px solid var\(--border\)'/)
    // …y la opción no declara uno propio.
    expect(s).toContain("border: 'none'")
  })

  it('se declara como una elección, no como ocho botones', () => {
    const s = selector()
    expect(s).toContain('aria-label="Tipo de consulta"')
    expect(s).toContain('role="radio"')
    expect(s).toContain('aria-checked={elegido}')
  })

  it('el estado elegido lo pinta la HOJA, para no matar el hover', () => {
    // El defecto de la unidad 22, cometido por segunda vez y corregido.
    const s = selector()
    expect(s).toContain("data-elegido={elegido ? '' : undefined}")
    expect(s, 'el fondo no se escribe en línea').not.toMatch(/background: elegido \?/)
    expect(HOJA).toContain('.nx-opcion-tipo[data-elegido]')
    expect(HOJA).toMatch(/\.nx-opcion-tipo:not\(\[data-elegido\]\):hover/)
  })

  it('el foco se ve aunque la opción no tenga borde propio', () => {
    expect(HOJA).toMatch(/\.nx-opcion-tipo:focus-visible\s*\{[^}]*outline/)
    // Por dentro: un anillo por fuera se comería la línea del grupo.
    expect(HOJA).toMatch(/\.nx-opcion-tipo:focus-visible\s*\{[^}]*outline-offset: -2px/)
  })

  it('las medidas salen de la escala, no escritas a mano', () => {
    const s = selector()
    expect(s).toContain("fontSize: 'var(--t-caption)'")
    expect(s).toContain("fontSize: 'var(--t-overline)'")
    expect(s).toContain("borderRadius: 'var(--r-md)'")
  })
})
