/**
 * RTC-19 (3ª tanda) — ¿resuelve el token en las superficies CLÍNICAS?
 *
 * Igual que la 2ª tanda en `/configuracion`, pero sobre las pantallas que el
 * médico usa con un paciente delante. La pregunta es la misma y hay que
 * volver a hacerla: `color-mix()` que no resuelve deja el elemento **sin
 * fondo**, y eso en el `git diff` se ve perfecto.
 *
 * Mide, en las rutas tocadas: cuántos elementos siguen pintando teal-500
 * crudo, cuántos perdieron su fondo, y el tono calculado del acento.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc19-clinico-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc19-clinico'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const RUTAS = ['/antibiograma', '/expediente/pac-refugio-alcantara', '/consulta/pac-refugio-alcantara']

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

const medidas = {}
for (const ruta of RUTAS) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)
  const m = await page.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    /* teal-500 tal como lo calcula el navegador: 20,184,166. */
    const CRUDO = /\b20,\s*184,\s*166\b/
    const todos = [...document.querySelectorAll('body *')].filter(visible)
    const conTealCrudo = todos.filter(el => {
      const cs = getComputedStyle(el)
      return CRUDO.test(cs.backgroundColor) || CRUDO.test(cs.borderColor) || CRUDO.test(cs.color)
    }).length
    /* Los que declaran un fondo translúcido y acaban en transparente: la
       señal de que un `color-mix` no resolvió. */
    const sinFondo = todos.filter(el => {
      const cs = getComputedStyle(el)
      return cs.backgroundColor === 'rgba(0, 0, 0, 0)' && /color-mix/.test(el.getAttribute('style') ?? '')
    }).length
    const sonda = document.createElement('div')
    sonda.style.color = 'var(--nexus)'
    document.body.appendChild(sonda)
    const acento = getComputedStyle(sonda).color
    sonda.remove()
    return { elementos: todos.length, conTealCrudo, sinFondo, acento }
  })
  medidas[ruta] = m
  console.log(`  ${ruta.padEnd(38)} ${m.elementos} elementos · teal-500 crudo: ${m.conTealCrudo} · color-mix sin resolver: ${m.sinFondo} · acento ${m.acento}`)
  await page.screenshot({ path: path.join(DESTINO, `${ruta.replace(/\//g, '-')}.png`) })
}

await contexto.close()
await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion-clinico.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de página · acta en ${path.join(DESTINO, 'medicion-clinico.json')}`)
