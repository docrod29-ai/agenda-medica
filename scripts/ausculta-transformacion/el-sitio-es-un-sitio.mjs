#!/usr/bin/env node
/**
 * EL SITIO PÚBLICO ES UN SITIO, NO ONCE PÁGINAS SUELTAS.
 *
 * Recorre las once páginas públicas en dos anchos y dos temas y pregunta, de
 * cada una, las cinco cosas que hacen que sea parte del sitio y no un callejón:
 *
 *   · ¿lleva `NavPublica`?
 *   · ¿ocupa el ANCHO de la ventana, o heredó la columna de lectura?
 *   · ¿está FUERA de `<main>`? (un landmark de navegación dentro del de
 *     contenido principal le miente a quien recorre por landmarks)
 *   · ¿cuántas salidas internas tiene? — `/evidencia` tenía UNA
 *   · axe (WCAG A/AA/2.2), desborde a lo ancho y errores de consola
 *
 * ── DOS TRAMPAS QUE ESTE GUION YA SUFRIÓ ────────────────────────────────────
 *
 * 1. **Medir a media animación.** La portada entra con `nx-acto`, que arranca
 *    en `opacity: 0`; axe lanzado ahí lee ese cero y canta contraste 1,55. Y
 *    como el reparto de tiempos cambia con lo que tarde en compilar el servidor
 *    de desarrollo, la violación salía en una ruta distinta en cada corrida.
 *    Una violación que se mueve de sitio no es un defecto: es un cronómetro mal
 *    puesto. Se espera a que acaben las animaciones FINITAS.
 *
 * 2. **Esperar a una animación infinita.** El latido del micrófono del héroe no
 *    acaba nunca, así que su `finished` no se resuelve y el arnés se colgaba —
 *    y un arnés colgado no da un rojo, no da nada. De ahí el filtro y el tope
 *    de 3 s.
 *
 *   node scripts/ausculta-transformacion/el-sitio-es-un-sitio.mjs [base]
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const BASE = process.argv[2] ?? 'http://localhost:3200'
const RUTAS = ['/evidencia','/seguridad','/arquitectura','/operacion','/contacto','/paquetes','/privacidad','/terminos','/','/precios','/demo']
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let malos = 0
for (const tema of ['dark','light']) {
  for (const W of [390, 1440]) {
    const ctx = await nav.newContext({ viewport: { width: W, height: 900 }, colorScheme: tema })
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', e => errs.push(String(e).slice(0,90)))
    p.on('console', c => { if (c.type() === 'error') errs.push(c.text().slice(0,90)) })
    for (const r of RUTAS) {
      errs.length = 0
      await p.goto(BASE + r, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(1600)
      /*
       * SE ESPERA A QUE PARE EL MOVIMIENTO ANTES DE MEDIR CONTRASTE.
       *
       * La portada entra con `nx-acto`, que arranca en `opacity: 0`. axe
       * lanzado a media animación lee ese cero y canta contraste 1,55 — y como
       * el reparto de tiempos cambia con lo que tarde en compilar el servidor
       * de desarrollo, salía en una ruta distinta en cada corrida. Una
       * violación que se mueve de sitio no es un defecto: es un cronómetro mal
       * puesto. Comprobado: esperando a que acaben, cero en los dos temas y en
       * los dos anchos, a 1,6 s, 4 s y 8 s.
       */
      await p.evaluate(() => {
        /* Sólo las que ACABAN. El latido del micrófono del héroe es infinito:
           esperar a su `finished` cuelga el arnés para siempre — y un arnés
           colgado no da un rojo, da nada. */
        const finitas = document.getAnimations().filter(a => {
          const t = a.effect?.getTiming?.()
          return t && t.iterations !== Infinity
        })
        return Promise.race([
          Promise.all(finitas.map(a => a.finished.catch(() => {}))),
          new Promise(r => setTimeout(r, 3000)),
        ])
      }).catch(() => {})
      if (tema === 'light') { await p.evaluate(() => document.documentElement.setAttribute('data-theme','light')); await p.waitForTimeout(300) }
      await p.addScriptTag({ content: AXE })
      const m = await p.evaluate(async () => {
        const ax = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
        const barra = document.querySelector('.nx-nav-publica')
        const marca = document.querySelector('.nx-nav-marca')
        const nEnMain = document.querySelectorAll('main .nx-nav-publica').length
        return {
          graves: ax.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => `${v.id}×${v.nodes.length} ${(v.nodes[0].failureSummary||'').replace(/\s+/g,' ').slice(0,90)}`),
          hayNav: !!barra,
          anchoNav: barra ? Math.round(barra.getBoundingClientRect().width) : 0,
          altoNav: barra ? Math.round(barra.getBoundingClientRect().height) : 0,
          navDentroDeMain: nEnMain,
          marca: !!marca,
          desb: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          salidas: new Set([...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href'))).size,
        }
      })
      const mal = !m.hayNav || m.navDentroDeMain > 0 || m.desb || m.graves.length || m.anchoNav < W - 2 || m.altoNav > 96
      if (mal) malos++
      console.log(`  ${mal ? '✗' : 'ok'} ${r.padEnd(15)} ${W}/${tema}  nav ${m.anchoNav}×${m.altoNav}  enMain ${m.navDentroDeMain}  salidas ${m.salidas}  desb ${m.desb}  axe ${m.graves.length ? m.graves.join(' | ') : 0}${errs.length ? '  consola: ' + errs.join(' / ') : ''}`)
    }
    await ctx.close()
  }
}
console.log(`\n  combinaciones con algo mal: ${malos}`)
await nav.close()

process.exit(malos > 0 ? 1 : 0)
