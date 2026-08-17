/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-MOBILE-001, segunda rebanada (§40 Real
 * Browser Requirement, §36 Visible-Progress Contract).
 *
 * Prueba, en viewport móvil (390×844) de MÉDICO, que:
 *   1. la topbar NO tiene hamburguesa («Abrir menú») y SÍ tiene Buscar
 *      («Buscar paciente o acción»), con objetivo táctil ≥44×44 y pegado al
 *      borde derecho (pulgar, §22);
 *   2. pulsar Buscar ABRE la paleta de verdad, teclear un nombre y pulsar el
 *      resultado ATERRIZA en su expediente — los dos lados del enlace, medidos
 *      («el dato tiene que llegar» aplicado a navegación);
 *   3. el DOM tiene UN solo <aside aria-label="Navegación clínica principal">
 *      y NINGÚN dialog «Menú» — la raíz del landmark-unique que axe marcó en
 *      todas las corridas de esta fase;
 *   4. axe ya NO reporta landmark-unique en /dashboard ni en /expediente
 *      (era el fingerprint preexistente documentado);
 *   5. /operaciones ofrece «Cerrar sesión» y pulsarlo SALE de verdad a /login
 *      (se mide al final, cuando ya no se necesita la sesión);
 *   6. escritorio 1440: la topbar móvil no se pinta y FlowRail conserva su
 *      propio Cerrar sesión (sin cambio).
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`.
 *
 * Uso:
 *   node scripts/design/capturar-topbar-movil-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-topbar-movil'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

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

/** Estado real de la topbar + landmarks del DOM. */
async function medirShell(page) {
  return page.evaluate(() => {
    const topbar = document.querySelector('.mobile-topbar')
    const hamburguesa = document.querySelector('button[aria-label="Abrir menú"]')
    const buscar = document.querySelector('button[aria-label="Buscar paciente o acción"]')
    const asides = [...document.querySelectorAll('aside[aria-label="Navegación clínica principal"]')]
    const dialogMenu = document.querySelector('[role="dialog"][aria-label="Menú"]')
    const rectBuscar = buscar?.getBoundingClientRect() ?? null
    return {
      topbarVisible: topbar ? getComputedStyle(topbar).display !== 'none' : false,
      hamburguesaEnDOM: !!hamburguesa,
      buscarEnDOM: !!buscar,
      buscarTactil: rectBuscar ? { w: rectBuscar.width, h: rectBuscar.height } : null,
      buscarPegadoADerecha: rectBuscar ? (window.innerWidth - rectBuscar.right) <= 24 : null,
      asidesNavPrincipal: asides.length,
      dialogMenuEnDOM: !!dialogMenu,
    }
  })
}

async function correrAxe(page) {
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodos: v.nodes.length,
      ejemplo: v.nodes[0]?.target?.join(' ') ?? '',
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
  const uid = await uidDelMedico()
  const resultado = {}
  const erroresConsola = []

  // ── Móvil 390×844 (médico) ────────────────────────────────────────────────
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  })
  await context.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page = await context.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)
  await page.waitForTimeout(1500)

  // 1+3. Topbar sin hamburguesa, con Buscar; un solo aside; sin dialog Menú
  resultado.dashboard = await medirShell(page)
  await page.screenshot({ path: path.join(DESTINO, 'dashboard--movil.png'), fullPage: false })

  // 4a. Axe en /dashboard — landmark-unique era el fingerprint preexistente
  resultado.axeDashboard = await correrAxe(page)

  // 2. Buscar abre la paleta y el resultado aterriza en el expediente
  await page.tap('button[aria-label="Buscar paciente o acción"]')
  const inputPaleta = page.locator('input[placeholder*="Buscar paciente"]')
  await inputPaleta.waitFor({ state: 'visible', timeout: 8000 })
  resultado.paletaAbre = true
  await page.screenshot({ path: path.join(DESTINO, 'paleta-abierta--movil.png'), fullPage: false })
  await inputPaleta.fill('Aurelio')
  await page.waitForTimeout(900)
  await page.locator('button', { hasText: 'Aurelio' }).first().tap()
  await page.waitForURL(`**/expediente/${PATIENT_ID}**`, { timeout: 15000 })
  resultado.urlTrasBuscar = new URL(page.url()).pathname
  await page.waitForTimeout(1500)

  // 3b+4b. En el expediente: mismo shell, y axe ahí también
  resultado.expediente = await medirShell(page)
  resultado.axeExpediente = await correrAxe(page)
  await page.screenshot({ path: path.join(DESTINO, 'expediente--movil.png'), fullPage: false })

  // 5. /operaciones: Cerrar sesión existe y SALE de verdad (al final, con tap)
  await page.goto(`${BASE}/operaciones`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  // Scope a <main>: el botón de FlowRail también dice «Cerrar sesión» y está
  // en el DOM (oculto por CSS en móvil) — sin el scope, el locator lo agarra.
  const cerrar = page.locator('main button', { hasText: 'Cerrar sesión' })
  resultado.operacionesTieneCerrarSesion = (await cerrar.count()) > 0
  await page.screenshot({ path: path.join(DESTINO, 'operaciones--movil.png'), fullPage: true })
  await cerrar.first().tap()
  await page.waitForURL('**/login**', { timeout: 20000 })
  resultado.cerrarSesionAterrizaEnLogin = new URL(page.url()).pathname === '/login'
  await context.close()

  // ── Escritorio 1440: topbar móvil oculta, FlowRail con su Cerrar sesión ───
  const ctx2 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await ctx2.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page2 = await ctx2.newPage()
  await login(page2)
  await page2.waitForTimeout(1200)
  resultado.escritorio = await medirShell(page2)
  resultado.escritorioFlowRailCerrarSesion = await page2.evaluate(() => {
    const rail = document.querySelector('aside[aria-label="Navegación clínica principal"]')
    return !!rail && [...rail.querySelectorAll('button')].some(b => b.textContent?.includes('Cerrar sesión'))
  })
  await page2.screenshot({ path: path.join(DESTINO, 'dashboard--escritorio.png'), fullPage: false })
  await ctx2.close()

  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log('móvil dashboard:', JSON.stringify(resultado.dashboard))
  console.log('paleta abre:', resultado.paletaAbre, '· aterriza en:', resultado.urlTrasBuscar)
  console.log('expediente shell:', JSON.stringify(resultado.expediente))
  console.log('axe dashboard:', resultado.axeDashboard?.length, JSON.stringify(resultado.axeDashboard))
  console.log('axe expediente:', resultado.axeExpediente?.length, JSON.stringify(resultado.axeExpediente))
  console.log('operaciones cerrar sesión:', resultado.operacionesTieneCerrarSesion, '→ login:', resultado.cerrarSesionAterrizaEnLogin)
  console.log('escritorio:', JSON.stringify(resultado.escritorio), 'railLogout:', resultado.escritorioFlowRailCerrarSesion)
  console.log('errores de consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
