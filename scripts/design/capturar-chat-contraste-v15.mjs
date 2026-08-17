/**
 * V15-A11Y-001, cuarta rebanada — contrastes de /chat + colisiones de
 * widgets flotantes, verificados en navegador REAL.
 *
 * QUÉ MIDE (y por qué cada cosa):
 *
 * 1. Axe con detalle (fg/bg/ratio) en CUATRO mediciones: oscuro/claro ×
 *    1440/390. La sexta rebanada de Fase 9 dejó anotada una familia
 *    `color-contrast` (serious, 3 nodos) medida sólo en oscuro; los hex
 *    fijos del chat (#a78bfa, #040b12, rgba(0,0,0,α), '#000') eran además
 *    ilegibles en CLARO, donde nadie había medido. Objetivo: 0 violaciones
 *    en las cuatro.
 *
 * 2. La colisión del toggle de tema con el botón Enviar. El PRIMER intento
 *    de diagnóstico de esta rebanada NO PUDO pulsar Enviar — Playwright:
 *    «.theme-toggle subtree intercepts pointer events» — en 1440 Y en 390.
 *    El composer del lienzo ancla su acción primaria justo en la esquina
 *    del widget flotante. Aquí se mide la geometría (toggle ∩ composer = ∅,
 *    toggle ∩ BottomNav = ∅) y el COMPORTAMIENTO: se escribe, se le QUITA
 *    el foco al textarea (el peor caso: con foco el toggle ya se ocultaba
 *    en ≤900px) y se pulsa Enviar con un click real — el mensaje debe
 *    llegar a la lista (ida y vuelta por el emulador).
 *
 * 3. §24: el toggle ahora mide ≥44×44 (era 38, y 34 en móvil — «táctil
 *    chico» anotado por la radiografía de trabajos móviles).
 *
 * 4. El toggle cede el paso mientras el aviso push pregunta (la colisión
 *    anotada por Fase 9: pintaba sobre el borde de la hoja en 390px). Se
 *    abre un contexto SIN el flag de descarte, se espera .nx-push-optin y
 *    se mide opacity/pointer-events del toggle; tras «Después», vuelve.
 *
 * Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *        --project demo-nexusmed-test \
 *        "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-chat-contraste-v15.mjs"
 */
import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-chat-contraste'
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

async function axeDetalle(page) {
  const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
  await page.evaluate(axeSource)
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact,
      nodes: v.nodes.map(n => ({
        target: n.target.join(' '),
        html: n.html.slice(0, 200),
        data: n.any?.[0]?.data ?? null,
      })),
    }))
  })
}

function contexto(browser, uid, tema, viewport, opts = {}) {
  return browser.newContext({
    viewport,
    ...(viewport.width < 500 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}),
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  }).then(async ctx => {
    await ctx.addInitScript(({ u, t, sinDescartePush }) => {
      try {
        localStorage.setItem(`nexus_tour_v1_${u}`, '1')
        if (!sinDescartePush) localStorage.setItem('agenda-medica:push-dismissed', '1')
        localStorage.setItem('nexusmed.theme', t)
      } catch { /* noop */ }
    }, { u: uid, t: tema, sinDescartePush: !!opts.sinDescartePush })
    return ctx
  })
}

const geometriaWidgets = () => {
  const toggle = document.querySelector('.theme-toggle')
  const ta = document.querySelector('textarea')
  const nav = document.querySelector('.bottom-nav-wrap')
  const enviar = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Enviar')
  if (!toggle || !ta || !enviar) return { encontrado: false }
  const rt = toggle.getBoundingClientRect()
  const fila = ta.parentElement.getBoundingClientRect()
  const re = enviar.getBoundingClientRect()
  const rn = nav ? nav.getBoundingClientRect() : null
  const interseca = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  return {
    encontrado: true,
    toggle: `${Math.round(rt.width)}×${Math.round(rt.height)} @ (${Math.round(rt.left)},${Math.round(rt.top)})`,
    toggleTactilOk: rt.width >= 44 && rt.height >= 44,
    tocaComposer: interseca(rt, fila),
    tocaEnviar: interseca(rt, re),
    tocaNav: rn ? interseca(rt, rn) : false,
  }
}

