/**
 * CAMINAR UNA PANTALLA CON EL TECLADO, Y APUNTAR DÓNDE CAE EL FOCO.
 *
 * Treinta pulsaciones de Tab. De cada parada apunta qué recibió el foco, cuánto
 * mide y si el indicador de foco se puede VER. Nació encontrando REG-439: un
 * `input[type=date]` oculto de 1×1 se llevaba TRES paradas seguidas —día, mes y
 * año son tramos tabulables del control nativo— con el anillo de 2px dibujado
 * sobre un píxel.
 *
 * ── LA TRAMPA QUE SUFRIÓ ────────────────────────────────────────────────────
 *
 * La primera corrida midió «Saltar / Siguiente / Saltar» en bucle: era el
 * recorrido de bienvenida, que es un modal CON trampa de foco —correcta— y que
 * hay que cerrar antes. Sin eso lo que se mide es el recorrido, no la pantalla.
 *
 *   node scripts/ausculta-transformacion/caminar-con-el-teclado.mjs \
 *        http://localhost:3200  <ruta>
 *
 * Necesita el arnés con emuladores, así que NO corre en CI.
 */
import { chromium } from 'playwright'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base, ruta] = process.argv.slice(2)
const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
await p.goto(base + '/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(1200)
// El recorrido de bienvenida es un modal CON trampa de foco — correcta, pero
// si no se cierra lo que se mide es el recorrido, no la pantalla.
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
await p.evaluate(() => (document.activeElement)?.blur())
const paradas = []
for (let i = 0; i < 30; i++) {
  await p.keyboard.press('Tab')
  const d = await p.evaluate(() => {
    const e = document.activeElement
    if (!e || e === document.body) return null
    const r = e.getBoundingClientRect()
    const cs = getComputedStyle(e)
    return {
      et: e.tagName, tipo: e.getAttribute('type'),
      nombre: (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 34),
      w: Math.round(r.width), h: Math.round(r.height),
      // ¿Se ve el foco? Sin anillo ni contorno ni sombra, no se ve.
      outline: cs.outlineStyle === 'none' ? null : `${cs.outlineStyle} ${cs.outlineWidth}`,
      boxShadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 40),
      dentroDeLaPantalla: r.top >= 0 && r.bottom <= 844 && r.left >= 0 && r.right <= 390,
    }
  })
  if (d) paradas.push(d)
}
const invisibles = paradas.filter(d => (d.w < 10 || d.h < 10))
const sinAnillo = paradas.filter(d => !d.outline && !d.boxShadow)
console.log(JSON.stringify({
  paradas: paradas.length,
  focosDiminutos: invisibles,
  sinIndicadorDeFoco: sinAnillo.length,
  ejemplosSinIndicador: sinAnillo.slice(0, 5).map(d => `${d.nombre} (${d.et}) ${d.w}x${d.h}`),
  primeras: paradas.slice(0, 8).map(d => `${d.nombre} ${d.w}x${d.h}`),
}, null, 2))
await nav.close()
import { chromium } from 'playwright'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base, ruta] = process.argv.slice(2)
const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
await p.goto(base + '/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(1200)
// El recorrido de bienvenida es un modal CON trampa de foco — correcta, pero
// si no se cierra lo que se mide es el recorrido, no la pantalla.
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
await p.evaluate(() => (document.activeElement)?.blur())
const paradas = []
for (let i = 0; i < 30; i++) {
  await p.keyboard.press('Tab')
  const d = await p.evaluate(() => {
    const e = document.activeElement
    if (!e || e === document.body) return null
    const r = e.getBoundingClientRect()
    const cs = getComputedStyle(e)
    return {
      et: e.tagName, tipo: e.getAttribute('type'),
      nombre: (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 34),
      w: Math.round(r.width), h: Math.round(r.height),
      // ¿Se ve el foco? Sin anillo ni contorno ni sombra, no se ve.
      outline: cs.outlineStyle === 'none' ? null : `${cs.outlineStyle} ${cs.outlineWidth}`,
      boxShadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 40),
      dentroDeLaPantalla: r.top >= 0 && r.bottom <= 844 && r.left >= 0 && r.right <= 390,
    }
  })
  if (d) paradas.push(d)
}
const invisibles = paradas.filter(d => (d.w < 10 || d.h < 10))
const sinAnillo = paradas.filter(d => !d.outline && !d.boxShadow)
console.log(JSON.stringify({
  paradas: paradas.length,
  focosDiminutos: invisibles,
  sinIndicadorDeFoco: sinAnillo.length,
  ejemplosSinIndicador: sinAnillo.slice(0, 5).map(d => `${d.nombre} (${d.et}) ${d.w}x${d.h}`),
  primeras: paradas.slice(0, 8).map(d => `${d.nombre} ${d.w}x${d.h}`),
}, null, 2))
await nav.close()
