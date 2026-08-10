/**
 * V10 — capturas reales del golden flow con sesión autenticada (V10 §33, §39, §47).
 *
 * Presupone:
 *   1. emuladores corriendo:  npx firebase emulators:start --only auth,firestore --project demo-nexusmed-test
 *   2. siembra hecha:         node scripts/design/sembrar-emulador-v10.mjs  (con las env de emulador)
 *   3. app corriendo:         npm run dev  (con .env.local demo + NEXT_PUBLIC_FIREBASE_EMULATOR=1)
 *
 * Produce:
 *   tests/visual/capturas/<pantalla>--<viewport>.jpg
 *   tests/visual/capturas/axe-<pantalla>--<viewport>.json  (violaciones axe-core, WCAG 2.2)
 *
 * Nunca toca producción: sólo localhost. Datos 100 % sintéticos.
 */
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const OUT = path.resolve('tests/visual/capturas')
const EMAIL = 'dra.demo@nexusmed.test'
const PASSWORD = 'arnes-v10-demo'

// V10 §39: escritorio estándar, escritorio angosto, tableta, móvil común.
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900, mobile: false },
  { name: '1024x768', width: 1024, height: 768, mobile: false },
  { name: '768x1024', width: 768, height: 1024, mobile: false },
  { name: '390x844', width: 390, height: 844, mobile: true },
]

// Golden flow Practice (V10 §1): inicio → agenda → pacientes → expediente →
// consulta → pendientes. `/login` se captura sin sesión.
const SCREENS = [
  { name: 'login', path: '/login', auth: false },
  { name: 'dashboard', path: '/dashboard', auth: true },
  { name: 'calendario', path: '/calendario', auth: true },
  { name: 'citas', path: '/citas', auth: true },
  { name: 'pacientes', path: '/pacientes', auth: true },
  { name: 'expediente', path: '/expediente/pac-sintetico-01', auth: true },
  { name: 'consulta', path: '/consulta/pac-sintetico-02', auth: true },
  { name: 'pendientes', path: '/pendientes', auth: true },
]

const axeSource = readFileSync(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8')

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 45000 })
  // El tour de bienvenida sale una vez por médico (localStorage). Se salta para
  // capturar las pantallas reales; el tour se puntúa aparte si hace falta.
  // OJO: «Saltar» tiene DOS coincidencias (la X lleva aria-label="Saltar") y el
  // modo estricto de Playwright truena con el selector por nombre; Escape llama
  // al mismo cierre y no depende del markup.
  try {
    await page.getByRole('dialog', { name: 'Bienvenida a NexusMED' }).waitFor({ timeout: 6000 })
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: 'Bienvenida a NexusMED' }).waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* ya visto */ }
}

async function settle(page) {
  // Sin networkidle a secas: Firestore mantiene streams abiertos. Espera corta +
  // fuentes cargadas + un respiro para datos en vivo. La página puede navegar
  // por su cuenta a mitad de la espera (redirect de auth, HMR): se reintenta.
  for (let intento = 0; intento < 3; intento++) {
    try {
      await page.waitForLoadState('domcontentloaded')
      await page.evaluate(() => document.fonts.ready)
      break
    } catch { await page.waitForTimeout(1000) }
  }
  await page.waitForTimeout(2500)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const resumen = []

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: vp.mobile ? 3 : 1,
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    // El indicador de errores del dev-overlay de Next no es producto: fuera de
    // las capturas. Los errores de consola sí se registran, abajo.
    await page.addInitScript(() => {
      const style = document.createElement('style')
      style.textContent = 'nextjs-portal { display: none !important }'
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    })
    const consola = []
    page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text()) })
    page.on('pageerror', (e) => consola.push(`pageerror: ${e.message}`))

    let sesion = false
    for (const screen of SCREENS) {
      if (screen.auth && !sesion) { await login(page); sesion = true }
      const t0 = Date.now()
      await page.goto(`${BASE}${screen.path}`, { waitUntil: 'domcontentloaded' })
      await settle(page)
      const ms = Date.now() - t0

      const file = `${screen.name}--${vp.name}.jpg`
      await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 80, fullPage: false })
      // Página completa además, solo en los dos extremos (escritorio y móvil):
      if (vp.name === '1440x900' || vp.name === '390x844') {
        await page.screenshot({ path: path.join(OUT, `${screen.name}--${vp.name}--full.jpg`), type: 'jpeg', quality: 80, fullPage: true })
      }

      // axe-core sobre el DOM real (línea base de accesibilidad, salida 10)
      await page.evaluate(axeSource)
      const axe = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })
        return r.violations.map(v => ({
          id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.length,
          ejemplos: v.nodes.slice(0, 3).map(n => n.target.join(' ')),
        }))
      })
      writeFileSync(path.join(OUT, `axe-${screen.name}--${vp.name}.json`), JSON.stringify(axe, null, 2))

      resumen.push({ screen: screen.name, viewport: vp.name, ms, axeViolaciones: axe.length, erroresConsola: consola.splice(0).slice(0, 5) })
      console.log(`✓ ${screen.name} @ ${vp.name} — ${ms}ms, axe: ${axe.length} violaciones`)
    }
    await context.close()
  }

  await browser.close()
  writeFileSync(path.join(OUT, 'resumen.json'), JSON.stringify(resumen, null, 2))
  console.log(`\nListo: ${resumen.length} capturas en ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
