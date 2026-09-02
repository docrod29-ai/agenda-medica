/** Recorre una página desplazándose de verdad y captura cada pantalla. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base, ruta, salida, anchoStr] = process.argv.slice(2)
const w = Number(anchoStr || 1440), h = w === 390 ? 844 : 900
mkdirSync(salida, { recursive: true })
const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
await p.goto(base + ruta, { waitUntil: 'networkidle', timeout: 45000 })
await p.waitForTimeout(900)
const total = await p.evaluate(() => document.documentElement.scrollHeight)
const pasos = Math.min(12, Math.ceil(total / h))
const slug = (ruta === '/' ? 'landing' : ruta.replace(/^\//, '').replace(/[^\w-]/g, '_'))
for (let i = 0; i < pasos; i++) {
  await p.evaluate(y => window.scrollTo(0, y), i * h)
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${salida}/${slug}-${w}-p${String(i).padStart(2, '0')}.png` })
}
console.log('alto', total, 'pasos', pasos)
await nav.close()
