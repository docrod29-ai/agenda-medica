import { chromium } from 'playwright'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto('http://localhost:3200/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(()=>{})
await p.waitForTimeout(2500)
console.log(JSON.stringify(await p.evaluate(() => {
  const logo = document.querySelector('.sidebar-logo')
  const nombre = logo?.querySelectorAll('div')[1]?.querySelector('div')
  if (!nombre) return { error: 'no encontrado', html: logo?.innerHTML?.slice(0, 300) }
  const cs = getComputedStyle(nombre)
  const r = nombre.getBoundingClientRect()
  return { texto: nombre.textContent, whiteSpace: cs.whiteSpace, overflow: cs.overflow,
    alto: Math.round(r.height), ancho: Math.round(r.width), title: nombre.getAttribute('title') }
}), null, 1))
await nav.close()
