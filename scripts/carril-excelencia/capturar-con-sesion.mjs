#!/usr/bin/env node
/**
 * CAPTURAS CON SESIÓN — el arnés para MIRAR las pantallas del consultorio.
 *
 * `capturar.mjs` sirve para las rutas públicas. Las del consultorio exigen
 * sesión, y montarla en cada script es justo lo que hace que nadie las mire.
 * Aquí se entra una vez con la cuenta sintética del emulador y se reutiliza el
 * contexto para todas las rutas: entrar nueve veces tarda nueve veces más y es
 * la razón real por la que una auditoría visual se queda en tres pantallas.
 *
 * Además de la imagen deja MEDIDAS, porque «se ve estático» no es un dato:
 *  · cuántos elementos declaran transición o animación (movimiento real);
 *  · cuántos rectángulos con borde+radio hay (fatiga de tarjeta);
 *  · cuántos tamaños tipográficos distintos se usan (jerarquía);
 *  · cuántos pesos de fuente distintos;
 *  · si el cuerpo se desborda a lo ancho.
 *
 * Lo que esto NO ve: si el movimiento SIGNIFICA algo, si la jerarquía es la
 * correcta, y si la pantalla se entiende. Eso se mira en la captura.
 *
 * Uso:  node scripts/carril-excelencia/capturar-con-sesion.mjs <base> <etiqueta> <ruta> [ruta...]
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const ANCHOS = (process.env.ANCHOS || '390,768,1440').split(',').map(Number)
const ALTOS = { 390: 844, 768: 1024, 1440: 900 }
const SALIDA = process.env.SALIDA || 'docs/audit/carril-excelencia/capturas'

const [base, etiqueta, ...rutas] = process.argv.slice(2)
if (!base || !etiqueta || !rutas.length) {
  console.error('uso: capturar-con-sesion.mjs <base> <etiqueta> <ruta> [ruta...]')
  process.exit(2)
}
mkdirSync(SALIDA, { recursive: true })

const nav = await chromium.launch({ executablePath: CHROME })
const acta = []

for (const w of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: ALTOS[w] || 900 }, deviceScaleFactor: 1 })
  const pag = await ctx.newPage()
  // Sesión una sola vez por ancho.
  await pag.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
  await pag.waitForTimeout(2500)
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test').catch(() => {})
  await pag.locator('input[type=password]').first().fill('demo1234').catch(() => {})
  await pag.locator('button[type=submit]').first().click().catch(() => {})
  await pag.waitForTimeout(7000)

  for (const ruta of rutas) {
    const consola = []
    const onMsg = m => { if (m.type() === 'error') consola.push(m.text().slice(0, 180)) }
    pag.on('console', onMsg)
    await pag.goto(base + ruta, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await pag.waitForTimeout(4500)
    const saltar = pag.locator('button:visible').filter({ hasText: /^saltar$/i }).first()
    if (await saltar.count().catch(() => 0)) { await saltar.click().catch(() => {}); await pag.waitForTimeout(1200) }

    const slug = (ruta === '/' ? 'raiz' : ruta.replace(/^\//, '').replace(/[^\w-]/g, '_')) + `-${etiqueta}-${w}`
    await pag.screenshot({ path: `${SALIDA}/${slug}.png`, fullPage: false }).catch(() => {})

    const medidas = await pag.evaluate(() => {
      const vis = [...document.querySelectorAll('body *')].filter(e => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      let conMovimiento = 0, tarjetas = 0
      const tamanos = new Set(), pesos = new Set()
      for (const e of vis) {
        const s = getComputedStyle(e)
        // OJO: `transitionProperty` vale 'all' por defecto en TODO elemento, así
        // que mirarlo a solas da 100 % y la medida deja de significar nada.
        // Lo que declara movimiento real es la DURACIÓN.
        const dur = (s.transitionDuration || '').split(',').some(v => parseFloat(v) > 0)
        const anim = s.animationName && s.animationName !== 'none'
          && (s.animationDuration || '').split(',').some(v => parseFloat(v) > 0)
        if (dur || anim) conMovimiento++
        const bw = parseFloat(s.borderTopWidth) || 0
        const br = parseFloat(s.borderTopLeftRadius) || 0
        const r = e.getBoundingClientRect()
        if (bw > 0 && br >= 6 && r.width > 80 && r.height > 40) tarjetas++
        if (e.textContent && e.textContent.trim()) { tamanos.add(s.fontSize); pesos.add(s.fontWeight) }
      }
      return {
        elementosVisibles: vis.length,
        conMovimiento,
        tarjetas,
        tamanosTipograficos: tamanos.size,
        pesosDeFuente: pesos.size,
        desbordeHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        alturaDocumento: document.documentElement.scrollHeight,
      }
    }).catch(e => ({ error: String(e).slice(0, 120) }))

    acta.push({ ruta, ancho: w, ...medidas, consola })
    pag.off('console', onMsg)
  }
  await ctx.close()
}
await nav.close()
writeFileSync(`docs/audit/carril-excelencia/acta-estaticidad-${etiqueta}.json`, JSON.stringify(acta, null, 2) + '\n')
for (const a of acta) {
  const pc = a.elementosVisibles ? ((a.conMovimiento / a.elementosVisibles) * 100).toFixed(1) : '?'
  console.log(`${a.ruta.padEnd(28)} @${String(a.ancho).padStart(4)}  vis=${String(a.elementosVisibles).padStart(4)}  mov=${String(a.conMovimiento).padStart(3)} (${pc}%)  tarjetas=${String(a.tarjetas).padStart(3)}  tam=${a.tamanosTipograficos}  pesos=${a.pesosDeFuente}  desborde=${a.desbordeHorizontal}`)
}
