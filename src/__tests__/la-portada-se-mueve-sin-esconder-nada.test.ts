/**
 * GOLDEN — la portada se mueve, y nada queda escondido si el movimiento no ocurre.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La portada tenía **tres** `transition` en 655 líneas y ni una sola entrada.
 * El sistema de movimiento del producto —los tokens `--mov-*` y el apagador de
 * `prefers-reduced-motion` de §24— estaba entero y sin usar ahí. La primera
 * pantalla de un producto que se vende por lo bien hecho que está no se movía.
 *
 * ── EL RIESGO QUE ESTE GUARDIÁN VIGILA DE VERDAD ────────────────────────────
 *
 * Animar una entrada es fácil; el defecto caro es el otro:
 *
 *     .algo { opacity: 0 }          ← en la HOJA
 *     .algo.visible { opacity: 1 }  ← lo pone JavaScript al entrar en pantalla
 *
 * Si el JavaScript no corre, si no hay `IntersectionObserver`, o si el
 * observador no llega a dispararse, **la portada se queda en blanco**. Y no se
 * descubre nunca, porque en la máquina de quien lo escribió siempre corre.
 *
 * Por eso aquí se invierte: el contenido nace visible y el estado oculto lo
 * pone el propio JavaScript, y sólo después de comprobar que va a poder
 * quitarlo. Lo peor que puede pasar es que no haya animación.
 *
 * Y el apagador global de §24 NO basta por sí solo para esto: anula la
 * *duración* de la transición, pero un elemento que arranca en `opacity: 0` y
 * al que nadie saca de ahí sigue invisible, dure lo que dure. La preferencia
 * hay que consultarla ANTES de esconder.
 *
 * ── QUÉ MIDE EL NAVEGADOR, Y ESTO NO ────────────────────────────────────────
 *
 * `scripts/carril-excelencia/medir-portada.mjs` recorre la portada entera en
 * Chromium a 390/768/1440, con y sin `prefers-reduced-motion`, y comprueba que
 * ningún bloque queda por debajo de opacidad 0,9. Resultado registrado:
 *
 *   normal    → 7 de 7 bloques revelados · 0 ocultos · latido 2,4 s infinito
 *   reducido  → 0 preparados y 0 revelados · 0 ocultos · latido 1e-05 s, 1 vez
 *
 * Los ceros del modo reducido son la prueba: no es que se revelaran deprisa,
 * es que **nunca se escondió nada**.
 *
 * Esta prueba es el contrato de código; la de navegador es el hecho.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No juzga si la portada se ve bien. Eso son las capturas.
 * - No cubre el resto de la aplicación: sólo la portada y su escaparate.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const CSS = leer('src/app/globals.css')
const REVELAR = leer('src/components/landing/Revelar.tsx')
const PORTADA = leer('src/app/page.tsx')
const ESCAPARATE = leer('src/components/ProductWindow.tsx')

describe('la hoja no esconde nada por su cuenta', () => {
  it('`.nx-revelar` a secas no tiene opacidad — sólo con el atributo que pone JS', () => {
    /**
     * Es EL caso. Si alguien añade `.nx-revelar { opacity: 0 }` a la hoja, la
     * portada se queda en blanco el día que el JavaScript falle, y esta prueba
     * es lo único que lo diría.
     */
    const reglas = [...CSS.matchAll(/\.nx-revelar([^{]*)\{([^}]*)\}/g)]
    expect(reglas.length, 'no existe la regla de revelado').toBeGreaterThan(0)
    for (const [, selector, cuerpo] of reglas) {
      if (/opacity\s*:\s*0\b/.test(cuerpo)) {
        expect(
          selector,
          'una regla esconde .nx-revelar SIN exigir el atributo que pone JavaScript',
        ).toMatch(/\[data-revelar=['"]preparado['"]\]/)
      }
    }
  })

  it('la entrada del héroe usa `animation … both`, que bajo §24 acaba visible', () => {
    // Con `both`, el apagador global la resuelve en 0,01 ms y el elemento
    // queda en su estado final. Sin `both`, se quedaría en el inicial.
    const m = CSS.match(/\.nx-entra\s*\{([^}]*)\}/)
    expect(m, 'no existe la entrada del héroe').toBeTruthy()
    expect(m![1]).toContain('both')
  })

  it('el apagador global de §24 sigue en la hoja', () => {
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(CSS).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
  })
})

