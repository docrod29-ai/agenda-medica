/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-VISUAL-SYSTEM-001 (Fase 10, séptima
 * rebanada: LOS ROLES TIPOGRÁFICOS DE VISUAL_DNA §2 EN HOY — ProxHero (NOW)
 * y AppointmentRow (TODAY)). §40 Real Browser Requirement.
 *
 * Mide con `getComputedStyle` — no leyendo JSX — que:
 *
 *   1. `span.nx-ident` pinta la identidad a 15.5px/600 en el héroe NOW y en
 *      cada fila de «Agenda de hoy», SIN ellipsis computado (§24: la
 *      identidad envuelve, no se trunca).
 *   2. `.riel-hora` pinta la hora a 14px/600 con tabular-nums — ya no el
 *      700 inline que le ganaba al nombre (R3 restaurada: 15.5 > 14).
 *   3. `.nx-meta` pinta el metadato a 12.5px en --text3.
 *   4. La FILA sigue abriendo la cita y el héroe sigue iniciando consulta
 *      (equivalencia funcional, medida con clic real).
 *   5. Nada de esto introduce violaciones axe nuevas, en oscuro NI claro,
 *      ni desborda en móvil 390 (el nombre largo sembrado envuelve).
 *
 * Nota de honestidad: el héroe NOW sólo se pinta si hay una cita de HOY a
 * una hora >= la actual (America/Mexico_City). La siembra pone citas de
 * 09:00 a 17:00; si el arnés corre cuando ya pasaron todas, `hero: null`
 * queda declarado en el resultado en vez de fingirse medido.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-roles-hoy-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-roles-hoy'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
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

