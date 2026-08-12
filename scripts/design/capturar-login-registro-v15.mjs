/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-REMAINING-SCREENS-001 (cuarta rebanada:
 * LA PUERTA DE ENTRADA HABLA EL SISTEMA). §40 Real Browser Requirement.
 *
 * Hermano de `capturar-orden-cromo-v15.mjs`. No siembra nada propio: /login y
 * /registro son públicas; la cuenta del médico la pone `sembrar-capturas.mjs`
 * (arnés) y el alta de prueba crea SU PROPIA cuenta sintética en el emulador.
 *
 * Mide — con getComputedStyle y clic real, no leyendo JSX:
 *
 *   1. LA CTA de /registro computa --nexus-solido de fondo con texto BLANCO en
 *      los dos temas (antes: #000 sobre var(--teal), 2.99:1 en claro), y su
 *      estado deshabilitado es .btn:disabled (opacity), no un gris a mano.
 *   2. FOCO REAL: enfocar el correo de /registro pinta el anillo de
 *      .input:focus (box-shadow ≠ none) — el hack JS de borde no daba ninguno.
 *   3. TEMA: el aviso de restablecer de /login cambia de verdad entre temas
 *      (color-mix sobre el token; antes rgba crudo del tema oscuro).
 *   4. §24: CTAs ≥ 48 de alto, «¿Olvidaste tu contraseña?» ≥ 44, ojos 44×44,
 *      campos con nombre accesible.
 *   5. EQUIVALENCIA FUNCIONAL con clic real: login de verdad → /dashboard,
 *      alta de verdad → /setup, y los cruces login↔registro navegan.
 *   6. MÓVIL 390: sin desborde horizontal, CTA a fila completa.
 *   7. AXE en oscuro, claro y móvil de las DOS páginas (primera medición axe
 *      de la puerta de entrada en V15), con failureSummary completo.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-login-registro-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-login-registro'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function correrAxe(page) {
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] } })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, nodos: v.nodes.length,
      targets: v.nodes.map(n => n.target.join(' ')).slice(0, 8),
      resumen: v.nodes.map(n => n.failureSummary ?? '').slice(0, 5),
    }))
  })
}

/** CTA de /registro: fondo, texto, alto y estado deshabilitado. */
async function medirCtaRegistro(page) {
  return page.evaluate(() => {
    const cta = document.querySelector('button[type="submit"]')
    if (!cta) return { encontrada: false }
    const c = getComputedStyle(cta)
    const r = cta.getBoundingClientRect()
    return {
      encontrada: true,
      texto: cta.textContent.trim(),
      esBtnPrimary: cta.classList.contains('btn-primary'),
      fondo: c.backgroundColor,
      color: c.color,
      opacidad: c.opacity,
      alto: Math.round(r.height),
      deshabilitada: cta.disabled,
    }
  })
}

