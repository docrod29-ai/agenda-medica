/**
 * GOLDEN — en la rejilla de la agenda, ningún botón vive dentro de otro.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `nested-interactive`, impacto **serio**, en `/calendario` a 390, 768 y 1440 px.
 * La celda vacía es un `role="button"` («Agendar a las 09:00») y cada cita que
 * cae dentro es OTRO `role="button"`. Cinco nodos con la siembra actual: uno
 * por cada hora ocupada.
 *
 * ── POR QUÉ IMPORTA, QUE NO ES UNA ETIQUETA MAL PUESTA ──────────────────────
 *
 * Un control anidado deja al de dentro **sin forma fiable de alcanzarse**: el
 * árbol accesible no admite un botón dentro de otro, así que quien navega con
 * teclado o con lector se queda sin poder abrir la cita — que es exactamente lo
 * único que de verdad se hace en esa celda. El ratón funcionaba; el teclado, no.
 *
 * ── CUÁNTO LLEVABA AHÍ ──────────────────────────────────────────────────────
 *
 * Está en la línea base de axe de V10 (`v10-truth`, 5 nodos) y en la de V15
 * (`v15-baseline-before`, 6 nodos). **Dos programas de diseño lo midieron, lo
 * anotaron y ninguno lo cerró.** No es la familia «nadie lo estaba midiendo»:
 * es su variante peor — sí se medía.
 *
 * ── LA REGLA, Y POR QUÉ NO ES LA MISMA EN LAS TRES VISTAS ───────────────────
 *
 * · **Semana y día:** la celda es botón SÓLO cuando está vacía. Con citas
 *   dentro, las citas son los botones. Se puede porque «agendar a esta hora»
 *   tiene otra puerta de teclado: el botón «Nueva cita».
 *
 * · **Mes:** ahí el destino de la celda —ver ese día— NO tiene otra puerta, y
 *   un día con citas es precisamente el que uno quiere abrir. Dejarlo sin
 *   control cambiaría un defecto de accesibilidad por una función perdida. El
 *   control se muda al NÚMERO del día; la celda se queda de contenedor.
 *
 * Es la misma regla —un solo control por región— resuelta según lo que cada
 * vista tiene que seguir permitiendo.
 *
 * ── LO QUE ESTO CUESTA, DICHO ───────────────────────────────────────────────
 *
 * En una celda ya ocupada de la semana, agendar a esa hora deja de alcanzarse
 * con teclado **desde la rejilla**. Se sigue pudiendo por «Nueva cita». Se
 * cambia un camino roto por uno que funciona, no un camino por ninguno.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `activable` incondicional a la celda de la semana cae el primer
 * caso; a la del día, el segundo; devolviéndolo a la celda del mes (en vez de
 * al número), el tercero. Y la medición real está en el acta: axe pasó de 5
 * nodos a 0 en el build de producción.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Escáner de fuente: no prueba que el árbol accesible resultante sea
 *   navegable, sólo que la trampa concreta no vuelva. La medición con axe vive
 *   en el acta y en el trinquete de interfaz.
 * · No cubre el resto de la aplicación. Que aquí no haya anidamiento no dice
 *   nada de las otras 74 pantallas.
 * · No comprueba el ORDEN de tabulación resultante.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/app/(dashboard)/calendario/page.tsx', 'utf8')
/** Sin comentarios: un comentario que cite el defecto satisfaría `toContain`. */
const cuerpo = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')

/** El trozo de fuente de cada vista, para no confundir una con otra. */
function vista(desde: string, hasta?: string): string {
  const i = cuerpo.indexOf(desde)
  expect(i, desde).toBeGreaterThan(-1)
  const j = hasta ? cuerpo.indexOf(hasta, i) : cuerpo.length
  return cuerpo.slice(i, j > i ? j : cuerpo.length)
}

