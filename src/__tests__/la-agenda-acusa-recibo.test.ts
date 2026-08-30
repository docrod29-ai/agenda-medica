/**
 * GOLDEN — la rejilla de la agenda acusa recibo al ratón y al dedo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Los bloques de cita y las 91 celdas vacías de la rejilla semanal declaraban
 * `cursor: pointer` y **ninguna transición**. Se podían pulsar y no acusaban
 * recibo: un hueco que no responde parece un hueco muerto, y el médico vuelve a
 * pulsar. Medido en el navegador: cero elementos con movimiento en el plano de
 * contenido del calendario.
 *
 * ── EL SEGUNDO DEFECTO, QUE ERA MÍO ─────────────────────────────────────────
 *
 * El arreglo inicial no funcionaba, y **leyendo el CSS parecía bien**. La celda
 * llevaba el tinte de fin de semana como estilo EN LÍNEA
 * (`style={{ background: ... }}`), y un estilo en línea gana siempre a la regla
 * `:hover` de la hoja. Las 91 celdas seguían sin responder.
 *
 * No se descubrió leyendo: se descubrió midiendo `backgroundColor` antes y
 * después de posar el ratón, sobre el **build de producción**. `none` →
 * `none`. La clase estaba puesta, la regla existía, y no hacía nada. Es la
 * familia «escrito y sin conectar» dentro de una hoja de estilos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una propiedad que la hoja anima en `:hover` **no puede escribirse en línea**
 * sobre el mismo elemento. Si hace falta un estado (fin de semana, hoy), va por
 * atributo de datos y lo pinta la hoja, que es quien sabe de cascada.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `background:` al `style` de la celda cae el primer caso; quitando
 * la regla `:hover` de la hoja cae el segundo; quitando la clase del bloque cae
 * el tercero.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es un escáner de fuente: comprueba que la trampa concreta no vuelva a la
 *   celda de la agenda. **No** detecta la misma trampa en otro componente —
 *   para eso haría falta mirar el navegador, y eso vive en el acta.
 * · No juzga si 120 ms es la duración correcta, ni si el brillo es el adecuado.
 * · No prueba nada sobre `prefers-reduced-motion`: de eso se encarga el
 *   apagador global de §24, con su propio guardián.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PAGINA = readFileSync('src/app/(dashboard)/calendario/page.tsx', 'utf8')
const HOJA = readFileSync('src/app/globals.css', 'utf8')
/** Sin comentarios: un comentario que cite el defecto satisfaría `toContain`. */
const paginaSinComentarios = PAGINA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')

/** El bloque `style={{ ... }}` que acompaña a la celda de la rejilla. */
function estiloDeLaCelda(): string {
  const i = paginaSinComentarios.indexOf('nx-agenda-celda')
  expect(i, 'la celda de la rejilla lleva su clase').toBeGreaterThan(-1)
  // El `style` de ese elemento está justo por encima de la clase.
  const desde = paginaSinComentarios.lastIndexOf('style={{', i)
  return paginaSinComentarios.slice(desde, i)
}

describe('la agenda acusa recibo', () => {
  it('la celda NO escribe en línea la propiedad que la hoja anima', () => {
    // El defecto: `background` en línea gana a `:hover` y lo deja muerto.
    expect(estiloDeLaCelda()).not.toMatch(/\bbackground\s*:/)
  })

  it('el tinte de fin de semana lo pinta la hoja, por atributo', () => {
    expect(paginaSinComentarios).toContain('data-finde=')
    expect(HOJA).toContain('.nx-agenda-celda[data-finde]')
  })

  it('la hoja declara respuesta al ratón para celda y bloque', () => {
    expect(HOJA).toMatch(/\.nx-agenda-celda:hover\s*\{[^}]*background/)
    expect(HOJA).toMatch(/\.nx-agenda-bloque:hover\s*\{[^}]*filter/)
    // Y al pulsar, que es lo que acusa recibo en una pantalla táctil.
    expect(HOJA).toMatch(/\.nx-agenda-bloque:active\s*\{[^}]*transform/)
  })

  it('el foco de teclado recibe el mismo trato que el ratón', () => {
    // Sin esto, quien navega con Tab no ve dónde está en una rejilla de 91 celdas.
    expect(HOJA).toContain('.nx-agenda-celda:focus-visible')
  })

  it('las tres duraciones salen de los tokens, no escritas a mano', () => {
    const bloque = HOJA.slice(HOJA.indexOf('.nx-agenda-celda'), HOJA.indexOf('.nx-agenda-ahora'))
    expect(bloque).toContain('var(--mov-')
    // Ninguna duración literal (`120ms`, `.12s`) dentro de una transición.
    expect(bloque).not.toMatch(/transition:[^;]*\d+m?s/)
  })

  /**
   * `button-name`, crítico, presente en las líneas base de V10 y de V15: las
   * dos flechas que mueven el calendario no tenían una palabra dentro. Son la
   * única forma de moverse por él.
   *
   * Probado al revés: quitando cualquiera de los dos `aria-label`, cae.
   */
  it('las flechas que mueven la agenda dicen qué mueven', () => {
    expect(paginaSinComentarios).toContain('${ETIQUETA_PASO[view]} anterior')
    expect(paginaSinComentarios).toContain('${ETIQUETA_PASO[view]} siguiente')
    // Y el nombre cambia con la vista: una semana no es un mes.
    expect(paginaSinComentarios).toMatch(/ETIQUETA_PASO: Record<View, string>/)
  })

  it('la marca de AHORA existe en la semana y en el día, no sólo en una', () => {
    const usos = [...paginaSinComentarios.matchAll(/nx-agenda-ahora/g)]
    expect(usos.length, 'semana + día').toBeGreaterThanOrEqual(2)
    // Y se anuncia: una línea de color no le dice la hora a nadie que no la vea.
    expect(paginaSinComentarios).toMatch(/aria-label=\{`Ahora son las/)
  })
})
