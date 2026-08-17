/**
 * BASELINE DE PERCEPCIÓN — V15-PERF-001, primera rebanada: MEDIR ANTES DE
 * TOCAR (§30/§43 orden 15). Este arnés no cambia nada: establece los números
 * contra los que toda rebanada de PERF se juzga.
 *
 * Qué mide, por ruta de la cadena clínica y por viewport:
 *
 *   1. TTFB / FCP / LCP — lo que el médico ESPERA mirando pantalla vacía.
 *   2. `Next.js-hydration` — el coste de que React se despierte encima del
 *      HTML ya pintado; la pantalla parece lista pero no responde.
 *   3. Long tasks (suma y cuenta, buffered) — los bloqueos de main thread
 *      que hacen que un tap "no haga nada".
 *   4. Peso REAL transferido (JS/CSS por transferSize, caché apagada por
 *      CDP) y nodos de DOM montados — el porqué de 2 y 3.
 *
 * Caché deshabilitada a propósito: el presupuesto se mide en frío, que es
 * el peor caso honesto (primera visita, SW aún sin instalar, o tras un
 * deploy que invalida chunks). Móvil corre con CPU 4× más lenta (CDP) —
 * un teléfono de consultorio no es la máquina de build.
 *
 * Uso (mismo patrón que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-perf-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-perf'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE_SEMBRADO = 'pac-refugio-alcantara'

// La cadena clínica de §4: Hoy → lista → expediente → consulta → cierre.
const RUTAS = [
  { nombre: 'hoy', ruta: '/dashboard' },
  { nombre: 'pacientes', ruta: '/pacientes' },
  { nombre: 'expediente', ruta: `/expediente/${PACIENTE_SEMBRADO}` },
  { nombre: 'consulta', ruta: `/consulta/${PACIENTE_SEMBRADO}` },
  { nombre: 'pendientes', ruta: '/pendientes' },
]

const resultado = { fecha: new Date().toISOString(), base: BASE, corridas: [] }

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  // El tour de bienvenida (por uid nuevo en cada siembra) tapa la pantalla.
  const saltar = page.locator('button:has-text("Saltar")').first()
  try {
    await saltar.waitFor({ state: 'visible', timeout: 4000 })
    await saltar.click()
    await saltar.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour esta vez */ }
}

/** Observers instalados ANTES de navegar (init script): LCP y long tasks. */
const INIT_OBSERVERS = `
  window.__perf = { lcp: null, longTasks: [], }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__perf.lcp = e.startTime
        const el = e.element
        if (el) {
          // Un DIV sin clase no identifica nada: se anota también la clase del
          // padre y el arranque del texto, para saber QUÉ pintó tan tarde.
          const clase = (n) => (n && n.className ? '.' + String(n.className).split(' ').slice(0, 2).join('.') : '')
          window.__perf.lcpElemento = (
            el.tagName + clase(el) +
            (clase(el) ? '' : ' padre:' + (el.parentElement ? el.parentElement.tagName + clase(el.parentElement) : '?')) +
            ' «' + (el.textContent || '').trim().slice(0, 40) + '»'
          ).slice(0, 120)
        } else {
          window.__perf.lcpElemento = String(e.url || '').slice(-60)
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.longTasks.push(e.duration)
    }).observe({ type: 'longtask', buffered: true })
  } catch {}
  // La CASCADA: cuándo se va el spinner de auth/clinic del layout, cuándo
  // aparece el shell (FlowRail) y cuándo llega texto de verdad (datos).
  window.__perf.hitos = {}
  const marcar = (k) => { if (!(k in window.__perf.hitos)) window.__perf.hitos[k] = Math.round(performance.now()) }
  const revisar = () => {
    const spinner = document.querySelector('svg.lucide-loader-circle, svg.lucide-loader-2')
    if (spinner) marcar('spinnerVisto')
    if (!spinner && window.__perf.hitos.spinnerVisto) marcar('spinnerFuera')
    if (document.querySelector('.flow-rail, [class*="nx-rail"], nav')) marcar('shell')
    const texto = (document.body && document.body.innerText || '').length
    if (texto > 400) marcar('texto400')
    if (texto > 1500) marcar('texto1500')
  }
  // OJO: el init script corre ANTES de que exista documentElement — observar
  // null tira TypeError y mataba todo lo que venía después (por eso la v3
  // salió con hitos vacíos). Se observa el nodo document, que siempre existe.
  new MutationObserver(revisar).observe(document, { childList: true, subtree: true, attributes: false })
  document.addEventListener('DOMContentLoaded', revisar)
`