describe('ningún botón vive dentro de otro', () => {
  it('la celda de la SEMANA es botón sólo cuando está vacía', () => {
    const semana = vista('function WeekView', 'function DayView')
    expect(semana).toContain('cellAppts.length === 0')
    // Y el `activable` de la celda cuelga de esa condición, no suelto.
    const i = semana.indexOf('Agendar el ${ds} a las')
    expect(i).toBeGreaterThan(-1)
    expect(semana.slice(Math.max(0, i - 200), i)).toContain('cellAppts.length === 0')
  })

  it('la fila del DÍA es botón sólo cuando está vacía', () => {
    const dia = vista('function DayView', 'function MonthView')
    const i = dia.indexOf('Agendar a las ${hourStr}')
    expect(i).toBeGreaterThan(-1)
    expect(dia.slice(Math.max(0, i - 200), i)).toContain('cellAppts.length === 0')
  })

  it('en el MES el control es el número del día, no la celda', () => {
    const mes = vista('function MonthView')
    expect(mes).toContain('nx-agenda-dia-mes')
    // El `activable` va en el número; la celda sólo lleva onClick.
    const i = mes.indexOf('Ver el día')
    expect(i).toBeGreaterThan(-1)
    expect(mes.slice(Math.max(0, i - 220), i)).toContain('nx-agenda-dia-mes')
  })

  it('el número del día dice cuántas citas hay, no sólo el número', () => {
    // Si vas a mudar el control ahí, que además informe: es lo que decide si
    // vale la pena abrir ese día.
    const mes = vista('function MonthView')
    expect(mes).toMatch(/dayAppts\.length === 1 \? 'cita' : 'citas'/)
    expect(mes).toContain("' · sin citas'")
  })

  it('el foco del número del día se ve sin ampliar su caja', () => {
    // Mide 24×24, justo el mínimo de WCAG 2.2 §2.5.8: el anillo va por fuera.
    const hoja = readFileSync('src/app/globals.css', 'utf8')
    expect(hoja).toMatch(/\.nx-agenda-dia-mes:focus-visible\s*\{[^}]*outline/)
    expect(hoja).toMatch(/\.nx-agenda-dia-mes:focus-visible\s*\{[^}]*outline-offset/)
  })

  /**
   * ── LA SEÑAL DE ESTADO NO SE PAGA CON EL CONTRASTE DEL DATO ────────────────
   *
   * La cita cancelada se atenuaba al 0,45 y eso dejaba por debajo del mínimo de
   * contraste TODO lo que llevaba dentro: el nombre, la insignia que dice
   * «Cancelada» y la línea de tipo y duración. Era la última violación de axe
   * del calendario, en las tres vistas.
   *
   * Dos cambios, y el segundo es el que importa:
   *
   *  1. 0,45 → 0,72. La señal ya está dicha por el tachado, el borde
   *     discontinuo y el nombre accesible; la opacidad era la única redundante
   *     Y la única que costaba legibilidad.
   *
   *  2. En la vista de día, la merma se muda de la TARJETA al NOMBRE. Atenuar
   *     la tarjeta entera atenuaba también la insignia que anuncia el estado —
   *     atenuar el aviso de cancelación para señalar que está cancelada se
   *     muerde la cola.
   *
   * Probado al revés: devolviendo el 0,45 o devolviendo la opacidad a la
   * tarjeta, cae.
   */
  it('atenuar una cita cancelada no deja ilegible lo que lleva dentro', () => {
    const est = vista('function estiloEstadoCita', 'type View')
    // No se vuelve al valor que fallaba contraste en las tres vistas.
    expect(est).not.toContain('opacity: 0.45')
    const m = est.match(/opacity:\s*([\d.]+),\s*borderStyle:\s*'dashed',\s*tachado:\s*true/)
    expect(m, 'el estilo de cancelada declara su opacidad').toBeTruthy()
    expect(Number(m![1])).toBeGreaterThanOrEqual(0.6)
    // Y sigue siendo MENOS que una cita viva: la señal no se pierde.
    expect(Number(m![1])).toBeLessThan(0.85)
  })

  it('la insignia que anuncia el estado no se atenúa con la tarjeta', () => {
    const dia = vista('function DayView', 'function MonthView')
    // La opacidad cuelga del <span> del nombre, no del contenedor de la cita.
    const i = dia.indexOf('StatusBadge')
    expect(i).toBeGreaterThan(-1)
    const tarjeta = dia.slice(Math.max(0, i - 900), i)
    expect(tarjeta).toContain('opacity: est.opacity')
    // …y ese `opacity` está en el span, junto al tachado, no en el style de la
    // tarjeta (que ya no lo lleva).
    expect(tarjeta).toMatch(/<span style=\{\{ opacity: est\.opacity, textDecoration/)
  })

  /**
   * NI SIQUIERA UN `onClick` SUELTO EN LA CELDA OCUPADA.
   *
   * El primer arreglo del anidamiento dejaba el clic de ratón «para no perder
   * función». Eso es un control que sólo sirve con ratón — lo que prohíbe
   * `teclado-controles`, y lo cazó en la celda del mes. En la de semana y día
   * NO lo cazó: su regla da por resuelta la etiqueta si ve `activable(` en
   * cualquier parte, y ahí aparecía en la otra rama del ternario.
   *
   * Ese punto ciego queda anotado y este caso lo cubre desde este lado. No se
   * apoya uno en el hueco de un guardián ajeno, ni se afloja el ajeno.
   */
  it('la celda ocupada no se queda con un clic que sólo sirve con ratón', () => {
    for (const [nombre, trozo] of [
      ['semana', vista('function WeekView', 'function DayView')],
      ['día', vista('function DayView', 'function MonthView')],
    ] as const) {
      // La rama «ocupada» del ternario no reparte ningún manejador.
      expect(trozo, nombre).toMatch(/\? activable\([\s\S]{0,200}?\n\s*: \{\}\)\}/)
    }
  })

  it('y el cursor no promete un clic que ya no existe', () => {
    const semana = vista('function WeekView', 'function DayView')
    const dia = vista('function DayView', 'function MonthView')
    for (const [nombre, trozo] of [['semana', semana], ['día', dia]] as const) {
      expect(trozo, nombre).toContain("cellAppts.length === 0 ? 'pointer' : 'default'")
    }
  })

  it('ninguna de las tres vistas deja un activable incondicional en la celda', () => {
    // El defecto exacto que había: `{...activable(...)}` colgando del contenedor.
    const sospechosos = [...cuerpo.matchAll(/\{\.\.\.activable\(/g)]
    // Sólo quedan los de los BLOQUES de cita y el del número del día.
    for (const m of sospechosos) {
      const antes = cuerpo.slice(Math.max(0, m.index - 260), m.index)
      const esCondicional = antes.includes('cellAppts.length === 0')
      const esBloque = antes.includes('nx-agenda-bloque') || antes.includes('nx-agenda-dia-mes')
      expect(esCondicional || esBloque, `activable suelto cerca de: ${antes.slice(-90)}`).toBe(true)
    }
  })
})
