import { chromium } from 'playwright'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = 'http://127.0.0.1:3300'
const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] })
const pag = await ctx.newPage()
await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await pag.waitForTimeout(3000)
await pag.locator('input[type=email]').fill('demo@nexusmed.test')
await pag.locator('input[type=password]').fill('demo1234')
await pag.locator('button[type=submit]').first().click(); await pag.waitForTimeout(9000)
await pag.goto(`${BASE}/consulta/pac-001`, { waitUntil: 'domcontentloaded' }); await pag.waitForTimeout(10000)
for (const t of [/^saltar$/i, /^entendido$/i]) {
  const b = pag.locator('button:visible').filter({ hasText: t }).first()
  if (await b.count().catch(()=>0)) { await b.click().catch(()=>{}); await pag.waitForTimeout(800) }
}
const b = pag.getByRole('button', { name: /Grabar la consulta/i }).first()
const caja = await b.boundingBox()
console.log('botón:', JSON.stringify(caja), 'disabled:', await b.isDisabled())
console.log('¿quién está en su centro?:', await pag.evaluate(({x,y}) => {
  const e = document.elementFromPoint(x, y)
  return e ? e.tagName + '.' + String(e.className).slice(0,40) : 'nada'
}, { x: caja.x + caja.width/2, y: caja.y + caja.height/2 }))
await b.click()
for (const t of [500, 1500, 3000]) {
  await pag.waitForTimeout(t === 500 ? 500 : 1000)
  const d = await pag.evaluate(() => ({
    dialogos: document.querySelectorAll('[role=dialog]').length,
    textoDialogo: document.querySelector('[role=dialog]')?.innerText.replace(/\s+/g,' ').slice(0,120) || '',
    toast: [...document.querySelectorAll('[class*=toast],[role=alert]')].map(e=>e.textContent.trim().slice(0,80)),
  }))
  console.log(`t+${t}ms:`, JSON.stringify(d))
}
await nav.close()
