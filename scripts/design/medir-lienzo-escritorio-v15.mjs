/**
 * ARNÉS RTC-12 — el lienzo de escritorio, medido.
 *
 * El registro canónico dice dos cosas distintas en una línea, y sólo una de
 * ellas es una rebanada acotable:
 *
 *   (a) «Ninguna superficie usa el lienzo de escritorio: columna única
 *       880–1100px en todas» — eso es el refactor del monolito (6147 líneas),
 *       deuda dimensionada, y no se abre a ciegas.
 *   (b) «En consulta a 1440 el paciente SE PIERDE al desplazar» — eso es un
 *       defecto de seguridad clínica con arreglo contenido: saber de quién es
 *       la nota que se está escribiendo.
 *
 * Este arnés mide LAS DOS para que la decisión se tome sobre números:
 *
 *   · `anchoDelContenido`  — ancho real de la columna de trabajo por ruta.
 *   · `anchoDesaprovechado` — cuánto del viewport queda sin usar a 1440.
 *   · `identidadVisibleTrasDesplazar` — tras 1500px de scroll, ¿queda a la
 *     vista el nombre del paciente en alguna parte de la pantalla?
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-lienzo-escritorio-v15.mjs [destino]"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc12'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE = 'pac-refugio-alcantara'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
const errores = []
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()) })
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

const RUTAS = [
  ['/dashboard', 'hoy'],
  ['/pacientes', 'pacientes'],
  [`/expediente/${PACIENTE}`, 'expediente'],
  [`/consulta/${PACIENTE}`, 'consulta'],
]

const medidas = {}
for (const [ruta, etiqueta] of RUTAS) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)

  const m = await page.evaluate(() => {
    const principal = document.querySelector('main') ?? document.body
    // La columna de trabajo: el hijo más ancho con un maxWidth declarado, que
    // es como este producto acota su contenido hoy.
    const acotados = [...principal.querySelectorAll('div')]
      .filter(d => {
        const mw = getComputedStyle(d).maxWidth
        return mw && mw !== 'none' && parseFloat(mw) > 400
      })
      .map(d => Math.round(d.getBoundingClientRect().width))
    return {
      anchoDelViewport: window.innerWidth,
      anchoDelMain: Math.round(principal.getBoundingClientRect().width),
      anchoDeLaColumna: acotados.length ? Math.max(...acotados) : null,
      alturaDelDocumento: Math.round(document.documentElement.scrollHeight),
    }
  })

  /**
   * ¿SOBREVIVE LA IDENTIDAD AL DESPLAZAMIENTO?
   *
   * OJO CON QUÉ SE DESPLAZA. La primera versión hacía `window.scrollTo(0,1500)`
   * y no movía nada: en este shell el contenedor con scroll es `<main>`
   * (`overflow-y: auto`), no la ventana — el documento medía 900px, o sea el
   * viewport exacto, y el arnés informaba «la identidad sigue a la vista» sin
   * haber desplazado un píxel. Una condición que pasa porque el gesto no
   * ocurrió es peor que una que falla.
   */
  await page.evaluate(() => {
    const cont = document.querySelector('main')
    if (cont) cont.scrollTop = 1500
    window.scrollTo(0, 1500)
  })
  await page.waitForTimeout(600)
  const identidad = await page.evaluate(() => {
    const enPantalla = el => {
      const r = el.getBoundingClientRect()
      return r.height > 0 && r.top < window.innerHeight && r.bottom > 0
    }
    const marcas = [...document.querySelectorAll('.nx-ident-franja, .nx-ident, .nx-vt-paciente, .nx-ancla-nombre')]
    const visibles = marcas.filter(enPantalla)
    const cont = document.querySelector('main')
    return {
      scrollY: Math.round(window.scrollY),
      scrollDelMain: cont ? Math.round(cont.scrollTop) : null,
      altoScrollDelMain: cont ? Math.round(cont.scrollHeight) : null,
      /* El hecho DETERMINISTA, que no depende de cuánto contenido haya
         sembrado: si la franja de identidad vive fuera del contenedor que
         scrollea (o es sticky), no puede perderse. */
      posicionDeLaFranja: (() => {
        const f = document.querySelector('.nx-franja-escritorio')
        if (!f) return 'ausente'
        return `${getComputedStyle(f).position}${cont && cont.contains(f) ? ' (DENTRO del scroll)' : ' (fuera del scroll)'}`
      })(),
      marcasDeIdentidad: marcas.length,
      identidadVisibleTrasDesplazar: visibles.length > 0,
      textoVisible: visibles.map(v => (v.textContent ?? '').trim()).slice(0, 2),
    }
  })

  medidas[etiqueta] = {
    ruta, ...m, ...identidad,
    anchoDesaprovechado: m.anchoDeLaColumna != null ? m.anchoDelViewport - m.anchoDeLaColumna : null,
  }
  console.log(`  ${etiqueta.padEnd(11)} columna ${String(m.anchoDeLaColumna).padStart(4)}px de ${m.anchoDelViewport}px · doc ${m.alturaDelDocumento}px · main desplazado ${identidad.scrollDelMain}/${identidad.altoScrollDelMain}px → identidad ${identidad.identidadVisibleTrasDesplazar ? 'SIGUE a la vista ✓' : 'SE PERDIÓ ✗'} · franja: ${identidad.posicionDeLaFranja}`)
  await page.screenshot({ path: path.join(DESTINO, `${etiqueta}-desplazado.png`) })
}

await contexto.close()
await navegador.close()

const acta = { base: BASE, viewport: '1440x900', medidas, erroresDeConsola: errores }
fs.writeFileSync(path.join(DESTINO, `medicion-${process.env.ETIQUETA || 'baseline'}.json`), JSON.stringify(acta, null, 2))
console.log(`\nacta: ${path.join(DESTINO, `medicion-${process.env.ETIQUETA || 'baseline'}.json`)}`)
