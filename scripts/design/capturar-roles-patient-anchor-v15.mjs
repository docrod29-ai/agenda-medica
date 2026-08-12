/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-VISUAL-SYSTEM-001 (Fase 10, quinta
 * rebanada: EL PATIENT ANCHOR HABLA LOS ROLES DE VISUAL_DNA §2 Y SU
 * IDENTIDAD ES NIVEL DISPLAY). §40 Real Browser Requirement.
 *
 * Mide con `getComputedStyle` — no leyendo JSX — que:
 *
 *   1. El <h1> del ancla pinta la identidad en Fraunces (nivel display,
 *      R3: «nombre del paciente en su espacio clínico») a 20px/600, y
 *      ENVUELVE en vez de truncarse (nombre largo sembrado, §24).
 *   2. `.nx-meta` pinta edad · sexo · teléfono a 12.5px en --text3.
 *   3. La alergia REGISTRADA es `span.nx-critico` (13/700, --red, flex-wrap)
 *      con el icono al lado en la misma fila — y «no registradas» NO lleva
 *      la clase (valor crítico ≠ dato del registro).
 *   4. El ancla sigue pegajosa DE VERDAD: tras hacer scroll del expediente,
 *      el nombre sigue dentro del viewport (§7: siempre visible).
 *   5. Nada de esto introduce violaciones axe nuevas, en tema oscuro NI
 *      claro, ni desborda en móvil 390.
 *
 * NOTA de honestidad: la siembra no crea documentos NotaMedica, así que
 * «Último cambio» y «Consulta sin cerrar» no se pintan aquí — su tipografía
 * la vigila el guardián estático; este arnés mide lo que el emulador pinta.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm start`.
 *
 * Uso:
 *   node scripts/design/capturar-roles-patient-anchor-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-roles-patient-anchor'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
const CON_ALERGIA = '/expediente/pac-aurelio-dominguez'      // Penicilina (rash…)
const NOMBRE_LARGO_URL = '/expediente/pac-refugio-alcantara' // sin alergias + nombre largo
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

/** Los roles, medidos DENTRO del ancla. */
async function medirAncla(page) {
  return page.evaluate(() => {
    const ancla = document.querySelector('.nx-patient-anchor')
    if (!ancla) return null
    const h1 = ancla.querySelector('h1.nx-display.nx-ancla-nombre')
    const meta = ancla.querySelector('.nx-meta')
    const critico = ancla.querySelector('span.nx-critico')
    const estilo = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        fontFamily: s.fontFamily.split(',')[0],
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        flexWrap: s.flexWrap,
        overflowWrap: s.overflowWrap,
      }
    }
    // El icono del aviso vive en la MISMA fila que el valor crítico.
    const filaAviso = critico?.parentElement ?? null
    return {
      temaActual: document.documentElement.getAttribute('data-theme') ?? '(default)',
      h1: h1 ? { texto: h1.textContent?.trim(), ...estilo(h1) } : null,
      meta: meta ? { texto: meta.textContent?.trim(), ...estilo(meta) } : null,
      critico: critico ? { texto: critico.textContent?.trim(), ...estilo(critico) } : null,
      iconoJuntoAlCritico: !!filaAviso?.querySelector('svg'),
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

  await page.goto(`${BASE}${CON_ALERGIA}`, { waitUntil: 'load' })
  await page.waitForSelector('.nx-patient-anchor h1.nx-ancla-nombre', { timeout: 20000 })
  await page.waitForTimeout(400)

  resultado.oscuro = await medirAncla(page)
  await page.screenshot({ path: path.join(DESTINO, 'anchor-alergia--oscuro-1440.png'), fullPage: false })
  resultado.axeOscuro = await correrAxe(page)

  // ── §7 pegajosa DE VERDAD: scroll del contenedor real y el nombre sigue ──
  resultado.sticky = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return { error: 'sin <main>' }
    main.scrollTop = main.scrollHeight
    const h1 = document.querySelector('.nx-patient-anchor h1.nx-ancla-nombre')
    const r = h1?.getBoundingClientRect()
    const scrolleado = main.scrollTop
    return {
      scrolleado,
      visibleTrasScroll: !!r && r.top >= 0 && r.top < window.innerHeight,
    }
  })
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0 })

  // ── TEMA CLARO (mismos puntos; los tokens cambian de hex por tema) ────────
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(400)
  resultado.claro = await medirAncla(page)
  await page.screenshot({ path: path.join(DESTINO, 'anchor-alergia--claro-1440.png'), fullPage: false })
  resultado.axeClaro = await correrAxe(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

  // ── SIN alergia registrada: el valor NO es crítico ────────────────────────
  await page.goto(`${BASE}${NOMBRE_LARGO_URL}`, { waitUntil: 'load' })
  await page.waitForSelector('.nx-patient-anchor h1.nx-ancla-nombre', { timeout: 20000 })
  await page.waitForTimeout(400)
  resultado.sinAlergia = await page.evaluate(() => {
    const ancla = document.querySelector('.nx-patient-anchor')
    const critico = ancla?.querySelector('span.nx-critico') ?? null
    const aviso = Array.from(ancla?.querySelectorAll('span') ?? [])
      .find(s => s.textContent?.includes('Alergias:'))
    return {
      textoDelAviso: aviso?.textContent?.trim() ?? null,
      elAvisoNeutroLlevaCritico: !!critico,
    }
  })
  await context.close()

  // ── MÓVIL 390×844: el nombre largo ENVUELVE y nada desborda ──────────────
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

  await movil.goto(`${BASE}${NOMBRE_LARGO_URL}`, { waitUntil: 'load' })
  await movil.waitForSelector('.nx-patient-anchor h1.nx-ancla-nombre', { timeout: 20000 })
  await movil.waitForTimeout(400)
  resultado.movilNombreLargo = await movil.evaluate((NOMBRE_LARGO) => {
    const doc = document.documentElement
    const h1 = document.querySelector('.nx-patient-anchor h1.nx-ancla-nombre')
    const s = h1 ? getComputedStyle(h1) : null
    return {
      desbordeHorizontal: doc.scrollWidth > doc.clientWidth,
      anchoDocumento: doc.scrollWidth,
      nombre: h1?.textContent?.trim(),
      esElSembrado: h1?.textContent?.trim() === NOMBRE_LARGO,
      recortado: h1 ? h1.scrollWidth > h1.clientWidth : null,
      lineas: h1 && s ? Math.round(h1.getBoundingClientRect().height / parseFloat(s.lineHeight)) : null,
    }
  }, NOMBRE_LARGO)
  await movil.screenshot({ path: path.join(DESTINO, 'anchor-nombre-largo--movil-390.png'), fullPage: false })

  await movil.goto(`${BASE}${CON_ALERGIA}`, { waitUntil: 'load' })
  await movil.waitForSelector('.nx-patient-anchor h1.nx-ancla-nombre', { timeout: 20000 })
  await movil.waitForTimeout(400)
  resultado.movilAlergia = await movil.evaluate(() => {
    const doc = document.documentElement
    const critico = document.querySelector('.nx-patient-anchor span.nx-critico')
    return {
      desbordeHorizontal: doc.scrollWidth > doc.clientWidth,
      criticoRecortado: critico ? critico.scrollWidth > critico.clientWidth : null,
      criticoFlexWrap: critico ? getComputedStyle(critico).flexWrap : null,
    }
  })
  resultado.axeMovil = await correrAxe(movil)
  await movil.screenshot({ path: path.join(DESTINO, 'anchor-alergia--movil-390.png'), fullPage: false })
  await contextMovil.close()
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  console.log('\n── Resumen ──')
  console.log('oscuro       :', JSON.stringify(resultado.oscuro))
  console.log('sticky       :', JSON.stringify(resultado.sticky))
  console.log('claro        :', JSON.stringify(resultado.claro))
  console.log('sin alergia  :', JSON.stringify(resultado.sinAlergia))
  console.log('móvil largo  :', JSON.stringify(resultado.movilNombreLargo))
  console.log('móvil alergia:', JSON.stringify(resultado.movilAlergia))
  console.log('axe oscuro   :', JSON.stringify(resultado.axeOscuro))
  console.log('axe claro    :', JSON.stringify(resultado.axeClaro))
  console.log('axe móvil    :', JSON.stringify(resultado.axeMovil))
  console.log('errores de consola:', erroresConsola.length)
}

main().catch((e) => { console.error(e); process.exit(1) })
