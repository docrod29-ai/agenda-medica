/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-MOTION-001, tercera rebanada:
 * las transiciones INLINE de los componentes TSX hablan los tokens.
 * §40 Real Browser Requirement.
 *
 * El guardián de la rebanada barre el TEXTO de los TSX; este arnés mide lo
 * que el navegador COMPUTA — porque un custom property en un style inline
 * también puede llegar roto (token inexistente → 0s) y el guardián de texto
 * no lo vería jamás. «El dato tiene que llegar», dicho en style inline:
 *
 *   1. En cada superficie medida se buscan los elementos cuyo atributo
 *      style DECLARA un token (`[style*="--mov-"]`) y se comprueba que la
 *      duración computada es EXACTAMENTE la del token declarado — un 0s
 *      delataría un var() que no resolvió.
 *   2. La curva computada es la de facto, cubic-bezier(0.16, 1, 0.3, 1).
 *   3. Bajo `reducedMotion: 'reduce'`, el apagador !important de §24 le
 *      GANA al style inline (la especificidad del inline pierde contra
 *      !important): el mismo elemento computa 0.01ms. Es LA afirmación
 *      a11y-crítica de esta rebanada — sin ella, tokenizar inline habría
 *      dejado media app fuera del apagador.
 *   4. El instrumento NO migrado (medidor de micrófono) se comprueba por
 *      AUSENCIA de token: si aparece `--mov-` en MientrasHablas, alguien lo
 *      «normalizó» — eso lo vigila el guardián de texto; aquí se comprueba
 *      que las superficies medidas no traen un 90ms/60ms tokenizado.
 *
 * Este arnés no corre axe: la rebanada no añade ni quita nodos del DOM ni
 * cambia un color computado en reposo (unifica CÓMO se declara la misma
 * transición). Sí junta errores de consola, como todos sus hermanos.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-motion-inline-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-motion-inline'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

// Comparación NUMÉRICA — el CSS computado normaliza a segundos (`0.12s`).
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
const partes = (v) => v.split(/,(?![^(]*\))/).map((s) => s.trim())
const TOKEN_MS = { rapido: 120, normal: 200, lento: 320 }

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

/**
 * En la página actual: todo elemento cuyo style inline declara un token de
 * movimiento, con su duración/curva computadas y el token que declara.
 */
