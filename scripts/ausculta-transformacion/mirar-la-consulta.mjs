/**
 * MIRAR UNA PANTALLA DEL MÉDICO EN EL TELÉFONO.
 *
 * Sonda de OBSERVAR: no arregla nada, cuenta lo que hay. 390×844 por omisión,
 * que es un iPhone en Chromium — y Chromium NO es un iPhone.
 *
 * Nació mirando la consulta y se generalizó a la segunda pantalla, en vez de
 * copiarse: una sonda por pantalla son cinco sondas que divergen, y la que
 * mide de más gana por accidente.
 *
 *   node scripts/ausculta-transformacion/mirar-la-consulta.mjs \
 *        http://localhost:3200  <carpeta de salida>  [ancho]  [ruta]
 *
 * Necesita el arnés con emuladores (`arnes:emuladores` · `arnes:sembrar` ·
 * `arnes:dev`) y por eso NO corre en CI.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base, salida, anchoStr, rutaArg] = process.argv.slice(2)
const ruta = rutaArg || '/consulta/pac-001'
const w = Number(anchoStr || 390)
mkdirSync(salida, { recursive: true })
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const ctx = await nav.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 },
  permissions: ['microphone'], hasTouch: w === 390, isMobile: w === 390 })
const p = await ctx.newPage()
const consola = []
p.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 160)) })
p.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 160)))

await p.goto(base + '/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(1500)
for (let i = 0; i < 15; i++) {
  const d = p.locator('[role="dialog"][aria-label*="ienvenida"]')
  if (!(await d.count()) || !(await d.first().isVisible())) break
  const b = d.locator('button', { hasText: /Siguiente|Entendido|Empezar|Cerrar|Saltar|Listo|Omitir/i }).first()
  if (await b.count()) await b.click({ force: true }); else await p.keyboard.press('Escape')
  await p.waitForTimeout(500)
}
await p.goto(base + ruta, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(3500)
for (let i = 0; i < 8; i++) {
  const d = p.locator('[role="dialog"][aria-label*="ienvenida"]')
  if (!(await d.count()) || !(await d.first().isVisible())) break
  await d.locator('button').last().click({ force: true }).catch(() => {})
  await p.waitForTimeout(400)
}
const nombre = ruta.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'raiz'
await p.screenshot({ path: `${salida}/${nombre}-${w}.png`, fullPage: false })
await p.screenshot({ path: `${salida}/${nombre}-${w}-completa.png`, fullPage: true })

const m = await p.evaluate(() => {
  const vis = e => { const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' }
  const controles = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]')].filter(vis)
  const chicos = controles.filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44 })
  const nombre = e => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
  const noBoton = [...document.querySelectorAll('[onclick], [role="button"]')].filter(e => vis(e) && e.tagName !== 'BUTTON' && e.tagName !== 'A')
  const campos = [...document.querySelectorAll('input, select, textarea')].filter(vis)
  const sinEtiqueta = campos.filter(e => !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')
    && !(e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) && !e.closest('label'))
  return {
    alto: document.documentElement.scrollHeight,
    anchoScroll: document.documentElement.scrollWidth,
    desbordaH: document.documentElement.scrollWidth > window.innerWidth + 1,
    controlesVisibles: controles.length,
    objetivosChicos: chicos.length,
    ejemplosChicos: chicos.slice(0, 12).map(e => { const r = e.getBoundingClientRect()
      return `${nombre(e)} ${Math.round(r.width)}x${Math.round(r.height)}` }),
    interactivosQueNoSonBoton: noBoton.length,
    camposSinEtiqueta: sinEtiqueta.length,
    ejemplosSinEtiqueta: sinEtiqueta.slice(0, 8).map(nombre),
    pestanas: [...document.querySelectorAll('[role="tab"]')].filter(vis).map(e => e.innerText.trim().slice(0, 24)),
    encabezados: [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(e => e.tagName + ' ' + e.innerText.trim().slice(0, 44)).slice(0, 24),
    hayH1: document.querySelectorAll('h1').length,
    // ¿cuánto de la primera pantalla es cabecera/navegación en vez de trabajo?
    primeraPantalla: [...document.querySelectorAll('body *')].filter(e => {
      const r = e.getBoundingClientRect(); return vis(e) && r.top < 200 && r.height > 20 && r.width > 200
    }).length,
  }
})
console.log(JSON.stringify({ ruta, ancho: w, ...m, erroresDeConsola: consola.slice(0, 10) }, null, 2))
await nav.close()
