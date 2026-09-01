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
      // Y el COMPÁS de la obra del héroe, por la misma razón y con la misma
      // forma: `--mov-*` mide lo que tarda un CONTROL en responder (80–320 ms);
      // `--nx-compas` / `--nx-pulso` miden lo que tarda una persona en LEER un
      // acto antes de que llegue el siguiente. No son la misma magnitud, y
      // meterlos en `--mov-*` haría que bajar una transición de la aplicación
      // atropellara los tres tiempos de la portada. Siguen siendo tokens: lo
      // que este caso prohíbe es la cifra suelta, no la escala propia.
      if (/var\(--nx-(?:compas|pulso|arranque)\)/.test(texto)) continue
      // `animation: none` no tiene duración que tokenizar: es el APAGADO, y es
      // justamente lo que el bloque de menos-movimiento tiene que decir.
      if (/animation:\s*none/.test(texto)) continue
      expect(texto, `duración suelta: ${texto.trim()}`).toMatch(/var\(--mov-/)
    }
  })

  /**
   * El escalón se pasa por VARIABLE, no repitiendo la regla con otra cifra.
   *
   * El mecanismo sobrevivió al rediseño; el nombre de la variable no. Antes lo
   * llevaba `--nx-retraso` desde el JSX del héroe viejo; ahora el héroe es
   * declarativo y lo llevan `--nx-acto` (qué tiempo de la obra) y `--nx-orden`
   * (qué lugar en la lista), puestos en el elemento y leídos por `calc()` en la
   * hoja. Se comprueba el MECANISMO —una regla, muchos elementos, un índice por
   * elemento— y no un nombre concreto, que es lo que ató el caso anterior.
   */
  it('el escalón de la entrada se pasa por variable, no repitiendo la regla', () => {
    // La hoja escalona con calc() sobre un índice del elemento…
    expect(CSS).toMatch(/animation-delay: calc\([^;]*var\(--nx-(?:acto|orden)/)
    // …y el índice lo pone el JSX, una vez por elemento.
    const heroe = leer('src/components/landing/HeroConsulta.tsx')
    const nav = leer('src/components/landing/NavPublica.tsx')
    const indices = (heroe + nav).match(/'--nx-(?:acto|orden)' as string/g) ?? []
    expect(indices.length, 'el escalón volvió a escribirse regla a regla').toBeGreaterThanOrEqual(3)
    // Y ninguna de esas reglas repite una cifra suelta de retraso.
    expect(CSS).not.toMatch(/animation-delay: \d+ms;/)
  })
})

describe('el movimiento DICE algo', () => {
  /**
   * EL HÉROE ENSEÑA QUE SE ESTÁ OYENDO — el requisito, no el componente.
   *
   * Este caso nació sobre `ProductWindow`, la captura del producto que llevaba
   * el héroe viejo: la portada afirma que la nota se dicta sola, y sin nada
   * vivo el escaparate era la foto de algo quieto.
   *
   * La transformación de producto cambió el héroe entero —ahora enseña el
   * MECANISMO (se oye → se entiende → se escribe) en vez de una captura— y
   * `ProductWindow` **se borró**, porque al salir de la portada no quedó ningún
   * consumidor y `modulos-sin-conectar` lo cazó como isla nueva. Guardarlo «por
   * si acaso» habría sido crear a mano el defecto que ese guardián existe para
   * encontrar.
   *
   * El REQUISITO no se fue con el componente: se comprueba donde vive hoy.
   */
  it('el escaparate del héroe tiene el micrófono vivo', () => {
    const heroe = leer('src/components/landing/HeroConsulta.tsx')
    // La onda existe, tiene barras, y la hoja la anima.
    expect(heroe).toContain('nx-hero-onda')
    expect(heroe).toMatch(/Array\.from\(\{ length: \d+ \}\)/)
    expect(CSS).toMatch(/@keyframes nx-onda/)
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
    /**
     * La portada nueva no usa `nx-lift`: sus únicas tarjetas son los planes de
     * precios, con su propia regla. Lo que este caso protege NO es la clase —
     * es que **ninguna superficie de la portada conteste sólo al puntero**. Un
     * `:hover` sin `:active` es una tarjeta muerta en el teléfono, que es donde
     * se lee la mitad de esta página.
     *
     * Se comprueba como regla: por cada `:hover` que MUEVE algo en el bloque
     * público, tiene que existir su `:active`. Probado al revés borrando
     * `.nx-plan:active` — falla.
     */
    const i = CSS.indexOf('SUPERFICIE PÚBLICA')
    expect(i, 'no existe el bloque público').toBeGreaterThan(-1)
    const publico = CSS.slice(i).replace(/\/\*[\s\S]*?\*\//g, ' ')
    const sinDedo: string[] = []
    for (const m of publico.matchAll(/(\.[\w-]+):hover(?:[^{]*)\{([^}]*)\}/g)) {
      if (!/transform:/.test(m[2])) continue      // sólo lo que se MUEVE
      const base = m[1]
      if (!new RegExp(`\\${base}:active`).test(publico)) sinDedo.push(base)
    }
    expect(sinDedo, `contestan al ratón y no al dedo: ${sinDedo.join(', ')}`).toEqual([])
    expect(PORTADA, 'volvieron los manejadores de ratón a mano').not.toContain('onMouseEnter={e => (e.currentTarget.style.borderColor')
  })
})
