/**
 * EN UN BLOQUE ESTRECHO DE LA AGENDA, EL NOMBRE MANDA — y lo que se recorte
 * lo dice.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * Midiendo el producto a 390 px (unidad 98 del carril) con una sonda que
 * pregunta, elemento por elemento, si un texto se corta sin puntos suspensivos
 * que lo digan. En `/calendario`, vista de SEMANA, salieron **diez** bloques
 * cortados en seco. Al mirar la captura se vio lo que el número no decía: en
 * un teléfono la columna de un día mide unos **41 px**, ahí caben unos cinco
 * caracteres, y los cinco se los llevaba la hora. Los bloques de la semana
 * decían «08:00», «09:00», «10:30», «13:00» — y el nombre del paciente no
 * llegaba a pintarse NUNCA.
 *
 * La hora ya la da la fila de la izquierda de la rejilla. El nombre no lo da
 * nadie más. La pantalla donde el médico busca a quién tiene a las nueve
 * gastaba su ancho entero repitiendo el eje y escondiendo la respuesta.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El bloque escribía `{hora} {nombre}` como un solo texto con
 * `overflow: hidden`. En un texto corrido el recorte se lleva SIEMPRE lo
 * último, y lo último era el nombre. No había forma de que la hora cediera:
 * no era un elemento aparte que pudiera retirarse.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **El nombre va primero** en el orden del documento, así que es la hora la
 *    que se queda fuera cuando no cabe, y no al revés.
 * 2. **La hora se retira** en pantalla de teléfono (`max-width: 640px`) en vez
 *    de comerse la línea. La hora exacta sigue en el `title` y en la etiqueta
 *    accesible del bloque, y a un toque está la cita entera.
 * 3. **El recorte se declara.** Un nombre cortado en seco —«Ros» por Rosalía o
 *    por Rosario— es peor que uno que avisa de que sigue: en una agenda
 *    clínica confundir a dos pacientes es un daño, y un recorte mudo invita
 *    justo a eso. Por eso `text-overflow: ellipsis`, que además necesita
 *    `min-width: 0` para poder aplicarse dentro de un contenedor flex.
 *
 * Probado al revés: se invirtió el orden en `EtiquetaDeBloque` (la hora antes
 * que el nombre) y falla el caso 1; se quitó `text-overflow: ellipsis` de
 * `.nx-agenda-quien` y falla el 4; se quitó el `display: none` de la hora bajo
 * los 640 px y falla el 5; se quitó `min-width: 0` y falla el 6.
 *
 * ── Y AUN ASÍ, 41 PX NO DAN PARA UN NOMBRE ──────────────────────────────────
 *
 * Con la regla puesta y medido otra vez, los bloques de la semana pasaron de
 * decir «08:00» a decir «R…», «M…», «Ta…». Ya no se corta nada en silencio —
 * que era el defecto— pero **una letra no es un nombre**: el ancho no da.
 *
 * La consecuencia —que en un teléfono la agenda abra en DÍA— la resolvió la
 * rama de transformación, y su guardián es
 * `el-calendario-abre-en-dia-en-el-telefono`. Aquí no se repite: lo que este
 * archivo sella es la ETIQUETA del bloque estrecho, que sigue haciendo falta
 * en la vista de semana y en la de mes.
 *
 * ── Y LA REGLA SE COLGÓ DEL SITIO EQUIVOCADO, DE PASO ───────────────────────
 *
 * La primera versión de este arreglo colgó el `white-space: nowrap` de
 * `.nx-agenda-bloque` — la clase que comparten los TRES tamaños de bloque. Pero
 * la vista de día no es una línea estrecha: es una tarjeta de dos renglones con
 * el nombre completo y su insignia de estado. Al dejar de poder partir la
 * línea, esa tarjeta se salió **198 px** de la pantalla del teléfono.
 *
 * No se vio antes porque la vista de día **nunca se había medido a 390 px**:
 * no era la que abría. El arreglo de abrir en día la puso delante de la sonda
 * por primera vez, y la sonda la cazó en la misma corrida. Una regla de la
 * etiqueta estrecha no es una regla del bloque, y compartir clase no es
 * compartir forma.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide píxeles.** Que con esta regla el nombre quepa de verdad en 41 px
 *   lo dice el navegador, no este archivo: el arnés `el-telefono-medido-en-el-navegador`, y el
 *   `trinquete-de-interfaz`. Una regla correcta en el CSS no es un nombre
 *   legible en la pantalla.
 * · **No cubre la vista de DÍA**, que tiene el ancho entero y sí escribe
 *   «HH:MM — nombre completo» a propósito.
 * · No juzga el umbral de 640 px: es una decisión de dónde está «un teléfono»,
 *   no una medida.
 * · **No comprueba que el efecto corra de verdad en un navegador**: eso lo dice
 *   el arnés. Aquí sólo se sella que la regla está escrita y que la elección
 *   del médico la desactiva.
 * · No cubre el resto de sitios donde un nombre largo pueda cortarse. La sonda
 *   de 390 px los busca; este guardián sólo sella la agenda.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..', '..')
const CALENDARIO = readFileSync(join(RAIZ, 'src/app/(dashboard)/calendario/page.tsx'), 'utf8')
const CSS = readFileSync(join(RAIZ, 'src/app/globals.css'), 'utf8')

/** TODOS los cuerpos de regla con ese selector exacto, concatenados.
 *
 * Leer sólo el primero deja pasar una segunda regla escrita más abajo, que en
 * CSS es justo la que gana. La primera versión de este ayudante hacía eso y su
 * prueba al revés salió en verde con el defecto puesto: no lo veía. */
