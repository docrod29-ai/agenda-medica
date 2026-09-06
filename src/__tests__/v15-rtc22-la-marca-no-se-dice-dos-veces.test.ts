/**
 * RTC-22 — el producto dice cómo se llama UNA vez, y la franja habla de
 * clínica o se calla.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * ORT-17 + RT-20 contaron «Ausculta» dos veces en escritorio: en la cabecera
 * del riel y en la franja de instrumentos. Medido en navegador, había **dos
 * fuentes distintas** del mismo defecto, y la segunda era peor que la que se
 * denunció:
 *
 * 1. La franja de la **topbar**, sin paciente en la ruta, se rellenaba con el
 *    nombre del consultorio.
 * 2. La franja de **escritorio** lo pintaba **siempre**, incluso con un
 *    paciente delante: «Ausculta · María del Refugio Alcántara». El elemento
 *    cuyo trabajo es el estado clínico (§5: «current patient» es el primer
 *    estado periférico) empezaba diciendo la marca.
 *
 * ── LO MEDIDO ───────────────────────────────────────────────────────────────
 *
 * `scripts/design/medir-rtc22-marca-duplicada-v15.mjs`, apariciones VISIBLES
 * del nombre del consultorio (nodos hoja con ese texto exacto — buscar por
 * «contiene» habría contado también a cada ancestro):
 *
 *                        antes            después
 *   escritorio sin pac.  2 (riel+franja)  1 (riel)
 *   escritorio con pac.  2 (riel+franja)  1 (riel)
 *   móvil sin paciente   1 (franja)       1 (franja)   ← intacto a propósito
 *   móvil con paciente   0                0
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Quién dice el nombre depende de qué cromo hay en pantalla**, y eso lo
 *    sabe el CSS, no un `if`. A partir de 769px el riel está y lo dice; por
 *    debajo el riel no existe y la franja es la ÚNICA identidad — ahí se
 *    queda. Por eso el respaldo se oculta con una media query y no se borra:
 *    borrarlo dejaría la aplicación sin nombre en el teléfono.
 * 2. **Sin estado clínico, no hay franja.** Quitada la marca, la variante de
 *    escritorio habría pintado una banda de 30px con una línea y nada dentro
 *    en todas las pantallas sin paciente. Devuelve `null`, y vuelve sola en
 *    cuanto hay paciente o se abre el micrófono.
 * 3. **La franja no pierde su trabajo**: con paciente sigue diciendo su
 *    nombre, y grabando sigue contando los segundos.
 *
 * Probado al revés: devolviendo el nombre del consultorio a la franja de
 * escritorio falla el caso 1; borrando el respaldo de la topbar en vez de
 * ocultarlo por ancho falla el 2; quitando la media query falla el 3;
 * devolviendo el `return` incondicional falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No cuenta apariciones en el navegador**: eso es el arnés, y su acta está
 *   fechada. Aquí se protege el mecanismo, que es lo que una prueba de fuente
 *   puede sostener.
 * · **No cubre el modo Secretaria**: `Sidebar` tiene su propia cabecera con el
 *   nombre y no comparte pantalla con esta franja del shell V15.
 * · No juzga si «Ausculta» debe ser el respaldo cuando el consultorio no tiene
 *   nombre configurado: eso es contenido, no duplicación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: la cabecera del componente CITA el texto para explicarlo. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const FRANJA = sinComentarios(leer('src/components/InstrumentStrip.tsx'))
const CSS = leer('src/app/globals.css')
const RIEL = sinComentarios(leer('src/components/FlowRail.tsx'))

describe('RTC-22 — una sola marca en pantalla', () => {
  it('1 · la franja de escritorio ya no pinta el nombre del consultorio', () => {
    /**
     * Era el peor de los dos: se pintaba incluso con paciente, delante de su
     * nombre, en el elemento que existe para decir el estado clínico.
     */
    const apariciones = [...FRANJA.matchAll(/nombreClinica \|\| 'Ausculta'/g)]
    expect(apariciones, 'la franja vuelve a decir el nombre del consultorio en más de un sitio').toHaveLength(1)
  })

  it('2 · el respaldo que queda es el de la TOPBAR, y sigue existiendo', () => {
    /**
     * No se borra: a ≤768px el riel no está en pantalla y ésta es la única
     * identidad. Borrarla dejaría la aplicación sin nombre en el teléfono —
     * el defecto contrario, y más caro.
     */
    expect(FRANJA).toMatch(/className="nx-ident-franja nx-marca-de-respaldo"/)
  })

  it('3 · y se calla por ANCHO, donde el riel ya lo dice', () => {
    // Quién dice el nombre depende de qué cromo hay en pantalla: eso es CSS.
    expect(CSS).toMatch(/@media \(min-width: 769px\)[\s\S]{0,600}\.nx-marca-de-respaldo \{ display: none; \}/)
    // Y el riel sigue siendo quien lo dice ahí.
    expect(RIEL).toContain("{config.nombreClinica || 'Ausculta'}")
  })

  it('4 · sin paciente y sin grabación, la franja de escritorio no pinta una banda vacía', () => {
    /**
     * Quitar la marca sin esto habría dejado 30px de banda con una línea de
     * separación y nada dentro en todas las pantallas sin paciente: un
     * renglón que hay que saltarse.
     */
    expect(FRANJA).toMatch(/if \(!paciente && segundos == null\) return null/)
  })

  it('5 · pero la franja NO pierde su trabajo', () => {
    // Con paciente dice su nombre; grabando cuenta los segundos.
    expect(FRANJA).toContain('{paciente.nombre}')
    /*
     * ESTE CASO EXIGÍA LA ORTOGRAFÍA, NO EL TRABAJO (corregido el 1-sep-2026).
     *
     * Pedía literalmente `Grabando · {formatearDuracion(segundos)}` — la cadena
     * escrita a mano en esta franja. Y esa cadena era justo una de las CUATRO
     * copias del rótulo de grabación que decían el mismo segundo con distintas
     * palabras y distintos formatos («Escuchando · 0:39» aquí, «Grabando ·
     * 00:39» allá). Mientras el guardián exigiera la copia, la copia no se podía
     * quitar.
     *
     * Ahora exige el TRABAJO: que la franja siga diciendo el estado y siga
     * contando — pidiéndoselo al vocabulario común en vez de escribiéndolo.
     * Que la palabra sea «Grabando» y el reloj `mm:ss` lo fija
     * `un-estado-de-la-escucha-se-dice-una-sola-vez`, donde vive esa decisión.
     */
    expect(FRANJA).toMatch(/rotulo\('grabando', segundos\)/)
    expect(FRANJA).toMatch(/from '@\/lib\/encuentro\/vocabulario-de-la-escucha'/)
  })
})