async function medirChat(browser, uid, tema, viewport, etiqueta, resultado) {
  const ctx = await contexto(browser, uid, tema, viewport)
  const page = await ctx.newPage()
  const errores = []
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text()}`) })
  await login(page)
  await page.goto(`${BASE}/chat`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)

  // Geometría de la colisión (ANTES de escribir: toggle visible, sin foco).
  const geo = await page.evaluate(geometriaWidgets)

  // El peor caso medido: escribir, PERDER el foco (con foco el toggle ya se
  // ocultaba), y pulsar Enviar con un click real. Antes del arreglo este
  // click NO LLEGABA: lo interceptaba el toggle.
  const textoPrueba = `Contraste ${etiqueta} — ${Math.floor(performance.now())}`
  await page.fill('textarea', textoPrueba)
  await page.evaluate(() => document.querySelector('textarea')?.blur())
  await page.waitForTimeout(300)
  let enviarClickeable = true
  try {
    await page.click('button[aria-label="Enviar"]', { timeout: 5000 })
  } catch {
    enviarClickeable = false
  }
  await page.waitForTimeout(2500)
  const llega = await page.evaluate(
    t => (document.querySelector('main')?.textContent || '').includes(t),
    textoPrueba,
  )

  resultado[etiqueta] = {
    geo,
    enviarClickeableSinFoco: enviarClickeable,
    mensajeLlega: llega,
    axe: await axeDetalle(page),
    erroresConsola: errores.length,
  }
  await page.screenshot({ path: path.join(DESTINO, `chat-${etiqueta}.png`) })
  await ctx.close()
}

async function medirCesionAlAviso(browser, uid, resultado) {
  // Contexto SIN flag de descarte: el aviso push debe aparecer y el toggle
  // debe ceder (opacity 0, pointer-events none); tras «Después», volver.
  const ctx = await contexto(browser, uid, 'dark', { width: 390, height: 844 }, { sinDescartePush: true })
  const page = await ctx.newPage()
  await login(page)
  await page.waitForTimeout(4500) // el aviso espera 3s tras montar
  const conAviso = await page.evaluate(() => {
    const aviso = document.querySelector('.nx-push-optin')
    const toggle = document.querySelector('.theme-toggle')
    if (!toggle) return { encontrado: false }
    const cs = getComputedStyle(toggle)
    return {
      encontrado: true,
      avisoAbierto: !!aviso,
      toggleOpacity: cs.opacity,
      togglePointerEvents: cs.pointerEvents,
    }
  })
  await page.screenshot({ path: path.join(DESTINO, 'aviso-abierto-toggle-cede.png') })
  let trasDescartar = null
  if (conAviso.avisoAbierto) {
    await page.click('.nx-push-optin button:has-text("Después")')
    await page.waitForTimeout(500)
    trasDescartar = await page.evaluate(() => {
      const toggle = document.querySelector('.theme-toggle')
      return toggle ? getComputedStyle(toggle).opacity : null
    })
  }
  resultado.cesionAlAviso = { ...conAviso, toggleOpacityTrasDescartar: trasDescartar }
  await ctx.close()
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
  await medirChat(browser, uid, 'dark', { width: 1440, height: 900 }, 'oscuro-1440', resultado)
  await medirChat(browser, uid, 'light', { width: 1440, height: 900 }, 'claro-1440', resultado)
  await medirChat(browser, uid, 'dark', { width: 390, height: 844 }, 'oscuro-390', resultado)
  await medirChat(browser, uid, 'light', { width: 390, height: 844 }, 'claro-390', resultado)
  await medirCesionAlAviso(browser, uid, resultado)
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))

  const chats = ['oscuro-1440', 'claro-1440', 'oscuro-390', 'claro-390'].map(k => resultado[k])
  const axeLimpio = chats.every(c => c.axe.length === 0)
  const sinColision = chats.every(c =>
    c.geo.encontrado && !c.geo.tocaComposer && !c.geo.tocaEnviar && !c.geo.tocaNav && c.geo.toggleTactilOk)
  const envioVivo = chats.every(c => c.enviarClickeableSinFoco && c.mensajeLlega)
  const cede = resultado.cesionAlAviso.avisoAbierto
    ? resultado.cesionAlAviso.toggleOpacity === '0'
      && resultado.cesionAlAviso.togglePointerEvents === 'none'
      && resultado.cesionAlAviso.toggleOpacityTrasDescartar === '1'
    : null // si el aviso no salió, se declara — no se inventa el resultado

  console.log('\n── V15-A11Y-001 · 4ª rebanada ──')
  console.log('axe 0 en las cuatro mediciones:', axeLimpio)
  console.log('toggle sin colisión y ≥44:', sinColision)
  console.log('Enviar clickeable sin foco y el mensaje llega:', envioVivo)
  console.log('toggle cede al aviso push:', cede === null ? 'AVISO NO APARECIÓ — sin medir' : cede)

  if (!axeLimpio || !sinColision || !envioVivo || cede === false) {
    console.error('\n✗ ALGUNA MEDICIÓN FALLÓ — revisar resultado.json')
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