function medirInline(page) {
  return page.evaluate(() => {
    const medidos = []
    for (const el of document.querySelectorAll('[style*="--mov-"]')) {
      const declarado = el.getAttribute('style') || ''
      const m = /var\(--mov-(rapido|normal|lento)\)/.exec(declarado)
      if (!m) continue
      const cs = getComputedStyle(el)
      medidos.push({
        etiqueta: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`,
        token: m[1],
        declarado: /transition:[^;]*/.exec(declarado)?.[0] ?? declarado.slice(0, 80),
        duracion: cs.transitionDuration,
        curva: cs.transitionTimingFunction,
      })
    }
    return medidos
  })
}

function evaluar(nombre, medidos, fallos) {
  if (medidos.length === 0) {
    fallos.push(`${nombre}: NINGÚN elemento con token inline encontrado — o la superficie perdió sus transiciones o el selector se rompió`)
    return { medidos: 0 }
  }
  let ok = 0
  for (const el of medidos) {
    const esperada = TOKEN_MS[el.token]
    const duraciones = partes(el.duracion).map(ms)
    // `all var(--mov-rapido)` computa UNA duración; una lista de propiedades
    // (BottomNav declara una sola) también — basta que TODA parte declarada
    // por el token principal coincida. Los shorthands mixtos no existen en
    // esta rebanada (cada sitio declara un solo token).
    const okDur = duraciones.every((d) => d === esperada)
    const okCurva = partes(el.curva).every(mismaCurva)
    if (okDur && okCurva) ok++
    else fallos.push(`${nombre} → ${el.etiqueta} (${el.token}): computa «${el.duracion}» / «${el.curva}»`)
  }
  return { medidos: medidos.length, ok }
}

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {},
)
const consola = []
const fallos = []
const resumen = {}

// ── Escritorio 1440: /pacientes (filas), /calendario (botones de vista y
// celdas del mes) — superficies con transición inline migrada ──
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
const page = await contexto.newPage()
page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text()) })
await login(page)
await page.waitForTimeout(1200)

for (const ruta of ['/pacientes', '/calendario']) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForSelector('[style*="--mov-"]', { timeout: 15000 }).catch(() => {})
  const medidos = await medirInline(page)
  resumen[`desktop ${ruta}`] = evaluar(`desktop ${ruta}`, medidos, fallos)
  resumen[`desktop ${ruta}`].detalle = medidos.slice(0, 6)
}
await page.screenshot({ path: path.join(DESTINO, 'calendario-1440.png') })

// ── Bajo reduce, el apagador !important de §24 le GANA al style inline ──
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.waitForTimeout(300)
const bajoReduce = await page.evaluate(() => {
  const el = document.querySelector('[style*="--mov-"]')
  return el ? getComputedStyle(el).transitionDuration : null
})
const apagadorGana =
  bajoReduce !== null && partes(bajoReduce).every((s) => Math.abs(ms(s) - 0.01) < 1e-6)
if (!apagadorGana)
  fallos.push(`apagador §24 sobre inline: esperado 0.01ms, computa «${bajoReduce}»`)
await page.emulateMedia({ reducedMotion: 'no-preference' })
await contexto.close()

// ── Móvil 390: el BottomNav (color rapido en el enlace, atenuado normal en
// el ícono) — la superficie inline MÁS tocada del médico en el teléfono ──
const contextoMovil = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const movil = await contextoMovil.newPage()
movil.on('console', (m) => { if (m.type() === 'error') consola.push(m.text()) })
await login(movil)
await movil.waitForTimeout(1200)
const navInferior = await movil.evaluate(() => {
  const enlaces = [...document.querySelectorAll('a[style*="--mov-rapido"]')]
  const iconos = [...document.querySelectorAll('svg[style*="--mov-normal"]')]
  const mide = (el) => {
    const cs = getComputedStyle(el)
    return { duracion: cs.transitionDuration, curva: cs.transitionTimingFunction }
  }
  return {
    enlaces: enlaces.map(mide),
    iconos: iconos.map(mide),
  }
})
if (navInferior.enlaces.length === 0)
  fallos.push('móvil BottomNav: ningún enlace con token rapido — ¿el nav inferior no montó?')
for (const e of navInferior.enlaces) {
  if (!partes(e.duracion).map(ms).every((d) => d === 120) || !partes(e.curva).every(mismaCurva))
    fallos.push(`móvil BottomNav enlace: computa «${e.duracion}» / «${e.curva}»`)
}
for (const i of navInferior.iconos) {
  if (!partes(i.duracion).map(ms).every((d) => d === 200) || !partes(i.curva).every(mismaCurva))
    fallos.push(`móvil BottomNav ícono: computa «${i.duracion}» / «${i.curva}»`)
}
resumen['movil /dashboard BottomNav'] = {
  enlaces: navInferior.enlaces.length,
  iconos: navInferior.iconos.length,
}
await movil.screenshot({ path: path.join(DESTINO, 'dashboard-390.png') })
await contextoMovil.close()

const resultado = {
  fecha: new Date().toISOString(),
  base: BASE,
  resumen,
  bajoReduce: { inlineTransitionDuration: bajoReduce, apagadorGana },
  consolaErrores: consola,
  veredicto: fallos.length === 0 ? 'PASA' : 'FALLA',
  fallos,
}
fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
console.log(JSON.stringify(resultado, null, 2))
await navegador.close()
if (fallos.length > 0) process.exit(1)
