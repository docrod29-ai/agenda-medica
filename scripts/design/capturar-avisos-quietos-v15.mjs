/**
 * VERIFICACIÓN EN NAVEGADOR REAL — RTC-04 (V15-ORIGINALITY-REDTEAM-001,
 * registro canónico; §8.5 «nonessential admin disappears», §40 Real Browser
 * Requirement).
 *
 * Prueba que la pila de avisos administrativos del layout —el banner de la
 * prueba gratuita que el equipo rojo encontró a peso íntegro DENTRO del modo
 * encuentro, sobre la franja de alergia— DESAPARECE de verdad cuando
 * `EVENTO_GRABANDO` suena con `activo: true`, VUELVE al apagarse, y que el
 * aviso de DEGRADACIÓN (OfflineBanner) NO está en la pila: sigue apareciendo
 * aunque se esté grabando, porque quedarse sin conexión a mitad de un dictado
 * es exactamente lo que el médico necesita saber.
 *
 * Simula la señal con el mismo `CustomEvent` que dispara `avisarEscucha()`
 * (mismo evento, mismo `detail`), igual que su hermano
 * `capturar-flow-rail-quieto-v15.mjs`: la pila vive en el árbol del shell,
 * no dentro de la página que graba.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs` (la clínica sembrada es una prueba con 9 días — el
 * TrialBanner pinta), `.env.local` demo, build de producción + `npm start`.
 *
 * Uso:
 *   node scripts/design/capturar-avisos-quietos-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-avisos-quietos'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

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

/**
 * Estado real de la pila: ¿está el banner de la prueba («prueba gratuita») en
 * el DOM? ¿y el de offline? Se busca por TEXTO dentro de role=status — el
 * banner no tiene otro identificador estable, y ésa es además la forma en que
 * lo encontró el equipo rojo: leyéndolo sobre la superficie clínica.
 */
async function medir(page) {
  return page.evaluate(() => {
    const status = [...document.querySelectorAll('[role="status"]')]
    const texto = (el) => (el.textContent || '').trim()
    return {
      trialBanner: status.some(el => /prueba gratuita/i.test(texto(el))),
      offlineBanner: status.some(el => /Sin conexión/i.test(texto(el))),
      avisosStatusVisibles: status.filter(el => texto(el).length > 0).length,
    }
  })
}

const grabar = (page, activo) => page.evaluate((a) => {
  window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: a } }))
}, activo)

async function correr(context, viewportNombre) {
  const page = await context.newPage()
  const erroresConsola = []
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)

  // La superficie donde el equipo rojo encontró el defecto: el modo encuentro.
  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)

  const r = {}
  r.antesDeGrabar = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, `consulta-${viewportNombre}--antes.png`) })

  await grabar(page, true)
  await page.waitForTimeout(300)
  r.grabando = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, `consulta-${viewportNombre}--grabando.png`) })

  // Degradación DURANTE la grabación: el offline debe seguir apareciendo.
  await context.setOffline(true)
  await page.waitForTimeout(300)
  r.grabandoYOffline = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, `consulta-${viewportNombre}--grabando-offline.png`) })
  await context.setOffline(false)
  await page.waitForTimeout(300)

  await grabar(page, false)
  await page.waitForTimeout(300)
  r.alDetener = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, `consulta-${viewportNombre}--al-detener.png`) })

  r.erroresConsola = erroresConsola
  await page.close()
  return r
}

function veredicto(r) {
  const fallos = []
  if (!r.antesDeGrabar.trialBanner) fallos.push('el TrialBanner no pintaba ANTES de grabar (v972: la prueba debe ser visible)')
  if (r.grabando.trialBanner) fallos.push('el TrialBanner seguía pintado GRABANDO')
  if (!r.grabandoYOffline.offlineBanner) fallos.push('el OfflineBanner NO apareció grabando+offline (la degradación no puede callarse)')
  if (r.grabandoYOffline.trialBanner) fallos.push('el TrialBanner reapareció con el offline')
  if (!r.alDetener.trialBanner) fallos.push('el TrialBanner no VOLVIÓ al detener (§8.5 es reversible, no destructivo)')
  return fallos
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = {}
  const uid = await uidDelMedico()

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
    resultado[nombre] = await correr(context, nombre)
    await context.close()
  }

  await browser.close()

  const fallos = [
    ...veredicto(resultado.desktop).map(f => `desktop: ${f}`),
    ...veredicto(resultado.mobile).map(f => `mobile: ${f}`),
  ]
  resultado.veredicto = fallos.length ? { PASS: false, fallos } : { PASS: true }
  fs.writeFileSync(path.join(DESTINO, 'acta-avisos-quietos.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado.veredicto, null, 2))
  if (fallos.length) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
