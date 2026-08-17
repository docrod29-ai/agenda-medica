/**
 * MEDICIÓN — V15-ENCOUNTER-MODE-001, por qué `FlowRail.tsx` no atenúa
 * etiquetas de texto con `opacity` (ver el comentario largo en
 * `useGrabando()` de ese archivo).
 *
 * Contra el FlowRail real (con sesión y datos sintéticos, no una lectura de
 * fuente), fuerza distintos valores de `opacity` sobre los elementos
 * candidatos y corre axe real en cada uno, para encontrar el margen exacto
 * que separa "se ve atenuado" de "cae por debajo de contraste AA". Quedó
 * como evidencia reproducible, no como parte del build ni de las
 * compuertas — se corre a mano si algún día cambia la paleta de
 * `--text3`/`--s1` y hay que remedir el margen.
 *
 * Requiere el mismo entorno que `capturar-flow-rail-quieto-v15.mjs`
 * (emuladores + siembra + `npm start`).
 *
 * Uso:
 *   node scripts/design/probar-opacidad-quieta-v15.mjs
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

async function uidDelMedico() {
  const r = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }) },
  )
  const j = await r.json()
  if (!j.localId) throw new Error(`No se pudo resolver el uid: ${JSON.stringify(j)}`)
  return j.localId
}

async function correr(page, selector, valores, etiqueta) {
  for (const alpha of valores) {
    await page.evaluate(({ sel, a }) => {
      document.querySelectorAll(sel).forEach(el => { el.style.opacity = String(a) })
    }, { sel: selector, a: alpha })
    await page.evaluate(axeSource)
    const violaciones = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document.querySelector('.nx-flow-rail'), {
        resultTypes: ['violations'],
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      })
      return r.violations.map(v => ({ id: v.id, nodos: v.nodes.length }))
    })
    console.log(`${etiqueta} opacity=${alpha}:`, JSON.stringify(violaciones))
  }
}

async function main() {
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: '/opt/pw-browsers/chromium' } : {},
  )
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const uid = await uidDelMedico()
  await context.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page = await context.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  await page.goto(`${BASE}/expediente/pac-aurelio-dominguez`, { waitUntil: 'load' })
  await page.waitForTimeout(1000)

  console.log('── Texto (.nx-flow-rail-quiet-hide antes de ocultarse — mide el margen si se atenuara en vez de ocultarse) ──')
  await correr(page, '.nx-flow-rail-quiet-hide', [0.42, 0.7, 0.85, 0.9, 0.95, 1], 'texto')

  console.log('── Íconos SVG (.nx-flow-rail-quiet-icon, .nav-icon — lo que sí se atenúa) ──')
  await correr(page, '.nx-flow-rail .nx-flow-rail-quiet-icon, .nx-flow-rail .nav-icon', [0.3, 0.4, 0.5], 'icono')

  await context.close()
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
