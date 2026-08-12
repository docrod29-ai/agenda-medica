/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-REMAINING-SCREENS-001 (quinta rebanada:
 * LA FAMILIA DE OPERACIONES HABLA EL SISTEMA). §40 Real Browser Requirement.
 *
 * Hermano de `capturar-login-registro-v15.mjs`. No siembra nada propio: el
 * médico sintético lo pone `sembrar-capturas.mjs` (arnés) y estas pantallas
 * son de cromo — no dependen de datos clínicos.
 *
 * Mide — con getComputedStyle y clic real, no leyendo JSX:
 *
 *   1. EL RIEL de /configuracion habla .nav-item: el activo computa fondo
 *      var(--s2) con texto var(--text) (NO teal-como-texto), lleva la barra
 *      de acento (::before de 3px en var(--nexus)) y declara aria-current.
 *      El borde índigo muerto rgba(61,90,254,0.3) ya no computa en nadie.
 *   2. CAMBIO DE SECCIÓN con clic real: pulsar «Horario de atención» pinta
 *      ese encabezado en el t-h2 del lienzo (equivalencia funcional).
 *   3. TEMA: la barra de acento del activo cambia con el tema (var(--nexus)
 *      computa distinto en oscuro y claro).
 *   4. /operaciones habla los roles: h1 computa 20px (t-h1), los grupos
 *      computan 10.5px uppercase (t-overline), los tiles miden ≥44 de alto,
 *      y el clic real en «Configuración» aterriza en /configuracion.
 *   5. §24 MÓVIL 390: el riel desaparece, el <select> con nombre accesible
 *      («Sección de configuración») mide ≥44, nada desborda.
 *   6. AXE en oscuro, claro y móvil de las DOS pantallas (primera medición
 *      axe de /configuracion y /operaciones en V15), failureSummary completo.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-operaciones-configuracion-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-operaciones-configuracion'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function correrAxe(page) {
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] } })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, nodos: v.nodes.length,
      targets: v.nodes.map(n => n.target.join(' ')).slice(0, 8),
      resumen: v.nodes.map(n => n.failureSummary ?? '').slice(0, 5),
    }))
  })
}

