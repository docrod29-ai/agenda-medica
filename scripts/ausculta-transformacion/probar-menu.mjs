/**
 * EL MENÚ SE PRUEBA PULSÁNDOLO — no leyéndolo.
 * Abre, mide, tabula, cierra con Escape y comprueba dónde quedó el foco.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const base = process.argv[2] || 'http://localhost:3100'
const salida = process.argv[3] || 'docs/audit/ausculta-transformacion/despues'
mkdirSync(salida, { recursive: true })
const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
const acta = {}
await p.goto(base + '/', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)

const disparador = p.locator('.nx-nav-disparador')
acta.disparadorVisible = await disparador.isVisible()
acta.cajaDisparador = await disparador.boundingBox()
acta.expandidoAntes = await disparador.getAttribute('aria-expanded')

await disparador.click()
await p.waitForTimeout(500)
await p.screenshot({ path: `${salida}/menu-abierto-390.png` })
acta.expandidoDespues = await disparador.getAttribute('aria-expanded')
acta.panelVisible = await p.locator('.nx-nav-panel').isVisible()
acta.filas = await p.locator('.nx-nav-panel-fila').count()

// ¿Cabe todo en pantalla, sin que nada quede debajo del borde?
acta.panelCaja = await p.locator('.nx-nav-panel').boundingBox()
acta.alturaVista = 844
// Objetivos táctiles: nada por debajo de 44 px de alto.
acta.altosDeFila = await p.locator('.nx-nav-panel-fila, .nx-nav-panel-cuenta .btn')
  .evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)))
// El foco entró al panel
acta.focoAlAbrir = await p.evaluate(() => document.activeElement?.className || document.activeElement?.tagName)

// Tabular hasta el final y comprobar que NO se escapa del panel
for (let i = 0; i < 12; i++) await p.keyboard.press('Tab')
acta.focoTrasDoceTab = await p.evaluate(() => {
  const a = document.activeElement
  const panel = document.querySelector('.nx-nav-panel')
  return { dentro: !!(panel && a && panel.contains(a)), texto: (a?.textContent || '').trim().slice(0, 30) }
})

await p.keyboard.press('Escape')
await p.waitForTimeout(400)
acta.expandidoTrasEscape = await disparador.getAttribute('aria-expanded')
acta.focoTrasEscape = await p.evaluate(() => document.activeElement?.className || '')
acta.panelVisibleTrasEscape = await p.locator('.nx-nav-panel').isVisible()

// Cerrar tocando fuera
await disparador.click(); await p.waitForTimeout(400)
await p.mouse.click(195, 700); await p.waitForTimeout(400)
acta.cierraAlTocarFuera = (await disparador.getAttribute('aria-expanded')) === 'false'

// Desbordamiento horizontal del documento
acta.desbordeHorizontal = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

console.log(JSON.stringify(acta, null, 1))
await nav.close()
