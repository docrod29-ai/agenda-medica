/**
 * ARNÉS RTC-08 — «Encuentro» es un lugar, o dice que no lo hay.
 *
 * Lo que jsdom no puede contestar y aquí se mide con el navegador de verdad:
 * a dónde LLEVA el ítem, qué se ilumina AL LLEGAR, y si el nombre accesible
 * dice la verdad en cada uno de los tres estados.
 *
 *   1. Sin encuentro abierto: el ítem sigue llevando a /pacientes —así se
 *      empieza uno— pero su nombre accesible lo DICE. (El defecto original no
 *      era el destino: era la promesa muda.)
 *   2. Con encuentro abierto: el ítem RETOMA esa consulta — se abre una,
 *      se escribe algo para que nazca el respaldo local, se sale a Hoy, y
 *      desde el riel se vuelve. Al llegar, el ítem iluminado es Encuentro.
 *   3. La señal de «hay uno abierto» se pinta fuera del encuentro y NO se
 *      pinta dentro (dentro ya lo dice el estado activo).
 *   4. 0 errores de consola.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/verificar-rtc08-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc08'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE = 'pac-refugio-alcantara'

fs.mkdirSync(DESTINO, { recursive: true })
const condiciones = []
const errores = []
const cond = (nombre, ok, detalle) => {
  condiciones.push({ nombre, estado: ok ? 'PASS' : 'FAIL', detalle })
  console.log(`${ok ? '  ✓' : '  ✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
}

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()) })
page.on('pageerror', e => errores.push(`pageerror: ${e.message}`))

await page.goto(`${BASE}/login`, { waitUntil: 'load' })
await page.waitForSelector('input[type="email"]', { timeout: 15000 })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard**', { timeout: 30000 })
try {
  const saltar = page.locator('button:has-text("Saltar")').first()
  await saltar.waitFor({ state: 'visible', timeout: 4000 })
  await saltar.click()
  await saltar.waitFor({ state: 'hidden', timeout: 4000 })
} catch { /* sin tour */ }

/** El ítem «Encuentro» del riel — por su rótulo, no por su posición. */
const itemEncuentro = () => page.locator('.nx-flow-rail a:has-text("Encuentro")').first()

// ── 1 · SIN encuentro abierto ────────────────────────────────────────────────
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('nx.consulta.bkp.')) localStorage.removeItem(k)
  }
})
await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
await page.waitForTimeout(1200)

const item0 = itemEncuentro()
const href0 = await item0.getAttribute('href')
const nombre0 = await item0.getAttribute('aria-label')
const senal0 = await item0.locator('span[aria-hidden="true"]').count()
cond('sin encuentro: el destino sigue siendo /pacientes (así se empieza uno)', href0 === '/pacientes', String(href0))
cond('sin encuentro: el nombre accesible DICE que no hay ninguno',
  (nombre0 ?? '').includes('ninguno abierto'), nombre0 ?? '(sin aria-label)')
cond('sin encuentro: no se pinta señal de estado', senal0 === 0, `${senal0} puntos`)
await page.screenshot({ path: path.join(DESTINO, 'riel-sin-encuentro.png') })

// ── 2 · Se ABRE un encuentro y se escribe algo (nace el respaldo local) ──────
await page.goto(`${BASE}/consulta/${PACIENTE}`, { waitUntil: 'load' })
await page.waitForTimeout(2500)
const dentro = itemEncuentro()
cond('dentro del encuentro: el ítem está activo (aria-current)',
  (await dentro.getAttribute('aria-current')) === 'page')
cond('dentro del encuentro: NO se pinta la señal (el activo ya lo dice)',
  (await dentro.locator('span[aria-hidden="true"]').count()) === 0)

// Escribir en el resumen dispara el autoguardado local (el respaldo por el que
// esta rebanada sabe que hay un encuentro abierto).
const campo = page.locator('textarea').first()
await campo.fill('Refiere mejoría del dolor tras 48 h de tratamiento.').catch(() => {})
await page.waitForTimeout(3000)
const hayRespaldo = await page.evaluate(() =>
  Object.keys(localStorage).some(k => k.startsWith('nx.consulta.bkp.')))
cond('escribir en la consulta crea el respaldo local (la marca del encuentro)', hayRespaldo)
await page.screenshot({ path: path.join(DESTINO, 'riel-dentro-del-encuentro.png') })

// ── 3 · Se SALE a Hoy: el riel debe ofrecer RETOMARLO ───────────────────────
await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
await page.waitForTimeout(1500)
const item1 = itemEncuentro()
const href1 = await item1.getAttribute('href')
const nombre1 = await item1.getAttribute('aria-label')
const senal1 = await item1.locator('span[aria-hidden="true"]').count()
cond('con encuentro abierto: el destino RETOMA esa consulta',
  (href1 ?? '').startsWith(`/consulta/${PACIENTE}`), String(href1))
cond('con encuentro abierto: el nombre accesible dice «retomar»',
  (nombre1 ?? '').includes('retomar'), nombre1 ?? '(sin aria-label)')
cond('con encuentro abierto: se pinta la señal de estado', senal1 === 1, `${senal1} puntos`)
await page.screenshot({ path: path.join(DESTINO, 'riel-con-encuentro-abierto.png') })

// ── 4 · Y al pulsarlo, se LLEGA: Encuentro queda iluminado ──────────────────
await item1.click()
await page.waitForTimeout(2500)
const alLlegar = itemEncuentro()
cond('al pulsar «Encuentro» se llega a la consulta (no a la lista)',
  page.url().includes(`/consulta/${PACIENTE}`), page.url())
cond('al llegar, el ítem iluminado es Encuentro — no Paciente',
  (await alLlegar.getAttribute('aria-current')) === 'page')
const pacienteActivo = await page.locator('.nx-flow-rail a:has-text("Paciente")').first().getAttribute('aria-current')
cond('al llegar, «Paciente» NO está iluminado (era el defecto de RTC-08)', pacienteActivo !== 'page', String(pacienteActivo))
await page.screenshot({ path: path.join(DESTINO, 'riel-tras-retomar.png') })

await contexto.close()
await navegador.close()

cond('0 errores de consola', errores.length === 0, errores.slice(0, 5).join(' | '))

const acta = {
  rebanada: 'V15-ORIGINALITY-REDTEAM-001 — RTC-08',
  base: BASE,
  condiciones,
  erroresDeConsola: errores,
  resultado: condiciones.every(c => c.estado === 'PASS') ? 'PASS' : 'FAIL',
}
fs.writeFileSync(path.join(DESTINO, 'acta-rtc08.json'), JSON.stringify(acta, null, 2))
console.log(`\n${acta.resultado} — ${condiciones.filter(c => c.estado === 'PASS').length}/${condiciones.length} condiciones`)
process.exit(acta.resultado === 'PASS' ? 0 : 1)
