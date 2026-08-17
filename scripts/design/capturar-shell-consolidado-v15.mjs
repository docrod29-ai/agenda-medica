/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-MOBILE-001, tercera rebanada (§40/§36).
 *
 * Contra la radiografía de `medir-trabajos-moviles-v15.mjs` (la línea base de
 * esta rebanada), prueba en móvil 390×844 que:
 *   1. el shell ya NO apila topbar + franja: la franja de fila propia no se
 *      pinta y su contenido vive DENTRO de la topbar (una fila);
 *   2. «Ausculta» aparece UNA vez en el shell (antes: 2);
 *   3. el shell fijo bajó de 135px (medido antes) — meta ~105px;
 *   4. el enlace del paciente en la topbar mide ≥44px de alto (antes 141×18)
 *      y PULSARLO aterriza en el expediente — los dos lados del enlace;
 *   5. grabando, la topbar enseña el contador mm:ss (misma señal, otra fila);
 *   6. la paleta abierta NO enseña las pistas de teclado (⌘K) en móvil;
 *   7. axe sin violaciones nuevas;
 * y en escritorio 1440 que NADA cambió: franja de fila propia visible con
 * clínica + paciente, topbar oculta, pistas de teclado visibles en la paleta.
 *
 * Uso: node scripts/design/capturar-shell-consolidado-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-shell-consolidado'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

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

async function medirShell(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0
    const topbar = q('.mobile-topbar')
    const franjaFila = q('.nx-instrument-strip')
    const franjaTopbar = q('.nx-instrument-strip-topbar')
    const bottom = q('.bottom-nav-wrap')
    const alturas = {
      topbar: vis(topbar) ? Math.round(topbar.getBoundingClientRect().height) : 0,
      franjaFila: vis(franjaFila) ? Math.round(franjaFila.getBoundingClientRect().height) : 0,
      bottomNav: vis(bottom) ? Math.round(bottom.getBoundingClientRect().height) : 0,
    }
    // Sólo texto VISIBLE: la franja de fila sigue en el DOM (display:none en
    // móvil) y contar su texto oculto daría un falso duplicado.
    const textoShell = [topbar, franjaFila].filter(el => vis(el)).map(el => el.textContent || '').join(' ')
    const linkPaciente = franjaTopbar?.querySelector('a') ?? null
    const rectLink = linkPaciente?.getBoundingClientRect() ?? null
    return {
      alturas,
      shellPxTotal: alturas.topbar + alturas.franjaFila + alturas.bottomNav,
      franjaFilaVisible: vis(franjaFila),
      franjaTopbarVisible: vis(franjaTopbar),
      auscultaVecesEnShell: (textoShell.match(/Ausculta/g) || []).length,
      linkPaciente: rectLink
        ? { texto: linkPaciente.textContent?.trim(), alto: Math.round(rectLink.height), ancho: Math.round(rectLink.width) }
        : null,
      contadorGrabando: franjaTopbar?.textContent?.match(/\d+:\d{2}/)?.[0] ?? franjaFila?.textContent?.match(/\d+:\d{2}/)?.[0] ?? null,
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
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target?.join(' ') ?? '' }))
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

  // ── Móvil 390×844 ─────────────────────────────────────────────────────────
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await ctx.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)
  await page.waitForTimeout(1500)

  // 1-3. Dashboard: shell de una fila, Ausculta ×1, altura total
  resultado.dashboard = await medirShell(page)
  await page.screenshot({ path: path.join(DESTINO, 'dashboard--movil.png') })

  // 4. Consulta: el paciente en la topbar, ≥44px, y el tap aterriza en expediente
  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  resultado.consulta = await medirShell(page)
  await page.screenshot({ path: path.join(DESTINO, 'consulta--movil.png') })
  const link = page.locator('.nx-instrument-strip-topbar a')
  if (await link.count()) {
    await link.tap()
    await page.waitForURL(`**/expediente/${PATIENT_ID}**`, { timeout: 15000 })
    resultado.tapPacienteAterriza = new URL(page.url()).pathname === `/expediente/${PATIENT_ID}`
  }
  await page.waitForTimeout(1200)

  // 5. Grabando: el contador aparece en la topbar
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: true } }))
  })
  await page.waitForTimeout(1600)
  resultado.grabando = await medirShell(page)
  await page.screenshot({ path: path.join(DESTINO, 'expediente--grabando-movil.png') })
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: false } }))
  })
  await page.waitForTimeout(400)

  // 6. Paleta: pistas de teclado ocultas en móvil
  await page.tap('button[aria-label="Buscar paciente o acción"]')
  await page.locator('input[placeholder*="Buscar paciente"]').waitFor({ state: 'visible', timeout: 8000 })
  resultado.pistasTecladoMovil = await page.evaluate(() => {
    const pie = document.querySelector('.nx-pista-teclado')
    return pie ? getComputedStyle(pie).display !== 'none' : null
  })
  await page.screenshot({ path: path.join(DESTINO, 'paleta--movil.png') })
  await page.keyboard.press('Escape')

  // 7. Axe en expediente (pantalla con paciente en topbar)
  resultado.axeExpediente = await correrAxe(page)
  await ctx.close()

  // ── Escritorio 1440: nada cambió ──────────────────────────────────────────
  const ctx2 = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await ctx2.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page2 = await ctx2.newPage()
  await login(page2)
  await page2.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
  await page2.waitForTimeout(2000)
  resultado.escritorio = await medirShell(page2)
  // Pistas de teclado SÍ visibles en la paleta de escritorio
  await page2.keyboard.press('Control+k')
  await page2.locator('input[placeholder*="Buscar paciente"]').waitFor({ state: 'visible', timeout: 8000 })
  resultado.pistasTecladoEscritorio = await page2.evaluate(() => {
    const pie = document.querySelector('.nx-pista-teclado')
    return pie ? getComputedStyle(pie).display !== 'none' : null
  })
  await page2.screenshot({ path: path.join(DESTINO, 'expediente--escritorio.png') })
  await ctx2.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log('dashboard:', JSON.stringify(resultado.dashboard))
  console.log('consulta:', JSON.stringify(resultado.consulta))
  console.log('tap paciente → expediente:', resultado.tapPacienteAterriza)
  console.log('grabando contador:', resultado.grabando?.contadorGrabando)
  console.log('pistas teclado móvil visibles:', resultado.pistasTecladoMovil, '· escritorio:', resultado.pistasTecladoEscritorio)
  console.log('axe expediente:', resultado.axeExpediente?.length, JSON.stringify(resultado.axeExpediente))
  console.log('escritorio:', JSON.stringify(resultado.escritorio))
  console.log('errores consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
