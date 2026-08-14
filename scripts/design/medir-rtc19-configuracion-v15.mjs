/**
 * RTC-19 (2ª tanda) — ¿el token RESUELVE donde antes había un hex?
 *
 * Cambiar `rgba(20,184,166,0.04)` por
 * `color-mix(in srgb, var(--nexus) 4%, transparent)` sólo es una mejora si el
 * navegador lo calcula. Si no lo soporta, la declaración es inválida y el
 * elemento se queda **sin fondo** — un cambio que en el `git diff` se ve
 * perfecto y en la pantalla borra el tinte. Es «el dato tiene que LLEGAR»
 * aplicado a un color.
 *
 * Mide, en las dos secciones tocadas de `/configuracion`, la zona de arrastre
 * y el tinte de cabecera: color calculado, alfa > 0, y que el tono resultante
 * sea el del acento del producto y no el teal-500 viejo.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc19-configuracion-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc19-configuracion'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
const errores = []
page.on('pageerror', e => errores.push(`pageerror: ${e.message}`))

await page.goto(`${BASE}/login`, { waitUntil: 'load' })
await page.waitForSelector('input[type="email"]', { timeout: 15000 })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard**', { timeout: 30000 })
try {
  const s = page.locator('button:has-text("Saltar")').first()
  await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
  await s.waitFor({ state: 'hidden', timeout: 4000 })
} catch { /* sin tour */ }

/** ¿Soporta el navegador la función que ahora sostiene estos fondos? */
const soporta = await page.evaluate(() => CSS.supports('background: color-mix(in srgb, red 4%, transparent)'))

const medidas = { soportaColorMix: soporta, secciones: {} }

for (const seccion of ['Recetas, órdenes y notas', 'Equipo (asistentes y hospital)']) {
  await page.goto(`${BASE}/configuracion`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  try {
    await page.getByRole('button', { name: seccion }).first().click()
  } catch {
    try { await page.getByText(seccion, { exact: false }).first().click() } catch { /* sigue */ }
  }
  await page.waitForTimeout(1500)

  const m = await page.evaluate(() => {
    /** Todo lo que declara un borde discontinuo o un fondo translúcido. */
    const pintados = [...document.querySelectorAll('div,label,button')]
      .filter(el => {
        const r = el.getBoundingClientRect()
        if (r.width < 40 || r.height < 20) return false
        const cs = getComputedStyle(el)
        return cs.borderStyle.includes('dashed') || /rgba?\([^)]*0?\.\d+\)/.test(cs.backgroundColor)
      })
      .slice(0, 12)
      .map(el => {
        const cs = getComputedStyle(el)
        return { fondo: cs.backgroundColor, borde: cs.borderColor, estilo: cs.borderStyle }
      })
    /* El tono del acento, calculado por el navegador: si el color-mix no
       resolviera, estos fondos saldrían `rgba(0, 0, 0, 0)`. */
    const sonda = document.createElement('div')
    sonda.style.color = 'var(--nexus)'
    document.body.appendChild(sonda)
    const acento = getComputedStyle(sonda).color
    sonda.remove()
    return { pintados, acento }
  })
  medidas.secciones[seccion] = m
  const transparentes = m.pintados.filter(p => p.fondo === 'rgba(0, 0, 0, 0)' && !p.estilo.includes('dashed'))
  console.log(`  ${seccion.padEnd(32)} acento ${m.acento} · ${m.pintados.length} elementos con tinte/traza · ${transparentes.length} sin fondo`)
  for (const p of m.pintados.slice(0, 4)) console.log(`      fondo ${p.fondo} · borde ${p.borde} (${p.estilo.split(' ')[0]})`)
}

await contexto.close()
await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion-token.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\ncolor-mix soportado: ${soporta} · ${errores.length} errores de página · acta en ${path.join(DESTINO, 'medicion-token.json')}`)
