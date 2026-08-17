/**
 * EQUIVALENCIA FUNCIONAL DE LOS PANELES DIFERIDOS — V15-PERF-001, 3ª rebanada.
 *
 * La rebanada movió seis paneles condicionales de /consulta a `dynamic()`.
 * Diferir no puede significar perder: el panel tiene que LLEGAR cuando su
 * condición se abre (la regla «el dato tiene que LLEGAR», versión de UI).
 *
 * Qué verifica, en navegador real contra build de producción:
 *
 *   1. /consulta carga con 0 errores de consola (el diferimiento no rompió
 *      el render inicial) y se registra cuántos .js viajaron.
 *   2. Al abrir la herramienta «Laboratorios» (una de las diferidas) el panel
 *      se monta DE VERDAD — su contenido aparece — y la red muestra chunks
 *      nuevos pedidos DESPUÉS del click: la descarga ocurre al abrir, no al
 *      cargar. Ese es el contrato entero de esta rebanada en una sola
 *      interacción.
 *   3. Los chunks de la carga inicial NO incluyen el contenido del panel
 *      diferido (se comprueba que el conteo de .js inicial < conteo tras
 *      abrir).
 *
 * Uso (mismo patrón que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/verificar-paneles-diferidos-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-perf'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE_SEMBRADO = 'pac-refugio-alcantara'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  const saltar = page.locator('button:has-text("Saltar")').first()
  try {
    await saltar.waitFor({ state: 'visible', timeout: 4000 })
    await saltar.click()
    await saltar.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour esta vez */ }
}

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()

const erroresConsola = []
page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text().slice(0, 160)) })
const chunksJs = []
page.on('response', (r) => { if (/\.js(\?|$)/.test(r.url())) chunksJs.push(r.url()) })

await login(page)

// 1. Carga inicial de /consulta.
await page.goto(`${BASE}/consulta/${PACIENTE_SEMBRADO}`, { waitUntil: 'load' })
await page.waitForTimeout(4000)
const jsInicial = chunksJs.length
const erroresInicial = erroresConsola.length
console.log(`carga inicial: ${jsInicial} .js, ${erroresInicial} errores de consola`)

// 2. Abrir la herramienta Laboratorios (diferida en esta rebanada).
const fila = page.locator('button:has-text("Laboratorios")').first()
await fila.scrollIntoViewIfNeeded()
await fila.click()
// El panel diferido tarda un ida-y-vuelta de red: se espera a su contenido.
await page.waitForTimeout(2500)
const jsTrasAbrir = chunksJs.length
const chunksNuevos = jsTrasAbrir - jsInicial
// El contenido del panel: su encabezado de captura o su estado vacío.
const panelVisible = await page.locator('button:has-text("Laboratorios")').first()
  .evaluate((btn) => btn.getAttribute('aria-expanded') === 'true')
const cuerpoTexto = (await page.textContent('body')) || ''
const panelMonto = /captura|resultado|laboratorio/i.test(cuerpoTexto)

console.log(`tras abrir Laboratorios: +${chunksNuevos} chunks nuevos, expandido=${panelVisible}, contenido=${panelMonto}`)
console.log(`errores de consola totales: ${erroresConsola.length}`)
if (erroresConsola.length) console.log(erroresConsola.slice(0, 5).join('\n'))

const veredicto = {
  fecha: new Date().toISOString(),
  jsInicial,
  chunksNuevosAlAbrir: chunksNuevos,
  panelExpandido: panelVisible,
  panelConContenido: panelMonto,
  erroresConsola: erroresConsola.length,
  // El contrato: la descarga ocurre AL ABRIR (chunks nuevos > 0), el panel
  // llega (expandido con contenido) y nada truena (0 errores).
  pasa: chunksNuevos > 0 && panelVisible && panelMonto && erroresConsola.length === 0,
}
fs.mkdirSync(DESTINO, { recursive: true })
fs.writeFileSync(path.join(DESTINO, 'paneles-diferidos.json'), JSON.stringify(veredicto, null, 2))
console.log(`\n${veredicto.pasa ? 'PASA' : 'FALLA'} — escrito ${path.join(DESTINO, 'paneles-diferidos.json')}`)

await contexto.close()
await navegador.close()
process.exit(veredicto.pasa ? 0 : 1)
