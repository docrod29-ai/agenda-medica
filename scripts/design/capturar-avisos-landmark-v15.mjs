/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-A11Y-001, primera rebanada (§40/§36).
 *
 * La violación axe `region` más repetida de la rama (el banner de prueba
 * gratuita fuera de todo landmark, fingerprint idéntico en las mediciones de
 * las fases 3-11) muere en su origen: los tres listones del shell sin voz
 * (`TrialBanner` ×2 variantes, `ModeBanner`, `OfflineBanner`) ahora hablan
 * `role="status"`. Este arnés mide:
 *
 *   1. /dashboard escritorio 1440, tema oscuro: el banner de prueba está en el
 *      DOM con role="status", y axe reporta CERO violaciones `region`;
 *   2. mismo en tema claro;
 *   3. red CORTADA de verdad (context.setOffline): `OfflineBanner` aparece,
 *      habla role="status", y axe sigue sin `region` con él en pantalla —
 *      la variante que ninguna corrida había alcanzado a medir;
 *   4. móvil 390×844: banner visible, axe sin `region`;
 *   5. equivalencia funcional: el CTA «Activar plan →» del banner sigue
 *      llevando a /configuracion?tab=suscripcion con un clic real;
 *   6. axe COMPLETO (no sólo region) por si la voz nueva rompió otra regla
 *      (p. ej. un status no puede ser landmark duplicado) — se reporta entero.
 *
 * Uso (emuladores 8080/9099 arriba, app en :3000 con .env.local demo):
 *   node scripts/design/capturar-avisos-landmark-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-avisos-landmark'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

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

/** El banner de prueba y su voz, desde el DOM real. */
async function medirBanner(page) {
  return page.evaluate(() => {
    const status = [...document.querySelectorAll('[role="status"]')]
    const banner = status.find(el => (el.textContent || '').includes('prueba gratuita'))
    const offline = document.querySelector('.offline-banner')
    return {
      rolesStatusEnPagina: status.length,
      bannerPruebaEnDOM: !!banner,
      bannerPruebaRole: banner?.getAttribute('role') ?? null,
      offlineEnDOM: !!offline,
      offlineRole: offline?.getAttribute('role') ?? null,
      url: location.pathname,
    }
  })
}

async function axeScan(page) {
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, nodes: v.nodes.length,
      targets: v.nodes.slice(0, 6).map(n => n.target.join(' ')),
    }))
  })
}

const soloRegion = (violaciones) => violaciones.filter(v => v.id === 'region')

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const uid = await uidDelMedico()
  const resultado = {}
  const erroresConsola = []

  // ── Escritorio 1440 — oscuro, claro y con la red cortada ────────────────
  const desk = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await desk.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page = await desk.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)
  await page.waitForTimeout(1200)

  resultado.oscuro = await medirBanner(page)
  resultado.axeOscuro = await axeScan(page)
  await page.screenshot({ path: path.join(DESTINO, '01-escritorio-oscuro.png') })

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(300)
  resultado.claro = await medirBanner(page)
  resultado.axeClaro = await axeScan(page)
  await page.screenshot({ path: path.join(DESTINO, '02-escritorio-claro.png') })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

  // Red cortada DE VERDAD: la variante que ningún arnés había medido.
  await desk.setOffline(true)
  await page.waitForSelector('.offline-banner', { timeout: 10000 })
  resultado.sinRed = await medirBanner(page)
  resultado.axeSinRed = await axeScan(page)
  await page.screenshot({ path: path.join(DESTINO, '03-escritorio-sin-red.png') })
  await desk.setOffline(false)
  await page.waitForTimeout(800)

  // Equivalencia funcional: el CTA del banner sigue llevando a suscripción.
  await page.locator('a', { hasText: 'Activar plan →' }).click()
  await page.waitForURL('**/configuracion**', { timeout: 15000 })
  resultado.ctaLlega = await page.evaluate(() => location.pathname + location.search)
  await desk.close()

  // ── Móvil 390×844 ───────────────────────────────────────────────────────
  const movil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await movil.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const mpage = await movil.newPage()
  mpage.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(mpage)
  await mpage.waitForTimeout(1200)
  resultado.movil = await medirBanner(mpage)
  resultado.axeMovil = await axeScan(mpage)
  await mpage.screenshot({ path: path.join(DESTINO, '04-movil.png') })
  await movil.close()
  await browser.close()

  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))

  console.log('\n── Avisos del shell en landmark, medido en navegador real ──')
  console.log('oscuro → banner prueba:', resultado.oscuro.bannerPruebaEnDOM, '· role:', resultado.oscuro.bannerPruebaRole)
  console.log('  axe region:', JSON.stringify(soloRegion(resultado.axeOscuro)), '· todas:', JSON.stringify(resultado.axeOscuro))
  console.log('claro → banner prueba:', resultado.claro.bannerPruebaEnDOM, '· role:', resultado.claro.bannerPruebaRole)
  console.log('  axe region:', JSON.stringify(soloRegion(resultado.axeClaro)))
  console.log('sin red → offline banner:', resultado.sinRed.offlineEnDOM, '· role:', resultado.sinRed.offlineRole)
  console.log('  axe region:', JSON.stringify(soloRegion(resultado.axeSinRed)), '· todas:', JSON.stringify(resultado.axeSinRed))
  console.log('CTA «Activar plan →» llega a:', resultado.ctaLlega)
  console.log('móvil → banner prueba:', resultado.movil.bannerPruebaEnDOM, '· role:', resultado.movil.bannerPruebaRole)
  console.log('  axe region:', JSON.stringify(soloRegion(resultado.axeMovil)), '· todas:', JSON.stringify(resultado.axeMovil))
  console.log('errores consola:', erroresConsola.length)

  const regiones = [
    ...soloRegion(resultado.axeOscuro), ...soloRegion(resultado.axeClaro),
    ...soloRegion(resultado.axeSinRed), ...soloRegion(resultado.axeMovil),
  ]
  if (regiones.length > 0) {
    console.error('\n✗ QUEDAN violaciones region — la rebanada no está pagada.')
    process.exit(2)
  }
  console.log('\n✓ CERO violaciones region en las cuatro mediciones.')
}

main().catch(e => { console.error(e); process.exit(1) })
