/**
 * Las transiciones de globals.css hablan los tokens de movimiento — una sola
 * voz. V15-MOTION-001 (§43 orden 14, §18 paso 8), primera rebanada.
 *
 * QUÉ FALLABA: los tokens `--mov-rapido/normal/lento/curva/nada` existían en
 * `globals.css`… y se usaban CERO veces. Las 22 transiciones de la hoja
 * escribían su duración a mano (80, 100, 120, 140, 150, 180, 200, 240 y
 * 280ms conviviendo sin criterio) y había DOS curvas en competencia: la del
 * token, `cubic-bezier(0.2,0,0,1)`, con cero usos, y la de facto,
 * `cubic-bezier(0.16,1,0.3,1)`, con 39. Además `.card-hover` y `.kpi-card`
 * declaraban su transición DOS veces cada una — la temprana quedaba muerta
 * porque el shorthand posterior la reemplazaba entera.
 *
 * CÓMO SE DESCUBRIÓ: la novena rebanada de Fase 10 midió el paso 8 de §18
 * contra el código real y dejó el conteo POR ESCRITO al diferirlo a
 * `V15-MOTION-001` («las 22 transiciones escriben su duración a mano y
 * conviven dos curvas»).
 *
 * CAUSA RAÍZ: el token se definió con una curva teórica que nadie adoptó,
 * y sin guardián cada transición nueva copió la duración de la vecina.
 *
 * LA REGLA QUE LO HACE SEGURO: el token adopta la curva REAL del producto
 * (nada cambia visualmente en los 39 usos) y toda parte de toda declaración
 * `transition` de globals.css debe hablar `var(--mov-*)`. Papeles: rapido =
 * feedback de color/fondo/opacidad; normal = énfasis, lift, cross-fade de
 * tema; lento = movimiento espacial; presion = estados :active (<100ms).
 * Este guardián barre la hoja entera para la transición que aún no se
 * escribió.
 *
 * QUÉ NO CUBRE: las ~30 transiciones INLINE de los componentes TSX (inventario
 * anotado en el estado V15 — segunda rebanada de MOTION-001); las
 * `animation`/`@keyframes` (12, inventariadas como funcionales por la novena
 * rebanada de Fase 10); y el valor pintado en pantalla, que lo mide el arnés
 * `scripts/design/medir-motion-tokens-v15.mjs` con getComputedStyle en el
 * navegador real.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('los tokens de movimiento — la escala y la curva real', () => {
  it('la curva del token es la curva de facto del producto', () => {
    expect(css).toMatch(/--mov-curva:\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)/)
  })

  it('la curva teórica que nadie usó está muerta', () => {
    expect(css).not.toContain('cubic-bezier(0.2, 0, 0, 1)')
  })

  it('la escala completa existe, incluida la presión (<100ms para :active)', () => {
    expect(css).toMatch(/--mov-presion:\s*80ms/)
    expect(css).toMatch(/--mov-rapido:\s*120ms/)
    expect(css).toMatch(/--mov-normal:\s*200ms/)
    expect(css).toMatch(/--mov-lento:\s*320ms/)
    expect(css).toMatch(/--mov-nada:\s*0ms/)
  })
})

describe('toda transición de globals.css habla los tokens', () => {
  it('ninguna parte de ninguna declaración transition lleva duración o curva a mano', () => {
    const partesLiterales: string[] = []
    for (const m of css.matchAll(/transition\s*:\s*([^;]+);/g)) {
      for (const parte of m[1].split(',')) {
        if (/\d+(\.\d+)?m?s|cubic-bezier/.test(parte) && !parte.includes('var(--mov')) {
          partesLiterales.push(parte.replace(/\s+/g, ' ').trim())
        }
      }
    }
    expect(partesLiterales).toEqual([])
  })

  it('transition-duration a mano sólo existe en el apagador de §24 (0.01ms !important)', () => {
    const duraciones = [...css.matchAll(/transition-duration\s*:\s*([^;]+);/g)]
      .map((m) => m[1].trim())
      .filter((v) => !v.includes('var(--mov'))
    expect(duraciones).toEqual(['0.01ms !important'])
  })

  it('el estado :active del botón habla --mov-presion', () => {
    expect(css).toMatch(/transition-duration:\s*var\(--mov-presion\)/)
  })
})

describe('una clase, una voz de transición', () => {
  // Las declaraciones tempranas de .card-hover y .kpi-card quedaban MUERTAS:
  // el shorthand del bloque de micro-interacciones las reemplazaba entero.
  // Dos voces por clase es como nació la deriva de duraciones. Se cuentan los
  // bloques cuyo selector es EXACTAMENTE la clase sola — el cross-fade de tema
  // (regla agrupada `html, body, .card, …`) es una voz compartida legítima y
  // su convivencia con el shorthand es conducta preexistente, fuera de esta
  // rebanada.
  const declaracionesDe = (clase: string) => {
    let n = 0
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim()
      if (selector === `.${clase}` && /transition\s*:/.test(m[2])) n++
    }
    return n
  }

  it('.card-hover declara transition exactamente una vez', () => {
    expect(declaracionesDe('card-hover')).toBe(1)
  })

  it('.kpi-card declara transition exactamente una vez', () => {
    expect(declaracionesDe('kpi-card')).toBe(1)
  })
})

describe('freeze — lo que la rebanada NO debe tocar', () => {
  it('el apagador global de §24 sigue intacto', () => {
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(css).toMatch(/scroll-behavior:\s*auto\s*!important/)
  })

  it('el opt-out de .cita-fila bajo reduced-motion sigue intacto', () => {
    expect(css).toMatch(/\.cita-fila\s*\{\s*transition:\s*none;?\s*\}/)
  })

  it('los :hover que la transición pinta siguen existiendo (equivalencia funcional)', () => {
    expect(css).toMatch(/\.card-hover:hover/)
    expect(css).toMatch(/\.kpi-card:hover/)
    expect(css).toMatch(/\.cita-fila:hover\s*\{\s*background:\s*var\(--s2\)/)
  })
})
