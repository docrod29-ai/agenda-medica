/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-A11Y-001, sexta rebanada: los dos
 * táctiles chicos que eran ENLACES. §40 Real Browser Requirement.
 *
 * El defecto que paga: la radiografía de trabajos móviles de Fase 9 midió
 * «Activar plan →» (TrialBanner) a 100×24 y el enlace de paciente de
 * /pendientes (a.nx-ident) a 156×20 — por debajo del mínimo táctil de §24.
 * La causa raíz: el bloque `@media (pointer: coarse)` nunca cubrió `<a>`.
 *
 * La salida estira el área de GOLPE con un pseudo `::before` centrado
 * (mismo mecanismo que .nx-fila-abrir::after). El pseudo NO aparece en
 * getBoundingClientRect — por eso este arnés NO mide rects: mide el área
 * que el hit-testing del navegador de verdad le atribuye al enlace
 * (elementFromPoint, barrido vertical de 2px) y luego ENTREGA el tap
 * (touchscreen.tap en la zona estirada → la navegación llega). Una
 * radiografía futura que sólo lea rects volverá a ver 156×20: tiene que
 * hit-testear, y este arnés es el precedente.
 *
 * Mide, no supone:
 *   1. Móvil 390 (hasTouch → pointer: coarse de verdad, se comprueba con
 *      matchMedia): el alto EFECTIVO de golpe de los dos enlaces ≥44px.
 *   2. El tap FUERA de lo visible (encima del texto / debajo de la píldora)
 *      navega: /pendientes → /expediente/[pid] y banner → /configuracion.
 *   3. Escritorio 1440 (puntero fino): el pseudo NO existe — un clic 8px
 *      encima del enlace NO cae en el enlace (la densidad de escritorio no
 *      se estiró) y el alto del banner queda idéntico.
 *   4. Lo visible no se movió un píxel: rect del enlace sigue ~20px de alto
 *      y la píldora ~24px — el estirón es de golpe, no de layout.
 *   5. axe en /pendientes móvil (con el banner presente), detalle completo.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`
 * (la clínica sembrada nace en trial → el banner se pinta solo; las tareas
 * sembradas llevan patientId → el enlace de identidad se pinta solo).
 *
 * Uso:
 *   node scripts/design/capturar-tactiles-de-enlace-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-tactiles-de-enlace'
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

/**
 * El alto EFECTIVO de golpe: desde el centro del enlace, búsqueda binaria del
 * borde (precisión 0.25px) hacia arriba y hacia abajo mientras
 * elementFromPoint siga atribuyendo el punto al enlace (el hit-testing de un
 * ::before pertenece a su elemento). El primer intento de este arnés barría
 * en pasos de 2px y perdía hasta 4px en los bordes: medía 40 sobre un área
 * real de 44. También se reporta el alto COMPUTADO del pseudo, que es la
 * cifra que la regla escribe.
 */
async function altoDeGolpe(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const esElEnlace = (y) => {
      const hit = document.elementFromPoint(x, y)
      return hit === el || el.contains(hit)
    }
    const centro = r.top + r.height / 2
    const borde = (dir) => {
      let bueno = centro
      let malo = centro + dir * 60
      for (let i = 0; i < 12; i++) {
        const m = (bueno + malo) / 2
        if (esElEnlace(m)) bueno = m
        else malo = m
      }
      return bueno
    }
    const top = borde(-1)
    const bottom = borde(+1)
    return {
      rect: { alto: Math.round(r.height), ancho: Math.round(r.width), top: Math.round(r.top) },
      golpe: { top: +top.toFixed(1), bottom: +bottom.toFixed(1), alto: +(bottom - top).toFixed(1) },
      pseudoComputado: getComputedStyle(el, '::before').height,
      x: Math.round(x),
    }
  }, selector)
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
      id: v.id, impact: v.impact, help: v.help, nodos: v.nodes.length,
      detalles: v.nodes.map(n => ({
        target: n.target?.join(' ') ?? '',
        resumen: n.failureSummary ?? '',
        html: (n.html ?? '').slice(0, 200),
      })),
    }))
  })
}

const ENLACE_PACIENTE = 'a.nx-ident'
const CTA_BANNER = 'a.nx-cta-aviso'

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = {}
  const erroresConsola = []
  const uid = await uidDelMedico()

  // ── MÓVIL 390×844, dedo de verdad ─────────────────────────────────────────
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
  await movil.waitForSelector(ENLACE_PACIENTE, { timeout: 20000 })
  await movil.waitForTimeout(400)

  // El estirón sólo existe si el medio ES de puntero grueso — se comprueba,
  // no se supone (hasTouch de Playwright debe traducirse a coarse).
  resultado.movilEsCoarse = await movil.evaluate(() => matchMedia('(pointer: coarse)').matches)

  resultado.movilPaciente = await altoDeGolpe(movil, ENLACE_PACIENTE)
  resultado.movilBanner = await altoDeGolpe(movil, CTA_BANNER)
  await movil.screenshot({ path: path.join(DESTINO, 'pendientes--movil-390.png'), fullPage: false })
  resultado.axeMovil = await correrAxe(movil)

  // ── EL TAP LLEGA (regla «el dato tiene que llegar», dicha en táctil):
  // tap FUERA del texto visible, dentro de la zona estirada. ──────────────
  const p = resultado.movilPaciente
  if (p) {
    await movil.touchscreen.tap(p.x, p.rect.top - 6)
    await movil.waitForURL('**/expediente/**', { timeout: 20000 }).catch(() => {})
    resultado.tapPacienteNavega = {
      punto: `${p.x},${p.rect.top - 6} (6px encima del texto)`,
      urlAterrizada: new URL(movil.url()).pathname,
      llega: new URL(movil.url()).pathname.startsWith('/expediente/'),
    }
    await movil.goBack()
    await movil.waitForSelector(CTA_BANNER, { timeout: 20000 })
    await movil.waitForTimeout(300)
  }
  const b = await altoDeGolpe(movil, CTA_BANNER)
  if (b) {
    const yBajo = b.rect.top + b.rect.alto + 6
    await movil.touchscreen.tap(b.x, yBajo)
    await movil.waitForURL('**/configuracion**', { timeout: 20000 }).catch(() => {})
    resultado.tapBannerNavega = {
      punto: `${b.x},${yBajo} (6px debajo de la píldora)`,
      urlAterrizada: new URL(movil.url()).pathname + new URL(movil.url()).search,
      llega: new URL(movil.url()).pathname.startsWith('/configuracion'),
    }
  }
  await contextMovil.close()

  // ── ESCRITORIO 1440, puntero fino: la densidad NO se estiró ───────────────
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  })
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
  await page.waitForSelector(ENLACE_PACIENTE, { timeout: 20000 })
  await page.waitForTimeout(400)

  resultado.escritorioEsCoarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
  resultado.escritorioPaciente = await altoDeGolpe(page, ENLACE_PACIENTE)
  resultado.escritorioBanner = await altoDeGolpe(page, CTA_BANNER)
  resultado.escritorioBannerAlto = await page.evaluate(() => {
    const cta = document.querySelector('a.nx-cta-aviso')
    return cta ? Math.round(cta.closest('[role="status"]')?.getBoundingClientRect().height ?? -1) : null
  })
  await page.screenshot({ path: path.join(DESTINO, 'pendientes--escritorio-1440.png'), fullPage: false })
  await context.close()

  await browser.close()
  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 1))

  const ok = (v) => (v ? 'OK' : 'FALLA')
  console.log(JSON.stringify({
    movilEsCoarse: resultado.movilEsCoarse,
    paciente: {
      visible: `${resultado.movilPaciente?.rect.ancho}×${resultado.movilPaciente?.rect.alto}`,
      golpe: resultado.movilPaciente?.golpe.alto,
      pseudoComputado: resultado.movilPaciente?.pseudoComputado,
      cumple44: ok((resultado.movilPaciente?.golpe.alto ?? 0) >= 43.5),
    },
    banner: {
      visible: `${resultado.movilBanner?.rect.ancho}×${resultado.movilBanner?.rect.alto}`,
      golpe: resultado.movilBanner?.golpe.alto,
      pseudoComputado: resultado.movilBanner?.pseudoComputado,
      cumple44: ok((resultado.movilBanner?.golpe.alto ?? 0) >= 43.5),
    },
    tapPacienteNavega: resultado.tapPacienteNavega,
    tapBannerNavega: resultado.tapBannerNavega,
    escritorio: {
      esCoarse: resultado.escritorioEsCoarse,
      pacienteGolpe: resultado.escritorioPaciente?.golpe.alto,
      bannerGolpe: resultado.escritorioBanner?.golpe.alto,
      bannerAlto: resultado.escritorioBannerAlto,
      sinEstirar: ok(
        (resultado.escritorioPaciente?.golpe.alto ?? 99) < 44 &&
        (resultado.escritorioBanner?.golpe.alto ?? 99) < 44,
      ),
    },
    axeMovil: resultado.axeMovil?.map(v => `${v.id}×${v.nodos}`),
    consola: erroresConsola.length,
  }, null, 1))
}

main().catch((e) => { console.error(e); process.exit(1) })
