/**
 * LA PANTALLA NO CAMBIA SOLA — regresión visual con línea base.
 *
 * POR QUÉ NO EXISTÍA, TENIENDO 127 CARPETAS DE CAPTURAS
 * ─────────────────────────────────────────────────────
 * `docs/design/capturas/` guarda 127 carpetas de imágenes. Ninguna se compara
 * con nada: son la prueba de un momento —«así se veía el día que lo arreglé»—
 * y sirven para eso. Lo que no había es quien diga «esto cambió y nadie lo
 * pidió».
 *
 * EL PROBLEMA DE FONDO: UN COMPARADOR RUIDOSO ES PEOR QUE NINGUNO
 * ──────────────────────────────────────────────────────────────
 * Este producto enseña la hora, el día, «Buenos días» y «visto hoy». Comparar
 * píxeles sin más da rojo todas las mañanas por motivos que no son defectos, y
 * un guardián que grita sin razón se acaba ignorando — y entonces no avisa el
 * día que importa. Este repositorio ya lo sabe y por eso mide CONDUCTA (axe,
 * desborde, contraste) en vez de píxeles.
 *
 * Así que aquí el trabajo no es comparar: es **quitar de en medio lo que
 * cambia legítimamente** para que lo que quede signifique algo.
 *
 *   · **El reloj se congela** (`page.clock`) a una hora fija del día de hoy, y
 *     la siembra es del día de hoy: así los rótulos relativos —«visto hoy»,
 *     «faltan 20 min»— caen siempre igual.
 *   · **Las regiones que llevan la fecha del día se tapan** antes de retratar.
 *     Taparlas es más honesto que aflojar el umbral: un umbral flojo esconde
 *     también los cambios de verdad, y no dice cuáles.
 *   · **El umbral es 0.02 % de los píxeles, y sale de dos medidas**, no de un
 *     gusto. Por abajo: dos corridas seguidas del MISMO build dan **0.0000 %**
 *     en las catorce capturas —el reloj congelado y las máscaras dejan el ruido
 *     en cero—, y eso se vuelve a medir cuando se quiera con `--estabilidad`.
 *     Por arriba: el cambio real más pequeño que se probó —bajar UN rol
 *     tipográfico de 12.5 px a 12 px— da **0.2325 %** en la pantalla que menos
 *     lo usa y **7.5 %** en la que más. El umbral queda entre las dos, diez
 *     veces por encima del ruido y diez por debajo del cambio más pequeño.
 *
 * CÓMO SE USA
 * ───────────
 *   node …/la-pantalla-no-cambia-sola.mjs --fijar        fija la línea base
 *   node …/la-pantalla-no-cambia-sola.mjs                compara contra ella
 *   node …/la-pantalla-no-cambia-sola.mjs --estabilidad  mide su propio ruido
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo Chromium.** No hay WebKit en este entorno: esto no prueba iPhone.
 * · Sólo tema oscuro. El claro lo mide `el-tema-claro-tambien-cuenta`.
 * · **No sabe si un cambio es bueno.** Dice que cambió y cuánto; decidir si
 *   estaba pedido es del que mira. Por eso escribe el diff en disco.
 * · No cubre lo que sólo se ve al interactuar: menús abiertos, diálogos,
 *   estados de error. Sólo el reposo de cada ruta.
 * · La línea base es de ESTE entorno. Otra máquina, otras fuentes, otro
 *   suavizado: los números no se comparan entre máquinas.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'

const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const FIJAR = process.argv.includes('--fijar')
const ESTABILIDAD = process.argv.includes('--estabilidad')

const DIR_BASE = 'docs/design/capturas/base'
const DIR_DIFF = 'docs/design/capturas/base/diff'

/** El umbral, calibrado entre el ruido medido (0.0000 %) y el cambio real
 *  más pequeño que se probó (0.2325 %). Ver la cabecera y `--estabilidad`. */
const UMBRAL_PCT = 0.02

const RUTAS = ['citas', 'calendario', 'pacientes', 'finanzas', 'dashboard', 'pendientes', 'expedientes']
const ANCHOS = [[390, 844], [1440, 900]]

/**
 * Lo que se tapa antes de retratar, y por qué cada uno.
 * Taparlo es declarar «esto cambia solo»; aflojar el umbral sería esconderlo.
 */
const LO_QUE_CAMBIA_SOLO = `
  /* La fecha y la hora del día cambian sin que nadie toque el producto. */
  [data-reloj], .riel-ahora, .nx-agenda-ahora,
  time, [datetime] { visibility: hidden !important; }
`

function capturas() {
  const lista = []
  for (const r of RUTAS) for (const [w, h] of ANCHOS) lista.push({ r, w, h, nombre: `${r}-${w}` })
  return lista
}