function reglaDe(selector: string, dentroDe = CSS): string {
  const cuerpos: string[] = []
  let desde = 0
  for (;;) {
    const i = dentroDe.indexOf(selector, desde)
    if (i < 0) break
    desde = i + selector.length
    // Sólo el selector EXACTO: `.nx-agenda-bloque` no es `.nx-agenda-bloque:hover`
    // ni `.nx-agenda-bloques`, y `.grid-2 > *` no es `.grid-2`.
    const resto = dentroDe.slice(desde)
    const m = /^\s*\{/.exec(resto)
    if (!m) continue
    const a = desde + m[0].length - 1
    const b = dentroDe.indexOf('}', a)
    if (b < 0) continue
    // …y que no sea la cola de otro selector (`.x .nx-agenda-bloque`, `a.grid-2`).
    const antes = dentroDe[i - 1]
    if (antes && /[a-zA-Z0-9_-]/.test(antes)) continue
    cuerpos.push(dentroDe.slice(a + 1, b))
  }
  return cuerpos.join('\n')
}

/** El cuerpo del @media de teléfono que menciona el selector dado. */
function mediaDeTelefono(selector: string): string {
  const re = /@media \(max-width: 640px\) \{([\s\S]*?)\n\}/g
  for (const m of CSS.matchAll(re)) if (m[1].includes(selector)) return m[1]
  return ''
}

describe('en un bloque estrecho de la agenda, el nombre manda', () => {
  it('1 · el nombre va ANTES que la hora en el orden del documento', () => {
    const cuerpo = CALENDARIO.slice(
      CALENDARIO.indexOf('function EtiquetaDeBloque'),
      CALENDARIO.indexOf('function WeekView'),
    )
    expect(cuerpo).not.toBe('')
    const quien = cuerpo.indexOf('nx-agenda-quien')
    const hora = cuerpo.indexOf('nx-agenda-hora')
    expect(quien).toBeGreaterThan(-1)
    expect(hora).toBeGreaterThan(-1)
    // Si la hora se pintara primero, sería el nombre el que se cae al recortar.
    expect(quien).toBeLessThan(hora)
  })

  it('2 · las dos vistas estrechas —semana y mes— usan la misma etiqueta', () => {
    const usos = CALENDARIO.match(/<EtiquetaDeBloque\b/g) ?? []
    expect(usos.length).toBe(2)
  })

  it('3 · ninguna vista estrecha vuelve a escribir hora y nombre como un solo texto', () => {
    // El patrón que causó el defecto: la hora pegada al nombre en una interpolación.
    const pegados = CALENDARIO.match(/\{a\.fechaHora\.slice\(11, 16\)\} \{a\.pacienteNombre\.split/g) ?? []
    expect(pegados.length).toBe(0)
  })

  it('4 · lo que se recorta del nombre lo dice: hay puntos suspensivos', () => {
    const r = reglaDe('.nx-agenda-quien')
    expect(r).toContain('text-overflow: ellipsis')
    expect(r).toContain('overflow: hidden')
  })

  it('5 · en un teléfono la hora se retira en vez de comerse la línea', () => {
    const m = mediaDeTelefono('.nx-agenda-hora')
    expect(m).not.toBe('')
    expect(m.replace(/\s+/g, ' ')).toMatch(/\.nx-agenda-hora \{ display: none; \}/)
  })

  it('6 · el nombre puede encoger: sin min-width:0 la truncación no se aplica nunca', () => {
    // Un hijo de flex vale por defecto min-width:auto —«nunca más angosto que
    // tu contenido»—, y con eso el ellipsis escrito no llega a ejecutarse.
    expect(reglaDe('.nx-agenda-quien')).toContain('min-width: 0')
  })

  it('7 · la hora no se encoge ni se recorta: o cabe entera o no está', () => {
    // Una hora a medias («09:4») es peor que ninguna hora.
    expect(reglaDe('.nx-agenda-hora')).toContain('flex: 0 0 auto')
  })

  it('8 · la línea estrecha no le prohíbe partirse a la tarjeta del día', () => {
    // `.nx-agenda-bloque` la comparten los tres tamaños de bloque. Colgar de
    // ella el nowrap sacó la tarjeta del día 198 px fuera de la pantalla.
    const bloque = reglaDe('.nx-agenda-bloque')
    expect(bloque).not.toContain('white-space')
    // La regla vive en la etiqueta estrecha, que es de quien es.
    expect(reglaDe('.nx-agenda-etiqueta')).toContain('white-space: nowrap')
  })

  it('9 · la etiqueta estrecha es UN elemento, no dos sueltos en el bloque', () => {
    // Si el nombre y la hora cuelgan directos del bloque, la regla de una sola
    // línea no tiene de dónde colgarse sin volver a alcanzar a la tarjeta.
    const cuerpo = CALENDARIO.slice(
      CALENDARIO.indexOf('function EtiquetaDeBloque'),
      CALENDARIO.indexOf('function WeekView'),
    )
    expect(cuerpo).toContain('className="nx-agenda-etiqueta"')
    expect(cuerpo).not.toContain('<>')
  })

  it('10 · la hora exacta y el nombre completo siguen alcanzables en el bloque', () => {
    // Retirar la hora de la vista sólo es aceptable porque no se pierde.
    const semana = CALENDARIO.slice(CALENDARIO.indexOf('function WeekView'), CALENDARIO.indexOf('function DayView'))
    expect(semana).toContain('title={`${a.pacienteNombre}')
    expect(semana).toContain('etiquetaDeCita(a)')
  })
})
