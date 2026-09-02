/**
 * GOLDEN — en la portada, cada cita se pintaba con UNA PALABRA POR RENGLÓN.
 * REG-434.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * **El dueño abrió el sitio en su iPhone** y mandó cuatro capturas. En «El
 * recorrido», cada uno de los nueve pasos lleva debajo la cita del fallo real
 * que lo hizo necesario, y las nueve salían así:
 *
 *     │ El
 *     │ paciente
 *     │ nunca
 *     │ ve
 *     │ un
 *     │ borrador.
 *
 * Veintidós palabras en veintidós renglones, en la primera pantalla del
 * producto, **en producción**.
 *
 * ── LA CAUSA RAÍZ, Y NO ES DE WEBKIT ────────────────────────────────────────
 *
 * `.nx-camino-paso` es una rejilla de dos columnas —`46px` para el número y
 * el resto para el texto— y `.nx-camino-prueba` **no declaraba en cuál va**.
 * La regla de auto-colocación de `grid` la mete entonces en la primera celda
 * libre, que en la fila 3 es la de la IZQUIERDA: la del número.
 *
 * Arriba de 1000 px sí había `grid-column: 3` explícito, dentro de la media
 * query que le da su propia columna. Por eso el defecto vivía **sólo por
 * debajo de 1000 px** — y por eso ninguna captura de escritorio lo enseñaba.
 *
 * Medido en Chromium, que es donde se reprodujo igual: la auto-colocación no
 * depende del motor.
 *
 *     ancho   390 →  cita  34px de 342 disponibles · 23 palabras / 23 renglones
 *     ancho   640 →  cita  34px de 592 · 1 palabra por renglón
 *     ancho   900 →  cita  46px de 852 · 1,05
 *     ancho  1000 →  cita 374px de 952 · 11,5      ← aquí sí había regla
 *
 * Después: 290 px a 390, 540 a 640, 788 a 900. Cero astillas.
 *
 * ── POR QUÉ NINGUNA COMPUERTA LO CAZÓ ───────────────────────────────────────
 *
 * Y esto es lo que hay que aprender, porque el defecto estuvo publicado:
 *
 * · **No desborda a lo ancho** — cabe, se ajusta a la tira.
 * · **No falla axe** — contraste, roles y etiquetas correctos.
 * · **No rompe el blanco táctil** — ni siquiera es un control.
 * · **No sale en escritorio**, que es donde más se mira.
 * · Y el alto de la página creció, pero **nadie vigilaba el alto** de esa
 *   sección en concreto.
 *
 * Cinco compuertas verdes sobre una pantalla ilegible. La única que lo habría
 * cazado no existía: **contar palabras por renglón**. Ahora existe, en
 * `scripts/ausculta-transformacion/ningun-texto-cae-en-una-astilla.mjs`.
 *
 * ── LA SONDA GRITÓ EN FALSO ANTES DE SERVIR ─────────────────────────────────
 *
 * Su primera versión acusó 25 sitios; 24 estaban sanos. Contaba con
 * `textContent`, que pega los textos hijos SIN espacio —«⭐ Estándar» +
 * «Razonamiento…» = «EstándarRazonamiento»— y subcontaba las palabras de cada
 * celda de tabla. Con `innerText` y el filtro de proporción (la astilla es
 * mucho más angosta que el sitio que tiene; una celda de 298 px en una fila de
 * 858 es una columna y está bien), quedó en **1 de 1**.
 *
 * Una sonda que grita en falso se acaba ignorando — que es exactamente el
 * fallo que este mismo carril persiguió en los avisos del portal.
 *
 * ── PROBADO AL REVÉS, Y CON LA HOJA SERVIDA ─────────────────────────────────
 *
 * Quitando `grid-column: 2`, la sonda vuelve a acusar **9** (los nueve pasos).
 * El primer intento de esta comprobación salió INVERTIDO —0 con el fallo y 9
 * con el arreglo— porque `next dev` iba un cambio por detrás: la trampa del
 * CSS rancio, tercera vez en esta rama. Se rehízo esperando a que la REGLA
 * apareciera en el `.css` servido, no a que pasaran cuatro segundos.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **Este archivo es un guardián de fuente**: comprueba que la columna esté
 *   declarada. Que ningún texto caiga en una astilla se mide en el navegador
 *   con la sonda, y **eso no corre en CI**.
 * · **Sólo mira esta rejilla.** Otro hijo de otro `grid` sin columna declarada
 *   tiene el mismo defecto y este archivo no lo ve; la sonda sí, en las doce
 *   rutas públicas.
 * · **No es un iPhone.** Se reprodujo y se arregló en Chromium. Que en WebKit
 *   real se vea bien lo dirá el dueño, que es quien tiene el teléfono.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/** El bloque de una regla, desde su selector hasta la llave que la cierra. */