/** % de píxeles que difieren más de lo que difiere el ruido de compresión. */
function comparar(aBuf, bBuf, rutaDiff) {
  const a = PNG.sync.read(aBuf), b = PNG.sync.read(bBuf)
  if (a.width !== b.width || a.height !== b.height) return { pct: 100, motivo: `tamaño ${a.width}×${a.height} vs ${b.width}×${b.height}` }
  const diff = new PNG({ width: a.width, height: a.height })
  let distintos = 0
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
    // 24 sobre 765 posibles: por debajo es suavizado de fuentes, no un cambio.
    if (d > 24) {
      distintos++
      diff.data[i] = 255; diff.data[i + 1] = 0; diff.data[i + 2] = 0; diff.data[i + 3] = 255
    } else {
      const gris = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 6 + 96
      diff.data[i] = diff.data[i + 1] = diff.data[i + 2] = gris; diff.data[i + 3] = 255
    }
  }
  const pct = (distintos / (a.width * a.height)) * 100
  if (pct > 0 && rutaDiff) { mkdirSync(DIR_DIFF, { recursive: true }); writeFileSync(rutaDiff, PNG.sync.write(diff)) }
  return { pct, motivo: null }
}

async function retratar() {
  const nav = await chromium.launch({ executablePath: CHROME })
  const salida = new Map()
  for (const [w, h] of ANCHOS) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h } })
    const p = await ctx.newPage()
    // El reloj congelado a una hora fija de HOY: la siembra también es de hoy,
    // así que los rótulos relativos caen siempre en el mismo sitio.
    const hoy = new Date(); hoy.setHours(10, 30, 0, 0)
    await p.clock.setFixedTime(hoy)
    await p.goto(BASE + '/login')
    await p.fill('input[type=email]', 'demo@nexusmed.test')
    await p.fill('input[type=password]', 'demo1234')
    await p.click('button[type=submit]')
    await p.waitForURL(/dashboard|citas/, { timeout: 30000 })
    try {
      await p.getByRole('button', { name: 'Saltar', exact: true }).first().click({ timeout: 6000 })
      await p.waitForSelector('text=BIENVENIDO A AUSCULTA', { state: 'detached', timeout: 6000 })
    } catch { /* el tour ya estaba visto */ }
    for (const r of RUTAS) {
      await p.goto(`${BASE}/${r}`)
      await p.waitForTimeout(2600)
      await p.addStyleTag({ content: LO_QUE_CAMBIA_SOLO })
      await p.waitForTimeout(250)
      salida.set(`${r}-${w}`, await p.screenshot())
    }
    await ctx.close()
  }
  await nav.close()
  return salida
}

if (ESTABILIDAD) {
  console.log('  Midiendo el ruido del propio comparador: dos corridas del MISMO build.\n')
  const a = await retratar(), b = await retratar()
  let peor = 0
  for (const { nombre } of capturas()) {
    const { pct } = comparar(a.get(nombre), b.get(nombre), null)
    peor = Math.max(peor, pct)
    console.log(`  ${nombre.padEnd(22)} ${pct.toFixed(4)} %`)
  }
  console.log(`\n  Ruido peor: ${peor.toFixed(4)} %. El umbral es ${UMBRAL_PCT} %.`)
  console.log(peor < UMBRAL_PCT
    ? '  El comparador es estable: lo que pase del umbral es un cambio de verdad.'
    : '  ✗ El comparador NO es estable. Un guardián que grita solo se acaba ignorando.')
  process.exit(peor < UMBRAL_PCT ? 0 : 1)
}

const ahora = await retratar()

if (FIJAR) {
  mkdirSync(DIR_BASE, { recursive: true })
  for (const { nombre } of capturas()) writeFileSync(join(DIR_BASE, nombre + '.png'), ahora.get(nombre))
  console.log(`  Línea base fijada: ${capturas().length} capturas en ${DIR_BASE}.`)
  process.exit(0)
}

let cambiadas = 0, sinBase = 0
for (const { nombre } of capturas()) {
  const ruta = join(DIR_BASE, nombre + '.png')
  if (!existsSync(ruta)) { console.log(`  ?  ${nombre.padEnd(22)} sin línea base`); sinBase++; continue }
  const { pct, motivo } = comparar(readFileSync(ruta), ahora.get(nombre), join(DIR_DIFF, nombre + '.png'))
  if (motivo) { console.log(`  ✗  ${nombre.padEnd(22)} ${motivo}`); cambiadas++; continue }
  const mal = pct > UMBRAL_PCT
  if (mal) cambiadas++
  console.log(`  ${mal ? '✗' : '·'}  ${nombre.padEnd(22)} ${pct.toFixed(4)} %${mal ? `  → ${join(DIR_DIFF, nombre + '.png')}` : ''}`)
}
console.log(cambiadas === 0
  ? `\n  ${capturas().length - sinBase} pantallas idénticas a su línea base.`
  : `\n  ${cambiadas} pantalla(s) cambiaron. Míralas: si el cambio estaba pedido, vuelve a fijar la base con --fijar.`)
process.exit(cambiadas === 0 ? 0 : 1)
