/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-PATIENT-WORKSPACE-001, Patient Anchor.
 *
 * Igual método que `capturar-today-continuidad-v15.mjs`: login real contra
 * los emuladores, `/expediente/[patientId]` real (paciente sintético con una
 * nota firmada y una en borrador), captura desktop + móvil, axe-core, errores
 * de consola. No se aprueba leyendo JSX.
 *
 * Uso: node scripts/design/capturar-patient-anchor-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-patient-anchor'
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

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = { ancla: null, sticky: null, axe: {}, consola: {} }

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
    await page.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
    await page.waitForSelector('.nx-patient-anchor', { timeout: 15000 }).catch(() => null)
    await page.waitForTimeout(1500)
    // Primer login del contexto: el tour de bienvenida (OnboardingTour) tapa
    // la pantalla. Se descarta para que la captura muestre el ancla, no el tour.
    await page.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)
    await page.waitForTimeout(300)

    if (vp.nombre === 'desktop') {
      resultado.ancla = await page.evaluate(() => {
        const ancla = document.querySelector('.nx-patient-anchor')
        if (!ancla) return null
        return {
          texto: ancla.innerText.replace(/\s+/g, ' ').trim(),
          hayContinuar: /Consulta sin cerrar/.test(ancla.innerText),
        }
      })
      // Verificación real de "SIEMPRE visible": se compara la posición del
      // ancla ANTES y DESPUÉS de hacer scroll dentro de <main> (el contenedor
      // de scroll real, `overflowY: auto`). Si no fuera sticky, el ancla se
      // movería hacia arriba junto con el contenido al hacer scroll — aquí se
      // comprueba que NO se mueve (no que el CSS lo DIGA).
      const antes = await page.evaluate(() => document.querySelector('.nx-patient-anchor')?.getBoundingClientRect().top ?? null)
      await page.evaluate(() => { document.querySelector('main')?.scrollBy(0, 600) })
      await page.waitForTimeout(300)
      const despues = await page.evaluate(() => document.querySelector('.nx-patient-anchor')?.getBoundingClientRect().top ?? null)
      resultado.sticky = {
        topAntesDeScroll: antes,
        topDespuesDeScroll600px: despues,
        siguePegado: antes !== null && despues !== null && Math.abs(antes - despues) < 2,
      }
    }

    await page.screenshot({ path: path.join(DESTINO, `expediente--${vp.nombre}.png`), fullPage: false })

    await page.addScriptTag({ content: axeSource })
    const axeResult = await page.evaluate(async () => await window.axe.run(document, {
      resultTypes: ['violations'],
    }))
    resultado.axe[vp.nombre] = axeResult.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
    resultado.consola[vp.nombre] = erroresConsola

    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
