/**
 * V15-MOBILE-001 (séptima rebanada, §23) — en 768px exacto hay UN shell,
 * no un híbrido de los dos.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `scripts/design/medir-breakpoints-v15.mjs` (radiografía §23 a 8 anchos,
 * 12-ago-2026, resultado en docs/design/capturas/v15-breakpoints/) midió en
 * 768×1024 — el ancho CSS de un iPad Mini/9.7/10.2 en VERTICAL, no un ancho
 * teórico — un shell híbrido que ningún otro ancho tiene:
 *
 *   mobileTopbarVisible: true      ← lado móvil (max-width: 768px)
 *   franjaEscritorioVisible: true  ← lado escritorio (Tailwind md: = min 768)
 *   bottomNavVisible: true         ← lado móvil
 *   flowRailVisible: false         ← el rail AHOGADO: su wrapper md:flex
 *                                     encendía, pero la regla móvil
 *                                     `.sidebar { display:none }` (≤768) lo
 *                                     apagaba por dentro
 *
 * Instrumentos dos veces apilados (la duplicación que la 3ª rebanada mató en
 * <768 renacía JUSTO en 768) + colchones móviles bajo un shell de escritorio.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Dos familias de media queries con fronteras que se PISAN en un ancho:
 * el lado móvil del shell vive bajo `max-width: 768px` (inclusive) y el lado
 * escritorio vivía bajo Tailwind `md:` = `min-width: 768px` (inclusive).
 * En 768.0–768.9 aplicaban las dos a la vez. Nadie lo midió antes porque
 * todas las radiografías previas usaron 390 y 1440.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La frontera es UNA y el ancho 768 le pertenece al MÓVIL (coherente con
 * todas las reglas `max-width: 768px` ya selladas por los guardianes de las
 * rebanadas 1–6):
 *
 *   1. las dos piezas de shell exclusivas de escritorio (barra lateral y
 *      franja de fila propia) usan clases de HOJA (`nx-lado-escritorio`,
 *      `nx-franja-escritorio`) que encienden en `min-width: 769px` — no
 *      Tailwind `md:*`, cuyo corte (768) no es el del resto del shell;
 *   2. base `display: none` en la hoja (la lección nx-stat-grid: un display
 *      inline vencería al media query en silencio);
 *   3. ninguna regla del shell usa ya `min-width: 768px` — el lado
 *      escritorio entero empieza en 769.
 *
 * Probada al revés (git stash): los casos 1, 2, 3 y 5 fallan contra el árbol
 * previo (`hidden md:flex` / `hidden md:block` y `min-width: 768px` en la
 * topbar).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles — jsdom no tiene motor de layout; la verificación real es
 *   `medir-breakpoints-v15.mjs` en navegador (767/768/769/834/1024/1280).
 * · No prohíbe `md:` en el resto de la app — sólo en las piezas del SHELL,
 *   que son las que tienen contraparte móvil bajo max-width: 768px.
 * · No cubre pantallas que fijen sus propios breakpoints internos (640, 560,
 *   etc.): esos no tienen contraparte de escritorio que se pise.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const LAYOUT = leer('src/app/(dashboard)/layout.tsx')
const CSS = leer('src/app/globals.css')

describe('V15 §23 — la frontera del shell es una: móvil ≤768, escritorio ≥769', () => {
  it('1. la barra lateral de escritorio usa nx-lado-escritorio, no Tailwind md:flex', () => {
    expect(LAYOUT).toContain('className="nx-lado-escritorio"')
    expect(LAYOUT).not.toContain('md:flex')
  })

  it('2. la franja de fila propia usa nx-franja-escritorio, no Tailwind md:block', () => {
    expect(LAYOUT).toContain('className="nx-franja-escritorio"')
    expect(LAYOUT).not.toContain('md:block')
  })

  it('3. las clases existen en la hoja: apagadas por defecto, encendidas en ≥769px', () => {
    expect(CSS).toContain('.nx-lado-escritorio, .nx-franja-escritorio { display: none; }')
    const media = CSS.indexOf('@media (min-width: 769px)')
    expect(media).toBeGreaterThanOrEqual(0)
    // Dentro de ALGÚN bloque min-width:769 encienden con su display correcto
    // (flex para la barra — su hijo es un aside de columna; block para la franja).
    expect(CSS).toMatch(/@media \(min-width: 769px\) \{\s*\.nx-lado-escritorio \{ display: flex; \}\s*\.nx-franja-escritorio \{ display: block; \}/)
  })

  it('4. el gate NO vive inline: los dos wrappers no declaran display en style', () => {
    for (const clase of ['nx-lado-escritorio', 'nx-franja-escritorio']) {
      const idx = LAYOUT.indexOf(`className="${clase}"`)
      expect(idx).toBeGreaterThanOrEqual(0)
      const apertura = LAYOUT.slice(idx, LAYOUT.indexOf('>', idx))
      expect(apertura).not.toMatch(/display\s*:/)
    }
  })

  it('5. ninguna regla de globals.css enciende escritorio en min-width: 768px', () => {
    // La única frontera de escritorio del shell es 769. Si alguien reintroduce
    // min-width: 768px, el ancho 768 vuelve a tener dos shells a la vez.
    expect(CSS).not.toContain('@media (min-width: 768px)')
  })

  it('6. el lado móvil del shell conserva su frontera max-width: 768px (no se corrió a 767)', () => {
    // El arreglo fue mover el lado ESCRITORIO a 769 — no reescribir las reglas
    // móviles que otros guardianes ya sellan con el literal 768.
    expect(CSS).toMatch(/@media \(max-width: 768px\) \{\s*\.bottom-nav-wrap \{ display: block; \}/)
  })
})
