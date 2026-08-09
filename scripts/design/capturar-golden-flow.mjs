/**
 * CAPTURAS REALES DEL GOLDEN FLOW AUTENTICADO (V10 §33, §39, §47 salida 2).
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080) levantados, siembra de
 * `sembrar-capturas.mjs` hecha, y `next dev` en :3000 con `.env.local` demo
 * (NEXT_PUBLIC_FIREBASE_EMULATORS=1). Nada de esto toca producción.
 *
 * Además de capturar, corre axe-core en cada pantalla (salida 10 — línea base
 * de accesibilidad) y vuelca los resultados en JSON junto a las capturas.
 *
 * Uso:
 *   node scripts/design/capturar-golden-flow.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v10-truth'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

/** Anchos de V10 §39: escritorio estándar, escritorio angosto, tableta, móvil. */
const VIEWPORTS = [
  { nombre: 'desktop', width: 1440, height: 900 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'mobile', width: 390, height: 844 },
]

/** Pantallas del golden flow. `espera` = selector/texto que debe existir antes de capturar. */
const PANTALLAS = [
  { nombre: 'dashboard', ruta: '/dashboard' },
  { nombre: 'citas', ruta: '/citas' },
  { nombre: 'calendario', ruta: '/calendario' },
  { nombre: 'pacientes', ruta: '/pacientes' },
  { nombre: 'expediente', ruta: '/expediente/pac-aurelio-dominguez' },
  { nombre: 'consulta', ruta: '/consulta/pac-aurelio-dominguez' },
  { nombre: 'pendientes', ruta: '/pendientes' },
]

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

/**
 * uid del médico sembrado, vía la API REST del emulador de Auth. Sirve para
 * marcar el tour de bienvenida como visto ANTES de cargar la app (la clave de
 * OnboardingTour lleva el uid).
 */
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
  // El contenedor trae Chromium preinstalado; si la versión de playwright del
  // repo no coincide con la descargada, se lanza por ruta explícita.
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resumenAxe = []

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      ...(vp.nombre === 'mobile' ? { isMobile: true, hasTouch: true } : {}),
    })
    // El tour de bienvenida (una vez por médico) taparía todas las capturas:
    // se marca visto con la MISMA clave que escribe OnboardingTour, antes de
    // que la app cargue. No se oculta nada más: lo que salga, sale.
    const uid = await uidDelMedico()
    await context.addInitScript((u) => {
      try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
    }, uid)
    const page = await context.newPage()
    const erroresConsola = []
    page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
    await login(page)

    for (const p of PANTALLAS) {
      await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'load' })
      // Deja asentar snapshots de Firestore y transiciones.
      await page.waitForTimeout(2500)
      const archivo = path.join(DESTINO, `${p.nombre}--${vp.nombre}.png`)
      await page.screenshot({ path: archivo, fullPage: false })

      // Accesibilidad: axe una sola vez por pantalla (en escritorio).
      if (vp.nombre === 'desktop') {
        await page.evaluate(axeSource)
        const resultado = await page.evaluate(async () => {
          // eslint-disable-next-line no-undef
          const r = await axe.run(document, {
            resultTypes: ['violations'],
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
          })
          return r.violations.map(v => ({
            id: v.id, impact: v.impact, help: v.help,
            nodos: v.nodes.length,
            ejemplo: v.nodes[0]?.target?.join(' ') ?? '',
          }))
        })
        resumenAxe.push({ pantalla: p.nombre, ruta: p.ruta, violaciones: resultado })
      }
      console.log(`✓ ${p.nombre} @ ${vp.nombre}`)
    }
    if (erroresConsola.length) {
      fs.writeFileSync(
        path.join(DESTINO, `consola-errores--${vp.nombre}.json`),
        JSON.stringify(erroresConsola, null, 2),
      )
    }
    await context.close()
  }

  fs.writeFileSync(
    path.join(DESTINO, 'axe-baseline.json'),
    JSON.stringify({ capturadoEl: new Date().toISOString(), base: BASE, resultados: resumenAxe }, null, 2),
  )
  await browser.close()
  console.log(`Listo. Capturas y axe-baseline.json en ${DESTINO}/`)
}

main().catch((e) => { console.error(e); process.exit(1) })
