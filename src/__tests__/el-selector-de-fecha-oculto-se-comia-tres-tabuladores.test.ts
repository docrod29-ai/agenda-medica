/**
 * EL SELECTOR DE FECHA OCULTO SE COMÍA TRES TABULADORES — REG-439.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo `/citas` **con el teclado** a 390 px contra el arnés de
 * emuladores. Treinta pulsaciones de Tab, apuntando de cada parada qué recibió
 * el foco, cuánto medía y si el indicador se podía ver.
 *
 * La agenda enseña un botón de calendario de 44×44 —«Elegir una fecha en el
 * calendario»— que abre por programa un `<input type="date">` escondido. El
 * input vive oculto a propósito y con su razón escrita: el control nativo
 * enseñaría «08/09/2026», formato de Estados Unidos, en un producto es-MX.
 *
 * Lo que nadie había mirado es que **seguía en el orden de tabulación**:
 *
 *     Elegir una fecha en el calendario   44×44
 *     Ir a una fecha                      1×1   ← día
 *     Ir a una fecha                      1×1   ← mes
 *     Ir a una fecha                      1×1   ← año
 *
 * Un `input[type=date]` nativo tiene un tramo tabulable por cada segmento. Tres
 * pulsaciones de Tab dentro de una caja de un píxel, con el anillo de foco de
 * 2 px dibujado sobre ella: **el foco existía y no se podía ver** (WCAG 2.2
 * §2.4.7). Para quien navega con teclado, tres saltos al vacío.
 *
 * ── EL ARREGLO, Y POR QUÉ NO QUITA NADA ─────────────────────────────────────
 *
 * «Enfocable» y «parada del tabulador» no son lo mismo, y aquí sólo hacía falta
 * lo primero: el input se enfoca **por programa** cuando el botón lo abre.
 * `tabIndex={-1}` deja intacto ese camino y borra los tres saltos.
 *
 * Comprobado en el navegador, no deducido: enfocando el botón visible y
 * pulsando **Enter**, `showPicker()` se llama, sin `NotAllowedError` —una
 * pulsación de teclado cuenta como activación de usuario— y sin un solo error
 * de consola. El camino de teclado sigue entero.
 *
 * ── LO QUE APARECIÓ EN LA MISMA MIRADA ──────────────────────────────────────
 *
 * El filtro «8 citas» medía **39 px de ancho**, cinco por debajo del mínimo, en
 * un renglón donde los filtros están a 14 px unos de otros. No es prosa —es un
 * control suelto—, así que no le vale la excepción de §2.5.8 para lo que va
 * dentro de una frase. Cinco píxeles de `min-width` y el renglón se pinta igual:
 * no se partió, «Estado…» sigue cabiendo.
 *
 * ── LA SONDA GRITÓ EN FALSO, Y SE AFINÓ ─────────────────────────────────────
 *
 * `mirar-la-consulta.mjs` contaba el input de 1 px como objetivo táctil
 * pequeño. No lo es: está fuera del orden de tabulación y tiene un control
 * visible equivalente al lado; §2.5.8 habla de objetivos de PUNTERO. Se afinó
 * para no contar un auxiliar oculto y **se comprobó que la afinación no tapa
 * nada**: en `/consulta` siguen saliendo los dos «ya no» de 34×44 y en
 * `/expediente` sigue saliendo cero.
 *
 * Es la segunda vez que esta sonda grita en falso. La lección es de REG-434:
 * una sonda que grita en falso se acaba ignorando.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Este guardián es de FUENTE.** Que el recorrido de teclado sea el correcto
 *   lo mide `scripts/ausculta-transformacion/caminar-con-el-teclado.mjs`, y esa
 *   sonda **no corre en CI**: necesita emuladores y navegador.
 * · **No es un iPhone ni un lector de pantalla.** Chromium a 390 px con
 *   teclado. Cómo lo anuncia VoiceOver no se ha comprobado y no se declara.
 * · **No comprueba que el selector nativo sea usable con teclado por dentro.**
 *   Eso lo pone el navegador; aquí sólo se comprueba que se abre.
 * · **No mira el resto de `/citas`**: las tarjetas de cita, el menú de tres
 *   puntos y el buscador quedan sin recorrer con teclado.
 * · **Los dos «ya no» de la consulta siguen a 34×44 a propósito** (REG-437):
 *   ésos sí van dentro de una frase.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
/** Sin comentarios: este archivo y el que vigila explican el defecto citando
 *  los literales del arreglo, y un golden no debe caer con su propia prosa. */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CITAS = sinComentarios(leer('src', 'app', '(dashboard)', 'citas', 'page.tsx'))