async function medirRuta(page, ruta) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  // Colchón para hidratación + long tasks tardías; networkidle es inestable
  // con Firestore en vivo, así que se usa un settle fijo.
  await page.waitForTimeout(4500)
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    const hidratacion = performance.getEntriesByName('Next.js-hydration')[0]
    // transferSize es 0 cuando responde el service worker; encodedBodySize
    // sigue diciendo el peso real del recurso. Se reportan los dos.
    let js = 0, css = 0, jsN = 0, cssN = 0
    for (const r of performance.getEntriesByType('resource')) {
      const peso = r.transferSize || r.encodedBodySize || 0
      if (/\.js(\?|$)/.test(r.name)) { js += peso; jsN++ }
      if (/\.css(\?|$)/.test(r.name)) { css += peso; cssN++ }
    }
    const p = window.__perf || {}
    const redondo = (x) => (x == null ? null : Math.round(x))
    return {
      ttfb: redondo(nav ? nav.responseStart : null),
      fcp: redondo(fcp ? fcp.startTime : null),
      lcp: redondo(p.lcp),
      // null si el navegador/build no expone la medida — no se inventa (§40).
      hidratacionMs: redondo(hidratacion ? hidratacion.duration : null),
      medidasNext: performance.getEntriesByType('measure').map((m) => m.name).slice(0, 8),
      lcpElemento: p.lcpElemento || null,
      hitos: p.hitos || {},
      // Cuándo empieza y cuánto dura el tráfico a los emuladores (Firestore
      // :8080 / Auth :9099): si la primera petición sale tarde, la espera es
      // NUESTRA (JS/hidratación); si sale pronto y termina tarde, es transporte.
      firestore: (() => {
        const rs = performance.getEntriesByType('resource').filter((r) => r.name.includes(':8080'))
        if (!rs.length) return null
        const inicio = Math.min(...rs.map((r) => r.startTime))
        const fin = Math.max(...rs.map((r) => r.responseEnd))
        return { primeraMs: Math.round(inicio), ultimaMs: Math.round(fin), n: rs.length }
      })(),
      auth: (() => {
        const rs = performance.getEntriesByType('resource').filter((r) => r.name.includes(':9099'))
        if (!rs.length) return null
        return { primeraMs: Math.round(Math.min(...rs.map((r) => r.startTime))), n: rs.length }
      })(),
      longTasksMs: redondo((p.longTasks || []).reduce((a, b) => a + b, 0)),
      longTasksN: (p.longTasks || []).length,
      jsKB: Math.round(js / 1024),
      jsPeticiones: jsN,
      cssKB: Math.round(css / 1024),
      cssPeticiones: cssN,
      nodosDOM: document.querySelectorAll('*').length,
    }
  })
}

async function corrida(navegador, etiqueta, viewport, cpuFactor) {
  // Sin service worker: el SW de la PWA responde desde caché y todo
  // transferSize da 0 — el frío honesto (primera visita / SW recién
  // invalidado) se mide con la red de verdad.
  const contexto = await navegador.newContext({ viewport, serviceWorkers: 'block' })
  const page = await contexto.newPage()
  const cdp = await contexto.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  if (cpuFactor > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuFactor })
  await page.addInitScript(INIT_OBSERVERS)

  // El login no se mide: sólo deja la sesión puesta.
  await login(page)

  for (const { nombre, ruta } of RUTAS) {
    const m = await medirRuta(page, ruta)
    resultado.corridas.push({ corrida: etiqueta, pantalla: nombre, ruta, ...m })
    console.log(
      `  ${etiqueta} ${nombre.padEnd(11)} FCP ${String(m.fcp).padStart(5)} · LCP ${String(m.lcp).padStart(5)} [${m.lcpElemento}] · spinnerFuera ${String(m.hitos.spinnerFuera ?? '—').padStart(5)} · texto400 ${String(m.hitos.texto400 ?? '—').padStart(5)} · fs1ª ${String(m.firestore ? m.firestore.primeraMs : '—').padStart(5)} fsFin ${String(m.firestore ? m.firestore.ultimaMs : '—').padStart(5)} · longTasks ${String(m.longTasksMs).padStart(4)} (${m.longTasksN}) · JS ${m.jsKB} KB`
    )
  }
  await contexto.close()
}

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {},
)
console.log('── escritorio 1440×900, CPU 1× ──')
await corrida(navegador, 'escritorio', { width: 1440, height: 900 }, 1)
console.log('── móvil 390×844, CPU 4× ──')
await corrida(navegador, 'movil', { width: 390, height: 844 }, 4)
await navegador.close()

fs.mkdirSync(DESTINO, { recursive: true })
fs.writeFileSync(path.join(DESTINO, 'baseline.json'), JSON.stringify(resultado, null, 2))
console.log(`\nBaseline escrito en ${path.join(DESTINO, 'baseline.json')}`)
