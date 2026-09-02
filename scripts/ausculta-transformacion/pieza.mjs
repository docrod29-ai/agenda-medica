/** Captura UNA pieza por selector, tras dejar que su movimiento termine. */
import { chromium } from 'playwright'
const [base, ruta, selector, destino, anchoStr, esperaStr] = process.argv.slice(2)
const w = Number(anchoStr || 1440)
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await (await nav.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } })).newPage()
await p.goto(base + ruta, { waitUntil: 'networkidle' })
await p.waitForTimeout(Number(esperaStr || 4000))
await p.locator(selector).first().screenshot({ path: destino })
await nav.close()
