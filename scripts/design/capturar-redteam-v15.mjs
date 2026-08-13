/**
 * CAPTURAS PARA EL EQUIPO ROJO DE ORIGINALIDAD — V15-ORIGINALITY-REDTEAM-001
 * (§41, §29). §40 Real Browser Requirement: el equipo rojo NO revisa JSX,
 * revisa PANTALLAS reales con datos sintéticos sembrados.
 *
 * Captura las superficies estructuradas por V15 — Hoy, Pacientes, Patient
 * Workspace, Encounter Mode, Resultados/Cierre (Pendientes) y Operaciones —
 * en escritorio 1440 y móvil 390, tema oscuro (default) y claro, más una
 * variante GRIS (filter: grayscale(1)) por superficie: la prueba de §41
 * «diferenciación sólo-color» se juzga sobre la pantalla sin color, no
 * sobre una opinión.
 *
 * No mide estilos: entrega evidencia. Lo único que verifica es que cada
 * ruta pintó su contenido (selector ancla) y cuenta errores de consola.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-redteam-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-redteam'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
const PATIENT_ID = 'pac-catalina-ibarra'

const SUPERFICIES = [
  { nombre: 'hoy', ruta: '/dashboard', ancla: '.nx-ident, main' },
  { nombre: 'pacientes', ruta: '/pacientes', ancla: 'main' },
  { nombre: 'expediente', ruta: `/expediente/${PATIENT_ID}`, ancla: 'main' },
  { nombre: 'consulta', ruta: `/consulta/${PATIENT_ID}`, ancla: 'main' },
  { nombre: 'pendientes', ruta: '/pendientes', ancla: 'main' },
  { nombre: 'operaciones', ruta: '/operaciones', ancla: 'main' },
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

async function capturar(page, superficie, sufijo, resultado) {
  await page.goto(`${BASE}${superficie.ruta}`, { waitUntil: 'load' })
  await page.waitForSelector(superficie.ancla, { timeout: 20000 })
  // La red de emulador es local: un respiro corto asienta datos y fuentes.
  await page.waitForTimeout(1500)
  const archivo = path.join(DESTINO, `${superficie.nombre}-${sufijo}.png`)
  await page.screenshot({ path: archivo, fullPage: true })
  resultado.capturas.push(path.basename(archivo))

  // Variante GRIS de la MISMA pantalla, sin recargar: §41 pide juzgar la
  // diferenciación sin color. filter en <html> no toca layout ni jerarquía.
  await page.evaluate(() => { document.documentElement.style.filter = 'grayscale(1)' })
  const gris = path.join(DESTINO, `${superficie.nombre}-${sufijo}-gris.png`)
  await page.screenshot({ path: gris, fullPage: true })
  await page.evaluate(() => { document.documentElement.style.filter = '' })
  resultado.capturas.push(path.basename(gris))
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const uid = await uidDelMedico()
  const navegador = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = { capturas: [], erroresConsola: {}, fecha: new Date().toISOString() }

  for (const [sufijo, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['movil', { width: 390, height: 844 }],
  ]) {
    const context = await navegador.newContext({ viewport, deviceScaleFactor: 1 })
    await context.addInitScript(({ u, pushKey }) => {
      try {
        localStorage.setItem(`nexus_tour_v1_${u}`, '1')
        localStorage.setItem(pushKey, '1')
      } catch {}
    }, { u: uid, pushKey: PUSH_DISMISS_KEY })
    const page = await context.newPage()
    const errores = []
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)) })
    await login(page)

    for (const superficie of SUPERFICIES) {
      await capturar(page, superficie, sufijo, resultado)
      // El tema claro sólo en escritorio y sólo pantallas del flujo clínico:
      // el equipo rojo necesita ver los DOS temas del shell, no duplicar todo.
      if (sufijo === 'desktop' && ['hoy', 'expediente', 'consulta'].includes(superficie.nombre)) {
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
        await page.waitForTimeout(400)
        const claro = path.join(DESTINO, `${superficie.nombre}-desktop-claro.png`)
        await page.screenshot({ path: claro, fullPage: true })
        resultado.capturas.push(path.basename(claro))
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
        await page.waitForTimeout(400)
      }
    }
    resultado.erroresConsola[sufijo] = errores
    await context.close()
  }

  await navegador.close()
  fs.writeFileSync(path.join(DESTINO, 'acta.json'), JSON.stringify(resultado, null, 2))
  console.log(`Capturas: ${resultado.capturas.length} en ${DESTINO}`)
  for (const [v, e] of Object.entries(resultado.erroresConsola)) {
    console.log(`Errores de consola (${v}): ${e.length}`)
    e.slice(0, 5).forEach((t) => console.log(`  · ${t}`))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
