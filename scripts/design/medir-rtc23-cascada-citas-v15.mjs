/**
 * RTC-23 — ¿la cascada de /citas se re-arma al filtrar, y cuánto tiempo deja
 * la lista en blanco?
 *
 * ORT-18 + RT-17/18 lo anotaron así: «cascada de /citas re-armándose con cada
 * filtro (fila 12 invisible 336ms)». La cuenta sale del código —
 * `animationDelay: min(i,12) * 28ms` con `animation: … both`, que mantiene el
 * estado inicial DURANTE el retraso—, pero de ahí no se deduce si de verdad
 * vuelve a correr al filtrar: eso depende de si React remonta las filas.
 *
 * Este arnés lo mira en el navegador en vez de razonarlo:
 *
 *   1. carga /citas y espera a que la cascada de entrada termine;
 *   2. comprueba que todas las filas están opacas (línea base);
 *   3. pulsa un filtro y MUESTREA la opacidad cada 40ms durante medio segundo;
 *   4. informa cuántas filas se quedaron por debajo de 1 y cuánto tiempo.
 *
 * Una fila que existe pero no se ve no es una animación: es una espera. Y en
 * una lista de citas, filtrar es la acción más repetida de la pantalla.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc23-cascada-citas-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc23-cascada'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
const errores = []
page.on('pageerror', e => errores.push(`pageerror: ${e.message}`))

await page.goto(`${BASE}/login`, { waitUntil: 'load' })
await page.waitForSelector('input[type="email"]', { timeout: 15000 })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard**', { timeout: 30000 })
try {
  const s = page.locator('button:has-text("Saltar")').first()
  await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
  await s.waitFor({ state: 'hidden', timeout: 4000 })
} catch { /* sin tour */ }

await page.goto(`${BASE}/citas`, { waitUntil: 'load' })
await page.waitForTimeout(2600)   // la cascada de entrada, terminada

/*
  SE CUENTAN LAS FILAS, NO LA CLASE DE ANIMACIÓN.

  La primera versión de este arnés buscaba `.nx-reveal`. Cuando el arreglo
  quitó esa clase después de la entrada, el instrumento dejó de encontrar nada
  y informó «0/0 filas · 0ms invisible»: un aprobado vacío que parecía la
  prueba del éxito. Es el mismo defecto que RTC-20 encontró en la vara del
  riel —medir la forma del código en vez del producto—, cometido aquí sobre el
  propio arreglo.

  `.riel-entrada` es la fila, exista o no la animación. Y se mide la opacidad
  del CONTENEDOR animado cuando lo hay, subiendo un nivel, porque es él quien
  lleva el `nx-reveal`.
*/
const muestra = () => page.evaluate(() => {
  const filas = [...document.querySelectorAll('.riel-entrada')]
  const opacidadDe = (fila) => {
    const animado = fila.closest('.nx-reveal') ?? fila.parentElement
    return Math.min(+getComputedStyle(fila).opacity, +getComputedStyle(animado ?? fila).opacity)
  }
  return {
    n: filas.length,
    opacas: filas.filter(f => opacidadDe(f) >= 0.99).length,
    minima: filas.length ? Math.min(...filas.map(opacidadDe)) : null,
  }
})

/*
  LA ENTRADA TIENE QUE SEGUIR ANIMANDO.

  Apagar la cascada al filtrar sería un mal arreglo si de paso apagara la de
  entrar: esa sí ordena la jerarquía de la lista (§20), y el propio equipo rojo
  declaró buena la del dashboard. Se recarga la pantalla y se mira ANTES de que
  termine: si la cascada existe, alguna fila tiene que estar todavía subiendo.
*/
await page.goto(`${BASE}/citas`, { waitUntil: 'domcontentloaded' })
let entradaAnima = false
for (let t = 0; t < 40 && !entradaAnima; t++) {
  const m = await muestra()
  if (m.n > 0 && m.opacas < m.n) entradaAnima = true
  await page.waitForTimeout(30)
}
console.log(`  la cascada de ENTRADA sigue viva: ${entradaAnima}`)
await page.waitForTimeout(2200)

const base = await muestra()
console.log(`  línea base: ${base.opacas}/${base.n} filas opacas (mínima ${base.minima})`)

/** Los filtros del renglón-resumen, tal como los pulsa el médico. */
const filtros = await page.evaluate(() =>
  [...document.querySelectorAll('.riel-filtro')].map(b => (b.textContent ?? '').trim().replace(/\s+/g, ' ')))
console.log(`  filtros en pantalla: ${filtros.join(' | ') || 'ninguno'}`)

const series = {}
for (const [idx, etiqueta] of filtros.entries()) {
  if (idx === 0) continue          // «todas» ya está puesto: pulsarlo no cambia nada
  await page.evaluate(i => document.querySelectorAll('.riel-filtro')[i].click(), idx)

  const serie = []
  for (let t = 0; t < 13; t++) {           // 13 × 40ms ≈ 520ms, la duración de la animación
    serie.push({ t: t * 40, ...(await muestra()) })
    await page.waitForTimeout(40)
  }
  const conParpadeo = serie.filter(m => m.n > 0 && m.opacas < m.n)
  const msInvisible = conParpadeo.length * 40
  series[etiqueta] = { serie, msInvisible }
  console.log(
    `  filtro «${etiqueta.slice(0, 28)}» → ${serie[0].n} filas · ` +
    `muestras con alguna fila translúcida: ${conParpadeo.length}/13 (~${msInvisible}ms) · ` +
    `opacidad mínima vista: ${Math.min(...serie.map(m => m.minima ?? 1))}`,
  )
  // Se vuelve a «todas» para que el siguiente filtro parta del mismo sitio.
  await page.evaluate(() => document.querySelectorAll('.riel-filtro')[0].click())
  await page.waitForTimeout(700)
}

await page.screenshot({ path: path.join(DESTINO, 'citas-1440.png') })
await contexto.close()
await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, entradaAnima, lineaBase: base, filtros, series, errores }, null, 2))
console.log(`\n${errores.length} errores de página · acta en ${path.join(DESTINO, 'medicion.json')}`)
