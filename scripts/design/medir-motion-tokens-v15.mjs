/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-MOTION-001, primera rebanada:
 * las transiciones de globals.css hablan los tokens de movimiento.
 * §40 Real Browser Requirement.
 *
 * El guardián de la rebanada barre el TEXTO de la hoja; este arnés mide lo
 * que el navegador COMPUTA — porque un `var(--mov-rapido)` mal escrito
 * (token inexistente, cascada rota) computa `0s` y el guardián de texto no
 * lo vería jamás. «El dato tiene que llegar», dicho en CSS custom
 * properties:
 *
 *   1. En /dashboard (médico logueado), getComputedStyle de los
 *      representantes de cada papel — comparado contra la CASCADA REAL, no
 *      contra la regla base: el cross-fade de tema (regla agrupada posterior)
 *      reemplaza el shorthand de .btn/.nav-item/.tab con su papel normal ×3,
 *      y el fade del toggle sombrea su propio shorthand (las dos cosas son
 *      PREEXISTENTES — ya eran así con las duraciones a mano; anotadas para
 *      la siguiente rebanada). La duración computada tiene que ser
 *      EXACTAMENTE la del token que la cascada deja ganar — un 0s delataría
 *      un var() roto.
 *   2. La curva computada tiene que ser cubic-bezier(0.16, 1, 0.3, 1) —
 *      la curva de facto adoptada por el token — en todos los medidos.
 *   3. Bajo `reducedMotion: 'reduce'`, el apagador de §24 GANA: el mismo
 *      .btn computa transition-duration 0.01ms, no la escala.
 *   4. Los tokens viven en :root — se leen los cinco con getComputedStyle
 *      del documentElement (presion/rapido/normal/lento/nada).
 *
 * Este arnés no corre axe: la rebanada no añade ni quita un solo nodo del
 * DOM ni cambia un color (sólo unifica CÓMO se declara la misma
 * transición); la sexta rebanada de A11Y midió axe de /pendientes y el
 * shell hace un día sin cambios de DOM desde entonces.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-motion-tokens-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-motion-tokens'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

function leerMediciones(page) {
  return page.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement)
    const tokens = {
      presion: raiz.getPropertyValue('--mov-presion').trim(),
      rapido: raiz.getPropertyValue('--mov-rapido').trim(),
      normal: raiz.getPropertyValue('--mov-normal').trim(),
      lento: raiz.getPropertyValue('--mov-lento').trim(),
      nada: raiz.getPropertyValue('--mov-nada').trim(),
      curva: raiz.getPropertyValue('--mov-curva').trim(),
    }
    const mide = (selector) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const cs = getComputedStyle(el)
      return { duracion: cs.transitionDuration, curva: cs.transitionTimingFunction }
    }
    return {
      tokens,
      btn: mide('.btn'),
      navItem: mide('.nav-item'),
      themeToggle: mide('.theme-toggle'),
      themeToggleSvg: mide('.theme-toggle svg'),
      tab: mide('.tab'),
      citaFila: mide('.cita-fila'),
    }
  })
}

// La comparación es NUMÉRICA: el CSS de producción minifica (`120ms` →
// `.12s`, `cubic-bezier(0.16,…)` → `(.16,…)`) y una comparación de cadenas
// da falsos fallos — le pasó a la primera corrida de este arnés.
const ms = (v) => {
  const m = /^([\d.e-]+)(m?s)$/.exec(v.trim())
  return m ? parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1) : NaN
}
const curvaNums = (v) => (/cubic-bezier\(([^)]*)\)/.exec(v)?.[1] ?? '').split(',').map(Number)
const CURVA_ESPERADA = [0.16, 1, 0.3, 1]
const mismaCurva = (v) => {
  const n = curvaNums(v)
  return n.length === 4 && n.every((x, i) => Math.abs(x - CURVA_ESPERADA[i]) < 1e-9)
}
// Separa listas por comas de PRIMER nivel (las de dentro de cubic-bezier no).
const partes = (v) => v.split(/,(?![^(]*\))/).map((s) => s.trim())

