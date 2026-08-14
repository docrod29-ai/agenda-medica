/**
 * RTC-12 (mitad de identidad) — el paciente NO se pierde al desplazar.
 *
 * ── QUÉ DECÍA EL DEFECTO, Y QUÉ ENCONTRÓ LA MEDICIÓN ────────────────────────
 *
 * RTC-12 del registro canónico junta dos cosas distintas en una línea:
 *
 *   (a) «Ninguna superficie usa el lienzo de escritorio: columna única
 *       880–1100px en todas» — CONFIRMADO y medido (ver abajo). Es el refactor
 *       del monolito de 6147 líneas: deuda dimensionada con dueño, no una
 *       rebanada de esta iteración.
 *   (b) «En consulta a 1440 el paciente se pierde al desplazar» — medido el
 *       14-ago en navegador real y **NO se reproduce**: en /consulta, con el
 *       contenedor desplazado 1500px de 2549px reales, la identidad del
 *       paciente SIGUE a la vista.
 *
 * La razón no es suerte: el `InstrumentStrip` (Capa 1 del shell V15, §5) vive
 * FUERA del `<main>`, y `<main>` es quien tiene `overflow-y: auto`. Lo que
 * scrollea es el contenido; la franja de estado periférico no puede irse con
 * él. El shell que construyó V15-SHELL-GREYBOX-001 ya contestaba esta pregunta
 * antes de que se escribiera esta prueba.
 *
 * ── POR QUÉ ESTA PRUEBA EXISTE IGUAL ────────────────────────────────────────
 *
 * Porque «funciona hoy» y «no puede romperse» son cosas distintas, y esta
 * propiedad es de las que se rompen sin que nadie lo note: basta meter la
 * franja dentro del `<main>` en un refactor de layout —o darle al `<main>` un
 * `overflow` distinto— para que el nombre del paciente empiece a irse con el
 * scroll a mitad de una nota. Eso es la familia «paciente equivocado», la
 * misma de REG-312. Un defecto que el equipo rojo buscó y no encontró merece
 * un guardián, no un encogimiento de hombros.
 *
 * ── LO MEDIDO (1440×900, build de producción + emuladores + siembra) ────────
 *
 *   ruta        columna    main desplazado   identidad
 *   hoy          900px     95/924px          a la vista ✓
 *   pacientes   1100px      0/829px          a la vista ✓
 *   expediente   880px    412/1241px         a la vista ✓
 *   consulta     980px   1500/2549px         a la vista ✓
 *
 * Acta: `docs/design/capturas/v15-rtc12/medicion-baseline.json`.
 *
 * Nota de método: la primera pasada del arnés hacía `window.scrollTo(0,1500)`
 * y no movía NADA —el contenedor con scroll es `<main>`, no la ventana— y aun
 * así informaba «la identidad sigue a la vista». Una condición que pasa porque
 * el gesto no ocurrió es peor que una que falla.
 *
 * Probada al revés: metiendo `<InstrumentStrip />` dentro del `<main>` falla el
 * caso 2; quitando el `overflow-y: auto` del `<main>` falla el caso 1.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No cubre la mitad (a) de RTC-12: el lienzo multicolumna sigue ABIERTO y
 *   declarado en el registro canónico con su dimensionamiento.
 * · No cubre móvil: ahí la identidad vive en la topbar (`enTopbar`) y su
 *   permanencia la cubre `v15-shell-movil-consolidado`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const LAYOUT = readFileSync(join(process.cwd(), 'src/app/(dashboard)/layout.tsx'), 'utf8')

describe('RTC-12 — la identidad no puede irse con el scroll', () => {
  it('1 · el que scrollea es el <main>, no la ventana', () => {
    expect(LAYOUT).toMatch(/<main style=\{\{ flex: 1, overflowY: 'auto' \}\}>/)
  })

  it('2 · la franja de identidad vive FUERA del <main>', () => {
    const franja = LAYOUT.indexOf('<div className="nx-franja-escritorio"><InstrumentStrip /></div>')
    const main = LAYOUT.indexOf("<main style={{ flex: 1, overflowY: 'auto' }}>")
    expect(franja, 'la franja de escritorio ya no existe').toBeGreaterThan(0)
    expect(main).toBeGreaterThan(0)
    // Antes en el DOM que el contenedor con scroll ⇒ es su hermana, no su hija:
    // por construcción no puede desplazarse con el contenido.
    expect(franja).toBeLessThan(main)
  })

  it('3 · lo mismo para la variante de topbar en móvil', () => {
    const topbar = LAYOUT.indexOf('<InstrumentStrip enTopbar />')
    const main = LAYOUT.indexOf("<main style={{ flex: 1, overflowY: 'auto' }}>")
    expect(topbar).toBeGreaterThan(0)
    expect(topbar).toBeLessThan(main)
  })
})
