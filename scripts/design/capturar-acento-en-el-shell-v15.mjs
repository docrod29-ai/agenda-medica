/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-VISUAL-SYSTEM-001 (Fase 10, primera
 * rebanada: EL ACENTO ENTRA AL SHELL). §40 Real Browser Requirement.
 *
 * Mide con `getComputedStyle` — no leyendo JSX — que:
 *
 *   1. El contexto activo del FlowRail pinta barra (::before) e icono en
 *      cobalto (las reglas base de `.nav-item.active`, ya sin el override
 *      greybox).
 *   2. La categoría seleccionada del ClinicalSpine rellena en
 *      `--nexus-solido` con texto blanco.
 *   3. El indicador «Grabando» del InstrumentStrip habla cobalto — el mismo
 *      idioma que el marco perimetral — en escritorio Y en la topbar móvil.
 *   4. Nada de esto introduce violaciones axe nuevas, en tema oscuro NI en
 *      tema claro (el token cambia de hex por tema: #2AA5B5 / #12626E).
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm
 * start` (mismo método que toda la familia capturar-*-v15).
 *
 * Uso:
 *   node scripts/design/capturar-acento-en-el-shell-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-acento-en-el-shell'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'
// Clave REAL de descarte del aviso push (línea 17 de NotificacionesPushOptIn
// .tsx) — lección de la 6ª rebanada de Fase 9: los arneses previos usaban una
// clave inventada y el aviso tapaba lo que se quería medir.
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function uidDelMedico() {
  const r = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    },
  )
  const j = await r.json()
  if (!j.localId) throw new Error(`No se pudo resolver el uid: ${JSON.stringify(j)}`)
  return j.localId
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

/** Colores computados de los tres puntos de acento de esta rebanada. */
async function medirAcento(page) {
  return page.evaluate(() => {
    const activo = document.querySelector('.nx-flow-rail .nav-item.active')
    const icono = document.querySelector('.nx-flow-rail .nav-item.active .nav-icon')
    const chipSeleccionado = document.querySelector('.nx-clinical-spine button[aria-current="true"]')
    const grabando = [...document.querySelectorAll('.nx-instrument-strip span, .nx-instrument-strip-topbar span')]
      .find(s => /grabando|\d+:\d{2}/i.test(s.textContent ?? '') && s.querySelector('svg'))
    return {
      temaActual: document.documentElement.getAttribute('data-theme') ?? '(default)',
      barraActiva: activo ? getComputedStyle(activo, '::before').backgroundColor : null,
      textoActivo: activo?.textContent?.trim() ?? null,
      iconoActivo: icono ? getComputedStyle(icono).color : null,
      chipSpine: chipSeleccionado
        ? {
            texto: chipSeleccionado.textContent?.trim(),
            fondo: getComputedStyle(chipSeleccionado).backgroundColor,
            color: getComputedStyle(chipSeleccionado).color,
          }
        : null,
      indicadorGrabando: grabando
        ? { texto: grabando.textContent?.trim(), color: getComputedStyle(grabando).color }
        : null,
    }
  })
}

async function correrAxe(page) {
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodos: v.nodes.length,
      targets: v.nodes.map(n => n.target?.join(' ') ?? '').slice(0, 5),
    }))
  })
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = {}
  const erroresConsola = []

  // ── ESCRITORIO 1440 ────────────────────────────────────────────────────────
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  })
  const uid = await uidDelMedico()
  await context.addInitScript(({ u, pushKey }) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem(pushKey, '1')
    } catch { /* noop */ }
  }, { u: uid, pushKey: PUSH_DISMISS_KEY })
  const page = await context.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)

  await page.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)

  // El chip del spine sólo lleva aria-current tras un clic o scroll — clic real.
  const chip = page.locator('.nx-clinical-spine button').first()
  if (await chip.count()) await chip.click()
  await page.waitForTimeout(400)

  // Grabación simulada con el MISMO CustomEvent que dispara avisarEscucha():
  // no micrófono real — lo que se mide es el color del indicador.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: true } }))
  })
  await page.waitForTimeout(500)

  resultado.oscuro = await medirAcento(page)
  await page.screenshot({ path: path.join(DESTINO, 'expediente--oscuro-1440.png'), fullPage: false })
  resultado.axeOscuro = await correrAxe(page)

  // ── TEMA CLARO (mismo estado, mismos puntos) ───────────────────────────────
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.claro = await medirAcento(page)
  await page.screenshot({ path: path.join(DESTINO, 'expediente--claro-1440.png'), fullPage: false })
  resultado.axeClaro = await correrAxe(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

  // Apagar la grabación: el indicador debe desaparecer (freeze de conducta).
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: false } }))
  })
  await page.waitForTimeout(400)
  resultado.alApagar = await medirAcento(page)
  await context.close()

  // ── MÓVIL 390×844 (coherencia: BottomNav ya hablaba cobalto) ───────────────
  const contextMovil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  })
  await contextMovil.addInitScript(({ u, pushKey }) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem(pushKey, '1')
    } catch { /* noop */ }
  }, { u: uid, pushKey: PUSH_DISMISS_KEY })
  const movil = await contextMovil.newPage()
  movil.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(`[movil] ${m.text()}`) })
  await login(movil)
  await movil.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
  await movil.waitForTimeout(1800)
  await movil.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: true } }))
  })
  await movil.waitForTimeout(500)
  resultado.movil = await movil.evaluate(() => {
    // Scoped al BottomNav VISIBLE: un `nav a[aria-current]` a secas devuelve
    // el primer match del DOM — el FlowRail de escritorio, que en 390px está
    // display:none pero sigue en el árbol (defecto de la primera corrida de
    // este arnés: midió el link oculto y reportó var(--text)).
    const activoNav = document.querySelector('.bottom-nav-wrap a[aria-current="page"]')
    const grabandoTopbar = [...document.querySelectorAll('.nx-instrument-strip-topbar span')]
      .find(s => s.querySelector('svg'))
    return {
      bottomNavActivo: activoNav
        ? { texto: activoNav.textContent?.trim(), color: getComputedStyle(activoNav).color }
        : null,
      indicadorTopbar: grabandoTopbar
        ? { texto: grabandoTopbar.textContent?.trim(), color: getComputedStyle(grabandoTopbar).color }
        : null,
    }
  })
  await movil.screenshot({ path: path.join(DESTINO, 'expediente--movil-390.png'), fullPage: false })
  await contextMovil.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log('oscuro :', JSON.stringify(resultado.oscuro))
  console.log('claro  :', JSON.stringify(resultado.claro))
  console.log('apagar :', JSON.stringify(resultado.alApagar))
  console.log('móvil  :', JSON.stringify(resultado.movil))
  console.log('axe oscuro:', JSON.stringify(resultado.axeOscuro))
  console.log('axe claro :', JSON.stringify(resultado.axeClaro))
  console.log('errores de consola:', erroresConsola.length)
}

main().catch((e) => { console.error(e); process.exit(1) })
