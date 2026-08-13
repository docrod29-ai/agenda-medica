/**
 * VERIFICACIÓN EN NAVEGADOR REAL — RTC-06 (V15-ORIGINALITY-REDTEAM-001;
 * ORT-05 + RT-11; §40).
 *
 * Mide con getComputedStyle —no leyendo JSX— que /dashboard tiene UNA sola
 * acción primaria rellena y que es la CLÍNICA:
 *
 *   1. cero `.btn-primary` en la pantalla;
 *   2. el CTA del héroe (`.prox-hero-cta`) existe y está RELLENO (fondo
 *      opaco, no transparente);
 *   3. «Nueva cita» del header es visualmente secundaria (sin el fondo
 *      cobalto sólido del CTA);
 *   4. el saludo es kicker: el <h1> mide 15px, no 32px, y pinta en --text2;
 *   5. los «Consulta» por fila son secundarios.
 *
 * El «antes» de esta medición es el paquete del equipo rojo
 * (docs/design/capturas/v15-redteam/hoy-*.png): 7 rellenos idénticos y el
 * saludo como el texto más grande de la pantalla.
 *
 * Requiere: emuladores + siembra + build + npm start (método hermano).
 *
 * Uso:
 *   node scripts/design/capturar-hoy-una-primaria-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-hoy-una-primaria'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

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

async function medir(page) {
  return page.evaluate(() => {
    const esRelleno = (el) => {
      const bg = getComputedStyle(el).backgroundColor
      const m = bg.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/)
      if (!m) return false
      const alfa = m[4] === undefined ? 1 : Number(m[4])
      return alfa > 0.5
    }
    const hero = document.querySelector('.prox-hero-cta')
    const nuevaCita = [...document.querySelectorAll('.hoy-accion .btn')][0] ?? null
    const filas = [...document.querySelectorAll('.cita-acciones .btn')]
    const saludo = document.querySelector('h1.hoy-saludo')
    return {
      btnPrimaryEnPantalla: document.querySelectorAll('.btn-primary').length,
      heroExiste: !!hero,
      heroRelleno: hero ? esRelleno(hero) : null,
      heroTexto: hero?.textContent?.trim() ?? null,
      nuevaCitaRellena: nuevaCita ? esRelleno(nuevaCita) : null,
      nuevaCitaClases: nuevaCita?.className ?? null,
      filasRellenas: filas.filter(esRelleno).length,
      filasTotal: filas.length,
      saludoFontSize: saludo ? getComputedStyle(saludo).fontSize : null,
      saludoTexto: saludo?.textContent?.trim() ?? null,
    }
  })
}

function veredicto(r, nombre) {
  const fallos = []
  if (r.btnPrimaryEnPantalla !== 0) fallos.push(`${nombre}: quedan ${r.btnPrimaryEnPantalla} .btn-primary`)
  if (!r.heroExiste) fallos.push(`${nombre}: el héroe NOW no pintó (¿siembra sin cita futura?)`)
  if (r.heroExiste && !r.heroRelleno) fallos.push(`${nombre}: el CTA del héroe NO está relleno — se quedó sin primaria`)
  if (r.nuevaCitaRellena === true) fallos.push(`${nombre}: «Nueva cita» sigue rellena — dos primarias`)
  if (r.filasRellenas !== 0) fallos.push(`${nombre}: ${r.filasRellenas} botones de fila siguen rellenos`)
  if (r.saludoFontSize !== '15px') fallos.push(`${nombre}: el saludo mide ${r.saludoFontSize}, no 15px`)
  return fallos
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const uid = await uidDelMedico()
  const resultado = {}
  const fallos = []

  for (const [nombre, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport, deviceScaleFactor: 1, locale: 'es-MX', timezoneId: 'America/Mexico_City',
    })
    await context.addInitScript((u) => {
      try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
    }, uid)
    const page = await context.newPage()
    const erroresConsola = []
    page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
    await login(page)
    await page.waitForTimeout(1800)
    resultado[nombre] = await medir(page)
    resultado[nombre].erroresConsola = erroresConsola
    await page.screenshot({ path: path.join(DESTINO, `hoy-${nombre}--despues.png`) })
    fallos.push(...veredicto(resultado[nombre], nombre))
    await context.close()
  }

  await browser.close()
  resultado.veredicto = fallos.length ? { PASS: false, fallos } : { PASS: true }
  fs.writeFileSync(path.join(DESTINO, 'acta-hoy-una-primaria.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado.veredicto, null, 2))
  if (fallos.length) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
