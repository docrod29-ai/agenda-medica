/**
 * VERIFICACIÓN EN NAVEGADOR REAL — RTC-07 + RTC-05 (V15-ORIGINALITY-REDTEAM-001;
 * ORT-04 + RT-11 · RT-06 + ORT-14; §40).
 *
 * Mide con getComputedStyle y despachando `nx:grabando` DE VERDAD — no
 * leyendo JSX — que:
 *
 * RTC-07 (la corona del pulgar es clínica):
 *   1. en /dashboard móvil el CTA «Nueva cita» del header NO se pinta;
 *   2. la acción central del BottomNav en /dashboard es «Nueva cita» SIN
 *      corona (ningún descendiente con fondo relleno);
 *   3. en /expediente/[id] móvil la acción central es «Consulta» CON corona
 *      (círculo relleno elevado) — y NO se atenúa al grabar;
 *   4. la central admin SÍ se atenúa al grabar (ícono a 0.4);
 *   5. en escritorio el header conserva «Nueva cita» (ahí no hay BottomNav).
 *
 * RTC-05 (los FAB se aquietan y salen del arco del pulgar):
 *   6. en móvil NI el FAB de ayuda NI el toggle de tema flotan en el shell;
 *   7. el trigger de ayuda vive en la topbar (≥44px), abre el panel real
 *      (role=dialog) y desaparece al grabar;
 *   8. RTC-32 INVIRTIÓ este caso, con su porqué escrito abajo, junto a las
 *      comprobaciones: en escritorio ya NO flota ninguno de los dos (el FAB
 *      llevaba el relleno de marca en 6/6 superficies y en /operaciones era el
 *      único de la pantalla). Lo que se exige ahora es que el disparador del
 *      pie del riel esté pintado, se aquiete al grabar y vuelva al detener.
 *      El cristal del toggle lo sigue vigilando el guardián estático de
 *      RTC-05 (caso 6): fuera del shell —login— el botón sigue existiendo.
 *   9. /operaciones ofrece la fila de tema (móvil y escritorio).
 *
 * El «antes» de esta medición es el paquete del equipo rojo
 * (docs/design/capturas/v15-redteam/hoy-movil*.png: FAB central coronando
 * «Nueva cita» + header duplicándola + dos FAB de esquina).
 *
 * Requiere: emuladores + siembra + build + npm start (método hermano).
 *
 * Uso:
 *   node scripts/design/capturar-pulgar-y-fabs-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-pulgar-y-fabs'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

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

const grabar = (page, activo) => page.evaluate((a) => {
  window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: a } }))
}, activo)

/** Estado pintado de los flotantes, el header de Hoy y la acción central. */
async function medir(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false
      const cs = getComputedStyle(el)
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0
    }
    const alfaDe = (bg) => {
      const m = (bg || '').match(/rgba?\([\d.]+, [\d.]+, [\d.]+(?:, ([\d.]+))?\)/)
      if (!m) return 0
      return m[1] === undefined ? 1 : Number(m[1])
    }
    const hoyAccion = document.querySelector('.hoy-accion')
    const fab = document.querySelector('.boton-ayuda-fab')
    const toggle = document.querySelector('.theme-toggle')
    /* RTC-32 — el disparador de la ayuda ya no es sólo el de la topbar móvil:
       en escritorio vive en el pie del riel. Se busca el que esté PINTADO, no
       el primero del DOM: en escritorio el de la topbar existe pero está
       oculto por CSS, y coger el primero devolvía un elemento invisible (el
       propio arnés de RTC-32 se cazó ese fallo midiendo «ayuda inalcanzable
       en escritorio» cuando sí lo era). */
    const trigger = [...document.querySelectorAll('[aria-label="Abrir ayuda"]')]
      .find(el => {
        const cs = getComputedStyle(el)
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0
      }) || null
    const central = document.querySelector('.bottom-nav a[aria-label="Nueva cita"], .bottom-nav a[aria-label="Consulta"]')
    let centralRelleno = null, centralLabel = null, centralIconOpacidad = null
    if (central) {
      centralLabel = central.getAttribute('aria-label')
      centralRelleno = [...central.querySelectorAll('*')].some(el => alfaDe(getComputedStyle(el).backgroundColor) > 0.5)
      const svg = central.querySelector('svg')
      centralIconOpacidad = svg ? Number(getComputedStyle(svg).opacity) : null
    }
    const rectTrigger = trigger && visible(trigger) ? trigger.getBoundingClientRect() : null
    return {
      hoyAccionVisible: visible(hoyAccion),
      ayudaFabVisible: visible(fab),
      toggleVisible: visible(toggle),
      toggleCristal: toggle ? getComputedStyle(toggle).backdropFilter : null,
      toggleBgAlfa: toggle ? alfaDe(getComputedStyle(toggle).backgroundColor) : null,
      triggerAyudaVisible: visible(trigger),
      triggerAyudaTamano: rectTrigger ? { w: Math.round(rectTrigger.width), h: Math.round(rectTrigger.height) } : null,
      panelAyudaAbierto: visible(document.querySelector('.boton-ayuda-panel')),
      centralLabel, centralRelleno, centralIconOpacidad,
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
  const uid = await uidDelMedico()
  const resultado = {}
  const fallos = []

  for (const [nombre, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport, deviceScaleFactor: 1, locale: 'es-MX', timezoneId: 'America/Mexico_City',
    })
    await context.addInitScript((u) => {
      try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
    }, uid)
    const page = await context.newPage()
    const erroresConsola = []
    page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
    await login(page)
    await page.waitForTimeout(1800)

    const r = {}
    r.hoy = await medir(page)
    await page.screenshot({ path: path.join(DESTINO, `hoy-${nombre}--despues.png`) })

    // Al grabar: los flotantes y el trigger desaparecen; al detener vuelven.
    await grabar(page, true)
    await page.waitForTimeout(300)
    r.hoyGrabando = await medir(page)
    await page.screenshot({ path: path.join(DESTINO, `hoy-${nombre}--grabando.png`) })
    await grabar(page, false)
    await page.waitForTimeout(300)
    r.hoyAlDetener = await medir(page)

    if (nombre === 'mobile') {
      // El trigger de la topbar abre el panel REAL.
      await page.click('.mobile-topbar [aria-label="Abrir ayuda"]')
      await page.waitForTimeout(400)
      r.trasAbrirAyuda = await medir(page)
      await page.screenshot({ path: path.join(DESTINO, 'panel-ayuda-movil.png') })
      await page.keyboard.press('Escape')

      // Contexto clínico: la central lleva CORONA y no se atenúa al grabar.
      await page.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
      await page.waitForTimeout(1500)
      r.expediente = await medir(page)
      await page.screenshot({ path: path.join(DESTINO, 'expediente-mobile--central-coronada.png') })
      await grabar(page, true)
      await page.waitForTimeout(300)
      r.expedienteGrabando = await medir(page)
      await grabar(page, false)

      // El tema vive en Operaciones.
      await page.goto(`${BASE}/operaciones`, { waitUntil: 'load' })
      await page.waitForTimeout(1200)
      r.operacionesTema = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => /^Tema:/.test((b.textContent || '').trim()))
        return btn ? { texto: btn.textContent.trim(), alto: Math.round(btn.getBoundingClientRect().height) } : null
      })
      await page.screenshot({ path: path.join(DESTINO, 'operaciones-mobile--tema.png') })
    }

    r.erroresConsola = erroresConsola
    resultado[nombre] = r
    await context.close()
  }

  const d = resultado.desktop, m = resultado.mobile
  // RTC-07
  if (!d.hoy.hoyAccionVisible) fallos.push('desktop: el header perdió «Nueva cita» (sólo debía suprimirse en móvil)')
  if (m.hoy.hoyAccionVisible) fallos.push('mobile: «Nueva cita» del header sigue pintada — duplicada con el pulgar')
  if (m.hoy.centralLabel !== 'Nueva cita') fallos.push(`mobile hoy: la acción central es ${m.hoy.centralLabel}`)
  if (m.hoy.centralRelleno !== false) fallos.push('mobile hoy: la central admin sigue CORONADA (fondo relleno)')
  if (m.hoyGrabando.centralIconOpacidad !== null && m.hoyGrabando.centralIconOpacidad > 0.5)
    fallos.push('mobile hoy: la central admin no se atenúa al grabar')
  if (m.expediente.centralLabel !== 'Consulta') fallos.push(`mobile expediente: la central es ${m.expediente.centralLabel}`)
  if (m.expediente.centralRelleno !== true) fallos.push('mobile expediente: la central clínica perdió la corona')
  if (m.expedienteGrabando.centralIconOpacidad !== null && m.expedienteGrabando.centralIconOpacidad < 0.9)
    fallos.push('mobile expediente: la central CORONADA se atenuó al grabar — es la entrada al encuentro')
  // RTC-05
  if (m.hoy.ayudaFabVisible) fallos.push('mobile: el FAB de ayuda sigue flotando')
  if (m.hoy.toggleVisible) fallos.push('mobile: el toggle de tema sigue flotando en el shell')
  if (!m.hoy.triggerAyudaVisible) fallos.push('mobile: no hay trigger de ayuda en la topbar')
  if (m.hoy.triggerAyudaTamano && (m.hoy.triggerAyudaTamano.w < 44 || m.hoy.triggerAyudaTamano.h < 44))
    fallos.push(`mobile: trigger de ayuda por debajo de 44px (${JSON.stringify(m.hoy.triggerAyudaTamano)})`)
  if (!m.trasAbrirAyuda.panelAyudaAbierto) fallos.push('mobile: el trigger no abre el panel de ayuda')
  if (m.hoyGrabando.triggerAyudaVisible) fallos.push('mobile: el trigger de ayuda no se aquieta al grabar')
  if (!m.operacionesTema) fallos.push('mobile: /operaciones no ofrece la fila de tema')
  if (m.operacionesTema && m.operacionesTema.alto < 44) fallos.push('mobile: la fila de tema mide <44px')
  /* ── RTC-32: la mitad de escritorio de este arnés se INVIERTE, con su razón ──
     Hasta aquí estas líneas exigían que en escritorio los dos widgets FLOTARAN
     («desktop: el FAB de ayuda no está»), porque RTC-05 había decidido a
     propósito no juzgar el escritorio. RTC-32 lo midió y lo pagó: en las 6
     superficies el FAB llevaba el relleno de marca —el mismo peso que la
     acción clínica primaria— y en /operaciones era el único de la pantalla.
     Así que ahora se exige lo contrario, y el invariante que sobrevive intacto
     es el de §8.5: el disparador se aquieta al grabar y VUELVE al detener. */
  if (d.hoy.ayudaFabVisible) fallos.push('desktop: el FAB de ayuda volvió a flotar sobre la columna clínica')
  if (d.hoy.toggleVisible) fallos.push('desktop: el toggle de tema volvió a flotar en el shell (su casa es /operaciones)')
  if (!d.hoy.triggerAyudaVisible) fallos.push('desktop: no hay disparador de ayuda pintado (el pie del riel)')
  if (d.hoyGrabando.triggerAyudaVisible) fallos.push('desktop: el disparador de ayuda no se aquieta al grabar')
  if (!d.hoyAlDetener.triggerAyudaVisible) fallos.push('desktop: el disparador de ayuda no VUELVE al detener')

  await browser.close()
  resultado.veredicto = fallos.length ? { PASS: false, fallos } : { PASS: true }
  fs.writeFileSync(path.join(DESTINO, 'acta-pulgar-y-fabs.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado.veredicto, null, 2))
  if (fallos.length) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