const CSS = sinComentarios(leer('src', 'app', 'globals.css'))
const SONDA = leer('scripts', 'ausculta-transformacion', 'mirar-la-consulta.mjs')

describe('el selector de fecha oculto no se lleva el tabulador', () => {
  it('EL CASO: el input escondido está FUERA del orden de tabulación', () => {
    /**
     * PROBADO AL REVÉS: quitando el `tabIndex={-1}`, la sonda de teclado vuelve
     * a contar tres paradas de 1×1 seguidas y una sin indicador de foco visible.
     * Medido: 3 → 0.
     */
    const i = CITAS.indexOf('className="riel-fecha-input"')
    expect(i, 'ya no está el input oculto de la agenda').toBeGreaterThan(0)
    const bloque = CITAS.slice(i, i + 320)
    expect(
      bloque,
      'el input de 1×1 volvió al orden de tabulación: tres saltos al vacío, ' +
      'con el anillo de foco dibujado sobre un píxel',
    ).toMatch(/tabIndex=\{-1\}/)
  })

  it('pero sigue existiendo y sigue oculto — el formato US no se enseña', () => {
    /**
     * La mitad que NO se toca. Sacarlo del DOM «para arreglar el tabulador»
     * devolvería «08/09/2026» a la pantalla de un producto es-MX.
     */
    expect(CITAS).toContain('riel-fecha-input')
    expect(CSS).toMatch(/\.riel-fecha-input\s*\{[^}]*width:\s*1px/)
  })

  it('y el camino de teclado sigue siendo el botón visible, con nombre', () => {
    /**
     * Si el input sale del tabulador y no queda un control accesible que abra
     * el selector, la fecha deja de poder cambiarse con teclado. Ese botón es
     * la razón por la que `tabIndex={-1}` no quita nada.
     */
    expect(CITAS).toContain('aria-label="Elegir una fecha en el calendario"')
    expect(CITAS).toMatch(/showPicker/)
  })
})

describe('los filtros de la agenda se pueden tocar', () => {
  it('EL CASO: ningún segmento del renglón baja de 44 px de ancho', () => {
    /**
     * PROBADO AL REVÉS: quitando el `min-width`, la sonda vuelve a contar
     * «8 citas» a 39×44. Medido: 1 → 0.
     *
     * Se sella el ancho y no el alto porque el alto ya llegaba a 44; escribir
     * los dos sugeriría que ambos estaban mal.
     */
    expect(CSS).toMatch(/\.riel-filtro\s*\{[^}]*min-width:\s*44px/)
  })
})

describe('la sonda no cuenta lo que no es un objetivo de puntero', () => {
  it('un auxiliar fuera del tabulador y de 1 px no se cuenta como táctil', () => {
    /**
     * Segunda vez que esta sonda grita en falso. Si se ignora esta afinación y
     * alguien «arregla» el input de 1 px ensanchándolo, la agenda vuelve a
     * enseñar el formato de Estados Unidos.
     */
    expect(SONDA).toMatch(/tabIndex < 0/)
    expect(SONDA).toMatch(/auxiliarOculto/)
  })

  it('y la afinación NO afloja el conteo de verdad', () => {
    /**
     * La condición pide LAS DOS COSAS: fuera del tabulador **y** de uno o dos
     * píxeles. Aflojarla a una sola dejaría de contar controles reales — un
     * botón de 40 px fuera del tabulador seguiría siendo un objetivo pequeño.
     */
    const i = SONDA.indexOf('const auxiliarOculto')
    const linea = SONDA.slice(i, SONDA.indexOf('\n', i))
    expect(linea).toMatch(/&&/)
    expect(linea).toMatch(/<= 2/)
  })
})
