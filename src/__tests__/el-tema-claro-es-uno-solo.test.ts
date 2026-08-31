/**
 * GOLDEN — el tema claro del sistema operativo es el MISMO tema claro.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `globals.css` declara la paleta clara DOS VECES:
 *
 *   1. `:root[data-theme="light"]`            → el médico pulsó el interruptor
 *   2. `@media (prefers-color-scheme: light)` → el sistema operativo está en
 *      claro y NADIE ha pulsado nada (el caso de estreno, y el más común)
 *
 * El segundo bloque se había quedado atrás en OCHO tokens. Los que dolían:
 *
 *   · `--elev-1/2/3` — sin ellos, el auto-claro heredaba las sombras NEGRAS
 *     de `:root` sobre el lienzo hueso. El propio comentario del bloque
 *     explícito dice por qué eso está mal: «una sombra negra sobre blanco se
 *     lee como suciedad». La app entera —tarjetas, modales, menús— se veía
 *     sucia para quien nunca tocó el interruptor.
 *   · `--warn-bg` / `--warn-border` — el recuadro de aviso se pintaba con el
 *     ámbar translúcido calculado para fondo oscuro.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Al añadir `--rosa` (el acento de ginecología, que no tenía cara clara) hubo
 * que escribirlo en dos sitios. Esa fricción es el síntoma: se comparó lo que
 * declaraba cada bloque y salieron siete tokens de desfase previo.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia «depende de que alguien se acuerde» (`docs/quality/FAMILIAS-DE-DEFECTO.md`):
 * el dato ya vive en el repositorio y un segundo sitio lo repite a mano. El
 * segundo se desfasa SIEMPRE. CSS no puede compartir un bloque de
 * declaraciones entre un selector y una media query, así que la duplicación es
 * inevitable — lo que no es inevitable es que nadie la vigile.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No comprueba que los VALORES sean bonitos ni accesibles: sólo que los dos
 *   caminos digan lo mismo. El contraste lo miden los guardianes de a11y.
 * - No mira el tema oscuro: ése tiene un solo camino (`:root`), que es
 *   justamente por lo que nunca se desfasó.
 * - No detecta un token que falte en LOS DOS. Para eso está el uso real.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const HOJA = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')

const EXPLICITO = ':root[data-theme="light"] {'
const AUTO = ':root:not([data-theme="dark"]):not([data-theme="light"]) {'

/** Declaraciones de un bloque, con los comentarios fuera del camino. */
function tokensDe(marca: string, cierre: string): Map<string, string> {
  const i = HOJA.indexOf(marca)
  expect(i, `no se encontró el bloque ${marca}`).toBeGreaterThan(-1)
  const j = HOJA.indexOf(cierre, i)
  expect(j, `no se encontró el cierre del bloque ${marca}`).toBeGreaterThan(i)
  const cuerpo = HOJA.slice(i + marca.length, j).replace(/\/\*[\s\S]*?\*\//g, ' ')
  const m = new Map<string, string>()
  for (const d of cuerpo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    m.set(d[1], d[2].replace(/\s+/g, ' ').trim())
  }
  return m
}

describe('el tema claro se declara dos veces y tiene que decir lo mismo', () => {
  const explicito = tokensDe(EXPLICITO, '\n}')
  const auto = tokensDe(AUTO, '\n  }')

  it('los dos bloques existen y no están vacíos', () => {
    // Si un refactor renombra un selector, el resto de la prueba pasaría en
    // falso comparando dos mapas vacíos. Esto es lo que lo impide.
    expect(explicito.size).toBeGreaterThan(30)
    expect(auto.size).toBeGreaterThan(30)
  })

  it('el auto-claro declara TODOS los tokens del claro explícito', () => {
    const faltan = [...explicito.keys()].filter(t => !auto.has(t))
    expect(
      faltan,
      `El sistema operativo en claro daría el tema OSCURO en estos tokens: ${faltan.join(', ')}`,
    ).toEqual([])
  })

  it('no sobra ninguno al revés', () => {
    const sobran = [...auto.keys()].filter(t => !explicito.has(t))
    expect(sobran, `sólo en el auto-claro: ${sobran.join(', ')}`).toEqual([])
  })

  it('los que están en los dos valen lo mismo', () => {
    const distintos = [...explicito.entries()]
      .filter(([t, v]) => auto.has(t) && auto.get(t) !== v)
      .map(([t, v]) => `${t}: explícito «${v}» vs auto «${auto.get(t)}»`)
    expect(distintos).toEqual([])
  })

  it('las tres elevaciones claras están en los dos caminos — es el desfase que dolía', () => {
    // Prueba al revés: si alguien vuelve a quitarlas del auto-claro, esto
    // falla aunque el caso general de arriba se relajara.
    for (const elev of ['--elev-1', '--elev-2', '--elev-3']) {
      expect(auto.get(elev), `${elev} sin cara clara en el auto-claro`).toContain('var(--text)')
      expect(explicito.get(elev)).toContain('var(--text)')
    }
  })
})