/** El riel de secciones: activo, dialecto y aria. */
async function medirRiel(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav.config-sidebar')
    if (!nav) return { encontrado: false }
    const botones = [...nav.querySelectorAll('button')]
    const activo = botones.find(b => b.classList.contains('active'))
    const inactivo = botones.find(b => !b.classList.contains('active'))
    const ca = activo ? getComputedStyle(activo) : null
    const barra = activo ? getComputedStyle(activo, '::before') : null
    const conIndigo = botones.filter(b => {
      const c = getComputedStyle(b)
      return `${c.borderColor} ${c.backgroundColor} ${c.color}`.includes('61, 90, 254')
    })
    return {
      encontrado: true,
      ariaLabel: nav.getAttribute('aria-label'),
      totalBotones: botones.length,
      todosNavItem: botones.every(b => b.classList.contains('nav-item')),
      activoTexto: activo?.textContent.trim() ?? null,
      activoAriaCurrent: activo?.getAttribute('aria-current') ?? null,
      activoFondo: ca?.backgroundColor ?? null,
      activoColor: ca?.color ?? null,
      barraAncho: barra?.width ?? null,
      barraColor: barra?.backgroundColor ?? null,
      inactivoColor: inactivo ? getComputedStyle(inactivo).color : null,
      botonesConIndigoMuerto: conIndigo.map(b => b.textContent.trim()),
      titulosDeGrupo: [...nav.querySelectorAll('.nav-section-title')].length,
    }
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

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') erroresConsola.push(m.text()) })

  // ── Login real contra el emulador ────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('#correo-electronico', { timeout: 20000 })
  await page.fill('#correo-electronico', EMAIL)
  await page.fill('#contrasena', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })

  // ── /operaciones — roles §2 y clic real ──────────────────────────────
  await page.goto(`${BASE}/operaciones`, { waitUntil: 'load' })
  await page.waitForSelector('h1', { timeout: 20000 })
  // Tour de bienvenida en el primer login del contexto: se descarta si aparece.
  await page.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)
  await page.waitForTimeout(800)

  resultado.operacionesRoles = await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    const h2 = document.querySelector('h2')
    const ch1 = getComputedStyle(h1)
    const ch2 = getComputedStyle(h2)
    const tiles = [...document.querySelectorAll('a[href^="/"]')]
      .filter(a => a.closest('section'))
    const chicos = tiles.filter(a => a.getBoundingClientRect().height < 44)
    return {
      h1Fuente: `${ch1.fontSize}/${ch1.fontWeight}`,
      grupoFuente: `${ch2.fontSize}/${ch2.fontWeight}`,
      grupoMayusculas: ch2.textTransform,
      tiles: tiles.length,
      tilesBajoTactil: chicos.map(a => a.textContent.trim()),
      primarias: [...document.querySelectorAll('.btn-primary')].map(b => b.textContent.trim()),
    }
  })
  await page.screenshot({ path: path.join(DESTINO, 'operaciones-oscuro-1440.png') })
  resultado.axeOperacionesOscuro = await correrAxe(page)

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, 'operaciones-claro-1440.png') })
  resultado.axeOperacionesClaro = await correrAxe(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(200)

  // Equivalencia: el tile de Configuración navega de verdad.
  await page.click('a[href="/configuracion"]')
  await page.waitForURL('**/configuracion**', { timeout: 20000 })
  resultado.clicTileConfiguracion = { llega: true, url: page.url() }

  // ── /configuracion — el riel habla .nav-item ─────────────────────────
  await page.waitForSelector('nav.config-sidebar', { timeout: 20000 })
  await page.waitForTimeout(800)
  resultado.rielOscuro = await medirRiel(page)
  resultado.encabezadoTab = await page.evaluate(() => {
    const h2 = document.querySelector('.config-tab-header h2')
    return h2 ? { texto: h2.textContent.trim(), clase: h2.className, fs: getComputedStyle(h2).fontSize } : null
  })
  await page.screenshot({ path: path.join(DESTINO, 'configuracion-oscuro-1440.png') })
  resultado.axeConfiguracionOscuro = await correrAxe(page)

  // Cambio de sección con clic real: el lienzo obedece.
  await page.getByRole('button', { name: 'Horario de atención' }).click()
  await page.waitForTimeout(400)
  resultado.cambioDeSeccion = await page.evaluate(() => {
    const h2 = document.querySelector('.config-tab-header h2')
    const activo = document.querySelector('nav.config-sidebar button.active')
    return {
      encabezado: h2?.textContent.trim() ?? null,
      activo: activo?.textContent.trim() ?? null,
      ariaCurrent: activo?.getAttribute('aria-current') ?? null,
    }
  })

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.rielClaro = await medirRiel(page)
  await page.screenshot({ path: path.join(DESTINO, 'configuracion-claro-1440.png') })
  resultado.axeConfiguracionClaro = await correrAxe(page)
  resultado.barraCambiaDeTema = !!resultado.rielOscuro.barraColor &&
    resultado.rielOscuro.barraColor !== resultado.rielClaro.barraColor
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await ctx.close()

  // ── MÓVIL 390 ────────────────────────────────────────────────────────
  const ctxM = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  const pm = await ctxM.newPage()
  pm.on('console', m => { if (m.type() === 'error') erroresConsola.push(`[móvil] ${m.text()}`) })
  await pm.goto(`${BASE}/login`, { waitUntil: 'load' })
  await pm.waitForSelector('#correo-electronico', { timeout: 20000 })
  await pm.fill('#correo-electronico', EMAIL)
  await pm.fill('#contrasena', PASSWORD)
  await pm.click('button[type="submit"]')
  await pm.waitForURL('**/dashboard**', { timeout: 30000 })

  await pm.goto(`${BASE}/configuracion`, { waitUntil: 'load' })
  await pm.waitForSelector('.config-mobile-select select', { timeout: 20000 })
  await pm.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)
  await pm.waitForTimeout(800)
  resultado.movilConfiguracion = await pm.evaluate(() => {
    const vw = window.innerWidth
    const nav = document.querySelector('nav.config-sidebar')
    const sel = document.querySelector('.config-mobile-select select')
    const rs = sel?.getBoundingClientRect()
    return {
      anchoDocumento: document.documentElement.scrollWidth,
      desborda: document.documentElement.scrollWidth > vw + 1,
      rielOculto: !nav || getComputedStyle(nav).display === 'none',
      selectVisible: !!rs && rs.height > 0,
      selectAlto: rs ? Math.round(rs.height) : null,
      selectAriaLabel: sel?.getAttribute('aria-label') ?? null,
    }
  })
  await pm.screenshot({ path: path.join(DESTINO, 'configuracion-390.png') })
  resultado.axeConfiguracionMovil = await correrAxe(pm)

  await pm.goto(`${BASE}/operaciones`, { waitUntil: 'load' })
  await pm.waitForSelector('h1', { timeout: 20000 })
  await pm.waitForTimeout(800)
  resultado.movilOperaciones = await pm.evaluate(() => {
    const vw = window.innerWidth
    const tiles = [...document.querySelectorAll('a[href^="/"]')].filter(a => a.closest('section'))
    const chicos = tiles.filter(a => a.getBoundingClientRect().height < 44)
    return {
      anchoDocumento: document.documentElement.scrollWidth,
      desborda: document.documentElement.scrollWidth > vw + 1,
      tiles: tiles.length,
      tilesBajoTactil: chicos.map(a => a.textContent.trim()),
    }
  })
  await pm.screenshot({ path: path.join(DESTINO, 'operaciones-390.png') })
  resultado.axeOperacionesMovil = await correrAxe(pm)
  await ctxM.close()

  await browser.close()
  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
