/**
 * MEDICIÓN — V15-MOBILE-001, séptima rebanada (§23, Fase 9).
 *
 * NO cambia nada: radiografía del MODELO RESPONSIVO por breakpoint que §23
 * exige decidir («cada breakpoint define qué persiste, qué se vuelve
 * contextual, qué colapsa»). Las seis rebanadas anteriores midieron 390 y
 * 1440; NADIE ha medido los anchos intermedios — y la lectura estática del
 * CSS deja una sospecha concreta:
 *
 *   - el shell de escritorio (FlowRail + franja) vive bajo Tailwind `md:`
 *     → `min-width: 768px`;
 *   - el shell móvil (mobile-topbar + BottomNav + colchones de main) vive
 *     bajo `max-width: 768px`;
 *   - en EXACTAMENTE 768px las dos familias aplican a la vez → doble
 *     navegación, doble franja de instrumentos. 768px no es un ancho
 *     teórico: es el ancho CSS de un iPad (Mini/9.7/10.2) en vertical.
 *
 * Para cada ancho: qué piezas del shell están visibles (mobile-topbar,
 * FlowRail, franja de escritorio, BottomNav), cuántas navegaciones primarias
 * hay a la vez, desborde horizontal, y captura.
 *
 * Uso: node scripts/design/medir-breakpoints-v15.mjs [carpetaDestino]
 * (emuladores 8080/9099 arriba, app en :3000 con .env.local demo, siembra de
 * sembrar-capturas.mjs)
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-breakpoints'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

// §23: teléfono · frontera exacta · tablet vertical (ancho real de iPad) ·
// tablet horizontal / laptop angosta · laptop estándar · escritorio ancho.
const ANCHOS = [
  { nombre: 'phone-390', w: 390, h: 844, touch: true },
  { nombre: 'frontera-767', w: 767, h: 1024, touch: true },
  { nombre: 'frontera-768-ipad-vertical', w: 768, h: 1024, touch: true },
  { nombre: 'frontera-769', w: 769, h: 1024, touch: true },
  { nombre: 'tablet-834', w: 834, h: 1194, touch: true },
  { nombre: 'tablet-h-1024', w: 1024, h: 768, touch: true },
  { nombre: 'laptop-1280', w: 1280, h: 800, touch: false },
  { nombre: 'desktop-1440', w: 1440, h: 900, touch: false },
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

/** Radiografía del shell en el viewport actual. */
async function medirShell(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const visible = (el) => {
      if (!el) return false
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const q = (sel) => document.querySelector(sel)

    const mobileTopbar = q('.mobile-topbar')
    const flowRail = q('.nx-flow-rail')
    const bottomNav = q('.bottom-nav-wrap')
    // franja de escritorio = el InstrumentStrip FUERA de la topbar móvil
    const franjas = [...document.querySelectorAll('.nx-instrument-strip')]
    const franjaEscritorio = franjas.find(el => !el.closest('.mobile-topbar')) || null

    // ¿cuántas navegaciones primarias ofrecen los 5 contextos a la vez?
    const navsPrimarias = [flowRail, bottomNav && bottomNav.querySelector('nav')]
      .filter(el => el && visible(el.closest('.bottom-nav-wrap') || el)).length

    const colchonMain = (() => {
      const m = q('main')
      return m ? getComputedStyle(m).paddingBottom : null
    })()

    return {
      vw,
      desbordaHorizontal: document.documentElement.scrollWidth > vw + 1,
      mobileTopbarVisible: visible(mobileTopbar),
      flowRailVisible: visible(flowRail),
      franjaEscritorioVisible: visible(franjaEscritorio),
      bottomNavVisible: visible(bottomNav),
      navsPrimariasSimultaneas: navsPrimarias,
      franjasInstrumentos: franjas.filter(visible).length,
      mainPaddingBottom: colchonMain,
    }
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

  for (const bp of ANCHOS) {
    const context = await browser.newContext({
      viewport: { width: bp.w, height: bp.h },
      deviceScaleFactor: 2,
      isMobile: bp.touch, hasTouch: bp.touch,
      locale: 'es-MX', timezoneId: 'America/Mexico_City',
    })
    await context.addInitScript((u) => {
      try {
        localStorage.setItem(`nexus_tour_v1_${u}`, '1')
        localStorage.setItem('agenda-medica:push-dismissed', '1')
      } catch { /* noop */ }
    }, uid)
    const page = await context.newPage()
    page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(`[${bp.nombre}] ${m.text()}`) })
    await login(page)
    await page.waitForTimeout(1500)
    resultado[bp.nombre] = await medirShell(page)
    await page.screenshot({ path: path.join(DESTINO, `${bp.nombre}-dashboard.png`) })
    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Radiografía de breakpoints (§23) ──')
  for (const [k, v] of Object.entries(resultado)) {
    console.log(`\n[${k}]`, JSON.stringify(v))
  }
  console.log('\nerrores de consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
