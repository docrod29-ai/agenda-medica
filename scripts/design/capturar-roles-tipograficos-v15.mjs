/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-VISUAL-SYSTEM-001 (Fase 10, segunda
 * rebanada: LOS ROLES TIPOGRÁFICOS DE VISUAL_DNA §2 EN /pendientes).
 * §40 Real Browser Requirement.
 *
 * Mide con `getComputedStyle` — no leyendo JSX — que:
 *
 *   1. `.nx-ident` pinta la identidad del paciente a 15.5px/600 encabezando
 *      la entrada, subrayada (es un enlace: no puede distinguirse sólo por
 *      color) — y que el clic NAVEGA de verdad al expediente (equivalencia
 *      funcional: mismo destino que el enlace teal que reemplaza).
 *   2. `.nx-estado` pinta el tipo en versalitas con su punto, y en la tarjeta
 *      cerrada el punto es VERDE (§3: cerrado/completo, atenuado).
 *   3. `.nx-meta` (12.5/--text3) y `.nx-num` (tabular-nums) visten metadatos
 *      y fechas.
 *   4. `.nx-critico` pinta el motivo de escalamiento a 13/700 CON icono svg
 *      en el mismo elemento — nunca sólo color.
 *   5. Nada de esto introduce violaciones axe nuevas, en tema oscuro NI claro.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm
 * start` (mismo método que toda la familia capturar-*-v15).
 *
 * Uso:
 *   node scripts/design/capturar-roles-tipograficos-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-roles-tipograficos'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'

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

/** Los roles, medidos sobre la primera tarjeta que los tenga todos. */
async function medirRoles(page) {
  return page.evaluate(() => {
    const ident = document.querySelector('a.nx-ident')
    const estado = document.querySelector('.nx-estado')
    const meta = document.querySelector('.nx-meta')
    const critico = document.querySelector('.nx-critico')
    const num = document.querySelector('.nx-num')
    const estilo = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        textDecorationLine: s.textDecorationLine,
        textTransform: s.textTransform,
        fontVariantNumeric: s.fontVariantNumeric,
      }
    }
    return {
      temaActual: document.documentElement.getAttribute('data-theme') ?? '(default)',
      ident: ident ? { texto: ident.textContent?.trim(), href: ident.getAttribute('href'), ...estilo(ident) } : null,
      estado: estado
        ? {
            texto: estado.textContent?.trim(),
            ...estilo(estado),
            punto: getComputedStyle(estado, '::before').backgroundColor,
          }
        : null,
      meta: meta ? estilo(meta) : null,
      critico: critico
        ? {
            texto: critico.textContent?.trim(),
            conIcono: !!critico.querySelector('svg'),
            ...estilo(critico),
          }
        : null,
      num: num ? estilo(num) : null,
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

  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.waitForSelector('a.nx-ident', { timeout: 20000 })

  resultado.oscuro = await medirRoles(page)
  await page.screenshot({ path: path.join(DESTINO, 'pendientes--oscuro-1440.png'), fullPage: true })
  resultado.axeOscuro = await correrAxe(page)

  // «Cerrados recientemente»: el punto verde del estado cerrado (§3).
  await page.getByRole('button', { name: /Ver cerrados recientemente/i }).click()
  await page.waitForTimeout(1200)
  resultado.cerrada = await page.evaluate(() => {
    // La sección de cerrados es la última; su .nx-estado lleva --estado-tono verde.
    const estados = [...document.querySelectorAll('.nx-estado')]
    const cerrado = estados[estados.length - 1]
    if (!cerrado) return null
    return {
      texto: cerrado.textContent?.trim(),
      punto: getComputedStyle(cerrado, '::before').backgroundColor,
      tonoDeclarado: cerrado.style.getPropertyValue('--estado-tono') || null,
    }
  })
  // `<main>` desplaza por dentro del nx-app-shell (4ª rebanada de Fase 9):
  // fullPage captura la VENTANA, no el scroll interno — sin esto la tarjeta
  // cerrada queda medida en el DOM pero fuera de la foto.
  await page.evaluate(() => {
    const estados = [...document.querySelectorAll('.nx-estado')]
    estados[estados.length - 1]?.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, 'pendientes--cerradas-1440.png'), fullPage: true })

  // ── EQUIVALENCIA FUNCIONAL: el enlace de identidad NAVEGA al expediente ──
  const href = await page.locator('a.nx-ident').first().getAttribute('href')
  await page.locator('a.nx-ident').first().click()
  await page.waitForURL('**/expediente/**', { timeout: 20000 })
  resultado.navegacion = {
    hrefDeclarado: href,
    urlAterrizada: new URL(page.url()).pathname,
    llega: new URL(page.url()).pathname === href,
  }
  await page.goBack()
  await page.waitForSelector('a.nx-ident', { timeout: 20000 })

  // ── TEMA CLARO (mismos puntos; los tokens cambian de hex por tema) ────────
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.claro = await medirRoles(page)
  await page.screenshot({ path: path.join(DESTINO, 'pendientes--claro-1440.png'), fullPage: true })
  resultado.axeClaro = await correrAxe(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await context.close()

  // ── MÓVIL 390×844: la cabecera envuelve sin desbordar ─────────────────────
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
  await movil.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await movil.waitForSelector('a.nx-ident', { timeout: 20000 })
  resultado.movil = await movil.evaluate(() => {
    const doc = document.documentElement
    const ident = document.querySelector('a.nx-ident')
    return {
      desbordeHorizontal: doc.scrollWidth > doc.clientWidth,
      anchoDocumento: doc.scrollWidth,
      ident: ident ? { fontSize: getComputedStyle(ident).fontSize, texto: ident.textContent?.trim() } : null,
    }
  })
  resultado.axeMovil = await correrAxe(movil)
  await movil.screenshot({ path: path.join(DESTINO, 'pendientes--movil-390.png'), fullPage: true })
  await contextMovil.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log('oscuro    :', JSON.stringify(resultado.oscuro))
  console.log('cerrada   :', JSON.stringify(resultado.cerrada))
  console.log('navegación:', JSON.stringify(resultado.navegacion))
  console.log('claro     :', JSON.stringify(resultado.claro))
  console.log('móvil     :', JSON.stringify(resultado.movil))
  console.log('axe oscuro:', JSON.stringify(resultado.axeOscuro))
  console.log('axe claro :', JSON.stringify(resultado.axeClaro))
  console.log('axe móvil :', JSON.stringify(resultado.axeMovil))
  console.log('errores de consola:', erroresConsola.length)
}

main().catch((e) => { console.error(e); process.exit(1) })
