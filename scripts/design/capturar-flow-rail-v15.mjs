/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-SHELL-GREYBOX-001 (§40 Real Browser
 * Requirement, §36 Visible-Progress Contract).
 *
 * Captura el FlowRail/InstrumentStrip/Operaciones ya renderizados con sesión
 * real (emuladores + siembra sintética, igual que `capturar-golden-flow.mjs`
 * de V10) — no se aprueba leyendo JSX.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo y `npm start` apuntando a los
 * emuladores (ver `docs/design/capturas/v10-truth/README.md`, mismos pasos).
 *
 * Uso:
 *   node scripts/design/capturar-flow-rail-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-shell-greybox'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const VIEWPORTS = [
  { nombre: 'desktop', width: 1440, height: 900 },
  { nombre: 'mobile', width: 390, height: 844 },
]

/** Las cuatro pantallas donde el FlowRail (o su destino /operaciones) es visible. */
const PANTALLAS = [
  { nombre: 'today-dashboard', ruta: '/dashboard' },
  { nombre: 'patient-pacientes', ruta: '/pacientes' },
  { nombre: 'work-pendientes', ruta: '/pendientes' },
  { nombre: 'operaciones', ruta: '/operaciones' },
]

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

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resumenAxe = []
  const medidas = []

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      ...(vp.nombre === 'mobile' ? { isMobile: true, hasTouch: true } : {}),
    })
    const uid = await uidDelMedico()
    await context.addInitScript((u) => {
      try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
    }, uid)
    const page = await context.newPage()
    const erroresConsola = []
    page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
    await login(page)

    for (const p of PANTALLAS) {
      await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'load' })
      await page.waitForTimeout(2000)

      // Cuenta de destinos primarios visibles en el FlowRail (sólo escritorio: en
      // móvil el rail vive en el cajón, cerrado por defecto — igual que Sidebar).
      if (vp.nombre === 'desktop') {
        const primarios = await page.evaluate(() => {
          const nav = document.querySelector('.nx-flow-rail .sidebar-nav')
          if (!nav) return null
          return [...nav.querySelectorAll('a.nav-item')].map(a => a.textContent?.trim())
        })
        medidas.push({ pantalla: p.nombre, viewport: vp.nombre, destinosFlowRail: primarios })
      }

      const archivo = path.join(DESTINO, `${p.nombre}--${vp.nombre}.png`)
      await page.screenshot({ path: archivo, fullPage: false })

      if (vp.nombre === 'desktop') {
        await page.evaluate(axeSource)
        const resultado = await page.evaluate(async () => {
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
        resumenAxe.push({ pantalla: p.nombre, ruta: p.ruta, violaciones: resultado })
      }
      console.log(`✓ ${p.nombre} @ ${vp.nombre}`)
    }
    if (erroresConsola.length) {
      fs.writeFileSync(
        path.join(DESTINO, `consola-errores--${vp.nombre}.json`),
        JSON.stringify(erroresConsola, null, 2),
      )
    }
    await context.close()
  }

  fs.writeFileSync(path.join(DESTINO, 'axe.json'), JSON.stringify(resumenAxe, null, 2))
  fs.writeFileSync(path.join(DESTINO, 'flow-rail-destinos.json'), JSON.stringify(medidas, null, 2))
  await browser.close()

  const totalViolaciones = resumenAxe.reduce((n, r) => n + r.violaciones.length, 0)
  console.log(`\nListo. ${resumenAxe.length} pantallas, ${totalViolaciones} violaciones axe (crítico/serio primero).`)
}

main().catch(e => { console.error(e); process.exit(1) })
