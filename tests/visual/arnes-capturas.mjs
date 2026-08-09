/**
 * ARNÉS DE CAPTURAS V10 — golden flow autenticado contra emuladores.
 *
 * Prerrequisitos (los tres corriendo):
 *   1. firebase emulators:start --only firestore,auth --project demo-nexusmed-test
 *   2. node tests/visual/sembrar-sinteticos.mjs   (con env de emuladores)
 *   3. npm run dev                                 (con .env.local demo + NEXT_PUBLIC_FIREBASE_EMULATORS=1)
 *
 * Captura cada pantalla del golden flow en 4 anchos (V10 §39): 1440×900,
 * 1024×768, 768×1024 y 390×844. Guarda el viewport (lo que se puntúa es la
 * jerarquía visible) y un reporte de errores de consola por ruta — la regla de
 * diseño exige mirar consola y red, no sólo el pixel.
 *
 * Salidas:
 *   tests/visual/capturas/<ruta>--<ancho>.png
 *   tests/visual/capturas/reporte-consola.json
 */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// `localhost`, no `127.0.0.1`: Next 16 bloquea los recursos de dev (HMR, chunks)
// cuando el origen no coincide — la página carga el HTML y jamás hidrata.
const BASE = process.env.ARNES_BASE_URL ?? 'http://localhost:3000'
const EMAIL = 'dra.demo@nexusmed.test'
const PASSWORD = 'NexusMED-arnes-2026'
const DIR = join(dirname(fileURLToPath(import.meta.url)), 'capturas')

const VIEWPORTS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '1024', width: 1024, height: 768 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844, movil: true },
]

/** Golden flow (V10 §1): agenda → paciente → consulta → nota. */
const RUTAS = [
  { ruta: '/login', nombre: 'login', publica: true },
  { ruta: '/dashboard', nombre: 'hoy' },
  { ruta: '/citas', nombre: 'agenda' },
  { ruta: '/pacientes', nombre: 'pacientes' },
  { ruta: '/expediente/pac-sint-01', nombre: 'expediente' },
  { ruta: '/consulta/pac-sint-03', nombre: 'consulta' },
  { ruta: '/nota/pac-sint-01', nombre: 'nota' },
]

mkdirSync(DIR, { recursive: true })

const navegador = await chromium.launch({
  executablePath: process.env.ARNES_CHROMIUM ?? undefined,
  // Todo lo que toca el arnés vive en localhost; el proxy del contenedor
  // rompería el WebSocket de dev y las llamadas al emulador.
  args: ['--no-proxy-server'],
})

const reporte = []

for (const vp of VIEWPORTS) {
  const contexto = await navegador.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: !!vp.movil,
    hasTouch: !!vp.movil,
    deviceScaleFactor: vp.movil ? 3 : 1,
    locale: 'es-MX',
    timezoneId: 'America/Chihuahua',
  })
  // El arnés puntúa las pantallas de TRABAJO, no el primer arranque: el tour de
  // bienvenida y el opt-in de push se marcan como ya vistos (mismas claves que
  // escriben OnboardingTour y NotificacionesPushOptIn al descartarse).
  await contexto.addInitScript(() => {
    try {
      localStorage.setItem('nexus_tour_v1_medico-demo', '1')
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* almacenamiento no disponible: el tour saldrá y se verá en la captura */ }
  })
  const page = await contexto.newPage()
  const consola = []
  page.on('console', (m) => {
    if (m.type() === 'error') consola.push({ viewport: vp.nombre, url: page.url(), texto: m.text().slice(0, 400) })
  })
  page.on('pageerror', (e) => consola.push({ viewport: vp.nombre, url: page.url(), texto: `pageerror: ${String(e).slice(0, 400)}` }))

  // Sesión: el estado de Firebase Auth vive en IndexedDB, así que se inicia
  // sesión UNA vez por contexto (storageState no lo transporta).
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('#correo-electronico', { timeout: 30000 })
  await page.fill('#correo-electronico', EMAIL)
  await page.fill('#contrasena', PASSWORD)
  await page.screenshot({ path: join(DIR, `login--${vp.nombre}.png`) })
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })

  for (const r of RUTAS) {
    if (r.publica) continue
    // 'load', no 'networkidle': los onSnapshot de Firestore mantienen un canal
    // abierto permanente y networkidle no llega nunca.
    await page.goto(`${BASE}${r.ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: join(DIR, `${r.nombre}--${vp.nombre}.png`) })
    console.log(`✓ ${r.nombre} @ ${vp.nombre}`)
  }

  reporte.push(...consola)
  await contexto.close()
}

writeFileSync(join(DIR, 'reporte-consola.json'), JSON.stringify(reporte, null, 2))
console.log(`✓ capturas en ${DIR} · ${reporte.length} errores de consola registrados`)
await navegador.close()
