/**
 * Capturas del golden flow AUTENTICADO — arnés V10 (§33, §39, §47 salidas 2/11).
 *
 * Recorre las pantallas críticas de Practice con la sesión del médico sintético
 * (sembrado por `sembrar-sintetico.mjs` en los emuladores) y captura cada una en
 * los cuatro anchos que exige la directiva: 1440×900, 1024×768, 768×1024 y
 * 390×844.
 *
 * Además corre axe-core (si está disponible vía CDN local no hay — se inyecta
 * desde node_modules si existe) — la línea base de accesibilidad se toma en un
 * paso separado para no mezclar responsabilidades.
 *
 * Requiere: app corriendo en BASE_URL (default http://localhost:3000) con
 * NEXT_PUBLIC_FIREBASE_EMULATORS=1, y emuladores sembrados.
 *
 * Uso: node tests/visual/capturar-golden-flow.mjs [directorio-salida]
 */
import { chromium } from '@playwright/test'
import { mkdirSync, existsSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const SALIDA = process.argv[2] || 'docs/design/capturas/golden-flow'
const CRED = { email: 'medico@sintetico.test', password: 'Captura-V10-Sintetica' }

const VIEWPORTS = [
  { nombre: '1440x900', width: 1440, height: 900 },
  { nombre: '1024x768', width: 1024, height: 768 },
  { nombre: '768x1024', width: 768, height: 1024 },
  { nombre: '390x844', width: 390, height: 844, movil: true },
]

// Pantallas del golden flow (Practice). El nombre es el del archivo.
const PANTALLAS = [
  { nombre: '01-landing', ruta: '/', publica: true },
  { nombre: '02-login', ruta: '/login', publica: true },
  { nombre: '03-hoy', ruta: '/dashboard' },
  { nombre: '04-calendario', ruta: '/calendario' },
  { nombre: '05-citas', ruta: '/citas' },
  { nombre: '06-pacientes', ruta: '/pacientes' },
  { nombre: '07-expediente', ruta: '/expediente/pac-sint-01' },
  { nombre: '08-consulta', ruta: '/consulta/pac-sint-03' },
  { nombre: '09-pendientes', ruta: '/pendientes' },
]

mkdirSync(SALIDA, { recursive: true })
// CHROMIUM: si el navegador que pide esta versión de Playwright no está
// descargado, se usa el del sistema (CHROMIUM_PATH o /opt/pw-browsers/chromium).
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH || existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' }
    : {},
)

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: !!vp.movil,
    hasTouch: !!vp.movil,
    deviceScaleFactor: vp.movil ? 3 : 1,
    reducedMotion: 'reduce', // capturas deterministas (§39)
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)) })

  const capturar = async (p) => {
    await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500) // onSnapshot: dejar llegar los datos
    await page.screenshot({ path: `${SALIDA}/${p.nombre}--${vp.nombre}.png` })
    console.log(`✓ ${p.nombre} @ ${vp.nombre}`)
  }

  // 1) Públicas ANTES de iniciar sesión — /login redirige al dashboard si ya
  //    hay sesión, y la captura saldría de la pantalla equivocada.
  for (const p of PANTALLAS.filter(p => p.publica)) await capturar(p)

  // 2) Sesión: login una vez por contexto.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#correo-electronico', CRED.email)
  await page.fill('#contrasena', CRED.password)
  await Promise.all([
    page.waitForURL(/dashboard|citas|calendario/, { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)

  // 3) El tour de bienvenida sale UNA vez por médico y taparía cada pantalla:
  //    se salta por su botón real (no borrando su clave — así también se
  //    comprueba que el botón funciona).
  const saltar = page.getByRole('button', { name: 'Saltar' }).first()
  await saltar.waitFor({ state: 'visible', timeout: 6000 })
    .then(() => saltar.click())
    .then(() => page.waitForTimeout(400))
    .catch(() => {}) // sin tour (ya visto en este contexto): seguir


  for (const p of PANTALLAS.filter(p => !p.publica)) await capturar(p)

  if (errores.length) {
    console.log(`⚠ consola con errores en ${vp.nombre}:`)
    for (const e of [...new Set(errores)].slice(0, 10)) console.log(`   ${e}`)
  }
  await ctx.close()
}

await browser.close()
console.log(`Capturas en ${SALIDA}`)