/** Campos visibles sin nombre accesible (fuera de ninguno: debe salir vacío). */
async function medirNombresDeCampos(page) {
  return page.evaluate(() => {
    const campos = [...document.querySelectorAll('input, select, textarea')]
      .filter(el => el.type !== 'hidden' && el.getBoundingClientRect().width > 0)
    const sinNombre = campos.filter(el => {
      const porLabel = el.id && document.querySelector(`label[for="${el.id}"]`)
      const porAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
      return !porLabel && !porAria
    })
    return {
      total: campos.length,
      sinNombre: sinNombre.map(el => `${el.tagName.toLowerCase()}[placeholder="${el.getAttribute('placeholder') ?? ''}"]`),
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
  const resultado = {}
  const erroresConsola = []

  // ── ESCRITORIO 1440 ──────────────────────────────────────────────────
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') erroresConsola.push(m.text()) })

  // ── /registro — la CTA y el foco real ────────────────────────────────
  await page.goto(`${BASE}/registro`, { waitUntil: 'load' })
  await page.waitForSelector('button[type="submit"]', { timeout: 20000 })
  await page.waitForTimeout(800)

  resultado.registroCtaDeshabilitadaOscuro = await medirCtaRegistro(page)
  // Foco real: el anillo de .input:focus (el hack JS no pintaba ninguno).
  resultado.focoRealEnCorreo = await page.evaluate(() => {
    const el = document.getElementById('reg-correo-electronico')
    el.focus()
    const c = getComputedStyle(el)
    return { boxShadow: c.boxShadow, borde: c.borderColor, hayAnillo: c.boxShadow !== 'none' }
  })
  await page.fill('#reg-tu-nombre-completo', 'Dra. Prueba Sintética Arnés')
  await page.fill('#reg-correo-electronico', 'alta-arnes@demo.test')
  await page.fill('#reg-contrasena', 'arnes-demo-123')
  await page.waitForTimeout(200)
  resultado.registroCtaOscuro = await medirCtaRegistro(page)
  resultado.registroCampos = await medirNombresDeCampos(page)
  resultado.enlacesSubrayados = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .filter(a => /Inicia sesión|términos|privacidad/.test(a.textContent))
      .map(a => ({ texto: a.textContent.trim().slice(0, 24), subrayado: getComputedStyle(a).textDecorationLine })),
  )
  await page.screenshot({ path: path.join(DESTINO, 'registro-oscuro-1440.png') })
  resultado.axeRegistroOscuro = await correrAxe(page)

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.registroCtaClaro = await medirCtaRegistro(page)
  await page.screenshot({ path: path.join(DESTINO, 'registro-claro-1440.png') })
  resultado.axeRegistroClaro = await correrAxe(page)
  resultado.ctaCambiaDeTema =
    resultado.registroCtaOscuro.fondo !== resultado.registroCtaClaro.fondo &&
    resultado.registroCtaOscuro.color === resultado.registroCtaClaro.color // blanco en los dos
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(200)

  // Cruce real registro → login.
  await page.click('a[href="/login"]')
  await page.waitForURL('**/login**', { timeout: 20000 })

  // ── /login — el aviso por tema y los táctiles ────────────────────────
  await page.waitForSelector('#correo-electronico', { timeout: 20000 })
  await page.waitForTimeout(500)
  await page.fill('#correo-electronico', EMAIL)
  // El aviso de restablecer: clic real (emulador de auth responde de verdad).
  await page.getByText('¿Olvidaste tu contraseña?').click()
  await page.waitForTimeout(1200)
  resultado.avisoOscuro = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d =>
      (d.textContent || '').startsWith('Te enviamos') || (d.textContent || '').startsWith('Si ese correo'))
    if (!el) return null
    const c = getComputedStyle(el)
    return { fondo: c.backgroundColor, color: c.color, texto: el.textContent.slice(0, 40) }
  })
  resultado.loginTactiles = await page.evaluate(() => {
    const alto = sel => {
      const el = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes(sel))
      return el ? Math.round(el.getBoundingClientRect().height) : null
    }
    const ojo = document.querySelector('button[aria-label*="contraseña"]')
    const ro = ojo?.getBoundingClientRect()
    return {
      olvidaste: alto('Olvidaste'),
      google: alto('Continuar con Google'),
      submit: alto('Iniciar sesión'),
      ojo: ro ? `${Math.round(ro.width)}×${Math.round(ro.height)}` : null,
    }
  })
  resultado.loginCampos = await medirNombresDeCampos(page)
  resultado.pieNxMeta = await page.evaluate(() => {
    const el = document.querySelector('p.nx-meta')
    return el ? { fs: getComputedStyle(el).fontSize, texto: el.textContent.trim().slice(0, 24) } : null
  })
  await page.screenshot({ path: path.join(DESTINO, 'login-oscuro-1440.png') })
  resultado.axeLoginOscuro = await correrAxe(page)

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.avisoClaro = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d =>
      (d.textContent || '').startsWith('Te enviamos') || (d.textContent || '').startsWith('Si ese correo'))
    if (!el) return null
    const c = getComputedStyle(el)
    return { fondo: c.backgroundColor, color: c.color }
  })
  await page.screenshot({ path: path.join(DESTINO, 'login-claro-1440.png') })
  resultado.axeLoginClaro = await correrAxe(page)
  resultado.avisoCambiaDeTema = !!resultado.avisoOscuro && !!resultado.avisoClaro &&
    (resultado.avisoOscuro.fondo !== resultado.avisoClaro.fondo ||
     resultado.avisoOscuro.color !== resultado.avisoClaro.color)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

  // Cruce real login → registro y de vuelta.
  await page.getByText('Crea una gratis').click()
  await page.waitForURL('**/registro**', { timeout: 20000 })
  resultado.cruceLoginRegistro = { llega: true, url: page.url() }
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })

  // ── EQUIVALENCIA: login REAL → /dashboard ────────────────────────────
  await page.fill('#correo-electronico', EMAIL)
  await page.fill('#contrasena', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  resultado.loginReal = { llega: true, url: page.url() }
  await ctx.close()

  // ── EQUIVALENCIA: alta REAL → /setup (contexto limpio, cuenta nueva) ──
  const ctxAlta = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  const pa = await ctxAlta.newPage()
  pa.on('console', m => { if (m.type() === 'error') erroresConsola.push(`[alta] ${m.text()}`) })
  await pa.goto(`${BASE}/registro`, { waitUntil: 'load' })
  await pa.waitForSelector('#reg-tu-nombre-completo', { timeout: 20000 })
  await pa.fill('#reg-tu-nombre-completo', 'Dr. Alta Real del Arnés')
  await pa.fill('#reg-correo-electronico', `alta-real-${Date.now()}@demo.test`)
  await pa.fill('#reg-contrasena', 'arnes-demo-123')
  await pa.click('button[type="submit"]')
  await pa.waitForURL('**/setup**', { timeout: 30000 })
  resultado.altaReal = { llega: true, url: pa.url() }
  await ctxAlta.close()

  // ── MÓVIL 390 ────────────────────────────────────────────────────────
  const ctxM = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  const pm = await ctxM.newPage()
  pm.on('console', m => { if (m.type() === 'error') erroresConsola.push(`[móvil] ${m.text()}`) })

  for (const [ruta, clave] of [['/login', 'movilLogin'], ['/registro', 'movilRegistro']]) {
    await pm.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await pm.waitForSelector('button[type="submit"]', { timeout: 20000 })
    await pm.waitForTimeout(800)
    resultado[clave] = await pm.evaluate(() => {
      const vw = window.innerWidth
      const cta = document.querySelector('button[type="submit"]')
      const r = cta?.getBoundingClientRect()
      return {
        anchoDocumento: document.documentElement.scrollWidth,
        desborda: document.documentElement.scrollWidth > vw + 1,
        ctaFilaCompleta: r ? r.width > vw * 0.7 : null,
        ctaAlto: r ? Math.round(r.height) : null,
      }
    })
    await pm.screenshot({ path: path.join(DESTINO, `${clave}-390.png`) })
    resultado[`axe${clave[0].toUpperCase()}${clave.slice(1)}`] = await correrAxe(pm)
  }
  await ctxM.close()

  await browser.close()
  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
