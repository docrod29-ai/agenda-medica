/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-MOBILE-001, cuarta rebanada (§40/§36).
 *
 * «Firmar/cerrar desde el teléfono» (§22): la radiografía de
 * `medir-trabajos-moviles-v15.mjs` midió «Firmar y cerrar nota» a ~2,900px
 * de scroll a 390×844. Esta corrida añadió `CierreAlPulgar` — la barra
 * pegada al borde inferior de <main> que enseña el estado del cierre y un
 * toque lleva hasta él. Aquí se prueba COMPORTAMIENTO, no JSX:
 *
 *   1. con la nota VACÍA la barra no existe (al principio manda
 *      EmpezarAGrabar — §8.6);
 *   2. al escribir contenido real en una sección (UI real, sin siembra
 *      ad-hoc) la barra APARECE, pegada al borde inferior del área de
 *      trabajo, encima del BottomNav, con altura táctil ≥44px;
 *   3. la barra dice LA VERDAD del cierre: con la nota incompleta enseña
 *      «Aún no se puede firmar» + el MISMO motivo que el renglón junto a
 *      Firmar (una sola fuente de verdad, medida en el DOM);
 *   4. sigue pegada tras scroll a media página (sticky de verdad);
 *   5. TAP en la barra → la zona de cierre entra al viewport (Firmar
 *      visible), el foco aterriza en el ancla y la barra se esconde
 *      (IntersectionObserver) — los dos lados del viaje, medidos;
 *   6. axe con la barra visible: sin violaciones nuevas;
 *   7. escritorio 1440: la barra NO se pinta (display:none por CSS).
 *
 * Uso (emuladores 8080/9099 arriba, app en :3000 con .env.local demo):
 *   node scripts/design/capturar-cierre-al-pulgar-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-cierre-al-pulgar'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

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

/** Estado medible de la barra y del cierre, desde el DOM real. */
async function medirBarra(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight
    const barra = document.querySelector('.nx-cierre-al-pulgar')
    const btn = document.querySelector('.nx-cierre-al-pulgar-btn')
    const bottomNav = document.querySelector('.bottom-nav')
    const ancla = document.getElementById('cierre-de-la-consulta')
    const firmar = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('Firmar y cerrar nota'))
    const motivoJuntoAFirmar = document.querySelector('#cierre-de-la-consulta [role="status"]')?.textContent?.trim() ?? null

    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0

    return {
      barraEnDOM: !!barra,
      barraVisible: visible(barra),
      barraRect: rect(btn),
      barraTexto: btn?.textContent?.trim() ?? null,
      // ¿Pegada al borde inferior del área de trabajo, sin tapar el BottomNav?
      bottomNavTop: bottomNav ? Math.round(bottomNav.getBoundingClientRect().top) : null,
      vh,
      anclaEnDOM: !!ancla,
      focoEnAncla: document.activeElement === ancla,
      firmarRect: rect(firmar),
      firmarVisible: firmar ? (firmar.getBoundingClientRect().top >= 0 && firmar.getBoundingClientRect().bottom <= vh) : null,
      motivoJuntoAFirmar,
      scrollMain: Math.round(document.querySelector('main')?.scrollTop ?? -1),
    }
  })
}

async function axeScan(page) {
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map(n => n.target.join(' ')) }))
  })
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
  const erroresConsola = []

  // ── Móvil 390×844 ──────────────────────────────────────────────────────
  const movil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await movil.addInitScript((u) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      // El banner de recordatorios push (`NotificacionesPushOptIn`, fixed
      // bottom z-1000) aparece a los 3s y TAPA el borde inferior completo en
      // 390px — la primera pasada de este arnés lo encontró comiéndose el tap
      // sobre la barra. Se siembra su flag de descarte (el mismo que escribe
      // «Después»), como un médico que ya lo descartó una vez. El solape
      // banner↔zona del pulgar queda anotado como deuda móvil preexistente.
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* noop */ }
  }, uid)
  const page = await movil.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)

  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)

  // 1. Nota vacía: la barra NO existe.
  resultado.notaVacia = await medirBarra(page)
  await page.screenshot({ path: path.join(DESTINO, '01-nota-vacia-sin-barra.png') })

  // 2. Escribir contenido REAL en la primera sección de la nota (UI real).
  const textarea = page.locator('main textarea').first()
  await textarea.tap()
  await textarea.fill('Paciente refiere disuria de 3 días de evolución, sin fiebre.')
  await page.waitForTimeout(800)
  // De vuelta arriba: la medición canónica es «la barra pegada abajo mientras
  // el médico está al INICIO de la nota» — la distancia que la barra acorta.
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0 })
  await page.waitForTimeout(600)
  resultado.conContenido = await medirBarra(page)
  await page.screenshot({ path: path.join(DESTINO, '02-con-contenido-barra-visible.png') })

  // 3. Sticky de verdad: scroll a media página y la barra sigue pegada.
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 800 })
  await page.waitForTimeout(600)
  resultado.trasScroll = await medirBarra(page)
  await page.screenshot({ path: path.join(DESTINO, '03-tras-scroll-sigue-pegada.png') })

  // 4. Axe con la barra visible (antes del viaje).
  resultado.axeMovil = await axeScan(page)

  // 5. TAP en la barra → el cierre entra a pantalla, el foco aterriza, la
  //    barra se esconde.
  await page.locator('.nx-cierre-al-pulgar-btn').tap()
  await page.waitForTimeout(1400)
  resultado.trasTap = await medirBarra(page)
  await page.screenshot({ path: path.join(DESTINO, '04-tras-tap-cierre-visible.png') })

  await movil.close()

  // ── Escritorio 1440 (control: la barra no existe ahí) ──────────────────
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' })
  await desk.addInitScript((u) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* noop */ }
  }, uid)
  const dpage = await desk.newPage()
  dpage.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(dpage)
  await dpage.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await dpage.waitForTimeout(2500)
  const dtextarea = dpage.locator('main textarea').first()
  await dtextarea.click()
  await dtextarea.fill('Paciente refiere disuria de 3 días de evolución, sin fiebre.')
  await dpage.waitForTimeout(800)
  resultado.escritorio = await dpage.evaluate(() => {
    const barra = document.querySelector('.nx-cierre-al-pulgar')
    return {
      barraEnDOM: !!barra,
      barraVisible: !!barra && getComputedStyle(barra).display !== 'none',
    }
  })
  await dpage.screenshot({ path: path.join(DESTINO, '05-escritorio-sin-barra.png') })
  await desk.close()
  await browser.close()

  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))

  console.log('\n── CierreAlPulgar, medido en navegador real ──')
  console.log('nota vacía → barra visible:', resultado.notaVacia.barraVisible, '(esperado false)')
  console.log('con contenido → barra visible:', resultado.conContenido.barraVisible, resultado.conContenido.barraRect, '(esperado true, h≥44)')
  console.log('  texto:', resultado.conContenido.barraTexto)
  console.log('  motivo junto a Firmar:', resultado.conContenido.motivoJuntoAFirmar)
  console.log('tras scroll 800 → sigue pegada:', resultado.trasScroll.barraVisible, resultado.trasScroll.barraRect)
  console.log('tras tap → Firmar visible:', resultado.trasTap.firmarVisible, '· foco en ancla:', resultado.trasTap.focoEnAncla, '· barra oculta:', !resultado.trasTap.barraVisible)
  console.log('escritorio → barra visible:', resultado.escritorio.barraVisible, '(esperado false)')
  console.log('axe móvil:', JSON.stringify(resultado.axeMovil))
  console.log('errores consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
