/**
 * MEDICIÓN — V15-MOBILE-001, tercera rebanada (§22/§23, §33 Fase 9).
 *
 * NO cambia nada: mide los trabajos móviles de §22 contra las pantallas
 * REALES a 390×844 antes de decidir qué recomponer (misma disciplina que la
 * medición de baseline de V15-ENCOUNTER-MODE-001). Para cada pantalla:
 *
 *   - ¿desborda horizontalmente? (scrollWidth > innerWidth — el defecto móvil
 *     más barato de detectar y más caro de sufrir);
 *   - ¿cuántos objetivos táctiles interactivos miden <44×44? (§24);
 *   - ¿la acción primaria es visible SIN scroll y cuánto mide?;
 *   - ¿cuánto shell fijo (topbar+strip+banners) se come del viewport? (§23:
 *     qué persiste vs qué colapsa por breakpoint);
 *   - captura de pantalla para el juicio a simple vista.
 *
 * Pantallas: /dashboard (control), /consulta/[pid] (arranque de encuentro y
 * cierre — trabajos «start encounter» y «sign/close» de §22), /pendientes
 * («review result»), /expediente/[pid] (control del shell).
 *
 * Uso: node scripts/design/medir-trabajos-moviles-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-trabajos-moviles-baseline'
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

/** Radiografía móvil de la pantalla actual. */
async function medir(page, accionPrimariaTexto) {
  return page.evaluate((primariaTexto) => {
    const vw = window.innerWidth
    const vh = window.innerHeight

    // 1. Desborde horizontal del documento
    const desborda = document.documentElement.scrollWidth > vw + 1
    // ¿Qué elemento desborda? (el más ancho que se sale)
    let culpableDesborde = null
    if (desborda) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width > vw + 1 && el.children.length === 0) {
          culpableDesborde = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} w=${Math.round(r.width)}`
          break
        }
      }
    }

    // 2. Objetivos táctiles <44×44 visibles (§24)
    const interactivos = [...document.querySelectorAll('button, a, input, select, [role="button"]')]
    const chicos = interactivos.filter(el => {
      const r = el.getBoundingClientRect()
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh
      return visible && (r.width < 44 || r.height < 44) && !el.closest('[aria-hidden="true"]')
    })
    const chicosResumen = chicos.slice(0, 12).map(el => {
      const r = el.getBoundingClientRect()
      return `${el.tagName.toLowerCase()}"${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 26)}" ${Math.round(r.width)}×${Math.round(r.height)}`
    })

    // 3. Acción primaria: visible sin scroll y su tamaño
    let primaria = null
    if (primariaTexto) {
      const candidatos = [...document.querySelectorAll('button, a')]
        .filter(el => (el.textContent || '').includes(primariaTexto))
      const el = candidatos[0]
      if (el) {
        const r = el.getBoundingClientRect()
        primaria = {
          texto: primariaTexto,
          visibleSinScroll: r.top >= 0 && r.bottom <= vh,
          tam: `${Math.round(r.width)}×${Math.round(r.height)}`,
          top: Math.round(r.top),
        }
      } else {
        primaria = { texto: primariaTexto, encontrada: false }
      }
    }

    // 4. Shell fijo: cuánto viewport se come (topbar + strip + banners + bottomnav)
    const piezas = ['.mobile-topbar', '.nx-instrument-strip', '.bottom-nav-wrap']
    const shell = {}
    let shellPx = 0
    for (const sel of piezas) {
      const el = document.querySelector(sel)
      if (el) {
        const r = el.getBoundingClientRect()
        const visible = getComputedStyle(el).display !== 'none' && r.height > 0
        shell[sel] = visible ? Math.round(r.height) : 0
        if (visible) shellPx += r.height
      }
    }
    // Banners entre topbar y main (TrialBanner etc.)
    const main = document.querySelector('main')
    const mainTop = main ? Math.round(main.getBoundingClientRect().top) : null

    // 5. ¿Cuántas veces se lee la palabra «Ausculta» en el shell visible?
    const textoShell = [...document.querySelectorAll('.mobile-topbar, .nx-instrument-strip')]
      .map(el => el.textContent || '').join(' ')
    const auscultaVeces = (textoShell.match(/Ausculta/g) || []).length

    return {
      vw, vh, desborda, culpableDesborde,
      tactilesChicos: chicos.length, tactilesChicosEjemplos: chicosResumen,
      primaria,
      shellAlturas: shell, shellPxTotal: Math.round(shellPx), mainTop,
      auscultaVecesEnShell: auscultaVeces,
    }
  }, accionPrimariaTexto ?? null)
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

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await context.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page = await context.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)
  await page.waitForTimeout(1500)

  // /dashboard — control del shell
  resultado.dashboard = await medir(page, 'Nueva cita')
  await page.screenshot({ path: path.join(DESTINO, 'dashboard.png') })

  // /consulta — trabajo «start encounter»: acción primaria EmpezarAGrabar
  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  resultado.consultaInicio = await medir(page, 'Grabar')
  await page.screenshot({ path: path.join(DESTINO, 'consulta-inicio.png') })
  // pie de la consulta (donde vive el cierre/firma)
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = m.scrollHeight })
  await page.waitForTimeout(600)
  resultado.consultaPie = await medir(page, 'Firmar')
  await page.screenshot({ path: path.join(DESTINO, 'consulta-pie.png') })

  // /pendientes — trabajo «review result»
  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  resultado.pendientes = await medir(page, null)
  await page.screenshot({ path: path.join(DESTINO, 'pendientes.png') })

  // /expediente — control (ya recompuesto por Fase 4)
  await page.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  resultado.expediente = await medir(page, 'Nueva consulta')
  await page.screenshot({ path: path.join(DESTINO, 'expediente.png') })

  await context.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Radiografía móvil (390×844) ──')
  for (const [k, v] of Object.entries(resultado)) {
    console.log(`\n[${k}]`)
    console.log('  desborda-X:', v.desborda, v.culpableDesborde ?? '')
    console.log('  táctiles <44px visibles:', v.tactilesChicos, JSON.stringify(v.tactilesChicosEjemplos?.slice(0, 5)))
    console.log('  primaria:', JSON.stringify(v.primaria))
    console.log('  shell px:', v.shellPxTotal, JSON.stringify(v.shellAlturas), 'mainTop:', v.mainTop)
    console.log('  «Ausculta» en shell:', v.auscultaVecesEnShell)
  }
  console.log('\nerrores de consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
