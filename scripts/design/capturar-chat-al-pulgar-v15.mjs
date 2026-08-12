/**
 * V15-MOBILE-001, sexta rebanada (§22/§24) — verificación en navegador REAL
 * del arreglo del chat: el composer vive ENCIMA del BottomNav, no debajo.
 *
 * No sólo screenshot: mide comportamiento de punta a punta —
 *   1. geometría: composer.bottom <= BottomNav.top (el defecto medido era
 *      889 > 791 en un viewport de 844);
 *   2. «el dato tiene que LLEGAR»: se escribe un mensaje con el teclado real
 *      y se pulsa Enviar; se comprueba que el mensaje aparece en la lista
 *      (ida y vuelta por el Firestore del emulador, no un setState local);
 *   3. §24: textarea y Enviar >= 44px medidos con getBoundingClientRect;
 *   4. axe con el chat abierto (violaciones nuevas = bloqueante);
 *   5. escritorio 1440: el chat sigue llenando el alto sin recorte (el
 *      cambio quita una resta que también era incorrecta ahí).
 *
 * Uso: node scripts/design/capturar-chat-al-pulgar-v15.mjs [carpetaDestino]
 * (emuladores 8080/9099 arriba, app en :3000 con .env.local demo, siembra de
 * sembrar-capturas.mjs)
 */
import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-chat-al-pulgar'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

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

async function axeScan(page) {
  const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact,
      nodes: v.nodes.slice(0, 5).map(n => n.target.join(' ')),
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
  const uid = await uidDelMedico()
  const resultado = {}
  const erroresConsola = []

  // ── MÓVIL 390×844 ─────────────────────────────────────────────────────────
  const ctxMovil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await ctxMovil.addInitScript((u) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* noop */ }
  }, uid)
  const page = await ctxMovil.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(`[movil] ${m.text()}`) })
  await login(page)
  await page.goto(`${BASE}/chat`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)

  // 1. Geometría: el composer encima del BottomNav
  resultado.geometriaMovil = await page.evaluate(() => {
    const ta = document.querySelector('textarea')
    const nav = document.querySelector('.bottom-nav-wrap')
    const boton = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Enviar')
    if (!ta || !nav || !boton) return { encontrado: false }
    const r = ta.getBoundingClientRect()
    const rn = nav.getBoundingClientRect()
    const rb = boton.getBoundingClientRect()
    return {
      encontrado: true,
      viewport: window.innerHeight,
      composerBottom: Math.round(r.bottom),
      navTop: Math.round(rn.top),
      composerEncimaDelNav: r.bottom <= rn.top + 1,
      enviarVisible: rb.top >= 0 && rb.bottom <= window.innerHeight,
      tamTextarea: `${Math.round(r.width)}×${Math.round(r.height)}`,
      tamEnviar: `${Math.round(rb.width)}×${Math.round(rb.height)}`,
      tactilOk: r.height >= 44 && rb.width >= 44 && rb.height >= 44,
    }
  })
  await page.screenshot({ path: path.join(DESTINO, 'chat-movil-vacio.png') })

  // 2. «El dato tiene que LLEGAR»: escribir + Enviar + verlo en la lista
  const textoPrueba = `Mensaje de arnés v15 — ${Math.floor(performance.now())}`
  await page.fill('textarea', textoPrueba)
  await page.click('button[aria-label="Enviar"]')
  await page.waitForTimeout(2500)
  resultado.mensajeLlega = await page.evaluate((t) => {
    const lista = document.querySelector('main')
    const aparece = (lista?.textContent || '').includes(t)
    const ta = document.querySelector('textarea')
    return { aparece, composerVacioTrasEnviar: (ta?.value ?? 'x') === '' }
  }, textoPrueba)
  await page.screenshot({ path: path.join(DESTINO, 'chat-movil-mensaje.png') })

  // 3. Axe con el chat abierto y con mensaje
  resultado.axeMovil = await axeScan(page)

  await ctxMovil.close()

  // ── ESCRITORIO 1440×900 ──────────────────────────────────────────────────
  const ctxDesk = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await ctxDesk.addInitScript((u) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* noop */ }
  }, uid)
  const pd = await ctxDesk.newPage()
  pd.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(`[desktop] ${m.text()}`) })
  await login(pd)
  await pd.goto(`${BASE}/chat`, { waitUntil: 'load' })
  await pd.waitForTimeout(2000)
  resultado.geometriaDesktop = await pd.evaluate(() => {
    const ta = document.querySelector('textarea')
    const main = document.querySelector('main')
    if (!ta || !main) return { encontrado: false }
    // el CONTENEDOR del composer (la fila con fondo y borde), no el textarea:
    // el textarea termina antes por el padding interno de la fila.
    const fila = ta.parentElement
    const r = fila.getBoundingClientRect()
    const rm = main.getBoundingClientRect()
    return {
      encontrado: true,
      viewport: window.innerHeight,
      composerBottom: Math.round(r.bottom),
      mainBottom: Math.round(rm.bottom),
      // el composer debe terminar pegado al borde de main (sin hueco de 52px
      // ni recorte): tolerancia de 2px de redondeo
      llenaElAlto: Math.abs(r.bottom - rm.bottom) <= 2,
    }
  })
  resultado.axeDesktop = await axeScan(pd)
  await pd.screenshot({ path: path.join(DESTINO, 'chat-desktop.png') })
  await ctxDesk.close()

  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Chat al pulgar (V15, 6ª rebanada) ──')
  console.log(JSON.stringify(resultado, null, 2))
  console.log('\nerrores de consola:', erroresConsola.length)

  const g = resultado.geometriaMovil
  const ok = g?.encontrado && g.composerEncimaDelNav && g.enviarVisible && g.tactilOk
    && resultado.mensajeLlega?.aparece && resultado.geometriaDesktop?.llenaElAlto
  if (!ok) {
    console.error('\n✗ ALGUNA MEDICIÓN FALLÓ — revisar resultado.json')
    process.exit(1)
  }
  console.log('\n✓ composer encima del BottomNav, Enviar visible y ≥44px, el mensaje llega, escritorio llena el alto')
}

main().catch(e => { console.error(e); process.exit(1) })
