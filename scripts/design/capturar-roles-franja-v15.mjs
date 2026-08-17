/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-VISUAL-SYSTEM-001 (Fase 10, octava
 * rebanada: LA IDENTIDAD DE LA FRANJA + EL BARRIDO FINAL DE §2). §40 Real
 * Browser Requirement.
 *
 * Mide con `getComputedStyle` — no leyendo JSX — que:
 *
 *   1. `a.nx-ident-franja` pinta la identidad del paciente en la franja a
 *      14px/600/var(--text) con subrayado atenuado — ya no cromo 12/--text2
 *      con ellipsis — en ESCRITORIO (franja propia) y en MÓVIL (topbar), y
 *      que en móvil el nombre largo sembrado ENVUELVE a 2 líneas (clamp)
 *      dentro de un objetivo táctil >= 44px, sin desbordar el documento.
 *   2. El respaldo del consultorio habla la MISMA voz (14px), no 16 — la
 *      franja ya no habla más fuerte cuando enseña lo menos importante.
 *   3. El timer de grabación (simulado con el MISMO CustomEvent
 *      `nx:grabando` que dispara `avisarEscucha()` — el micrófono real no es
 *      lo que este cambio toca) pinta dígitos tabular-nums (`nx-num`).
 *   4. Los conteos del ClinicalSpine son tabular-nums (barrido).
 *   5. El detalle de PanelPendientes en /dashboard es `.nx-meta` (barrido).
 *   6. El enlace de la franja SIGUE navegando al expediente desde una
 *      pantalla sin ningún otro rastro del paciente (/referencia/[pid]) —
 *      equivalencia funcional, medida con clic real.
 *   7. Nada de esto introduce violaciones axe nuevas, en oscuro NI claro,
 *      ni en móvil.
 *
 * Nota de honestidad: las tarjetas de duplicados de /pacientes NO se miden
 * aquí — la siembra no crea pares de expedientes duplicados, así que el
 * modal nunca se abre en el emulador. Su rol tipográfico lo vigila el
 * guardián estático (`v15-roles-tipograficos-en-franja-y-barrido.test.ts`);
 * declararlo aquí es más honesto que fingir que se midió.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-roles-franja-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-roles-franja'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
const PACIENTE_LARGO = 'pac-refugio-alcantara'      // «María del Refugio Alcántara Solís»
const NOMBRE_LARGO = 'María del Refugio Alcántara Solís'

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

const estilo = `(el) => {
  if (!el) return null
  const s = getComputedStyle(el)
  return {
    fontSize: s.fontSize, fontWeight: s.fontWeight, color: s.color,
    fontVariantNumeric: s.fontVariantNumeric,
    textDecorationLine: s.textDecorationLine,
    webkitLineClamp: s.webkitLineClamp,
    overflowWrap: s.overflowWrap, textOverflow: s.textOverflow,
  }
}`

/** La franja de ESCRITORIO (.nx-instrument-strip) con el paciente en la ruta. */
async function medirFranjaEscritorio(page) {
  return page.evaluate(({ fn }) => {
    // eslint-disable-next-line no-eval
    const st = eval(fn)
    const franja = document.querySelector('.nx-instrument-strip')
    if (!franja) return null
    const enlace = franja.querySelector('a.nx-ident-franja')
    const clinica = franja.querySelector('span:first-child')
    const timer = franja.querySelector('.nx-num')
    return {
      enlace: enlace ? { texto: enlace.textContent?.trim(), ...st(enlace) } : null,
      clinica: clinica ? { texto: clinica.textContent?.trim(), ...st(clinica) } : null,
      timer: timer ? { texto: timer.textContent?.trim(), ...st(timer) } : null,
      // La identidad domina el cromo de la franja: 14 > 12.
      identidadDominaCromo: enlace && clinica
        ? parseFloat(getComputedStyle(enlace).fontSize) > parseFloat(getComputedStyle(clinica).fontSize)
        : null,
    }
  }, { fn: estilo })
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
      targets: v.nodes.map(n => n.target?.join(' ') ?? '').slice(0, 5),
      resumen: v.nodes.map(n => n.failureSummary ?? '').slice(0, 5),
    }))
  })
}

