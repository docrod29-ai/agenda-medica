import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT = process.env.OUT ?? 'docs/design/screenshots/v10'
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:3005'
const rutas = [
  ['/', 'landing'],
  ['/precios', 'precios'],
  ['/registro', 'registro'],
  ['/login', 'login'],
  ['/demo', 'demo'],
  ['/demo/interactivo', 'demo-interactivo'],
  ['/demo/razonamiento', 'demo-razonamiento'],
  ['/dashboard', 'dashboard-sin-sesion'],
]
const vistas = [
  ['desktop-1440', { width: 1440, height: 900 }],
  ['mobile-390', { width: 390, height: 844 }],
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [vista, viewport] of vistas) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const consola = []
  page.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 200)) })
  for (const [ruta, nombre] of rutas) {
    try {
      const resp = await page.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${OUT}/${nombre}__${vista}.jpg`, quality: 55, type: 'jpeg', fullPage: true })
      console.log(`${vista} ${ruta} -> ${resp?.status()} url=${page.url().replace(BASE, '')}`)
    } catch (e) {
      console.log(`${vista} ${ruta} -> ERROR ${String(e).slice(0, 150)}`)
    }
  }
  if (consola.length) console.log(`[consola ${vista}]`, JSON.stringify([...new Set(consola)].slice(0, 8), null, 1))
  await ctx.close()
}
await browser.close()
