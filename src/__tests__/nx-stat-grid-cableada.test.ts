/**
 * .nx-stat-grid ESTABA ESCRITA Y SIN CONECTAR — un año «lista» y cero usos.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El 4-ago-2026 (Iteración 2 · Mobile Excellence) se escribió en globals.css
 * la utilidad `.nx-stat-grid`: 3 columnas en escritorio → 2 a ≤560px → 1 a
 * ≤360px. Su propia bitácora (docs/mobile/iteration-02-responsive-foundation.md)
 * la declaró **«No cableada aún (se hará donde se pueda verificar)»** — y nadie
 * volvió. El 11-ago-2026, `grep nx-stat-grid src/` daba UN solo archivo: el
 * propio globals.css.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Arranque de V15 (STRUCTURE BEFORE SKIN): la primera tarea era verificar la
 * entrega de CSS alrededor de `.nx-stat-grid`. La regla existía y parseaba
 * bien; el defecto no era de sintaxis sino de la regla hermana «escrito y sin
 * conectar»: el selector no aparecía en ningún componente, así que las cinco
 * rejillas `repeat(3, 1fr)` que debía colapsar seguían fijas y desbordaban en
 * teléfono (3 tarjetas a ~110px cada una en un viewport de 360px).
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La utilidad se construyó antes que sus usos y el cableado se pospuso «para
 * cuando se pudiera verificar». Nada medía la distancia entre la hoja de
 * estilos y los componentes, así que el hueco fue invisible durante un año:
 * ni vitest ni el build fallan por una clase CSS que nadie usa.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. La regla `.nx-stat-grid` y sus dos puntos de colapso EXISTEN en
 *    globals.css (si alguien la borra, los cinco usos quedan sin display:grid
 *    y las tarjetas se apilan también en escritorio).
 * 2. Cada una de las cinco pantallas documentadas la USA de verdad.
 * 3. Ningún uso re-declara `gridTemplateColumns` inline: un estilo inline
 *    vence a la hoja y re-rompería el colapso móvil en silencio.
 *
 * Probada al revés: con el cableado revertido (los divs con
 * `gridTemplateColumns: 'repeat(3, 1fr)'` inline y sin la clase), los casos
 * 2 y 3 fallan.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide el layout real: jsdom no tiene motor de layout. La verificación
 *   de verdad es la captura a 360/560/900px en navegador.
 * · No detecta una futura sexta rejilla `repeat(3, 1fr)` nueva que nazca sin
 *   la clase — sólo protege las cinco conocidas.
 * · No cubre otros anchos de columna (p. ej. `1.1fr 1fr 1fr` en finanzas:301,
 *   que es asimétrica a propósito y no es candidata a esta utilidad).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const CSS = leer('src/app/globals.css')

const USOS = [
  'src/app/(dashboard)/finanzas/page.tsx',
  'src/app/(dashboard)/corte-caja/page.tsx',
  'src/app/(dashboard)/farmacia/page.tsx',
  'src/app/(dashboard)/cumplimiento/retencion/page.tsx',
  'src/app/(dashboard)/configuracion/secciones-recetas.tsx',
]

describe('.nx-stat-grid: escrita, y ahora también conectada', () => {
  it('la regla y sus dos colapsos móviles siguen en globals.css', () => {
    expect(CSS).toMatch(/\.nx-stat-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/)
    expect(CSS).toMatch(/max-width:\s*560px[^{]*\{\s*\.nx-stat-grid\s*\{\s*grid-template-columns:\s*1fr 1fr/)
    expect(CSS).toMatch(/max-width:\s*360px[^{]*\{\s*\.nx-stat-grid\s*\{\s*grid-template-columns:\s*1fr\s*;?\s*\}/)
  })

  for (const ruta of USOS) {
    it(`${ruta} usa la clase`, () => {
      expect(leer(ruta)).toContain('nx-stat-grid')
    })

    it(`${ruta} no re-declara gridTemplateColumns inline en el div de la clase`, () => {
      const fuente = leer(ruta)
      // Cada elemento con la clase: su atributo style (si lo hay) no puede
      // traer gridTemplateColumns — inline vencería a la media query.
      const aperturas = fuente.match(/<div[^>]*nx-stat-grid[^>]*>/g) ?? []
      expect(aperturas.length).toBeGreaterThan(0)
      for (const tag of aperturas) {
        expect(tag).not.toContain('gridTemplateColumns')
      }
    })
  }
})
