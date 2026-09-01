import { chromium } from 'playwright'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
// La espera dura lo que tarde Firebase en decidir: se frena la red para verla.
await ctx.route('**identitytoolkit**', r => setTimeout(() => r.abort(), 8000))
p.goto('http://localhost:3100/login').catch(() => {})
await p.waitForTimeout(900)
await p.screenshot({ path: process.argv[2] })
console.log('espera visible:', await p.locator('.nx-puerta-espera').count())
await nav.close()
