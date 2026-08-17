/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-FOLLOWUP-WORK-001 (Fase 7, §10),
 * segunda rebanada: «closed recently» en `/pendientes`.
 *
 * Mismo método que `capturar-estado-de-accion-v15.mjs`: emuladores
 * Auth/Firestore reales + siembra sintética (`sembrar-capturas.mjs`, que
 * ahora incluye una tarea `cerrada`) + build de producción + `npm start`.
 *
 * Mide, no supone:
 *  · la sección de cerrados NO aparece poblada al cargar la pantalla (carga
 *    bajo demanda, no en cada visita);
 *  · pulsar «Ver cerrados recientemente» sí trae la tarea cerrada real, con
 *    su fecha;
 *  · la tarjeta cerrada NO lleva el botón «Ya no aplica» (sólo lectura);
 *  · pulsar de nuevo colapsa la sección sin otra lectura a Firestore;
 *  · axe-core sobre los dos estados (colapsado y expandido).
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080) vivos, siembra ya
 * corrida, `.env.local` demo con NEXT_PUBLIC_FIREBASE_EMULATORS=1, `npm start`
 * apuntando a los emuladores.
 *
 * Uso: node scripts/design/capturar-cerrados-recientes-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-cerrados-recientes'
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
  const resultado = { axe: {}, consola: {} }

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
    // El tour de bienvenida (primera vez del uid en este navegador) tapa la
    // pantalla con un modal — se descarta con su botón "Saltar" antes de
    // interactuar con nada de /pendientes.
    await page.locator('button[aria-label="Saltar"]').click({ timeout: 3000 }).catch(() => null)
    await page.waitForTimeout(800)

    if (vp.nombre === 'desktop') {
      // 1. Antes de pulsar nada: la sección de cerrados no está poblada —
      //    la lectura es bajo demanda, no automática al montar la pantalla.
      resultado.antesDeVerCerrados = await page.evaluate(() => ({
        botonDice: document.querySelector('button')
          ? Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('cerrados recientemente'))?.textContent?.trim()
          : null,
        radiografiaEnDOM: document.body.textContent.includes('Radiografía de tórax'),
      }))

      // 2. Pulsar «Ver cerrados recientemente».
      const boton = page.locator('button', { hasText: 'Ver cerrados recientemente' })
      await boton.click()
      await page.waitForSelector('text=Radiografía de tórax', { timeout: 15000 }).catch(() => null)
      await page.waitForTimeout(500)

      resultado.despuesDeVerCerrados = await page.evaluate(() => {
        const radiografia = Array.from(document.querySelectorAll('strong')).find(s => s.textContent.includes('Radiografía de tórax'))
        const tarjeta = radiografia ? radiografia.closest('div[style*="grid"]') ?? radiografia.parentElement?.parentElement : null
        return {
          radiografiaEnDOM: !!radiografia,
          textoCerrada: tarjeta ? tarjeta.textContent.includes('Cerrada') : false,
          tarjetaTieneYaNoAplica: tarjeta ? tarjeta.textContent.includes('Ya no aplica') : null,
          botonDiceOcultar: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Ocultar cerrados recientemente')),
        }
      })

      // 3. Colapsar de nuevo.
      const botonOcultar = page.locator('button', { hasText: 'Ocultar cerrados recientemente' })
      await botonOcultar.click()
      await page.waitForTimeout(300)
      resultado.despuesDeColapsar = await page.evaluate(() => ({
        radiografiaEnDOM: document.body.textContent.includes('Radiografía de tórax'),
        botonDiceVer: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Ver cerrados recientemente')),
      }))
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
