#!/usr/bin/env node
// Recorredor del Panel de Lujo. Uso:
//   node recorrer.mjs <ruta> [--movil] [--sin-sesion] [--click "texto"]... [--fill "selector=valor"]... [--tecla Escape] [--espera 3000]
import { chromium } from '/home/user/agenda-medica/node_modules/playwright/index.mjs'
import { existsSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE || 'http://localhost:3200'
const S = process.env.S || '/tmp/claude-0/-home-user-agenda-medica/ac4ce5f6-97f0-5905-bfc3-6415bf352856/scratchpad'
const args = process.argv.slice(2)
const ruta = args[0]; if (!ruta) { console.error('uso: recorrer.mjs <ruta> [opciones]'); process.exit(2) }
const movil = args.includes('--movil'), sinSesion = args.includes('--sin-sesion')
const clicks = [], fills = [], teclas = []; let espera = 3500
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--click') clicks.push(args[++i])
  if (args[i] === '--fill') fills.push(args[++i])
  if (args[i] === '--tecla') teclas.push(args[++i])
  if (args[i] === '--espera') espera = Number(args[++i])
}
const nav = await chromium.launch({ executablePath: CHROME })
const estado = `${S}/sesion${movil ? '-movil' : ''}.json`
const ctx = await nav.newContext({
  viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  ...(movil ? { isMobile: true, hasTouch: true } : {}),
  ...(!sinSesion && existsSync(estado) ? { storageState: estado } : {}),
})
const pag = await ctx.newPage()
const consola = [], fallidas = []
pag.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consola.push(`[${m.type()}] ${m.text().slice(0, 220)}`) })
pag.on('response', r => { if (r.status() >= 400) fallidas.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`) })
pag.on('requestfailed', r => fallidas.push(`FAILED ${r.method()} ${r.url().replace(BASE, '')} ${r.failure()?.errorText || ''}`))
if (!sinSesion && !existsSync(estado)) {
  await pag.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await pag.waitForTimeout(2500)
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForURL(u => !String(u).includes("/login"), { timeout: 30000 }).catch(() => {}); await pag.waitForTimeout(2000)
  await ctx.storageState({ path: estado })
}
await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('GOTO ERROR', String(e).slice(0, 200)))
await pag.waitForTimeout(espera)
const saltar = pag.locator('button:visible').filter({ hasText: /^saltar$/i }).first()
if (await saltar.count().catch(() => 0)) { await saltar.click().catch(() => {}); await pag.waitForTimeout(800) }
for (const f of fills) { const [sel, ...v] = f.split('='); await pag.locator(sel).first().fill(v.join('=')).catch(e => console.log('FILL ERROR', sel, String(e).slice(0, 120))); }
for (const c of clicks) {
  const loc = pag.getByRole('button', { name: c }).or(pag.getByRole('link', { name: c })).or(pag.getByText(c, { exact: false })).first()
  const antes = pag.url()
  await loc.click({ timeout: 8000 }).catch(e => console.log('CLICK ERROR', JSON.stringify(c), String(e).slice(0, 160)))
  await pag.waitForTimeout(2000)
  console.log(`CLICK ${JSON.stringify(c)} → url ${antes === pag.url() ? 'sin cambio' : pag.url().replace(BASE, '')}`)
}
for (const t of teclas) { await pag.keyboard.press(t); await pag.waitForTimeout(800); console.log(`TECLA ${t}`) }
const slug = (ruta === '/' ? 'raiz' : ruta.replace(/^\//, '').replace(/[^\w-]/g, '_')) + (movil ? '-movil' : '') + (clicks.length ? '-' + clicks.length + 'clicks' : '')
await pag.screenshot({ path: `${S}/capturas/${slug}.png`, fullPage: true }).catch(() => {})
const info = await pag.evaluate(() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const ctrls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=button], [onclick], [tabindex]')].filter(vis).map(e => {
    const r = e.getBoundingClientRect()
    const txt = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || e.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    const tag = e.tagName.toLowerCase()
    const extra = tag === 'a' ? ` href=${e.getAttribute('href')}` : (tag === 'input' ? ` type=${e.type}` : '')
    const flags = [e.disabled ? 'DISABLED' : '', (tag === 'div' || tag === 'span' || tag === 'li') ? 'NO-BUTTON' : '', (r.width < 44 || r.height < 44) && (tag === 'button' || tag === 'a') ? `pequeño(${Math.round(r.width)}x${Math.round(r.height)})` : '', (tag === 'input' && !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')) ? 'SIN-LABEL' : ''].filter(Boolean).join(' ')
    return `${tag}${extra} "${txt}" ${flags}`.trim()
  })
  const h = [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(e => `${e.tagName} ${e.textContent.trim().slice(0, 80)}`)
  const texto = document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 6000)
  const dialogs = document.querySelectorAll('[role=dialog], dialog[open]').length
  return { titulo: document.title, encabezados: h, controles: ctrls, texto, dialogs, desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }
})
console.log('URL FINAL:', pag.url().replace(BASE, '') || '/')
console.log('TÍTULO:', info.titulo, '| diálogos abiertos:', info.dialogs, '| desborde horizontal:', info.desborde)
console.log('CAPTURA:', `${S}/capturas/${slug}.png`)
console.log('\n== ENCABEZADOS =='); console.log(info.encabezados.join('\n') || '(ninguno)')
console.log(`\n== CONTROLES (${info.controles.length}) ==`); console.log(info.controles.join('\n'))
console.log('\n== CONSOLA =='); console.log(consola.slice(0, 25).join('\n') || '(limpia)')
console.log('\n== RED FALLIDA =='); console.log(fallidas.slice(0, 25).join('\n') || '(ninguna)')
console.log('\n== TEXTO VISIBLE =='); console.log(info.texto)
await nav.close()
