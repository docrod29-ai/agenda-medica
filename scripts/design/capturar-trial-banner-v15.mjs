/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-VISUAL-SYSTEM-001 (Fase 10, sexta
 * rebanada: EL TRIALBANNER HABLA TOKENS POR TEMA). §40 Real Browser
 * Requirement.
 *
 * El defecto que paga: la ÚNICA violación axe `color-contrast` recurrente de
 * las superficies V15 (rebanadas 2-5, fingerprint idéntico) — el span del
 * banner de prueba con `#f59e0b` pegado, ilegible sobre el crema del claro.
 *
 * Mide con `getComputedStyle` — no leyendo JSX — que:
 *
 *   1. El mensaje del banner va en el `--text` del tema (no ámbar, no hex).
 *   2. El icono va en el `--amber` del tema (cambia de hex entre temas).
 *   3. El CTA lleva relleno `--amber` del tema y texto `--sobre-aviso`
 *      (tinta en oscuro, blanco en claro): el par entero cambia por tema.
 *   4. axe NO reporta `color-contrast` sobre el banner en NINGÚN tema — la
 *      violación recurrente muere. Cualquier nodo que quede se reporta con
 *      su failureSummary COMPLETO (la corrida anterior dejó un segundo nodo
 *      sin identificar por recortar los datos).
 *   5. Equivalencia funcional: el CTA navega de verdad a
 *      /configuracion?tab=suscripcion.
 *   6. Móvil 390: el banner envuelve sin desbordar el documento.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`
 * (la clínica sembrada nace en plan trial → el banner de cuenta regresiva se
 * pinta solo).
 *
 * Uso:
 *   node scripts/design/capturar-trial-banner-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-trial-banner'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
// El span del mensaje: único texto de la app que empieza así.
const SPAN = 'span:has-text("Tu prueba gratuita")'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

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

/** El banner, medido de verdad: span + icono + CTA con sus colores computados. */
async function medirBanner(page) {
  return page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'))
    const span = spans.find(s => s.textContent?.trim().startsWith('Tu prueba gratuita'))
    if (!span) return null
    const banner = span.parentElement
    const icono = banner?.querySelector('svg')
    const cta = banner?.querySelector('a[href*="suscripcion"]')
    const c = (el, props) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return Object.fromEntries(props.map(p => [p, s[p]]))
    }
    return {
      temaActual: document.documentElement.getAttribute('data-theme') ?? '(default)',
      texto: span.textContent?.trim(),
      span: c(span, ['fontSize', 'color']),
      icono: icono ? { color: getComputedStyle(icono).color, stroke: icono.getAttribute('stroke') } : null,
      cta: cta
        ? { texto: cta.textContent?.trim(), href: cta.getAttribute('href'), ...c(cta, ['color', 'backgroundColor', 'fontSize', 'fontWeight']) }
        : null,
      // ¿El banner desborda el documento? (móvil)
      anchoDocumento: document.documentElement.scrollWidth,
    }
  })
}

async function correrAxe(page) {
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodos: v.nodes.length,
      // COMPLETO esta vez: la corrida de la cuarta rebanada recortó esto y un
      // segundo nodo quedó sin identificar.
      detalles: v.nodes.map(n => ({
        target: n.target?.join(' ') ?? '',
        resumen: n.failureSummary ?? '',
        html: (n.html ?? '').slice(0, 200),
      })),
    }))
  })
}

const esDelBanner = (v) =>
  v.id === 'color-contrast' &&
  v.detalles.some(d => d.html.includes('Tu prueba') || d.html.includes('Activar plan') || d.html.includes('Activar mi plan'))

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = {}
  const erroresConsola = []

  // ── ESCRITORIO 1440 ──────────────────────────────────────────────────────
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  })
  const uid = await uidDelMedico()
  await context.addInitScript(({ u, pushKey }) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem(pushKey, '1')
    } catch { /* noop */ }
  }, { u: uid, pushKey: PUSH_DISMISS_KEY })
  const page = await context.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)

  // /pacientes: la superficie donde la corrida anterior midió 2 nodos.
  await page.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await page.waitForSelector(SPAN, { timeout: 20000 })
  await page.waitForTimeout(400)

  resultado.oscuro = await medirBanner(page)
  await page.screenshot({ path: path.join(DESTINO, 'banner--oscuro-1440.png'), fullPage: false })
  resultado.axeOscuro = await correrAxe(page)

  // ── TEMA CLARO: donde vivía el defecto ────────────────────────────────────
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.claro = await medirBanner(page)
  await page.screenshot({ path: path.join(DESTINO, 'banner--claro-1440.png'), fullPage: false })
  resultado.axeClaro = await correrAxe(page)
  resultado.bannerLimpioEnClaro = !resultado.axeClaro.some(esDelBanner)

  // ── EQUIVALENCIA FUNCIONAL: el CTA navega a suscripción ──────────────────
  await page.locator('a:has-text("Activar plan")').first().click()
  await page.waitForURL('**/configuracion**', { timeout: 20000 })
  resultado.navegacion = {
    urlAterrizada: new URL(page.url()).pathname + new URL(page.url()).search,
    llega: new URL(page.url()).pathname.startsWith('/configuracion'),
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await context.close()

  // ── MÓVIL 390×844 ─────────────────────────────────────────────────────────
  const contextMovil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  })
  await contextMovil.addInitScript(({ u, pushKey }) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem(pushKey, '1')
    } catch { /* noop */ }
  }, { u: uid, pushKey: PUSH_DISMISS_KEY })
  const movil = await contextMovil.newPage()
  movil.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(`[movil] ${m.text()}`) })
  await login(movil)
  await movil.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await movil.waitForSelector(SPAN, { timeout: 20000 })
  await movil.waitForTimeout(400)
  resultado.movil = await medirBanner(movil)
  await movil.screenshot({ path: path.join(DESTINO, 'banner--movil-390.png'), fullPage: false })
  resultado.axeMovil = await correrAxe(movil)
  await contextMovil.close()

  await browser.close()
  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 1))
  console.log(JSON.stringify({
    oscuro: { span: resultado.oscuro?.span, cta: resultado.oscuro?.cta?.backgroundColor },
    claro: { span: resultado.claro?.span, cta: resultado.claro?.cta?.backgroundColor, ctaTexto: resultado.claro?.cta?.color },
    bannerLimpioEnClaro: resultado.bannerLimpioEnClaro,
    navegacion: resultado.navegacion,
    axeClaro: resultado.axeClaro?.map(v => `${v.id}×${v.nodos}`),
    axeOscuro: resultado.axeOscuro?.map(v => `${v.id}×${v.nodos}`),
    axeMovil: resultado.axeMovil?.map(v => `${v.id}×${v.nodos}`),
    consola: erroresConsola.length,
  }, null, 1))
}

main().catch((e) => { console.error(e); process.exit(1) })