describe('quien esconde, pregunta antes', () => {
  it('`Revelar` consulta la preferencia ANTES de preparar el estado oculto', () => {
    const iPregunta = REVELAR.indexOf('prefiereMenosMovimiento()')
    const iEsconde = REVELAR.indexOf("dataset.revelar = 'preparado'")
    expect(iPregunta, 'no consulta la preferencia').toBeGreaterThan(-1)
    expect(iEsconde).toBeGreaterThan(-1)
    expect(iPregunta, 'esconde antes de preguntar').toBeLessThan(iEsconde)
  })

  it('y también comprueba que exista IntersectionObserver antes de esconder', () => {
    const iObs = REVELAR.indexOf("typeof IntersectionObserver === 'undefined'")
    const iEsconde = REVELAR.indexOf("dataset.revelar = 'preparado'")
    expect(iObs).toBeGreaterThan(-1)
    expect(iObs).toBeLessThan(iEsconde)
  })

  it('la pregunta se hace en el módulo compartido, no con un matchMedia suelto', () => {
    // Misma razón que `comportamientoScroll`: la regla que se cumple en el
    // primer sitio y se olvida en el sexto.
    expect(REVELAR).toContain("from '@/lib/ui/movimiento'")
    expect(REVELAR).not.toContain('matchMedia(')
  })
})

describe('el movimiento habla los tokens del sistema', () => {
  it('ni una duración ni una curva sueltas en el bloque de la portada', () => {
    const i = CSS.indexOf('PORTADA · MOVIMIENTO CON INTENCIÓN')
    expect(i, 'no existe el bloque de movimiento de la portada').toBeGreaterThan(-1)
    const bloque = CSS.slice(i).replace(/\/\*[\s\S]*?\*\//g, ' ')
    for (const decl of bloque.matchAll(/(?:animation|transition):[^;]+;/g)) {
      const texto = decl[0]
      // El latido lleva su propia duración larga a propósito (2.4s): un
      // token de 320ms haría un parpadeo, no un latido. Se declara aquí.
      if (texto.includes('nx-latido')) continue
      expect(texto, `duración suelta: ${texto.trim()}`).toMatch(/var\(--mov-/)
    }
  })

  it('el escalón de la entrada se pasa por variable, no repitiendo la regla', () => {
    expect(CSS).toContain('var(--nx-retraso, var(--mov-nada))')
    expect((PORTADA.match(/--nx-retraso/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })
})

describe('el movimiento DICE algo', () => {
  it('el escaparate del héroe tiene el micrófono vivo', () => {
    /**
     * No es adorno: la portada afirma que la nota se dicta sola, y sin nada
     * vivo el escaparate es la foto de algo quieto.
     */
    expect(ESCAPARATE).toContain('nx-escucha')
  })

  it('y el latido es de OPACIDAD, no de tamaño — nada se mueve de sitio', () => {
    const m = CSS.match(/@keyframes nx-latido\s*\{([\s\S]*?)\n\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toContain('opacity')
    expect(m![1], 'el latido mueve el elemento de sitio').not.toMatch(/transform|scale|width|height/)
  })

  it('las tarjetas responden al dedo y no sólo al ratón', () => {
    // Antes eran dos manejadores de ratón: en un móvil no hacían nada.
    expect(CSS).toMatch(/\.nx-lift:active/)
    expect(PORTADA).toContain('className="nx-lift"')
    expect(PORTADA, 'volvieron los manejadores de ratón a mano').not.toContain('onMouseEnter={e => (e.currentTarget.style.borderColor')
  })
})
