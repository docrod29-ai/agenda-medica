/**
 * MEDICIÓN — V15-MOBILE-001, sexta rebanada (§22, §33 Fase 9).
 *
 * NO cambia nada: mide los trabajos móviles de §22 que la quinta rebanada dejó
 * nombrados y que la radiografía anterior (medir-trabajos-moviles-v15.mjs) NO
 * cubrió, contra las pantallas REALES a 390×844:
 *
 *   - «review generated note» → /nota/[pid]/[notaId] (nota firmada, el
 *     documento que el médico revisa y que acaba en manos del paciente);
 *   - «review result» a nivel de ITEM → /pendientes: qué ofrece una fila al
 *     pulgar (no sólo el shell, que ya se midió en la tercera rebanada);
 *   - «patient communication draft/review» → /chat (la única superficie de
 *     mensajería del producto hoy; es interna médico↔asistente — parte de la
 *     medición es DOCUMENTAR esa ausencia, no suponer que existe).
 *
 * Para cada pantalla: desborde horizontal, objetivos táctiles <44px (§24),
 * acción primaria visible sin scroll, alto de shell fijo, y captura.
 *
 * Uso: node scripts/design/medir-trabajos-moviles-2-v15.mjs [carpetaDestino]
 * (emuladores 8080/9099 arriba, app en :3000 con .env.local demo, siembra de
 * sembrar-capturas.mjs + nota firmada ad-hoc)
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-trabajos-moviles-2'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'
const NOTA_ID = 'nota-cap-seguimiento-firmada'

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

/** Radiografía móvil de la pantalla actual (mismo contrato que la 1ª medición). */
async function medir(page, accionPrimariaTexto) {
  return page.evaluate((primariaTexto) => {
    const vw = window.innerWidth
    const vh = window.innerHeight

    const desborda = document.documentElement.scrollWidth > vw + 1
    let culpableDesborde = null
    if (desborda) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width > vw + 1 && el.children.length === 0) {
          culpableDesborde = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} w=${Math.round(r.width)}`
          break
        }
      }
    }

    const interactivos = [...document.querySelectorAll('button, a, input, select, textarea, [role="button"]')]
    const chicos = interactivos.filter(el => {
      const r = el.getBoundingClientRect()
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh
      return visible && (r.width < 44 || r.height < 44) && !el.closest('[aria-hidden="true"]')
    })
    const chicosResumen = chicos.slice(0, 12).map(el => {
      const r = el.getBoundingClientRect()
      return `${el.tagName.toLowerCase()}"${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 26)}" ${Math.round(r.width)}×${Math.round(r.height)}`
    })

    let primaria = null
    if (primariaTexto) {
      const candidatos = [...document.querySelectorAll('button, a')]
        .filter(el => (el.textContent || '').includes(primariaTexto))
      const el = candidatos[0]
      if (el) {
        const r = el.getBoundingClientRect()
        primaria = {
          texto: primariaTexto,
          visibleSinScroll: r.top >= 0 && r.bottom <= vh,
          tam: `${Math.round(r.width)}×${Math.round(r.height)}`,
          top: Math.round(r.top),
        }
      } else {
        primaria = { texto: primariaTexto, encontrada: false }
      }
    }

    const piezas = ['.mobile-topbar', '.nx-instrument-strip', '.bottom-nav-wrap']
    const shell = {}
    let shellPx = 0
    for (const sel of piezas) {
      const el = document.querySelector(sel)
      if (el) {
        const r = el.getBoundingClientRect()
        const visible = getComputedStyle(el).display !== 'none' && r.height > 0
        shell[sel] = visible ? Math.round(r.height) : 0
        if (visible) shellPx += r.height
      }
    }
    const main = document.querySelector('main')
    const mainTop = main ? Math.round(main.getBoundingClientRect().top) : null

    return {
      vw, vh, desborda, culpableDesborde,
      tactilesChicos: chicos.length, tactilesChicosEjemplos: chicosResumen,
      primaria,
      shellAlturas: shell, shellPxTotal: Math.round(shellPx), mainTop,
    }
  }, accionPrimariaTexto ?? null)
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

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await context.addInitScript((u) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      // El aviso push como hoja ya se midió en la 5ª rebanada; aquí se
      // descarta para medir las pantallas debajo, no el aviso.
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* noop */ }
  }, uid)
  const page = await context.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)
  await page.waitForTimeout(1500)

  // ── «review generated note»: /nota/[pid]/[notaId] (nota FIRMADA sembrada)
  await page.goto(`${BASE}/nota/${PATIENT_ID}/${NOTA_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  resultado.notaArriba = await medir(page, 'Imprimir')
  await page.screenshot({ path: path.join(DESTINO, 'nota-arriba.png') })
  // ¿el documento-papel (hoja carta) desborda o se escala? ¿cuánto mide el texto?
  resultado.notaDocumento = await page.evaluate(() => {
    const doc = document.getElementById('doc')
    if (!doc) return { encontrado: false }
    const r = doc.getBoundingClientRect()
    // tamaño de letra REAL en pantalla de una sección del cuerpo
    const p = doc.querySelector('p, td, div[style*="font-size"]')
    const fs = p ? getComputedStyle(p).fontSize : null
    // ¿hay transform scale?
    let escala = null
    for (let el = doc; el; el = el.parentElement) {
      const t = getComputedStyle(el).transform
      if (t && t !== 'none') { escala = t; break }
    }
    return {
      encontrado: true,
      anchoDoc: Math.round(r.width),
      ventana: window.innerWidth,
      fontSizeMuestra: fs,
      transform: escala,
      scrollWidthBody: document.documentElement.scrollWidth,
    }
  })
  // pie de la nota (acciones al final, adenda, etc.)
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = m.scrollHeight; window.scrollTo(0, document.body.scrollHeight) })
  await page.waitForTimeout(600)
  resultado.notaPie = await medir(page, 'Agregar adenda')
  await page.screenshot({ path: path.join(DESTINO, 'nota-pie.png') })

  // ── «review result» a nivel de item: /pendientes
  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  resultado.pendientes = await medir(page, null)
  // radiografía de la PRIMERA fila de tarea: qué ofrece al pulgar
  resultado.pendientesFila = await page.evaluate(() => {
    // la primera tarjeta/fila de tarea con acciones dentro
    const filas = [...document.querySelectorAll('main li, main [class*="fila"], main article, main section div')]
      .filter(el => /urocultivo|seguimiento|metformina|EPOC/i.test(el.textContent || '') && el.querySelector('button, a'))
    const fila = filas[0]
    if (!fila) return { encontrada: false }
    const acciones = [...fila.querySelectorAll('button, a')].slice(0, 10).map(el => {
      const r = el.getBoundingClientRect()
      return `${el.tagName.toLowerCase()}"${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`
    })
    return { encontrada: true, alto: Math.round(fila.getBoundingClientRect().height), acciones }
  })
  await page.screenshot({ path: path.join(DESTINO, 'pendientes.png') })

  // ── «patient communication draft»: /chat (superficie de mensajería actual)
  await page.goto(`${BASE}/chat`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  resultado.chat = await medir(page, 'Enviar')
  // ¿el composer queda al alcance del pulgar? ¿tapado por el BottomNav?
  resultado.chatComposer = await page.evaluate(() => {
    const ta = document.querySelector('textarea')
    const nav = document.querySelector('.bottom-nav-wrap')
    if (!ta) return { encontrado: false }
    const r = ta.getBoundingClientRect()
    const rn = nav ? nav.getBoundingClientRect() : null
    return {
      encontrado: true,
      composerBottom: Math.round(r.bottom),
      viewport: window.innerHeight,
      navTop: rn ? Math.round(rn.top) : null,
      composerTapadoPorNav: rn ? r.bottom > rn.top : false,
    }
  })
  await page.screenshot({ path: path.join(DESTINO, 'chat.png') })

  await context.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Radiografía móvil 2 (390×844) ──')
  for (const [k, v] of Object.entries(resultado)) {
    console.log(`\n[${k}]`, JSON.stringify(v, null, 1).slice(0, 900))
  }
  console.log('\nerrores de consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
