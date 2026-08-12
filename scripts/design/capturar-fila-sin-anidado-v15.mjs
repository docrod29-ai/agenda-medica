/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-A11Y-001, 3ª rebanada: LAS FILAS DE
 * /pacientes YA NO ANIDAN UN CONTROL DENTRO DE OTRO. §40 Real Browser
 * Requirement.
 *
 * Mide contra el DOM vivo — no leyendo JSX — que:
 *
 *   1. axe ya NO reporta `nested-interactive` en /pacientes (era ×5, la
 *      familia del botón Editar, presente en TODAS las mediciones de la
 *      pantalla) — y se guarda el reporte COMPLETO de violaciones por tema.
 *   2. El velo funciona: un clic en la fila LEJOS de la identidad (la zona
 *      del metadato) navega al expediente — el gesto del ratón de siempre.
 *   3. Editar sigue siendo Editar: su clic abre el modal «Editar paciente»
 *      y la URL NO cambia (el hermano vive por encima del velo).
 *   4. El teclado gana un orden honesto: la identidad es un <button> real
 *      que recibe foco y Enter navega — sin role="button" sintético.
 *   5. El Editar mide su contraste real (para cerrar la conflación
 *      «color-contrast» del inventario con cifras, no con memoria).
 *   6. Nada de esto desborda en móvil 390 y el velo también abre ahí.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`.
 *
 * Uso:
 *   node scripts/design/capturar-fila-sin-anidado-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-fila-sin-anidado'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
const ABRIR = 'button.nx-fila-abrir'

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
      resumen: v.nodes.map(n => n.failureSummary ?? '').slice(0, 3),
    }))
  })
}

/** La estructura viva: botones hermanos, cero anidamiento, velo presente. */
async function medirEstructura(page) {
  return page.evaluate((ABRIR) => {
    const abrir = Array.from(document.querySelectorAll(ABRIR))
    if (!abrir.length) return null
    const primera = abrir[0]
    const fila = primera.closest('div[style*="relative"]') ?? primera.parentElement?.parentElement
    const editarDentroDeAbrir = abrir.reduce(
      (n, b) => n + b.querySelectorAll('button, a, [role="button"]').length, 0)
    const veil = getComputedStyle(primera, '::after')
    const editar = fila?.querySelector('button[title="Editar datos de contacto"]') ?? null
    const sEditar = editar ? getComputedStyle(editar) : null
    return {
      temaActual: document.documentElement.getAttribute('data-theme') ?? '(default)',
      botonesAbrir: abrir.length,
      // El corazón del defecto: interactivos DENTRO del control que abre.
      interactivosAnidados: editarDentroDeAbrir,
      filasConRoleButton: document.querySelectorAll('div[role="button"][aria-label^="Abrir el expediente de"]').length,
      etiqueta: primera.getAttribute('aria-label'),
      esBotonNativo: primera.tagName === 'BUTTON',
      velo: { position: veil.position, inset: veil.inset },
      editar: sEditar ? {
        zIndex: sEditar.zIndex, position: sEditar.position,
        color: sEditar.color, background: sEditar.backgroundColor,
      } : null,
    }
  }, ABRIR)
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
  await page.waitForSelector(ABRIR, { timeout: 20000 })
  await page.waitForTimeout(400)

  resultado.oscuro = await medirEstructura(page)
  await page.screenshot({ path: path.join(DESTINO, 'pacientes--oscuro-1440.png'), fullPage: true })
  resultado.axeOscuro = await correrAxe(page)

  // ── 2. EL VELO: clic en la fila LEJOS de la identidad navega ─────────────
  // Coordenadas del metadato (teléfono/edad) de la primera fila: territorio
  // del ::after. Clic POSICIONAL (page.mouse), como el ratón de verdad: el
  // locator.click() de Playwright se niega — reporta que .nx-fila-abrir
  // «intercepts pointer events», que es EXACTAMENTE el velo funcionando.
  const cajaMeta = await page.locator('.nx-meta').first().boundingBox()
  await page.mouse.click(cajaMeta.x + cajaMeta.width / 2, cajaMeta.y + cajaMeta.height / 2)
  await page.waitForURL('**/expediente/**', { timeout: 20000 })
  resultado.veloNavega = {
    urlAterrizada: new URL(page.url()).pathname,
    llega: new URL(page.url()).pathname.startsWith('/expediente/'),
  }
  await page.goBack()
  await page.waitForSelector(ABRIR, { timeout: 20000 })
  await page.waitForTimeout(400)

  // ── 3. EDITAR: abre el modal, NO navega ──────────────────────────────────
  const urlAntes = new URL(page.url()).pathname
  await page.locator('button[title="Editar datos de contacto"]').first().click()
  await page.waitForTimeout(600)
  resultado.editar = {
    modalAbierto: await page.getByText('Editar paciente', { exact: true }).count() > 0,
    urlSigueSiendo: new URL(page.url()).pathname,
    noNavego: new URL(page.url()).pathname === urlAntes,
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // ── 4. TECLADO: la identidad recibe foco real y Enter navega ─────────────
  await page.locator(ABRIR).first().focus()
  resultado.teclado = await page.evaluate((ABRIR) => {
    const activo = document.activeElement
    const primero = document.querySelector(ABRIR)
    return {
      focoEnBoton: activo === primero,
      tag: activo?.tagName ?? null,
      etiqueta: activo?.getAttribute('aria-label') ?? null,
    }
  }, ABRIR)
  await page.keyboard.press('Enter')
  await page.waitForURL('**/expediente/**', { timeout: 20000 })
  resultado.teclado.enterNavega = new URL(page.url()).pathname.startsWith('/expediente/')
  await page.goBack()
  await page.waitForSelector(ABRIR, { timeout: 20000 })

  // ── TEMA CLARO ────────────────────────────────────────────────────────────
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.claro = await medirEstructura(page)
  await page.screenshot({ path: path.join(DESTINO, 'pacientes--claro-1440.png'), fullPage: true })
  resultado.axeClaro = await correrAxe(page)
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
  await movil.waitForSelector(ABRIR, { timeout: 20000 })
  await movil.waitForTimeout(400)
  resultado.movil = await movil.evaluate((ABRIR) => {
    const doc = document.documentElement
    return {
      desbordeHorizontal: doc.scrollWidth > doc.clientWidth,
      anchoDocumento: doc.scrollWidth,
      botonesAbrir: document.querySelectorAll(ABRIR).length,
    }
  }, ABRIR)
  resultado.axeMovil = await correrAxe(movil)
  await movil.screenshot({ path: path.join(DESTINO, 'pacientes--movil-390.png'), fullPage: true })
  // El velo también abre con el dedo — tap posicional por la misma razón.
  const cajaMetaMovil = await movil.locator('.nx-meta').first().boundingBox()
  await movil.touchscreen.tap(cajaMetaMovil.x + cajaMetaMovil.width / 2, cajaMetaMovil.y + cajaMetaMovil.height / 2)
  await movil.waitForURL('**/expediente/**', { timeout: 20000 })
  resultado.movil.veloNavega = new URL(movil.url()).pathname.startsWith('/expediente/')
  await contextMovil.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log('oscuro     :', JSON.stringify(resultado.oscuro))
  console.log('velo navega:', JSON.stringify(resultado.veloNavega))
  console.log('editar     :', JSON.stringify(resultado.editar))
  console.log('teclado    :', JSON.stringify(resultado.teclado))
  console.log('claro      :', JSON.stringify(resultado.claro))
  console.log('móvil      :', JSON.stringify(resultado.movil))
  console.log('axe oscuro :', JSON.stringify(resultado.axeOscuro))
  console.log('axe claro  :', JSON.stringify(resultado.axeClaro))
  console.log('axe móvil  :', JSON.stringify(resultado.axeMovil))
  console.log('errores de consola:', erroresConsola.length)
}

main().catch((e) => { console.error(e); process.exit(1) })
