#!/usr/bin/env node
/**
 * LA PORTADA, MEDIDA EN NAVEGADOR — con movimiento y sin él.
 *
 * Lo que se comprueba, y por qué cada cosa:
 *
 *  · **Nada queda invisible.** Es el riesgo real de una entrada animada. Se
 *    mide la opacidad computada de cada bloque después de recorrer la página,
 *    en los dos modos. Un solo bloque a 0 es un defecto de portada en blanco.
 *  · **Con movimiento reducido no se anima NADA.** Ni `animation-duration`
 *    apreciable ni `data-revelar` preparado.
 *  · **El movimiento existe** cuando se acepta: hay elementos con entrada y
 *    el latido del micrófono está vivo.
 *  · **Sin desbordamiento horizontal** en los tres anchos.
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const SALIDA = 'docs/audit/carril-excelencia/capturas'
const base = process.argv[2] || 'http://localhost:3200'
mkdirSync(SALIDA, { recursive: true })

const nav = await chromium.launch({ executablePath: CHROME })
const acta = []

for (const modo of ['normal', 'reducido']) {
  for (const { w, h, nombre } of [{ w: 390, h: 844, nombre: 'movil' }, { w: 768, h: 1024, nombre: 'tableta' }, { w: 1440, h: 900, nombre: 'escritorio' }]) {
    const ctx = await nav.newContext({
      viewport: { width: w, height: h },
      reducedMotion: modo === 'reducido' ? 'reduce' : 'no-preference',
    })
    const pag = await ctx.newPage()
    const consola = []
    pag.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 160)) })
    pag.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 160)))
    await pag.goto(base + '/', { waitUntil: 'domcontentloaded' })
    await pag.waitForTimeout(1800)

    const conEntrada = await pag.locator('.nx-entra').count()
    const revelables = await pag.locator('.nx-revelar').count()

    // Recorrer la página entera, como un lector.
    const alto = await pag.evaluate(() => document.body.scrollHeight)
    for (let y = 0; y < alto; y += Math.floor(h * 0.7)) {
      await pag.evaluate(v => window.scrollTo(0, v), y)
      await pag.waitForTimeout(220)
    }
    await pag.waitForTimeout(900)

    const invisibles = await pag.evaluate(() => {
      const malos = []
      for (const el of document.querySelectorAll('.nx-revelar, .nx-entra')) {
        const cs = getComputedStyle(el)
        if (Number(cs.opacity) < 0.9) malos.push((el.className || el.tagName) + ' opacity=' + cs.opacity)
      }
      return malos
    })
    const preparados = await pag.locator('[data-revelar="preparado"]').count()
    // `preparado = 0` solo no basta: distingue «todos revelados» de «nunca se
    // preparó ninguno», que es justo lo que tiene que pasar con movimiento
    // reducido. Se cuentan los que SÍ llegaron a revelarse.
    const revelados = await pag.locator('[data-revelar="visible"]').count()
    const latido = await pag.evaluate(() => {
      const el = document.querySelector('.nx-escucha')
      if (!el) return null
      const cs = getComputedStyle(el)
      return { duracion: cs.animationDuration, iteraciones: cs.animationIterationCount }
    })
    const desborde = await pag.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

    acta.push({ modo, ancho: w, conEntrada, revelables, invisibles, preparadosAlFinal: preparados, revelados, latido, desborde, consola })
    if (modo === 'normal') { await pag.evaluate(() => window.scrollTo(0, 0)); await pag.waitForTimeout(600); await pag.screenshot({ path: `${SALIDA}/portada-${nombre}.png` }) }
    await ctx.close()
  }
}
await nav.close()
writeFileSync('docs/audit/carril-excelencia/acta-portada.json', JSON.stringify(acta, null, 2) + '\n')
for (const a of acta) {
  console.log(`${a.modo.padEnd(9)} ${String(a.ancho).padStart(4)}px  entradas=${a.conEntrada} revelables=${a.revelables} ocultos=${a.invisibles.length} preparados=${a.preparadosAlFinal} revelados=${a.revelados} latido=${a.latido ? a.latido.duracion + '/' + a.latido.iteraciones : '—'} desborde=${a.desborde} consola=${a.consola.length}`)
  if (a.invisibles.length) console.log('   ⛔', a.invisibles.slice(0, 3))
}