// Notas de cascada PREEXISTENTES (no de esta rebanada, verificadas contra el
// árbol previo — la regla agrupada del cross-fade de tema `html, body, .card,
// …, .btn, .nav-item, .tab, .input, …` viene DESPUÉS de las reglas base y las
// reemplaza con sus 3 propiedades a 200ms; ya era así con las duraciones a
// mano): .btn y .nav-item computan el papel normal ×3 por esa regla, y
// .theme-toggle computa el fade rapido que sombrea su propio shorthand.
// Hallazgo anotado en el estado para la siguiente rebanada de MOTION-001.
const esperado = {
  btn: { duracionMs: 200, n: 3, papel: 'normal ×3 (cross-fade de tema — cascada preexistente)' },
  navItem: { duracionMs: 200, n: 3, papel: 'normal ×3 (cross-fade de tema — cascada preexistente)' },
  themeToggle: { duracionMs: 120, n: 1, papel: 'rapido (fade que sombrea al shorthand — preexistente)' },
  themeToggleSvg: { duracionMs: 320, n: 1, papel: 'lento' },
  tab: { duracionMs: 200, n: 3, papel: 'normal ×3 (cross-fade de tema — cascada preexistente)' },
  citaFila: { duracionMs: 120, n: 1, papel: 'rapido' },
}

fs.mkdirSync(DESTINO, { recursive: true })
// Mismo patrón que capturar-acento-en-el-shell-v15: el contenedor trae el
// Chromium del sistema en /opt/pw-browsers y la versión pineada de
// @playwright/test puede esperar otra revisión — se lanza el que existe.
const navegador = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {},
)
const consola = []
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: false })
const page = await contexto.newPage()
page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text()) })

await login(page)
await page.waitForTimeout(1500)

// ── 1-2: sin preferencia, cada papel computa su token y la curva de facto ──
await page.emulateMedia({ reducedMotion: 'no-preference' })
const sinPreferencia = await leerMediciones(page)

const fallos = []
const tokensEsperados = { presion: 80, rapido: 120, normal: 200, lento: 320, nada: 0 }
for (const [k, v] of Object.entries(tokensEsperados)) {
  if (ms(sinPreferencia.tokens[k]) !== v) fallos.push(`token --mov-${k}: esperado ${v}ms, computa «${sinPreferencia.tokens[k]}»`)
}
if (!mismaCurva(sinPreferencia.tokens.curva))
  fallos.push(`token --mov-curva: esperado cubic-bezier(${CURVA_ESPERADA}), computa «${sinPreferencia.tokens.curva}»`)

const verificados = {}
for (const [nombre, exp] of Object.entries(esperado)) {
  const medido = sinPreferencia[nombre]
  if (!medido) { verificados[nombre] = 'AUSENTE en /dashboard (no concluyente aquí)'; continue }
  const duraciones = partes(medido.duracion).map(ms)
  const curvas = partes(medido.curva)
  const okDur = duraciones.length === exp.n && duraciones.every((d) => d === exp.duracionMs)
  const okCurva = curvas.every(mismaCurva)
  verificados[nombre] = { ...medido, papel: exp.papel, okDur, okCurva }
  if (!okDur) fallos.push(`${nombre}: esperado ${exp.duracionMs}ms ×${exp.n} (${exp.papel}), computa «${medido.duracion}»`)
  if (!okCurva) fallos.push(`${nombre}: curva esperada cubic-bezier(${CURVA_ESPERADA}), computa «${medido.curva}»`)
}

await page.screenshot({ path: path.join(DESTINO, 'dashboard-tokens-1440.png'), fullPage: false })

// ── 3: bajo reduce, el apagador de §24 GANA a la escala entera ──
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.waitForTimeout(300)
const bajoReduce = await page.evaluate(() => {
  const btn = document.querySelector('.btn')
  return btn ? getComputedStyle(btn).transitionDuration : null
})
const apagadorGana = bajoReduce !== null && partes(bajoReduce).every((s) => Math.abs(ms(s) - 0.01) < 1e-6)
if (!apagadorGana) fallos.push(`apagador §24: esperado 0.01ms en todo, computa «${bajoReduce}»`)

const resultado = {
  fecha: new Date().toISOString(),
  base: BASE,
  tokens: sinPreferencia.tokens,
  verificados,
  bajoReduce: { btnTransitionDuration: bajoReduce, apagadorGana },
  consolaErrores: consola,
  veredicto: fallos.length === 0 ? 'PASA' : 'FALLA',
  fallos,
}
fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
console.log(JSON.stringify(resultado, null, 2))
await navegador.close()
if (fallos.length > 0) process.exit(1)
