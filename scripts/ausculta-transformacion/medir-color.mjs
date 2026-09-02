import { chromium } from 'playwright'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
await p.goto('http://localhost:3200/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(()=>{})
await p.goto('http://localhost:3200/calendario', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2500)
const r = await p.evaluate(() => {
  const el = document.querySelector('.nx-agenda-bloque')
  if (!el) return { error: 'sin bloque' }
  const cs = getComputedStyle(el)
  const raiz = getComputedStyle(document.documentElement)
  return {
    background: cs.backgroundColor, borderLeft: cs.borderLeftColor, border: cs.borderTopColor,
    nexusSoft: raiz.getPropertyValue('--nexus-soft'), nexus: raiz.getPropertyValue('--nexus'),
    teal: raiz.getPropertyValue('--teal'), borde: raiz.getPropertyValue('--nexus-borde'),
    tema: document.documentElement.getAttribute('data-theme'),
  }
})
console.log(JSON.stringify(r, null, 1))
await nav.close()
