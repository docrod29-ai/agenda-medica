/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-MOBILE-001 (§40 Real Browser
 * Requirement, §36 Visible-Progress Contract).
 *
 * Prueba, en viewport móvil (390×844), que:
 *   1. la barra inferior del médico navega por la IA de V15 (Hoy · Paciente ·
 *      acción central · Seguimiento · Operaciones), no por la vieja
 *      (Inicio · Agenda · Pacientes · CRM);
 *   2. pulsar «Seguimiento» ATERRIZA de verdad en /pendientes (el otro lado
 *      del enlace, medido — regla «el dato tiene que llegar» aplicada a
 *      navegación);
 *   3. en un expediente la acción central ofrece la consulta de ESE paciente;
 *   4. al sonar `EVENTO_GRABANDO` los íconos no activos bajan a 0.4, las
 *      ETIQUETAS se quedan en opacidad 1, la acción central no se toca, y al
 *      apagarse todo vuelve;
 *   5. axe no reporta violaciones nuevas con la barra pintada (móvil).
 *
 * Simula la señal con el mismo `CustomEvent` que dispara `avisarEscucha()`;
 * no activa el micrófono real (igual que capturar-flow-rail-quieto-v15.mjs).
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`.
 *
 * Uso:
 *   node scripts/design/capturar-bottom-nav-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-bottom-nav'
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

/** Estado real de la barra: destinos, acción central, opacidades. */
async function medir(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav-wrap .bottom-nav')
    if (!nav) return { presente: false }
    const links = [...nav.querySelectorAll('a')]
    const conEtiqueta = links.map(a => {
      const spans = [...a.querySelectorAll('span')]
      const etiqueta = spans.at(-1)?.textContent?.trim() ?? a.getAttribute('aria-label') ?? ''
      const svg = a.querySelector('svg')
      return {
        etiqueta,
        href: a.getAttribute('href'),
        esActual: a.getAttribute('aria-current') === 'page',
        opacidadIcono: svg ? getComputedStyle(svg).opacity : null,
        opacidadEtiqueta: spans.at(-1) ? getComputedStyle(spans.at(-1)).opacity : null,
      }
    })
    return {
      presente: true,
      visible: getComputedStyle(nav.parentElement).display !== 'none',
      destinos: conEtiqueta,
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
  const uid = await uidDelMedico()
  const resultado = {}
  const erroresConsola = []

  // ── Móvil 390×844 ─────────────────────────────────────────────────────────
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

  // 1. La IA nueva en /dashboard
  resultado.dashboard = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, 'dashboard--movil.png'), fullPage: false })

  // 2. Pulsar «Seguimiento» aterriza en /pendientes — el otro lado del enlace
  const seguimiento = page.locator('.bottom-nav a', { hasText: 'Seguimiento' })
  await seguimiento.tap()
  await page.waitForURL('**/pendientes**', { timeout: 15000 })
  resultado.urlTrasSeguimiento = new URL(page.url()).pathname
  resultado.pendientes = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, 'pendientes--movil.png'), fullPage: false })

  // 3. En el expediente, la acción central ofrece la consulta de ESE paciente
  await page.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  resultado.expediente = await medir(page)

  // 4. Grabando: íconos no activos a 0.4, etiquetas intactas, central intacta
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: true } }))
  })
  await page.waitForTimeout(400)
  resultado.expedienteGrabando = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, 'expediente--grabando-movil.png'), fullPage: false })

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: false } }))
  })
  await page.waitForTimeout(400)
  resultado.expedienteDespues = await medir(page)

  // 5. Axe en móvil con la barra pintada (dashboard)
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.evaluate(axeSource)
  resultado.axe = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodos: v.nodes.length,
      ejemplo: v.nodes[0]?.target?.join(' ') ?? '',
    }))
  })
  await context.close()

  // ── Escritorio 1440: la barra NO debe pintarse (display:none por CSS) ─────
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
  resultado.escritorio = await medir(page2)
  await ctx2.close()

  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log('dashboard destinos:', JSON.stringify(resultado.dashboard?.destinos?.map(d => `${d.etiqueta}→${d.href}`)))
  console.log('tras Seguimiento:', resultado.urlTrasSeguimiento)
  console.log('expediente central:', JSON.stringify(resultado.expediente?.destinos?.find(d => d.etiqueta === 'Consulta' || d.etiqueta === 'Nueva cita')))
  console.log('grabando opacidades:', JSON.stringify(resultado.expedienteGrabando?.destinos?.map(d => `${d.etiqueta}:icono=${d.opacidadIcono},texto=${d.opacidadEtiqueta}`)))
  console.log('después opacidades:', JSON.stringify(resultado.expedienteDespues?.destinos?.map(d => `${d.etiqueta}:icono=${d.opacidadIcono}`)))
  console.log('escritorio barra visible:', resultado.escritorio?.visible)
  console.log('axe violaciones (móvil dashboard):', resultado.axe?.length, JSON.stringify(resultado.axe))
  console.log('errores de consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
