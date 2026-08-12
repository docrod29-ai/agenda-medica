/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-MOBILE-001, quinta rebanada (§40/§36).
 *
 * El aviso de recordatorios push (`NotificacionesPushOptIn`) era
 * `fixed bottom:16 z-1000` — en 390px tapaba el BottomNav completo y se comió
 * el tap de dos arneses (documentado en capturar-cierre-al-pulgar-v15.mjs).
 * Este arnés NO siembra el flag de descarte: quiere el aviso ABIERTO, porque
 * lo que se mide es que la navegación sobreviva con él en pantalla:
 *
 *   1. el aviso aparece (~3s) como hoja ENCIMA del BottomNav: sus rects NO se
 *      intersecan, medidos con getBoundingClientRect;
 *   2. CON el aviso abierto, un tap en «Seguimiento» del BottomNav LLEGA a
 *      /pendientes — la razón de ser del cambio («el dato tiene que llegar»
 *      aplicado a navegación);
 *   3. Activar / Después / X miden ≥44px táctiles (§24);
 *   4. el FAB de ayuda cede el paso mientras el aviso pregunta (opacity 0,
 *      pointer-events none) y VUELVE al descartar;
 *   5. tap en «Después» → el aviso se va y no vuelve (flag persistido);
 *   6. axe con el aviso abierto: sin violaciones nuevas;
 *   7. escritorio 1440: tarjeta abajo-derecha de siempre (máx 360px), y el
 *      FAB también le cede el paso (con el aviso ya bajo z-60, taparía su X).
 *
 * Uso (emuladores 8080/9099 arriba, app en :3000 con .env.local demo):
 *   node scripts/design/capturar-push-optin-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-push-optin'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

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

/** Geometría del aviso, del BottomNav y del FAB, desde el DOM real. */
async function medir(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const aviso = document.querySelector('.nx-push-optin')
    const nav = document.querySelector('.bottom-nav')
    const fab = document.querySelector('.boton-ayuda-fab')
    const botones = aviso
      ? [...aviso.querySelectorAll('button')].map(b => ({ texto: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30), ...rect(b) }))
      : []
    const rA = aviso?.getBoundingClientRect()
    const rN = nav?.getBoundingClientRect()
    const seIntersecan = !!(rA && rN && rA.bottom > rN.top && rA.top < rN.bottom && rA.right > rN.left && rA.left < rN.right)
    return {
      avisoEnDOM: !!aviso,
      avisoRect: rect(aviso),
      navRect: rect(nav),
      navVisible: !!nav && getComputedStyle(nav).display !== 'none',
      seIntersecan,
      zAviso: aviso ? Number(getComputedStyle(aviso).zIndex) : null,
      zNav: nav ? Number(getComputedStyle(nav).zIndex) : null,
      botones,
      fabOpacity: fab ? getComputedStyle(fab).opacity : null,
      fabPointerEvents: fab ? getComputedStyle(fab).pointerEvents : null,
      url: location.pathname,
    }
  })
}

async function axeScan(page) {
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map(n => n.target.join(' ')) }))
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

  // ── Móvil 390×844 — SIN sembrar el flag de descarte: se quiere el aviso ──
  const movil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
    // El permiso de Notification debe quedar en 'default' (sin decidir) para
    // que el aviso aparezca — no se concede ni se niega.
  })
  await movil.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page = await movil.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)

  // 1. El aviso aparece a los ~3s, como hoja encima del BottomNav.
  await page.waitForSelector('.nx-push-optin', { timeout: 15000 })
  await page.waitForTimeout(400)
  resultado.avisoAbierto = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, '01-aviso-encima-del-nav.png') })

  // 2. CON el aviso abierto, la navegación del pulgar sigue viva: tap en
  //    «Seguimiento» → /pendientes. Antes este tap se lo comía el aviso.
  await page.locator('.bottom-nav a', { hasText: 'Seguimiento' }).tap()
  await page.waitForURL('**/pendientes**', { timeout: 15000 })
  resultado.tapNavConAvisoAbierto = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, '02-tap-nav-llego-a-pendientes.png') })

  // 3. Axe con el aviso abierto (sigue abierto: no se ha decidido nada).
  resultado.axeMovil = await axeScan(page)

  // 4. Tap en «Después» → el aviso se va, el FAB vuelve, y el flag persiste
  //    (recargar no lo trae de vuelta).
  await page.locator('.nx-push-optin button', { hasText: 'Después' }).tap()
  await page.waitForTimeout(600)
  resultado.trasDescartar = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, '03-tras-despues-aviso-fuera.png') })
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(4000)
  resultado.trasRecargar = await medir(page)

  await movil.close()

  // ── Escritorio 1440 (control: tarjeta abajo-derecha, FAB cede) ─────────
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' })
  await desk.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const dpage = await desk.newPage()
  dpage.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(dpage)
  await dpage.waitForSelector('.nx-push-optin', { timeout: 15000 })
  await dpage.waitForTimeout(400)
  resultado.escritorio = await medir(dpage)
  await dpage.screenshot({ path: path.join(DESTINO, '04-escritorio-tarjeta.png') })
  await desk.close()
  await browser.close()

  resultado.erroresConsola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))

  const a = resultado.avisoAbierto
  console.log('\n── Push opt-in, medido en navegador real ──')
  console.log('aviso abierto:', a.avisoEnDOM, a.avisoRect)
  console.log('BottomNav:', a.navRect, '· se intersecan:', a.seIntersecan, '(esperado false)')
  console.log('z aviso', a.zAviso, '< z nav', a.zNav, ':', a.zAviso < a.zNav)
  console.log('botones ≥44px:', a.botones.map(b => `${b.texto}:${b.w}×${b.h}`).join(' · '))
  console.log('FAB cede:', a.fabOpacity, a.fabPointerEvents)
  console.log('tap nav con aviso abierto → URL:', resultado.tapNavConAvisoAbierto.url, '(esperado /pendientes)')
  console.log('tras Después → aviso en DOM:', resultado.trasDescartar.avisoEnDOM, '· FAB vuelve:', resultado.trasDescartar.fabOpacity)
  console.log('tras recargar → aviso vuelve:', resultado.trasRecargar.avisoEnDOM, '(esperado false)')
  console.log('escritorio → rect:', resultado.escritorio.avisoRect, '· FAB cede:', resultado.escritorio.fabOpacity)
  console.log('axe móvil:', JSON.stringify(resultado.axeMovil))
  console.log('errores consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