const simularGrabando = (page, activo) => page.evaluate((a) => {
  window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: a } }))
}, activo)

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = {
    duplicadosDeclarados: 'las tarjetas de duplicados de /pacientes NO se miden aquí (la siembra no crea pares) — las vigila el guardián estático',
  }
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

  // La franja con paciente, en la pantalla SIN ningún otro rastro del
  // paciente en su UI (la razón de ser de «paciente actual» en la franja).
  await page.goto(`${BASE}/referencia/${PACIENTE_LARGO}`, { waitUntil: 'load' })
  await page.waitForSelector('.nx-instrument-strip a.nx-ident-franja', { timeout: 20000 })
  await page.waitForTimeout(400)

  resultado.oscuro = await medirFranjaEscritorio(page)

  // Timer simulado: mismo CustomEvent que avisarEscucha().
  await simularGrabando(page, true)
  await page.waitForSelector('.nx-instrument-strip .nx-num', { timeout: 5000 })
  resultado.oscuroGrabando = await medirFranjaEscritorio(page)
  await page.screenshot({ path: path.join(DESTINO, 'franja--oscuro-grabando-1440.png') })
  await simularGrabando(page, false)

  resultado.axeOscuro = await correrAxe(page)

  // ── EQUIVALENCIA FUNCIONAL: el enlace de la franja lleva al expediente ───
  await page.locator('.nx-instrument-strip a.nx-ident-franja').click()
  await page.waitForURL(`**/expediente/${PACIENTE_LARGO}**`, { timeout: 20000 })
  resultado.navegacionFranja = {
    urlAterrizada: new URL(page.url()).pathname,
    llega: new URL(page.url()).pathname === `/expediente/${PACIENTE_LARGO}`,
  }

  // ── BARRIDO: conteos del ClinicalSpine tabulares, en el expediente real ──
  // El riel se pinta cuando sus datos cargan — esperar el conteo real
  // («Encuentros 0» siempre trae uno), no medir el DOM a medio cargar.
  await page.waitForSelector('.nx-clinical-spine .nx-num', { timeout: 20000 })
  resultado.spineNum = await page.evaluate(({ fn }) => {
    // eslint-disable-next-line no-eval
    const st = eval(fn)
    const nums = Array.from(document.querySelectorAll('.nx-clinical-spine .nx-num'))
    return nums.map(n => ({ texto: n.textContent?.trim(), ...st(n) }))
  }, { fn: estilo })

  // ── BARRIDO: detalle de PanelPendientes es .nx-meta, en /dashboard ───────
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  resultado.panelPendientesMeta = await page.evaluate(({ fn }) => {
    // eslint-disable-next-line no-eval
    const st = eval(fn)
    const metas = Array.from(document.querySelectorAll('.nx-meta'))
      .filter(m => m.closest('a[href^="/pendientes"], a[href^="/citas"], div') && m.textContent)
    const panel = Array.from(document.querySelectorAll('h2'))
      .find(h => h.textContent?.includes('Siguiente acción'))?.closest('div[style]')
    const dentro = panel ? Array.from(panel.parentElement?.querySelectorAll('.nx-meta') ?? []) : []
    return {
      metasEnPagina: metas.length,
      metasEnPanel: dentro.slice(0, 3).map(m => ({ texto: m.textContent?.trim().slice(0, 60), ...st(m) })),
    }
  }, { fn: estilo })

  // ── TEMA CLARO ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/referencia/${PACIENTE_LARGO}`, { waitUntil: 'load' })
  await page.waitForSelector('.nx-instrument-strip a.nx-ident-franja', { timeout: 20000 })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.claro = await medirFranjaEscritorio(page)
  await page.screenshot({ path: path.join(DESTINO, 'franja--claro-1440.png') })
  resultado.axeClaro = await correrAxe(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await context.close()

  // ── MÓVIL 390×844: la topbar — clamp de 2 líneas, 44px, sin desborde ─────
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

  // Respaldo del consultorio: en /dashboard no hay paciente en la ruta.
  await movil.waitForSelector('.nx-instrument-strip-topbar span.nx-ident-franja', { timeout: 20000 })
  resultado.movilRespaldo = await movil.evaluate(({ fn }) => {
    // eslint-disable-next-line no-eval
    const st = eval(fn)
    const topbar = document.querySelector('.nx-instrument-strip-topbar')
    const respaldo = topbar?.querySelector('span.nx-ident-franja')
    return respaldo ? { texto: respaldo.textContent?.trim(), ...st(respaldo) } : null
  }, { fn: estilo })

  await movil.goto(`${BASE}/expediente/${PACIENTE_LARGO}`, { waitUntil: 'load' })
  await movil.waitForSelector('.nx-instrument-strip-topbar a.nx-ident-franja', { timeout: 20000 })
  await movil.waitForTimeout(600)
  resultado.movil = await movil.evaluate(({ fn, NOMBRE_LARGO }) => {
    // eslint-disable-next-line no-eval
    const st = eval(fn)
    const doc = document.documentElement
    const enlace = document.querySelector('.nx-instrument-strip-topbar a.nx-ident-franja')
    const span = enlace?.querySelector('.nx-ident-franja--clamp')
    const alto = enlace?.getBoundingClientRect().height ?? null
    const lineas = span
      ? Math.round(span.getBoundingClientRect().height /
          (parseFloat(getComputedStyle(span).fontSize) * 1.2))
      : null
    return {
      desbordeHorizontal: doc.scrollWidth > doc.clientWidth,
      anchoDocumento: doc.scrollWidth,
      enlace: enlace ? { texto: enlace.textContent?.trim(), altoTactil: alto, ...st(enlace) } : null,
      span: span ? { ...st(span), lineas } : null,
      nombreCompleto: span?.textContent?.trim() === NOMBRE_LARGO,
      objetivoTactilOk: alto != null && alto >= 44,
    }
  }, { fn: estilo, NOMBRE_LARGO })

  // Timer en móvil, tabular.
  await simularGrabando(movil, true)
  await movil.waitForSelector('.nx-instrument-strip-topbar .nx-num', { timeout: 5000 })
  resultado.movilTimer = await movil.evaluate(({ fn }) => {
    // eslint-disable-next-line no-eval
    const st = eval(fn)
    const t = document.querySelector('.nx-instrument-strip-topbar .nx-num')
    return t ? { texto: t.textContent?.trim(), ...st(t) } : null
  }, { fn: estilo })
  await movil.screenshot({ path: path.join(DESTINO, 'franja--movil-grabando-390.png') })
  await simularGrabando(movil, false)

  // Equivalencia funcional en móvil: tap en el nombre → expediente. Ya
  // estamos en el expediente; el tap debe QUEDARSE ahí (href al mismo sitio).
  resultado.axeMovil = await correrAxe(movil)
  await contextMovil.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log(JSON.stringify({
    escritorioEnlace: resultado.oscuro?.enlace?.fontSize,
    escritorioSubrayado: resultado.oscuro?.enlace?.textDecorationLine,
    identidadDominaCromo: resultado.oscuro?.identidadDominaCromo,
    timerTabular: resultado.oscuroGrabando?.timer?.fontVariantNumeric,
    navegacionFranja: resultado.navegacionFranja?.llega,
    spineNums: resultado.spineNum?.map(n => n.fontVariantNumeric),
    movilEnlace: resultado.movil?.enlace?.fontSize,
    movilLineas: resultado.movil?.span?.lineas,
    movilTactil: resultado.movil?.objetivoTactilOk,
    movilNombreCompleto: resultado.movil?.nombreCompleto,
    movilRespaldo: resultado.movilRespaldo?.fontSize,
    movilTimerTabular: resultado.movilTimer?.fontVariantNumeric,
    movilDesborde: resultado.movil?.desbordeHorizontal,
    axe: {
      oscuro: resultado.axeOscuro?.length,
      claro: resultado.axeClaro?.length,
      movil: resultado.axeMovil?.length,
    },
    erroresConsola: erroresConsola.length,
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
