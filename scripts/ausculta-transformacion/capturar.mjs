import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base, salida, ...rutas] = process.argv.slice(2)
const ANCHOS = [{ w: 390, h: 844, n: 'movil' }, { w: 1440, h: 900, n: 'escritorio' }]
mkdirSync(salida, { recursive: true })
const nav = await chromium.launch({ executablePath: CHROME })
const acta = []
for (const ruta of rutas) {
  for (const { w, h, n } of ANCHOS) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    const p = await ctx.newPage()
    const consola = []
    p.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 160)) })
    p.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 160)))
    const slug = (ruta === '/' ? 'landing' : ruta.replace(/^\//, '').replace(/[^\w-]/g, '_')) + '-' + n
    let estado = 'ok'
    try { const r = await p.goto(base + ruta, { waitUntil: 'networkidle', timeout: 45000 }); estado = String(r?.status()) } catch (e) { estado = 'ERR ' + String(e).slice(0, 100) }
    await p.waitForTimeout(1200)
    await p.screenshot({ path: `${salida}/${slug}.png`, fullPage: true }).catch(() => {})
    const desborde = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1).catch(() => null)
    const alto = await p.evaluate(() => document.documentElement.scrollHeight).catch(() => null)
    acta.push({ ruta, ancho: w, estado, desborde, alto, consola })
    await ctx.close()
  }
}
await nav.close()
writeFileSync(`${salida}/acta.json`, JSON.stringify(acta, null, 2))
console.log(JSON.stringify(acta, null, 1))
