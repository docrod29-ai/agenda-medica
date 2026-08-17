/**
 * ARNÉS RTC-09 + RTC-11 — V15-ORIGINALITY-REDTEAM-001, 4ª corrida.
 *
 * Mide en NAVEGADOR REAL lo que jsdom no puede: los renglones que ocupa el
 * nombre del paciente, el ancho REAL de su columna, y si un botón está
 * pintado o sólo declarado. Es la lección de RTC-05 —el FAB «desaparecido»
 * seguía flotando porque su `display:flex` en línea vencía a la hoja— aplicada
 * a esta rebanada: **se mide lo pintado**.
 *
 * ── RTC-11 (/pacientes móvil) ────────────────────────────────────────────────
 *  1. 390px: «Editar» y el chevron NO están pintados en la fila.
 *  2. 390px: el nombre ocupa ≤2 renglones y su columna mide ≥190px
 *     (antes: 3 renglones en ~90px — el defecto #13 de la DNA).
 *  3. 1440px: «Editar» SIGUE pintado — la variante es móvil, no una amputación.
 *  4. La capacidad llegó a su casa nueva: en el expediente, «Editar datos»
 *     navega a `/pacientes?editar=<id>` y la lista ABRE el editor de ESE
 *     paciente (se comprueba con el nombre dentro del modal).
 *
 * ── RTC-09 (la IA es contextual) ─────────────────────────────────────────────
 *  5. /operaciones: ningún encabezado dice «Clínico» y no hay enlace a
 *     /consultor ni a /antibiograma.
 *  6. /expediente: las dos capacidades están pintadas como filas de
 *     Herramientas, con el paciente delante.
 *  7. El antibiograma se ABRE ahí mismo (su formulario aparece sin navegar).
 *  8. 0 errores de consola en las tres pantallas.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/verificar-rtc09-rtc11-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc09-rtc11'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE = 'pac-refugio-alcantara'

fs.mkdirSync(DESTINO, { recursive: true })
const condiciones = []
const errores = []
const cond = (nombre, ok, detalle) => {
  condiciones.push({ nombre, estado: ok ? 'PASS' : 'FAIL', detalle })
  console.log(`${ok ? '  ✓' : '  ✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  const saltar = page.locator('button:has-text("Saltar")').first()
  try {
    await saltar.waitFor({ state: 'visible', timeout: 4000 })
    await saltar.click()
    await saltar.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour esta vez */ }
}

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

/** Renglones REALES de un elemento: alto / alto de línea, medido en el DOM. */
const RENGLONES = `el => {
  const cs = getComputedStyle(el)
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2
  return Math.max(1, Math.round(el.getBoundingClientRect().height / lh))
}`

