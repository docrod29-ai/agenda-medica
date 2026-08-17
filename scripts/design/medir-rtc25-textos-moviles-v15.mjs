/**
 * RTC-25 — las cinco quejas de texto móvil, contadas una por una a 390px.
 *
 * ORT-20 + RT-22 dejaron una lista, no un diagnóstico:
 *
 *   1. el rótulo del héroe envuelve;
 *   2. el placeholder «…correo o CUI» se trunca;
 *   3. las píldoras-pestaña sangran fuera del ancho;
 *   4. los descriptores bajo los FABs envuelven;
 *   5. «Urgente» aparece como metadato gris de 12px.
 *
 * Cinco afirmaciones sobre la misma pantalla y el mismo ancho se miden juntas
 * o no se miden: por separado se arreglan tres y se olvidan dos. Y algunas
 * pueden haber muerto solas — los FABs, por ejemplo, ya no flotan desde RTC-05
 * y la corrida concurrente retiró el de ayuda entero, así que la queja 4
 * podría no tener sujeto.
 *
 * Qué mide, a 390×844:
 *   · **desbordes reales**: elementos cuyo ancho de contenido supera su caja
 *     (`scrollWidth > clientWidth`), que es sangrar de verdad y no «parece
 *     apretado»;
 *   · **truncados**: texto con ellipsis efectiva;
 *   · **envolturas**: cuántos renglones ocupa un rótulo que se quería en uno;
 *   · si «Urgente» se pinta con voz de metadato o de aviso.
 *
 * No cambia nada: informa. La decisión se toma con el acta delante.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc25-textos-moviles-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc25-textos-moviles'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const RUTAS = ['/dashboard', '/pacientes', '/pendientes', '/citas']

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
})
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

const medidas = {}

for (const ruta of RUTAS) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(2400)

  const m = await page.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const texto = el => (el.textContent ?? '').trim().replace(/\s+/g, ' ')

    /* DESBORDE REAL: el contenido no cabe en su caja. `scrollWidth` cuenta
       incluso lo que el `overflow: hidden` esconde, así que caza al que sangra
       Y al que se corta en silencio. Se ignoran los contenedores con scroll
       declarado: ahí desbordar es la función, no el defecto. */
    const desbordes = [...document.querySelectorAll('body *')]
      .filter(el => {
        if (!visible(el)) return false
        const cs = getComputedStyle(el)
        if (['auto', 'scroll'].includes(cs.overflowX)) return false
        return el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0
      })
      .slice(0, 12)
      .map(el => ({
        etiqueta: texto(el).slice(0, 40),
        clase: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 40),
        cabe: el.clientWidth, necesita: el.scrollWidth,
      }))

    /* TRUNCADO EFECTIVO: declara ellipsis Y no le cabe el texto. Declararlo
       sin que corte no es un defecto: es un seguro. */
    const truncados = [...document.querySelectorAll('body *')]
      .filter(el => visible(el) && getComputedStyle(el).textOverflow === 'ellipsis'
        && el.scrollWidth > el.clientWidth + 1)
      .slice(0, 10)
      .map(el => ({ etiqueta: texto(el).slice(0, 40), cabe: el.clientWidth, necesita: el.scrollWidth }))

    /* El placeholder del buscador, que la queja 2 nombra por su texto. */
    const buscadores = [...document.querySelectorAll('input[placeholder]')]
      .filter(visible)
      .map(el => {
        /* ¿Cabe el placeholder? Se mide con un lienzo, con la tipografía
           REAL del campo — comparar longitudes de cadena no dice nada. */
        const cs = getComputedStyle(el)
        const ctx = document.createElement('canvas').getContext('2d')
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        const ancho = ctx.measureText(el.placeholder).width
        const util = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        return { placeholder: el.placeholder, anchoTexto: Math.round(ancho), anchoUtil: Math.round(util), cabe: ancho <= util }
      })

    /* «Urgente»: ¿con qué voz se pinta? */
    const urgentes = [...document.querySelectorAll('body *')]
      .filter(el => el.children.length === 0 && /^urgente$/i.test(texto(el)) && visible(el))
      .map(el => {
        const cs = getComputedStyle(el)
        return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, fondo: cs.backgroundColor }
      })

    /* Renglones de los rótulos grandes: un título que se quería en una línea
       y ocupa tres es la queja 1. */
    const titulos = [...document.querySelectorAll('h1, h2')].filter(visible).map(el => {
      const cs = getComputedStyle(el)
      const alturaLinea = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2
      return {
        etiqueta: texto(el).slice(0, 40),
        fontSize: cs.fontSize,
        renglones: Math.round(el.getBoundingClientRect().height / alturaLinea),
      }
    })

    return {
      anchoDocumento: document.documentElement.scrollWidth,
      desbordaLaPagina: document.documentElement.scrollWidth > window.innerWidth + 1,
      desbordes, truncados, buscadores, urgentes, titulos,
    }
  })

  medidas[ruta] = m
  console.log(`\n  ${ruta}`)
  console.log(`    documento ${m.anchoDocumento}px · desborda la página: ${m.desbordaLaPagina}`)
  console.log(`    elementos que no caben en su caja: ${m.desbordes.length}`)
  for (const d of m.desbordes.slice(0, 4)) console.log(`      · «${d.etiqueta}» cabe ${d.cabe} necesita ${d.necesita} (${d.clase})`)
  console.log(`    truncados con ellipsis efectiva: ${m.truncados.length}`)
  for (const t of m.truncados.slice(0, 3)) console.log(`      · «${t.etiqueta}» cabe ${t.cabe} necesita ${t.necesita}`)
  for (const b of m.buscadores) console.log(`    placeholder «${b.placeholder}» ${b.cabe ? 'CABE' : 'NO CABE'} (${b.anchoTexto} de ${b.anchoUtil}px)`)
  for (const u of m.urgentes) console.log(`    «Urgente» ${u.fontSize}/${u.fontWeight} color ${u.color} fondo ${u.fondo}`)
  for (const t of m.titulos.filter(t => t.renglones > 1)) console.log(`    título «${t.etiqueta}» ${t.fontSize} en ${t.renglones} renglones`)
  await page.screenshot({ path: path.join(DESTINO, `390${ruta.replace(/\//g, '-')}.png`), fullPage: true })
}

await contexto.close()
await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de página · acta en ${path.join(DESTINO, 'medicion.json')}`)
