/**
 * RTC-28 — ¿el cromo se queda oscuro en tema claro, o ya no?
 *
 * El equipo rojo (RT-21) lo anotó como pregunta, no como veredicto: «riel,
 * topbar y FABs permanecen oscuros — **verificar si es decisión o resto**». Un
 * P3 así no se paga escribiendo código: se contesta midiendo.
 *
 * Qué mide, en tema CLARO y en tema OSCURO, sobre tres rutas del médico:
 *   · el fondo calculado del riel, de la topbar, de la superficie de trabajo y
 *     de los botones flotantes que queden;
 *   · su LUMINANCIA relativa, que es lo que decide si algo «está oscuro» —el
 *     nombre del token no lo dice, y el ojo sobre una captura tampoco;
 *   · si el cromo acompaña al tema o se queda anclado.
 *
 * El criterio, escrito antes de mirar: en tema claro, un elemento del cromo
 * está «oscuro» si su luminancia es MENOR que la de la superficie de trabajo
 * que tiene al lado. No se compara contra un umbral inventado: se compara con
 * el propio producto en la misma pantalla.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc28-tema-claro-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc28-tema-claro'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const RUTAS = ['/dashboard', '/pacientes', '/pendientes']

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

const medidas = {}

for (const tema of ['light', 'dark']) {
  for (const ruta of RUTAS) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.evaluate(t => {
      document.documentElement.setAttribute('data-theme', t)
      try { localStorage.setItem('nexus-tema', t) } catch { /* da igual */ }
    }, tema)
    await page.waitForTimeout(1200)

    const m = await page.evaluate(() => {
      /** Luminancia relativa (WCAG) del color de fondo pintado. */
      const lum = (css) => {
        const n = (css.match(/[\d.]+/g) ?? []).map(Number)
        if (n.length < 3) return null
        const [r, g, b] = n.slice(0, 3).map(v => {
          const c = v / 255
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        })
        return +(0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(4)
      }
      /* El fondo REAL: un elemento translúcido enseña lo que tiene detrás, así
         que se sube por los ancestros hasta encontrar un fondo opaco. */
      const fondoReal = (el) => {
        let n = el
        while (n) {
          const c = getComputedStyle(n).backgroundColor
          if (c && c !== 'rgba(0, 0, 0, 0)' && !/,\s*0\)$/.test(c)) return c
          n = n.parentElement
        }
        return getComputedStyle(document.body).backgroundColor
      }
      const uno = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const c = fondoReal(el)
        return { selector: sel, fondo: c, luminancia: lum(c) }
      }
      const flotantes = [...document.querySelectorAll('button')]
        .filter(b => ['fixed', 'absolute'].includes(getComputedStyle(b).position) && b.getBoundingClientRect().width >= 36)
        .slice(0, 3)
        .map(b => { const c = fondoReal(b); return { etiqueta: (b.getAttribute('aria-label') ?? b.title ?? 'botón').slice(0, 28), fondo: c, luminancia: lum(c) } })
      return {
        tema: document.documentElement.getAttribute('data-theme'),
        riel: uno('aside'),
        topbar: uno('header'),
        trabajo: uno('main'),
        flotantes,
      }
    })

    /* El veredicto: en claro, ¿hay cromo MÁS OSCURO que la superficie de
       trabajo que tiene al lado? Se compara con el propio producto, no con un
       umbral inventado. */
    const ref = m.trabajo?.luminancia ?? null
    const piezas = [m.riel, m.topbar, ...m.flotantes].filter(Boolean)
    m.masOscurosQueElTrabajo = ref == null ? null
      : piezas.filter(p => p.luminancia != null && p.luminancia < ref - 0.02).map(p => p.selector ?? p.etiqueta)
    medidas[`${tema}${ruta}`] = m

    console.log(
      `  ${tema.padEnd(5)} ${ruta.padEnd(12)} trabajo ${m.trabajo?.luminancia} · riel ${m.riel?.luminancia} · topbar ${m.topbar?.luminancia} · ` +
      `flotantes ${m.flotantes.map(f => f.luminancia).join('/') || '—'} · más oscuros que el trabajo: ${m.masOscurosQueElTrabajo?.join(', ') || 'ninguno'}`,
    )
    if (tema === 'light') await page.screenshot({ path: path.join(DESTINO, `claro${ruta.replace(/\//g, '-')}.png`) })
  }
}

await contexto.close()
await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de página · acta en ${path.join(DESTINO, 'medicion.json')}`)
