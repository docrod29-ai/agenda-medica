/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-VISUAL-SYSTEM-001 (Fase 10, cuarta
 * rebanada: LOS ROLES TIPOGRÁFICOS DE VISUAL_DNA §2 EN LAS FILAS DE
 * /pacientes). §40 Real Browser Requirement.
 *
 * Mide con `getComputedStyle` — no leyendo JSX — que:
 *
 *   1. `span.nx-ident` pinta la identidad del paciente a 15.5px/600
 *      encabezando cada fila del directorio, SIN subrayado (no es un enlace:
 *      la fila entera es role="button") y SIN enlace anidado nuevo.
 *   2. `.nx-meta` pinta el metadato (teléfono · edad) a 12.5px en --text3.
 *   3. La identidad ENVUELVE en vez de truncarse: el nombre largo sembrado
 *      («María del Refugio Alcántara Solís») no lleva ellipsis computado y no
 *      desborda su fila, tampoco en 390px (§24: no critical truncation).
 *   4. La FILA navega de verdad al expediente (equivalencia funcional).
 *   5. Nada de esto introduce violaciones axe nuevas, en tema oscuro NI claro,
 *      ni desborda en móvil 390.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs` (6 pacientes, 5 con ultimaCita → chip Recientes),
 * `.env.local` demo, build de producción + `npm start`.
 *
 * Uso:
 *   node scripts/design/capturar-roles-pacientes-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-roles-pacientes'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
const FILA = '[role="button"][aria-label^="Abrir el expediente de"]'
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

/** Los roles, medidos DENTRO de las filas del directorio. */
async function medirRoles(page) {
  return page.evaluate(({ FILA, NOMBRE_LARGO }) => {
    const filas = Array.from(document.querySelectorAll(FILA))
    if (!filas.length) return null
    const ident = filas[0].querySelector('span.nx-ident')
    const meta = filas[0].querySelector('.nx-meta')
    const estilo = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        textDecorationLine: s.textDecorationLine,
        textOverflow: s.textOverflow,
        whiteSpace: s.whiteSpace,
      }
    }
    // El nombre largo sembrado: ¿envuelve sin recortarse?
    const filaLarga = filas.find(f => f.querySelector('span.nx-ident')?.textContent?.trim() === NOMBRE_LARGO)
    const identLargo = filaLarga?.querySelector('span.nx-ident') ?? null
    return {
      temaActual: document.documentElement.getAttribute('data-theme') ?? '(default)',
      filas: filas.length,
      // nested-interactive NUEVO: ningún <a> dentro de la fila (el <button>
      // Editar es preexistente y tiene su propia anotación).
      enlacesAnidados: filas.reduce((n, f) => n + f.querySelectorAll('a').length, 0),
      identEsEnlace: filas.some(f => f.querySelector('a.nx-ident')),
      ident: ident ? { texto: ident.textContent?.trim(), ...estilo(ident) } : null,
      meta: meta ? { texto: meta.textContent?.trim(), ...estilo(meta) } : null,
      nombreLargo: identLargo
        ? {
            texto: identLargo.textContent?.trim(),
            recortado: identLargo.scrollWidth > identLargo.clientWidth,
            lineas: Math.round(identLargo.getBoundingClientRect().height / parseFloat(getComputedStyle(identLargo).lineHeight)),
          }
        : null,
    }
  }, { FILA, NOMBRE_LARGO })
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

  await page.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await page.waitForSelector(`${FILA} span.nx-ident`, { timeout: 20000 })
  await page.waitForTimeout(400)

  resultado.oscuro = await medirRoles(page)
  await page.screenshot({ path: path.join(DESTINO, 'pacientes--oscuro-1440.png'), fullPage: true })
  resultado.axeOscuro = await correrAxe(page)

  // ── EQUIVALENCIA FUNCIONAL: la FILA navega al expediente ─────────────────
  const nombrePrimero = await page.locator(`${FILA} span.nx-ident`).first().textContent()
  await page.locator(FILA).first().click()
  await page.waitForURL('**/expediente/**', { timeout: 20000 })
  resultado.navegacion = {
    nombreDeLaFila: nombrePrimero?.trim(),
    urlAterrizada: new URL(page.url()).pathname,
    llega: new URL(page.url()).pathname.startsWith('/expediente/'),
  }
  await page.goBack()
  await page.waitForSelector(`${FILA} span.nx-ident`, { timeout: 20000 })

  // ── TEMA CLARO (mismos puntos; los tokens cambian de hex por tema) ────────
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.claro = await medirRoles(page)
  await page.screenshot({ path: path.join(DESTINO, 'pacientes--claro-1440.png'), fullPage: true })
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
  await movil.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await movil.waitForSelector(`${FILA} span.nx-ident`, { timeout: 20000 })
  await movil.waitForTimeout(400)
  resultado.movil = await movil.evaluate(({ FILA, NOMBRE_LARGO }) => {
    const doc = document.documentElement
    const filas = Array.from(document.querySelectorAll(FILA))
    const filaLarga = filas.find(f => f.querySelector('span.nx-ident')?.textContent?.trim() === NOMBRE_LARGO)
    const identLargo = filaLarga?.querySelector('span.nx-ident') ?? null
    return {
      desbordeHorizontal: doc.scrollWidth > doc.clientWidth,
      anchoDocumento: doc.scrollWidth,
      filas: filas.length,
      nombreLargo: identLargo
        ? {
            texto: identLargo.textContent?.trim(),
            recortado: identLargo.scrollWidth > identLargo.clientWidth,
            lineas: Math.round(identLargo.getBoundingClientRect().height / parseFloat(getComputedStyle(identLargo).lineHeight)),
          }
        : null,
    }
  }, { FILA, NOMBRE_LARGO })
  resultado.axeMovil = await correrAxe(movil)
  await movil.screenshot({ path: path.join(DESTINO, 'pacientes--movil-390.png'), fullPage: true })
  await contextMovil.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log('oscuro    :', JSON.stringify(resultado.oscuro))
  console.log('navegación:', JSON.stringify(resultado.navegacion))
  console.log('claro     :', JSON.stringify(resultado.claro))
  console.log('móvil     :', JSON.stringify(resultado.movil))
  console.log('axe oscuro:', JSON.stringify(resultado.axeOscuro))
  console.log('axe claro :', JSON.stringify(resultado.axeClaro))
  console.log('axe móvil :', JSON.stringify(resultado.axeMovil))
  console.log('errores de consola:', erroresConsola.length)
}

main().catch((e) => { console.error(e); process.exit(1) })
