/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-ENCOUNTER-MODE-001, §8.6 «Firmar y
 * cerrar nota» domina la fila de cierre.
 *
 * Mismo método que `capturar-patient-anchor-v15.mjs`: login real contra los
 * emuladores, `/consulta/[patientId]` real, captura desktop + móvil,
 * axe-core, errores de consola, y medición real de tamaño/posición de los
 * botones (no lectura de JSX).
 *
 * Uso: node scripts/design/capturar-firmar-domina-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-firmar-domina'
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
  const resultado = { medicion: null, axe: {}, consola: {} }

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
    await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
    // Tour de bienvenida en el primer login del contexto: se descarta si aparece.
    await page.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)
    await page.waitForSelector('button:has-text("Firmar y cerrar nota")', { timeout: 20000 }).catch(() => null)
    await page.waitForTimeout(500)

    if (vp.nombre === 'desktop') {
      resultado.medicion = await page.evaluate(() => {
        const porTexto = (t) => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(t))
        const firmar = porTexto('Firmar y cerrar nota')
        const guardar = porTexto('Guardar borrador')
        const leer = porTexto('Leer resumen')
        const descartar = porTexto('Descartar')
        if (!firmar || !guardar) return { encontrado: false }
        const cs = (el) => { const s = getComputedStyle(el); return { fontSize: s.fontSize, padding: s.padding, border: s.borderStyle === 'none' ? 'none' : s.border, boxShadow: s.boxShadow, background: s.backgroundColor } }
        const rFirmar = firmar.getBoundingClientRect()
        const rGuardar = guardar.getBoundingClientRect()
        return {
          encontrado: true,
          firmar: cs(firmar),
          guardar: cs(guardar),
          descartar: descartar ? cs(descartar) : null,
          filasSeparadas: rFirmar.top < rGuardar.top,
          altoFirmarMayorQueGuardar: rFirmar.height > rGuardar.height,
          textoLeerResumenExiste: !!leer,
        }
      })
    }

    await page.screenshot({ path: path.join(DESTINO, `consulta--${vp.nombre}.png`), fullPage: false })

    await page.addScriptTag({ content: axeSource })
    const axeResult = await page.evaluate(async () => await window.axe.run(document, {
      resultTypes: ['violations'],
    }))
    resultado.axe[vp.nombre] = axeResult.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      detalle: v.nodes.map(n => ({ target: n.target, html: n.html, resumen: n.failureSummary })),
    }))
    resultado.consola[vp.nombre] = erroresConsola

    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
