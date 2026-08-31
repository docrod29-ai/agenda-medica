#!/usr/bin/env node
/**
 * ¿SE RESPETA «MENOS MOVIMIENTO»? — medido, no supuesto.
 *
 * ── POR QUÉ NO BASTA CON LEER LA HOJA ───────────────────────────────────────
 *
 * `globals.css` tiene un bloque `@media (prefers-reduced-motion: reduce)` que
 * apaga transiciones y animaciones con `!important`, y nueve reglas más
 * dirigidas. Leer eso y darlo por bueno es justo lo que este carril no hace:
 * el `!important` de una hoja **no alcanza al JavaScript** —ni a la Web
 * Animations API ni a `requestAnimationFrame`— y `lib/ui/movimiento.ts` lo dice
 * de sí mismo por escrito.
 *
 * ── LO QUE MIDE, Y POR QUÉ EN DOS PASADAS ───────────────────────────────────
 *
 * La misma pantalla con la preferencia puesta y sin ella. La segunda pasada no
 * es de adorno: sin ella, un producto **sin nada de movimiento** daría ceros en
 * la primera y parecería que respeta la preferencia. Los ceros sólo significan
 * algo si al lado hay un número grande.
 *
 * Cuenta tres cosas: transiciones CSS de más de 50 ms, animaciones CSS vivas, y
 * **animaciones de la Web Animations API corriendo** — que son las que el
 * `!important` no puede tocar.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   (emuladores sembrados + build y servidor CON la configuración del arnés)
 *   node scripts/carril-excelencia/respeta-menos-movimiento.mjs
 */
import { chromium } from 'playwright'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = 'http://localhost:3300'
const RUTAS = ['/dashboard', '/citas', '/calendario', '/consulta/pac-001', '/pacientes']

const nav = await chromium.launch({ executablePath: CHROME })
for (const modo of ['reduce', 'no-preference']) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: modo })
  const pag = await ctx.newPage()
  await pag.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  try { await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 }) }
  catch { console.error('  El servidor no sirve el build del arnés.'); await nav.close(); process.exit(2) }
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForTimeout(9000)
  console.log(`\n══ prefers-reduced-motion: ${modo} ══`)
  for (const ruta of RUTAS) {
    await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
    await pag.waitForTimeout(4500)
    for (const t of [/^saltar$/i, /^entendido$/i]) {
      const b = pag.locator('button:visible').filter({ hasText: t }).first()
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(600) }
    }
    const r = await pag.evaluate(() => {
      let conTransicion = 0, conAnimacionCss = 0
      for (const el of document.querySelectorAll('*')) {
        const c = getComputedStyle(el)
        const dur = parseFloat(c.transitionDuration) || 0
        const adur = parseFloat(c.animationDuration) || 0
        if (dur > 0.05) conTransicion++
        if (adur > 0.05 && c.animationName !== 'none') conAnimacionCss++
      }
      // Web Animations API: lo que el CSS con !important NO alcanza.
      const waapi = document.getAnimations().filter(a => a.playState === 'running')
      return { conTransicion, conAnimacionCss, waapi: waapi.length,
               nombres: waapi.slice(0, 4).map(a => a.animationName || (a.effect?.target?.tagName ?? '?')) }
    })
    console.log(`  ${ruta.padEnd(22)} transiciones>50ms ${String(r.conTransicion).padStart(4)} · animaciones CSS ${String(r.conAnimacionCss).padStart(3)} · WAAPI corriendo ${r.waapi} ${r.nombres.length ? JSON.stringify(r.nombres) : ''}`)
  }
  await ctx.close()
}
await nav.close()