/** Los roles, medidos DENTRO del héroe NOW y de las filas de Agenda de hoy. */
async function medirRoles(page) {
  return page.evaluate(({ NOMBRE_LARGO }) => {
    const estilo = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        fontVariantNumeric: s.fontVariantNumeric,
        textOverflow: s.textOverflow,
        whiteSpace: s.whiteSpace,
        overflowWrap: s.overflowWrap,
      }
    }
    const hero = document.querySelector('.prox-hero')
    const filas = Array.from(document.querySelectorAll('.cita-fila'))
    const fila = filas[0] ?? null
    const filaLarga = filas.find(f =>
      f.querySelector('span.nx-ident')?.textContent?.trim() === NOMBRE_LARGO)
    const identLargo = filaLarga?.querySelector('span.nx-ident') ?? null
    const medirZona = (zona) => zona && {
      ident: (() => {
        const el = zona.querySelector('span.nx-ident')
        return el ? { texto: el.textContent?.trim(), ...estilo(el) } : null
      })(),
      hora: (() => {
        const el = zona.querySelector('.riel-hora')
        return el ? { texto: el.textContent?.trim(), ...estilo(el) } : null
      })(),
      dur: (() => {
        const el = zona.querySelector('.riel-dur')
        return el ? { texto: el.textContent?.trim(), ...estilo(el) } : null
      })(),
      meta: (() => {
        const el = zona.querySelector('.nx-meta')
        return el ? { texto: el.textContent?.trim(), ...estilo(el) } : null
      })(),
    }
    return {
      temaActual: document.documentElement.getAttribute('data-theme') ?? '(default)',
      filas: filas.length,
      hero: medirZona(hero),
      fila: medirZona(fila),
      // R3 restaurada: la identidad (15.5) domina sobre la hora (14) y el
      // peso de la hora ya no es 700.
      nombreDominaSobreHora: fila
        ? parseFloat(getComputedStyle(fila.querySelector('span.nx-ident')).fontSize) >
          parseFloat(getComputedStyle(fila.querySelector('.riel-hora')).fontSize)
        : null,
      nombreLargo: identLargo
        ? {
            texto: identLargo.textContent?.trim(),
            recortado: identLargo.scrollWidth > identLargo.clientWidth,
            lineas: Math.round(identLargo.getBoundingClientRect().height /
              (parseFloat(getComputedStyle(identLargo).fontSize) * 1.3)),
          }
        : null,
    }
  }, { NOMBRE_LARGO })
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

  await page.waitForSelector('.cita-fila span.nx-ident', { timeout: 20000 })
  await page.waitForTimeout(600)

  resultado.oscuro = await medirRoles(page)
  await page.screenshot({ path: path.join(DESTINO, 'hoy--oscuro-1440.png'), fullPage: true })
  resultado.axeOscuro = await correrAxe(page)

  // ── EQUIVALENCIA FUNCIONAL: la FILA abre la cita ─────────────────────────
  const nombrePrimero = await page.locator('.cita-fila span.nx-ident').first().textContent()
  await page.locator('.cita-fila .cita-principal').first().click()
  await page.waitForURL('**/citas**', { timeout: 20000 })
  resultado.navegacionFila = {
    nombreDeLaFila: nombrePrimero?.trim(),
    urlAterrizada: page.url().replace(BASE, ''),
    llega: new URL(page.url()).pathname.startsWith('/citas'),
  }
  await page.goBack()
  await page.waitForSelector('.cita-fila span.nx-ident', { timeout: 20000 })

  // ── EQUIVALENCIA FUNCIONAL: el héroe inicia consulta (si hay héroe) ──────
  if (resultado.oscuro.hero) {
    await page.locator('.prox-hero-cta').click()
    await page.waitForURL('**/consulta/**', { timeout: 20000 })
    resultado.navegacionHero = {
      urlAterrizada: new URL(page.url()).pathname,
      llega: new URL(page.url()).pathname.startsWith('/consulta/'),
    }
    await page.goBack()
    await page.waitForSelector('.cita-fila span.nx-ident', { timeout: 20000 })
  } else {
    resultado.navegacionHero = 'sin héroe a esta hora — declarado, no medido'
  }

  // ── TEMA CLARO ────────────────────────────────────────────────────────────
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.claro = await medirRoles(page)
  await page.screenshot({ path: path.join(DESTINO, 'hoy--claro-1440.png'), fullPage: true })
  resultado.axeClaro = await correrAxe(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await context.close()

  // ── MÓVIL 390×844: la identidad envuelve sin desbordar ────────────────────
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
  await movil.waitForSelector('.cita-fila span.nx-ident', { timeout: 20000 })
  await movil.waitForTimeout(600)
  resultado.movil = await movil.evaluate(({ NOMBRE_LARGO }) => {
    const doc = document.documentElement
    const filas = Array.from(document.querySelectorAll('.cita-fila'))
    const filaLarga = filas.find(f =>
      f.querySelector('span.nx-ident')?.textContent?.trim() === NOMBRE_LARGO)
    const identLargo = filaLarga?.querySelector('span.nx-ident') ?? null
    const heroIdent = document.querySelector('.prox-hero span.nx-ident')
    return {
      desbordeHorizontal: doc.scrollWidth > doc.clientWidth,
      anchoDocumento: doc.scrollWidth,
      filas: filas.length,
      heroIdent: heroIdent
        ? {
            texto: heroIdent.textContent?.trim(),
            recortado: heroIdent.scrollWidth > heroIdent.clientWidth,
          }
        : null,
      nombreLargo: identLargo
        ? {
            texto: identLargo.textContent?.trim(),
            recortado: identLargo.scrollWidth > identLargo.clientWidth,
            lineas: Math.round(identLargo.getBoundingClientRect().height /
              (parseFloat(getComputedStyle(identLargo).fontSize) * 1.3)),
          }
        : null,
    }
  }, { NOMBRE_LARGO })
  resultado.axeMovil = await correrAxe(movil)
  await movil.screenshot({ path: path.join(DESTINO, 'hoy--movil-390.png'), fullPage: true })
  await contextMovil.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log(JSON.stringify({
    filaIdent: resultado.oscuro?.fila?.ident?.fontSize,
    filaHora: resultado.oscuro?.fila?.hora?.fontWeight,
    nombreDominaSobreHora: resultado.oscuro?.nombreDominaSobreHora,
    hero: resultado.oscuro?.hero?.ident?.fontSize ?? null,
    navegacionFila: resultado.navegacionFila?.llega,
    navegacionHero: resultado.navegacionHero,
    axe: {
      oscuro: resultado.axeOscuro?.length,
      claro: resultado.axeClaro?.length,
      movil: resultado.axeMovil?.length,
    },
    movilDesborde: resultado.movil?.desbordeHorizontal,
    erroresConsola: erroresConsola.length,
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
