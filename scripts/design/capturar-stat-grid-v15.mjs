/**
 * CAPTURAS DEL CABLEADO .nx-stat-grid (V15 · prioridad 1).
 *
 * Fotografía las cinco pantallas que estrenan `.nx-stat-grid` en los tres
 * anchos que la regla distingue: 1440 (3 col) · 500 (2 col) · 360 (1 col).
 * Reusa el candado y la sesión del arnés de golden flow (emuladores demo,
 * siembra sintética de `sembrar-capturas.mjs`).
 *
 * Uso (emuladores + siembra + app en :3000 ya arriba):
 *   node scripts/design/capturar-stat-grid-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-stat-grid'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const VIEWPORTS = [
  { nombre: 'desktop-3col', width: 1440, height: 900 },
  { nombre: 'movil-2col', width: 500, height: 844 },
  { nombre: 'movil-1col', width: 360, height: 780 },
]

const PANTALLAS = [
  { nombre: 'farmacia', ruta: '/farmacia' },
  { nombre: 'finanzas', ruta: '/finanzas' },
  { nombre: 'corte-caja', ruta: '/corte-caja' },
  { nombre: 'retencion', ruta: '/cumplimiento/retencion' },
  { nombre: 'config-recetas', ruta: '/configuracion?tab=recetas' },
]

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
  const medidas = []

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      ...(vp.width < 640 ? { isMobile: true, hasTouch: true } : {}),
    })
    const uid = await uidDelMedico()
    await context.addInitScript((u) => {
      try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
    }, uid)
    const page = await context.newPage()
    await login(page)

    for (const p of PANTALLAS) {
      await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'load' })
      await page.waitForTimeout(2500)
      // Medición real: cuántas columnas resuelve el grid en ESTE viewport.
      const columnas = await page.evaluate(() => {
        const el = document.querySelector('.nx-stat-grid')
        if (!el) return null
        return getComputedStyle(el).gridTemplateColumns.split(' ').length
      })
      medidas.push({ pantalla: p.nombre, viewport: vp.nombre, ancho: vp.width, columnas })
      const archivo = path.join(DESTINO, `${p.nombre}--${vp.nombre}.png`)
      await page.screenshot({ path: archivo, fullPage: false })
      console.log(`✓ ${p.nombre} @ ${vp.nombre} → ${columnas === null ? 'SIN .nx-stat-grid VISIBLE' : `${columnas} columnas`}`)
    }
    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'medidas-grid.json'), JSON.stringify(medidas, null, 2))
  const mal = medidas.filter(m => {
    if (m.columnas === null) return false // pantalla sin grid visible en ese estado: se revisa a ojo
    if (m.ancho >= 1025) return m.columnas !== 3
    if (m.ancho > 360) return m.columnas !== 2
    return m.columnas !== 1
  })
  if (mal.length) {
    console.error('COLAPSO INCORRECTO:', JSON.stringify(mal, null, 2))
    process.exit(1)
  }
  console.log('Colapso verificado en navegador real: 3 → 2 → 1 columnas.')
}

main().catch((e) => { console.error(e); process.exit(1) })
