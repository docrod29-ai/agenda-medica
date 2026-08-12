/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-A11Y-001, 5ª rebanada:
 * el esquema de encabezados de /consulta y la muerte de `heading-order`.
 *
 * QUÉ MIDE (con la página POBLADA — el hallazgo sólo existía con datos,
 * porque la hoja del paciente no se pinta vacía):
 *
 *  1. El esquema real de encabezados del DOM, en orden: cada h1..h6 con su
 *     texto, y si algún nivel SALTA más de uno respecto al anterior
 *     (la definición exacta de `heading-order`).
 *  2. Axe (wcag2a/aa/22aa) con detalle — la familia `heading-order` debe
 *     medir 0 nodos; el resto se registra entero.
 *  3. El botón «Análisis basado en evidencia» — el hallazgo hermano anotado
 *     junto a heading-order decía `#0f6e56` a 3.03:1; la Fase 10 cambió el
 *     acento (--teal → cobalto medido). Aquí se COMPUTA el contraste vivo
 *     (color sobre fondo compuesto por alfa) en vez de darlo por muerto.
 *
 * Tres mediciones: oscuro 1440, claro 1440, oscuro 390 (el trío de la casa).
 *
 * Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *        --project demo-nexusmed-test \
 *        "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-esquema-encabezados-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-esquema-encabezados'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

const MEDICIONES = [
  { etiqueta: 'oscuro-1440', tema: 'dark', viewport: { width: 1440, height: 900 } },
  { etiqueta: 'claro-1440', tema: 'light', viewport: { width: 1440, height: 900 } },
  { etiqueta: 'oscuro-390', tema: 'dark', viewport: { width: 390, height: 844 } },
]

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

/* Se evalúa DENTRO de la página. El fondo efectivo bajo un texto casi nunca
   es el backgroundColor de su nodo: se compone subiendo por los ancestros y
   fundiendo cada capa con alfa (aquí el botón de evidencia pinta
   rgba(teal, 0.10) sobre el canvas del tema). */
const medirEnPagina = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null
  }
  const fondoEfectivo = (el) => {
    const capas = []
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break }
    }
    let base = { r: 255, g: 255, b: 255 }
    for (let i = capas.length - 1; i >= 0; i--) {
      const c = capas[i]
      base = {
        r: c.r * c.a + base.r * (1 - c.a),
        g: c.g * c.a + base.g * (1 - c.a),
        b: c.b * c.a + base.b * (1 - c.a),
      }
    }
    return base
  }
  const luminancia = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => {
    const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
    return (l1 + 0.05) / (l2 + 0.05)
  }

  const encabezados = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({
    tag: h.tagName.toLowerCase(),
    texto: (h.textContent ?? '').trim().slice(0, 60),
  }))
  const saltos = []
  for (let i = 1; i < encabezados.length; i++) {
    const prev = +encabezados[i - 1].tag[1]
    const cur = +encabezados[i].tag[1]
    if (cur - prev > 1) saltos.push(`${encabezados[i - 1].tag}→${encabezados[i].tag} (${encabezados[i].texto})`)
  }

  const botonEv = [...document.querySelectorAll('button')]
    .find(b => b.textContent?.includes('Análisis basado en evidencia'))
  let evidencia = null
  if (botonEv) {
    const cs = getComputedStyle(botonEv)
    const fg = parse(cs.color)
    const bg = fondoEfectivo(botonEv)
    evidencia = {
      color: cs.color,
      fondoCompuesto: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      ratio: Math.round(ratio(fg, bg) * 100) / 100,
      aaOk: ratio(fg, bg) >= 4.5,
    }
  }

  return { encabezados, saltos, sinSaltos: saltos.length === 0, evidencia }
}

async function medir(browser, uid, { etiqueta, tema, viewport }, resultado) {
  const ctx = await browser.newContext({
    viewport,
    ...(viewport.width < 500 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}),
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  })
  await ctx.addInitScript(({ u, t }) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem('agenda-medica:push-dismissed', '1')
      localStorage.setItem('nexusmed.theme', t)
    } catch { /* noop */ }
  }, { u: uid, t: tema })

  const page = await ctx.newPage()
  const errores = []
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()) })
  page.on('pageerror', e => errores.push(String(e)))

  await login(page)
  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)
  await page.waitForSelector('button:has-text("Agregar diagnóstico")', { timeout: 20000 })

  // Poblar: con un dx + un medicamento la hoja del paciente SE PINTA — el
  // estado exacto en el que heading-order aparecía. Metformina, no
  // Amoxicilina: aquí no se busca disparar al Copiloto, sólo poblar.
  await page.click('button:has-text("Agregar diagnóstico")')
  const inputDx = page.locator('input[placeholder*="Faringitis"]').first()
  await inputDx.fill('Diabetes mellitus tipo 2, descontrolada')
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape').catch(() => null)

  await page.click('button:has-text("Agregar medicamento")')
  const inputMed = page.locator('input[placeholder="Medicamento"]').first()
  await inputMed.fill('Metformina 850 mg')
  await inputMed.blur()
  await page.waitForTimeout(400)

  const hojaVisible = await page.locator('#hoja-para-el-paciente').count() > 0

  resultado[etiqueta] = {
    hojaVisible,
    ...(await page.evaluate(medirEnPagina)),
  }

  await page.screenshot({
    path: path.join(DESTINO, `consulta--${etiqueta}.png`), fullPage: true,
  })

  const axe = await axeDetalle(page)
  resultado[etiqueta].axe = axe
  resultado[etiqueta].headingOrder = axe.find(v => v.id === 'heading-order')?.nodes.length ?? 0
  resultado[etiqueta].consola = errores
  await ctx.close()
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const uid = await uidDelMedico()
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = {}
  for (const m of MEDICIONES) await medir(browser, uid, m, resultado)
  await browser.close()

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))

  const fallo = MEDICIONES.some(m =>
    !resultado[m.etiqueta].hojaVisible ||
    !resultado[m.etiqueta].sinSaltos ||
    resultado[m.etiqueta].headingOrder > 0)
  if (fallo) { console.error('\n✗ El esquema de encabezados NO quedó limpio'); process.exit(1) }
  console.log('\n✓ Esquema sin saltos y heading-order 0 en las tres mediciones')
}

main().catch((e) => { console.error(e); process.exit(1) })
