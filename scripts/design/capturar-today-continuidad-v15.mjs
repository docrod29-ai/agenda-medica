/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-TODAY-001, zona CONTINUITY.
 *
 * Igual método que `capturar-flow-rail-v15.mjs` (emuladores + siembra
 * sintética + build de producción): login real, `/dashboard` real, captura
 * desktop y móvil, axe-core, errores de consola. No se aprueba leyendo JSX.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080) vivos, siembra de
 * `sembrar-capturas.mjs` (que ahora incluye 3 tareas_clinicas sintéticas),
 * `.env.local` demo con NEXT_PUBLIC_FIREBASE_EMULATORS=1 y `npm start`
 * apuntando a los emuladores.
 *
 * Uso: node scripts/design/capturar-today-continuidad-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-today-continuidad'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

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
  const resultado = { zonas: null, axe: {}, consola: {} }

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
    // 'networkidle' nunca llega: los listeners de Firestore mantienen la red
    // activa a propósito. Mismo criterio que capturar-flow-rail-v15.mjs.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
    // La zona CONTINUITY carga tras el efecto de tareasVivas(): esperar su
    // encabezado en vez de sólo un timeout fijo — es asíncrono, no decorativo.
    await page.waitForSelector('text=Sigue abierto de antes', { timeout: 15000 }).catch(() => null)
    await page.waitForTimeout(1500)

    if (vp.nombre === 'desktop') {
      resultado.zonas = await page.evaluate(() => {
        const texto = document.body.innerText
        return {
          NOW: /Próxima cita/.test(texto),
          NEEDS_ATTENTION: /Siguiente acción/.test(texto),
          TODAY: /Agenda de hoy/.test(texto),
          CONTINUITY: /Sigue abierto de antes/.test(texto),
          continuidadFilas: Array.from(document.querySelectorAll('[aria-label="Continuidad entre consultas"] .cita-fila'))
            .map(el => el.innerText.replace(/\s+/g, ' ').trim()),
        }
      })
    }

    await page.screenshot({ path: path.join(DESTINO, `dashboard--${vp.nombre}.png`), fullPage: true })

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