function bloque(selector: string): string {
  const i = CSS.indexOf(selector + ' {')
  if (i === -1) return ''
  return CSS.slice(i, CSS.indexOf('}', i))
}

describe('la cita del recorrido declara su columna', () => {
  it('la rejilla del paso sigue teniendo una columna estrecha para el número', () => {
    // Si dejara de tenerla, este golden protegería un fantasma: sin columna
    // estrecha, la auto-colocación ya no puede meter el párrafo en una astilla.
    expect(bloque('.nx-camino-paso'), 'la rejilla del paso cambió de forma')
      .toMatch(/grid-template-columns:\s*\d+px/)
  })

  it('EL CASO: la cita dice en qué columna va, en vez de dejar que la coloquen', () => {
    expect(
      bloque('.nx-camino-prueba'),
      'sin columna declarada, `grid` la mete en la primera celda libre — la del ' +
      'número, de 34-46px — y el párrafo cae en una tira de una palabra por renglón',
    ).toMatch(/grid-column:\s*2/)
  })

  it('y arriba de 1000px sigue teniendo la suya, que es otra', () => {
    // La regla de escritorio existía y es la que escondía el defecto: el
    // arreglo NO la toca, sólo añade la que faltaba para lo estrecho.
    const i = CSS.indexOf('@media (min-width: 1000px)')
    expect(i, 'desapareció la media query de escritorio').toBeGreaterThan(-1)
    expect(CSS.slice(i, i + 700)).toMatch(/\.nx-camino-prueba \{[^}]*grid-column:\s*3/)
  })

  it('ningún hermano de esa rejilla se quedó sin columna', () => {
    /**
     * El defecto no era de la cita: era de la rejilla. Cualquier hijo nuevo
     * de `.nx-camino-paso` que no declare columna cae en la misma trampa, y
     * el diff se vería perfecto. Se exige a todos.
     */
    const hijos = ['.nx-camino-n', '.nx-camino-titulo', '.nx-camino-texto', '.nx-camino-prueba']
    const sinColumna = hijos.filter(h => {
      const b = bloque(h)
      // `.nx-camino-n` va a la 1 por posición y lo dice con `grid-row`; los
      // demás tienen que nombrar su columna en la regla base o en la de 1000px.
      if (h === '.nx-camino-n') return !/grid-row/.test(b)
      return !/grid-column/.test(b)
    })
    expect(
      sinColumna,
      `hijos de la rejilla sin colocación declarada: ${sinColumna.join(', ')}`,
    ).toEqual([])
  })
})

describe('la sonda que lo habría cazado existe y dice qué mide', () => {
  it('está escrita, y cuenta palabras por renglón', () => {
    const sonda = readFileSync(
      join(process.cwd(), 'scripts/ausculta-transformacion/ningun-texto-cae-en-una-astilla.mjs'),
      'utf8',
    )
    expect(sonda).toContain('porRenglon')
    // `innerText` y no `textContent`: el segundo pegaba los hijos sin espacio y
    // subcontaba palabras, que fue lo que hizo gritar en falso a la primera
    // versión — 25 acusaciones, 24 sanas.
    expect(sonda, 'volvió el conteo que subcontaba palabras').toContain('e.innerText')
    expect(sonda).not.toMatch(/const t = \(e\.textContent/)
    // Y el filtro que separa la astilla de una columna de tabla legítima.
    expect(sonda).toContain('proporcion > 0.45')
  })
})
