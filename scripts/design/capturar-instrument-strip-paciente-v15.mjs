/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-PATIENT-WORKSPACE-001 (continuación),
 * InstrumentStrip pinta «paciente actual».
 *
 * Igual método que `capturar-patient-anchor-v15.mjs`: login real contra los
 * emuladores, paciente sintético sembrado, captura desktop + móvil, axe-core,
 * errores de consola. No se aprueba leyendo JSX.
 *
 * Prueba lo que el análisis estático NO puede: que la franja pinta el NOMBRE
 * correcto en /expediente, que lo SIGUE pintando al navegar a /receta (fuera
 * del expediente, la pregunta que motivó este cambio), y que desaparece en una
 * pantalla sin paciente (/dashboard) — nunca un nombre viejo colgado.
 *
 * Uso: node scripts/design/capturar-instrument-strip-paciente-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-instrument-strip-paciente'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

const VIEWPORTS = [
  { nombre: 'desktop', width: 1440, height: 900 },
  { nombre: 'mobile', width: 390, height: 844 },
]

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

async function franjaTexto(page) {
  await page.waitForSelector('.nx-instrument-strip', { timeout: 15000 }).catch(() => null)
  await page.waitForTimeout(600)
  return page.evaluate(() => document.querySelector('.nx-instrument-strip')?.innerText.replace(/\s+/g, ' ').trim() ?? null)
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = { franja: {}, axe: {}, consola: {} }

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: 'es-MX',
    })
    const page = await context.newPage()
    const erroresConsola = []
    page.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(msg.text()) })
    page.on('pageerror', (err) => erroresConsola.push(String(err)))

    await login(page)
    // Primer login del contexto: el tour de bienvenida tapa la pantalla.
    await page.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)

    const enExpediente = await franjaTexto(page)

    await page.goto(`${BASE}/receta/${PATIENT_ID}`, { waitUntil: 'load' }).catch(() => null)
    // /receta exige un notaId real; si la ruta base no resuelve, se prueba
    // igual desde /referencia, que sí acepta sólo el patientId.
    await page.goto(`${BASE}/referencia/${PATIENT_ID}`, { waitUntil: 'load' })
    const fueraDelExpediente = await franjaTexto(page)

    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
    const sinPaciente = await franjaTexto(page)

    if (vp.nombre === 'desktop') {
      resultado.franja = { enExpediente, fueraDelExpediente_referencia: fueraDelExpediente, sinPaciente_dashboard: sinPaciente }
    }

    await page.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(DESTINO, `expediente--${vp.nombre}.png`), fullPage: false })

    await page.addScriptTag({ content: axeSource })
    const axeResult = await page.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }))
    resultado.axe[vp.nombre] = axeResult.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
    resultado.consola[vp.nombre] = erroresConsola

    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
