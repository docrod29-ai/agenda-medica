#!/usr/bin/env node
/**
 * CAPTURAS DEL GOLDEN FLOW — V10 §33/§39.
 *
 * Corre DENTRO del arnés (emuladores arriba + siembra hecha + `next dev` en
 * :3000). Inicia sesión por la interfaz real (email/contraseña contra el
 * emulador de Auth) y captura las pantallas del golden flow en los cuatro
 * anchos de V10 §39: escritorio 1440×900, escritorio angosto 1024×768,
 * tableta 768×1024 y móvil 390×844.
 *
 * Salida: tests/visual/capturas/<pantalla>-<ancho>.png
 * Un contexto NUEVO por viewport (V10: la persistencia offline de Firestore
 * en IndexedDB contaminaría entre corridas; contexto limpio = datos frescos).
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.CAPTURA_BASE_URL ?? 'http://localhost:3000'
const SALIDA = 'tests/visual/capturas'
const EMAIL = 'medico@demo.nexusmed.test'
const PASSWORD = 'NexusDemo-2026'

const VIEWPORTS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '1024', width: 1024, height: 768 },
  { nombre: '768',  width: 768,  height: 1024 },
  { nombre: '390',  width: 390,  height: 844 },
]

const PANTALLAS = [
  { nombre: 'login',      ruta: '/login', sinSesion: true },
  { nombre: 'dashboard',  ruta: '/dashboard' },
  { nombre: 'citas',      ruta: '/citas' },
  { nombre: 'calendario', ruta: '/calendario' },
  { nombre: 'pacientes',  ruta: '/pacientes' },
  { nombre: 'expediente', ruta: '/expediente/pac-demo-001' },
  { nombre: 'consulta',   ruta: '/consulta/pac-demo-001' },
]

async function esperarQuieto(page) {
  // networkidle + margen: el layout tiene timeouts de seguridad de 8 s y las
  // suscripciones de Firestore llegan por websocket después del idle.
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)
}

async function main() {
  mkdirSync(SALIDA, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  })

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'es-MX' })
    const page = await ctx.newPage()
    const errores = []
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)) })

    // Sesión por la interfaz real (no un atajo): el login también se audita.
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
    await page.fill('input[type="email"], input[name="email"]', EMAIL)
    await page.fill('input[type="password"], input[name="password"]', PASSWORD)
    await page.screenshot({ path: `${SALIDA}/login-${vp.nombre}.png` })
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 30000 })
    await esperarQuieto(page)

    // Overlays de primera vez (contexto limpio ⇒ salen siempre): el recorrido
    // de bienvenida y el aviso de notificaciones. Se descartan para capturar
    // la pantalla de trabajo; el recorrido se captura aparte en dashboard-tour.
    if (vp.nombre === '1440') {
      await page.screenshot({ path: `${SALIDA}/dashboard-tour-${vp.nombre}.png` })
    }
    const saltar = page.getByText('Saltar', { exact: true }).first()
    if (await saltar.isVisible().catch(() => false)) await saltar.click()
    const despues = page.getByText('Después', { exact: true }).first()
    if (await despues.isVisible().catch(() => false)) await despues.click()
    await page.waitForTimeout(500)

    for (const p of PANTALLAS) {
      if (p.sinSesion) continue // login ya capturado arriba
      await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'domcontentloaded' })
      await esperarQuieto(page)
      await page.screenshot({ path: `${SALIDA}/${p.nombre}-${vp.nombre}.png` })
      console.log(`captura OK · ${p.nombre} @ ${vp.nombre}`)
    }

    if (errores.length) {
      console.log(`consola con errores @ ${vp.nombre}: ${errores.length}`)
      for (const e of [...new Set(errores)].slice(0, 5)) console.log(`  · ${e}`)
    }
    await ctx.close()
  }

  await browser.close()
  console.log('CAPTURAS COMPLETAS')
}

main().catch((e) => { console.error(e); process.exit(1) })
