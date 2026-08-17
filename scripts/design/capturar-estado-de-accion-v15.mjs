/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-FOLLOWUP-WORK-001 (Fase 7, §10),
 * primera rebanada: `/pendientes` agrupa `resto` por `estadoDeAccion`.
 *
 * Mismo método que sus hermanos de fase (`capturar-progreso-resultado-v15.mjs`,
 * `capturar-patient-anchor-v15.mjs`): emuladores Auth/Firestore reales +
 * siembra sintética (`sembrar-capturas.mjs`, que ahora incluye una receta por
 * entregar y una tarea "otra", ninguna de las dos escalando) + build de
 * producción + `npm start`.
 *
 * Mide, no supone:
 *  · los encabezados de grupo reales en el DOM, en el orden de
 *    `ORDEN_ESTADO_DE_ACCION` (sin "Vencidos", que sigue viviendo en
 *    "Requiere atención");
 *  · qué tarjeta cae bajo qué encabezado, por texto de `<strong>`, no por
 *    posición;
 *  · que "Requiere atención" sigue mostrando exactamente lo que ya mostraba
 *    (no se tocó `debeEscalar`);
 *  · axe-core sobre la pantalla con los seis grupos poblados.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080) vivos, siembra ya
 * corrida, `.env.local` demo con NEXT_PUBLIC_FIREBASE_EMULATORS=1, `npm start`
 * apuntando a los emuladores.
 *
 * Uso: node scripts/design/capturar-estado-de-accion-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-estado-de-accion'
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
  const resultado = { grupos: null, requiereAtencion: null, axe: {}, consola: {} }

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
    await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
    await page.waitForSelector('text=Espirometría de control', { timeout: 15000 }).catch(() => null)
    await page.waitForTimeout(1000)

    if (vp.nombre === 'desktop') {
      resultado.grupos = await page.evaluate(() => {
        // Cada <h2> vive dentro de su propia <section>; las tarjetas son sus
        // hermanas directas (<div>) dentro de esa misma sección — medido por
        // el DOM real, no por el código fuente.
        const secciones = Array.from(document.querySelectorAll('section'))
        return secciones.map(section => {
          const h2 = section.querySelector('h2')
          if (!h2) return null
          const encabezado = h2.textContent.trim()
          const tarjetas = Array.from(section.children)
            .filter(el => el.tagName === 'DIV')
            .map(card => card.querySelector('strong')?.textContent?.trim() ?? '(sin título)')
          return { encabezado, tarjetas }
        }).filter(Boolean)
      })
    }

    await page.screenshot({ path: path.join(DESTINO, `pendientes--${vp.nombre}.png`), fullPage: true })

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