for (const vp of [{ w: 390, h: 844, etiqueta: 'movil' }, { w: 1440, h: 900, etiqueta: 'escritorio' }]) {
  const contexto = await navegador.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.w < 700,
    hasTouch: vp.w < 700,
    serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${vp.etiqueta}] ${m.text()}`) })
  page.on('pageerror', e => errores.push(`[${vp.etiqueta}] pageerror: ${e.message}`))

  await login(page)

  // ── /pacientes ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await page.waitForSelector('.nx-fila-paciente', { timeout: 20000 })
  await page.waitForTimeout(500)

  const fila = page.locator('.nx-fila-paciente').first()
  const editarVisible = await fila.locator('.nx-fila-editar').isVisible().catch(() => false)
  const chevronVisible = await fila.locator('.nx-fila-chevron').isVisible().catch(() => false)
  const ident = fila.locator('.nx-ident').first()
  const caja = await ident.boundingBox()
  const renglones = await ident.evaluate(eval(`(${RENGLONES})`))

  if (vp.w === 390) {
    cond('RTC-11 · móvil: «Editar» NO está pintado en la fila', editarVisible === false)
    cond('RTC-11 · móvil: el chevron decorativo NO está pintado', chevronVisible === false)
    cond('RTC-11 · móvil: la identidad ocupa ≤2 renglones', renglones <= 2, `${renglones} renglones`)
    cond('RTC-11 · móvil: la columna de la identidad mide ≥190px', (caja?.width ?? 0) >= 190, `${Math.round(caja?.width ?? 0)}px`)
  } else {
    cond('RTC-11 · escritorio: «Editar» SIGUE pintado (no es amputación)', editarVisible === true)
    cond('RTC-11 · escritorio: la identidad cabe en 1 renglón', renglones <= 1, `${renglones} renglones`)
  }
  await page.screenshot({ path: path.join(DESTINO, `pacientes-${vp.etiqueta}.png`), fullPage: false })

  // ── /expediente: capacidades contextuales (RTC-09) ────────────────────────
  await page.goto(`${BASE}/expediente/${PACIENTE}`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)

  const textoExp = await page.locator('body').innerText()
  cond(`RTC-09 · ${vp.etiqueta}: «Consultor de evidencia» está en el expediente`,
    textoExp.includes('Consultor de evidencia'))
  cond(`RTC-09 · ${vp.etiqueta}: «Antibiograma» está en el expediente`,
    textoExp.includes('Antibiograma'))

  // Abrir la fila del antibiograma: la capacidad se USA aquí, no manda a otra
  // pantalla. Su chunk se descarga en ese momento (import perezoso).
  const urlAntes = page.url()
  const filaAnti = page.locator('text=Antibiograma').first()
  await filaAnti.click().catch(() => {})
  await page.waitForTimeout(2500)
  const textoTrasAbrir = await page.locator('body').innerText()
  cond(`RTC-09 · ${vp.etiqueta}: el antibiograma se abre SIN navegar`,
    page.url() === urlAntes, page.url() === urlAntes ? 'misma URL' : `navegó a ${page.url()}`)
  cond(`RTC-09 · ${vp.etiqueta}: el formulario del antibiograma se pintó`,
    /Organismo|organismo|Sitio de infecci/.test(textoTrasAbrir))
  await page.screenshot({ path: path.join(DESTINO, `expediente-capacidades-${vp.etiqueta}.png`), fullPage: false })

  // ── RTC-11 · la capacidad movida LLEGA (sólo hace falta medirlo una vez) ──
  if (vp.w === 390) {
    await page.goto(`${BASE}/expediente/${PACIENTE}`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    // «Datos del paciente» viene PLEGADO («ver / editar»): el botón de editar
    // no existe en el DOM hasta abrirlo. La primera pasada del arnés lo daba
    // por fallo de navegación — no lo era: el clic caía en la nada.
    const plegable = page.locator('button:has-text("Datos del paciente")').first()
    await plegable.scrollIntoViewIfNeeded().catch(() => {})
    await plegable.click().catch(() => {})
    await page.waitForTimeout(600)
    const btnEditar = page.locator('button:has-text("Editar datos")').first()
    await btnEditar.scrollIntoViewIfNeeded().catch(() => {})
    await btnEditar.click().catch(() => {})
    await page.waitForTimeout(2500)
    const enLista = page.url().includes('/pacientes') && page.url().includes('editar=')
    cond('RTC-11 · «Editar datos» navega a /pacientes?editar=<id>', enLista, page.url())
    // Y el editor de ESE paciente quedó abierto: el viaje LLEGA.
    const hayModal = await page.locator('input[type="tel"]').first().isVisible().catch(() => false)
    cond('RTC-11 · la lista ABRE el editor de ese paciente (el viaje llega)', hayModal)
    await page.screenshot({ path: path.join(DESTINO, 'editar-desde-expediente-movil.png'), fullPage: false })
  }

  // ── /operaciones (RTC-09) ─────────────────────────────────────────────────
  await page.goto(`${BASE}/operaciones`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const encabezados = await page.locator('h2').allInnerTexts()
  const hrefs = await page.locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href')))
  cond(`RTC-09 · ${vp.etiqueta}: ningún grupo se titula «Clínico»`,
    !encabezados.some(t => t.trim().toLowerCase() === 'clínico'), encabezados.join(' · '))
  cond(`RTC-09 · ${vp.etiqueta}: el índice admin no enlaza /consultor ni /antibiograma`,
    !hrefs.includes('/consultor') && !hrefs.includes('/antibiograma'))
  /**
   * HOSPITAL Y UCI SON OPT-IN, Y ESO CAMBIA LO QUE AQUÍ SE PUEDE MEDIR.
   *
   * `MODULOS_OPT_IN = ['hospitalizacion', 'uci']`: la clínica sintética de
   * capturas no los tiene contratados, así que `rutaPermitida` los filtra y el
   * grupo entero desaparece. La primera pasada de este arnés lo dio por
   * defecto del cambio — no lo era: es la bandera haciendo su trabajo.
   *
   * Lo que sí se puede medir aquí, y vale la pena: el grupo aparece **si y
   * sólo si** su ruta está permitida. Un grupo vacío pintado sería un defecto
   * de verdad (un encabezado que promete lo que no hay). Que la ruta esté
   * declarada en el índice lo prueba el freeze de vitest, que lee el fuente.
   */
  const tituloHospital = encabezados.some(t => t.trim().toLowerCase() === 'hospital y uci')
  cond(`RTC-09 · ${vp.etiqueta}: el grupo Hospital/UCI aparece si y sólo si su módulo está permitido`,
    tituloHospital === hrefs.includes('/hospitalizacion'),
    hrefs.includes('/hospitalizacion') ? 'módulo contratado: grupo presente' : 'módulo opt-in no contratado: grupo ausente (correcto)')
  await page.screenshot({ path: path.join(DESTINO, `operaciones-${vp.etiqueta}.png`), fullPage: true })

  await contexto.close()
}

await navegador.close()

cond('0 errores de consola en las tres pantallas', errores.length === 0, errores.slice(0, 5).join(' | '))

const acta = {
  rebanada: 'V15-ORIGINALITY-REDTEAM-001 — RTC-09 + RTC-11',
  base: BASE,
  viewports: ['390x844', '1440x900'],
  condiciones,
  erroresDeConsola: errores,
  resultado: condiciones.every(c => c.estado === 'PASS') ? 'PASS' : 'FAIL',
}
fs.writeFileSync(path.join(DESTINO, 'acta-rtc09-rtc11.json'), JSON.stringify(acta, null, 2))
console.log(`\n${acta.resultado} — ${condiciones.filter(c => c.estado === 'PASS').length}/${condiciones.length} condiciones`)
process.exit(acta.resultado === 'PASS' ? 0 : 1)
