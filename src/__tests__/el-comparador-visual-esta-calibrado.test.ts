/**
 * EL COMPARADOR VISUAL ESTÁ CALIBRADO — y su umbral no se afloja en silencio.
 *
 * ── QUÉ FALTABA Y CÓMO SE VIO ───────────────────────────────────────────────
 *
 * `docs/design/capturas/` guardaba **127 carpetas** de imágenes y ninguna se
 * comparaba con nada. Son la prueba de un momento —«así se veía el día que lo
 * arreglé»— y para eso sirven. Lo que no había era quien dijera «esto cambió y
 * nadie lo pidió».
 *
 * ── POR QUÉ NO BASTA CON COMPARAR PÍXELES ───────────────────────────────────
 *
 * Este producto enseña la hora, el día, «Buenos días» y «visto hoy». Un
 * comparador ingenuo da rojo todas las mañanas por motivos que no son defectos,
 * y **un guardián que grita sin razón se acaba ignorando** — y entonces no
 * avisa el día que importa.
 *
 * Así que el trabajo no fue comparar: fue quitar de en medio lo que cambia
 * legítimamente (reloj congelado, regiones con fecha tapadas) hasta que lo que
 * quedara significara algo. Taparlo es más honesto que aflojar el umbral: un
 * umbral flojo esconde también los cambios de verdad, y no dice cuáles.
 *
 * ── EL UMBRAL SALE DE DOS MEDIDAS, NO DE UN GUSTO ───────────────────────────
 *
 * · **Por abajo**: dos corridas seguidas del MISMO build dan **0.0000 %** en
 *   las catorce capturas. Medido, no supuesto, y remedible con `--estabilidad`.
 * · **Por arriba**: el cambio real más pequeño que se probó —bajar UN rol
 *   tipográfico de 12.5 px a 12 px— da **0.2325 %** en la pantalla que menos lo
 *   usa y **7.5 %** en la que más.
 *
 * El umbral queda en **0.02 %**: diez veces por encima del ruido y diez por
 * debajo del cambio más pequeño medido. Probado en las dos direcciones: con el
 * cambio puesto, seis capturas en rojo; al revertirlo, catorce en verde.
 *
 * Este guardián existe para que ese número no se suba «para que deje de
 * molestar». Si el comparador molesta, o el ruido subió —y entonces hay que
 * medirlo otra vez— o algo cambió de verdad.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No compara nada.** Eso lo hace el arnés en un navegador; esto sólo vigila
 *   que su calibración siga en pie y que la línea base no se evapore.
 * · No sabe si la línea base es *correcta*: sabe que existe. Una base fijada
 *   sobre una pantalla rota se defiende igual de bien.
 * · Sólo Chromium y sólo tema oscuro, como el arnés.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..', '..')
const ARNES = join(RAIZ, 'scripts/carril-excelencia/la-pantalla-no-cambia-sola.mjs')
const SRC = readFileSync(ARNES, 'utf8')
const DIR_BASE = join(RAIZ, 'docs/design/capturas/base')

describe('el comparador visual está calibrado', () => {
  it('1 · el umbral está entre el ruido medido y el cambio real más pequeño', () => {
    const m = /const UMBRAL_PCT = ([\d.]+)/.exec(SRC)
    expect(m).not.toBeNull()
    const umbral = Number(m![1])
    // Por abajo: dos corridas del mismo build dan 0.0000 %. Un umbral en 0 haría
    // saltar cualquier píxel suelto; uno por encima de 0.2325 % dejaría pasar el
    // cambio real más pequeño que se llegó a medir.
    expect(umbral).toBeGreaterThan(0)
    expect(umbral).toBeLessThan(0.2325)
  })

  it('2 · sabe medir su propio ruido, y no de oídas', () => {
    // Sin esto el umbral sería una creencia. Con esto se vuelve a comprobar.
    //
    // Y se exige la BANDERA, no la mención: la primera versión buscaba el texto
    // «--estabilidad» y la cabecera ya lo nombraba, así que quitar la bandera
    // de verdad dejaba el caso contento. Se vio probándolo al revés.
    expect(SRC).toMatch(/argv\.includes\('--estabilidad'\)/)
    expect(SRC).toMatch(/if \(ESTABILIDAD\)/)
    expect(SRC).toContain('dos corridas del MISMO build')
  })

  it('3 · el reloj se congela: si no, cambia solo cada minuto', () => {
    expect(SRC).toContain('clock.setFixedTime')
  })

  it('4 · lo que cambia solo se TAPA, y está declarado cuál', () => {
    // Taparlo dice «esto cambia legítimamente». Aflojar el umbral escondería
    // además los cambios de verdad, sin decir cuáles.
    const i = SRC.indexOf('const LO_QUE_CAMBIA_SOLO')
    expect(i).toBeGreaterThan(-1)
    expect(SRC.slice(i, i + 400)).toContain('visibility: hidden')
  })

  it('5 · cuando algo cambia, deja el diff en disco para poder mirarlo', () => {
    // «Cambió un 0.4 %» no es accionable. La imagen señalando qué cambió, sí.
    expect(SRC).toContain('DIR_DIFF')
    expect(SRC).toMatch(/writeFileSync\(rutaDiff/)
  })

  it('6 · la línea base existe y está completa', () => {
    expect(existsSync(DIR_BASE), `no hay línea base en ${DIR_BASE}`).toBe(true)
    const png = readdirSync(DIR_BASE).filter(f => f.endsWith('.png'))
    // 7 rutas × 2 anchos. Si alguien añade una ruta al arnés y no vuelve a
    // fijar la base, esa pantalla queda sin vigilar y aquí se nota.
    // La línea entera, no hasta el primer `]`: `ANCHOS` es una lista de PARES y
    // una expresión perezosa contaba un solo ancho. Salió al probarlo (14 ≠ 7).
    const linea = (nombre: string) =>
      new RegExp(`const ${nombre} = .*$`, 'm').exec(SRC)?.[0] ?? ''
    const rutas = (linea('RUTAS').match(/'/g)?.length ?? 0) / 2
    const anchos = linea('ANCHOS').match(/\[\s*\d+/g)?.length ?? 0
    expect(rutas).toBeGreaterThan(0)
    expect(anchos).toBeGreaterThan(0)
    expect(png.length).toBe(rutas * anchos)
  })

  it('7 · dice en su cabecera que no prueba iPhone', () => {
    // La limitación se declara donde se lee, no sólo en el informe de quien lo corrió.
    expect(SRC).toContain('no prueba iPhone')
  })
})
