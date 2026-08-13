/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-MOTION-001, cuarta rebanada:
 * la coreografía de continuidad de §20 (Hoy → Paciente → Encuentro).
 * §40 Real Browser Requirement.
 *
 * El guardián de la rebanada lee TEXTO; este arnés comprueba que el
 * mecanismo LLEGA al navegador — las tres cosas que un guardián de texto no
 * puede ver:
 *
 *   1. Las reglas nuevas SOBREVIVEN el parseo (lección nx-stat-grid: un
 *      selector que el motor no entiende se descarta EN SILENCIO y la hoja
 *      entera sigue «bien»). Se barre document.styleSheets buscando
 *      `::view-transition` y el gate del destino.
 *   2. `document.startViewTransition` se INVOCA de verdad al pulsar los
 *      saltos de la cadena (se instrumenta con un wrapper contador antes de
 *      cada click), el atributo `data-vt-continuidad` aparece durante la
 *      transición, la navegación LLEGA a su destino y el atributo se limpia
 *      al terminar.
 *   3. Bajo `reducedMotion: 'reduce'` el API NO se llama — el candado es JS,
 *      antes de tocar el API — y la navegación funciona igual.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-continuidad-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-motion-continuidad'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE_SEMBRADO = 'pac-refugio-alcantara'

const resultado = { fecha: new Date().toISOString(), casos: [], consola: [] }
let fallos = 0
const caso = (nombre, ok, detalle) => {
  resultado.casos.push({ nombre, ok, detalle })
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos++
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  // El tour de bienvenida (por uid, y el uid cambia con cada siembra) tapa
  // TODA la pantalla: sin descartarlo, ningún click de la cadena llega.
  const saltar = page.locator('button:has-text("Saltar")').first()
  try {
    await saltar.waitFor({ state: 'visible', timeout: 4000 })
    await saltar.click()
    await saltar.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour esta vez */ }
}

/**
 * Contador de invocaciones + bitácora del atributo, instalado ANTES del click.
 *
 * 5ª rebanada: también vigila `ready`. Un par DUPLICADO de
 * view-transition-name (el fallo que la franja persistente habría causado sin
 * la limpieza dentro del callback) no truena nada: el navegador SALTA la
 * transición en silencio — `ready` rechaza y `finished` resuelve igual. El
 * único testigo de que el par se formó y la animación ARRANCÓ es que `ready`
 * resolviera. Sin medirlo, «la coreografía corre» y «la coreografía se salta
 * siempre» son indistinguibles desde fuera.
 */
function instrumentar(page) {
  return page.evaluate(() => {
    const w = window
    w.__vt = { llamadas: 0, atributoDuranteTransicion: false, readyOk: null }
    if (typeof document.startViewTransition === 'function') {
      const original = document.startViewTransition.bind(document)
      document.startViewTransition = (cb) => {
        w.__vt.llamadas++
        w.__vt.atributoDuranteTransicion =
          document.documentElement.hasAttribute('data-vt-continuidad')
        const t = original(cb)
        w.__vt.readyOk = null
        t.ready.then(() => { w.__vt.readyOk = true }, () => { w.__vt.readyOk = false })
        return t
      }
    }
    return typeof document.startViewTransition === 'function'
  })
}

const leerVt = (page) => page.evaluate(() => window.__vt)

/**
 * El primer salto disponible de la cadena desde Hoy. Con la siembra actual y
 * según la hora del día puede no haber botón «Consulta» (citas pasadas) ni
 * héroe de próxima cita — pero las filas de continuidad («Sigue abierto de
 * antes») siempre están: son el salto Hoy→Paciente. Devuelve el patrón de
 * URL del destino esperado.
 */
async function saltoDesdeHoy(page) {
  await page.waitForSelector('.cita-fila', { timeout: 15000 })
  const botonConsulta = page.locator('.cita-fila button:has-text("Consulta"), .prox-hero-cta').first()
  if (await botonConsulta.count()) {
    await botonConsulta.click()
    return '**/consulta/**'
  }
  const fila = page.locator('a.cita-fila:has(.nx-ident)').first()
  await fila.waitFor({ state: 'visible', timeout: 10000 })
  await fila.click()
  return '**/expediente/**'
}

/** ¿Las reglas nuevas sobrevivieron el parseo de la hoja? */
function reglasParseadas(page) {
  return page.evaluate(() => {
    const halladas = { overlay: false, gateDestino: false, grupoLento: false, reduceApaga: false }
    const recorrer = (reglas) => {
      for (const r of reglas) {
        // OJO: con CSS nesting, TODA CSSStyleRule tiene `cssRules` (vacía) —
        // se revisa el selector SIEMPRE y además se desciende si hay hijas.
        // La primera versión hacía `if (r.cssRules) continue` y se saltaba
        // todas las reglas de nivel superior: 3 falsos negativos.
        const sel = r.selectorText || ''
        const cuerpo = r.cssText || ''
        if (sel === '::view-transition' && /pointer-events:\s*none/.test(cuerpo)) halladas.overlay = true
        if (sel.includes('html[data-vt-continuidad] .nx-vt-paciente') && /view-transition-name/.test(cuerpo)) halladas.gateDestino = true
        if (sel.includes('::view-transition-group(nx-paciente)') && /--mov-lento/.test(cuerpo)) halladas.grupoLento = true
        if (r.cssRules && r.cssRules.length) recorrer(r.cssRules)
      }
    }
    for (const hoja of document.styleSheets) {
      try { recorrer(hoja.cssRules) } catch { /* hoja externa sin acceso */ }
    }
    // El apagador de §24 vive dentro de un @media: segunda pasada buscando
    // el texto en las reglas condicionales.
    for (const hoja of document.styleSheets) {
      try {
        for (const r of hoja.cssRules) {
          if (r.media && /prefers-reduced-motion/.test(r.conditionText || '') && /::view-transition-group\(\*\)/.test(r.cssText)) {
            halladas.reduceApaga = true
          }
        }
      } catch { /* idem */ }
    }
    return halladas
  })
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  // Mismo patrón que sus hermanos: el contenedor trae Chromium preinstalado
  // en /opt/pw-browsers y Playwright no debe descargar el suyo.
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )

  // ── Escritorio 1440: la cadena completa ────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') resultado.consola.push(m.text()) })
  await login(page)

  const soporta = await instrumentar(page)
  caso('el navegador del arnés soporta startViewTransition', soporta)

  const reglas = await reglasParseadas(page)
  caso('la regla ::view-transition {pointer-events:none} SOBREVIVIÓ el parseo', reglas.overlay)
  caso('el gate del destino (html[data-vt-continuidad] .nx-vt-paciente) sobrevivió', reglas.gateDestino)
  caso('::view-transition-group(nx-paciente) con --mov-lento sobrevivió', reglas.grupoLento)
  caso('el apagador de §24 para view transitions sobrevivió', reglas.reduceApaga)

  // Hoy → Paciente/Encuentro: el primer salto disponible de la cadena.
  await page.waitForSelector('.cita-fila', { timeout: 15000 })
  await page.screenshot({ path: path.join(DESTINO, 'antes-hoy-1440.png') })
  const destinoHoy = await saltoDesdeHoy(page)
  await page.screenshot({ path: path.join(DESTINO, 'durante-salto-1440.png') })
  await page.waitForURL(destinoHoy, { timeout: 15000 })
  let vt = await leerVt(page)
  caso(`Hoy→${destinoHoy.includes('consulta') ? 'Encuentro' : 'Paciente'} invoca la view transition`, vt.llamadas === 1, `llamadas=${vt.llamadas}`)
  caso('el atributo data-vt-continuidad estaba puesto al capturar', vt.atributoDuranteTransicion)
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-vt-continuidad'), null, { timeout: 5000 })
  caso('el atributo se LIMPIA al terminar la transición', true)
  const h1Destino = await page.locator('h1.nx-vt-paciente, .nx-vt-paciente').count()
  caso('el destino lleva .nx-vt-paciente (el objeto ATERRIZA)', h1Destino === 1, `nodos=${h1Destino}`)
  await page.screenshot({ path: path.join(DESTINO, 'despues-salto-1440.png') })

  // Paciente → Encuentro: desde el expediente, «Nueva consulta».
  await page.goto(`${BASE}/expediente/${PACIENTE_SEMBRADO}`, { waitUntil: 'load' })
  await page.waitForSelector('h1.nx-vt-paciente', { timeout: 15000 })
  await instrumentar(page)
  await page.screenshot({ path: path.join(DESTINO, 'antes-expediente-1440.png') })
  await page.locator('button:has-text("Nueva consulta")').click()
  await page.waitForURL('**/consulta/**', { timeout: 15000 })
  vt = await leerVt(page)
  caso('Paciente→Encuentro invoca la view transition (el ancla es el origen)', vt.llamadas === 1, `llamadas=${vt.llamadas}`)

  // ── 5ª rebanada: la SEGUNDA cadena de §20 — Result queue → Patient result ──
  // El objeto compartido es la identidad del paciente (.nx-ident de la
  // tarjeta), decidido en continuidad.ts con §9 y §21 leídos.
  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.waitForSelector('a.nx-ident', { timeout: 15000 })
  await instrumentar(page)
  await page.screenshot({ path: path.join(DESTINO, 'antes-pendientes-1440.png') })
  await page.locator('a.nx-ident').first().click()
  await page.waitForURL('**/expediente/**', { timeout: 15000 })
  vt = await leerVt(page)
  caso('Result queue→Patient result invoca la view transition', vt.llamadas === 1, `llamadas=${vt.llamadas}`)
  await page.waitForFunction(() => window.__vt.readyOk !== null, null, { timeout: 5000 })
  vt = await leerVt(page)
  caso('…y el par SE FORMÓ (ready resolvió — la animación arrancó, no se saltó)', vt.readyOk === true, `readyOk=${vt.readyOk}`)
  await page.screenshot({ path: path.join(DESTINO, 'despues-pendientes-1440.png') })

  // ── 5ª rebanada: /pacientes → expediente (el salto que la 4ª declaró fuera) ─
  await page.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await page.waitForSelector('.nx-fila-abrir', { timeout: 15000 })
  await instrumentar(page)
  await page.locator('.nx-fila-abrir').first().click()
  await page.waitForURL('**/expediente/**', { timeout: 15000 })
  vt = await leerVt(page)
  caso('/pacientes→expediente invoca la view transition (la fila entrega su .nx-ident)', vt.llamadas === 1, `llamadas=${vt.llamadas}`)

  // ── 5ª rebanada: la franja desde una ruta SIN ancla (referencia) ───────────
  // El caso que motivó la limpieza dentro del callback: la franja SOBREVIVE a
  // la navegación. Si su nombre inline siguiera puesto en la captura nueva,
  // habría dos elementos llamados nx-paciente y el navegador saltaría la
  // transición EN SILENCIO — por eso aquí `ready` es la medición que importa.
  // /referencia/[patientId] y no /receta: receta exige [notaId] en la URL
  // (la primera corrida del arnés lo cazó — /receta/<pac> a secas es 404).
  await page.goto(`${BASE}/referencia/${PACIENTE_SEMBRADO}`, { waitUntil: 'load' })
  await page.waitForSelector('.nx-instrument-strip a.nx-ident-franja', { timeout: 15000 })
  await instrumentar(page)
  await page.screenshot({ path: path.join(DESTINO, 'antes-referencia-franja-1440.png') })
  await page.locator('.nx-instrument-strip a.nx-ident-franja').click()
  await page.waitForURL('**/expediente/**', { timeout: 15000 })
  vt = await leerVt(page)
  caso('franja→expediente (sin ancla en pantalla) invoca la view transition', vt.llamadas === 1, `llamadas=${vt.llamadas}`)
  await page.waitForFunction(() => window.__vt.readyOk !== null, null, { timeout: 5000 })
  vt = await leerVt(page)
  caso('…con la franja VIVA de origen el par se formó igual (la limpieza del callback funciona)', vt.readyOk === true, `readyOk=${vt.readyOk}`)
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-vt-continuidad'), null, { timeout: 5000 })
  const nombreResidual = await page.evaluate(
    () => document.querySelectorAll('[style*="view-transition-name"]').length,
  )
  caso('…y la franja no se queda con el nombre puesto (cero nombres inline residuales)', nombreResidual === 0, `residuales=${nombreResidual}`)
  await page.screenshot({ path: path.join(DESTINO, 'despues-referencia-franja-1440.png') })

  // ── 5ª rebanada: ya EN el expediente, la franja NO intercepta ──────────────
  await instrumentar(page)
  const franjaEnExpediente = page.locator('.nx-instrument-strip a.nx-ident-franja')
  if (await franjaEnExpediente.count()) {
    await franjaEnExpediente.click()
    await page.waitForTimeout(400)
    vt = await leerVt(page)
    caso('en el expediente del mismo paciente la franja navega a secas (0 coreografías)', vt.llamadas === 0, `llamadas=${vt.llamadas}`)
  } else {
    caso('en el expediente del mismo paciente la franja navega a secas (0 coreografías)', false, 'no se encontró el enlace de la franja en el expediente')
  }

  await ctx.close()

  // ── Reduced motion: el API NO se llama y la navegación funciona ───────────
  const ctxReduce = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const pageR = await ctxReduce.newPage()
  await login(pageR)
  await instrumentar(pageR)
  const destinoR = await saltoDesdeHoy(pageR)
  await pageR.waitForURL(destinoR, { timeout: 15000 })
  const vtR = await leerVt(pageR)
  caso('bajo reduced-motion el API NO se invoca (candado JS, §24)', vtR.llamadas === 0, `llamadas=${vtR.llamadas}`)
  caso('bajo reduced-motion la navegación LLEGA igual', /\/(consulta|expediente)\//.test(pageR.url()))
  await ctxReduce.close()

  // ── Móvil 390: el mismo salto con el shell móvil ───────────────────────────
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageM = await ctxM.newPage()
  await login(pageM)
  await instrumentar(pageM)
  await pageM.waitForSelector('.cita-fila', { timeout: 15000 })
  await pageM.screenshot({ path: path.join(DESTINO, 'antes-hoy-390.png') })
  const destinoM = await saltoDesdeHoy(pageM)
  await pageM.waitForURL(destinoM, { timeout: 15000 })
  const vtM = await leerVt(pageM)
  caso('móvil 390: el salto desde Hoy también coreografía', vtM.llamadas === 1, `llamadas=${vtM.llamadas}`)
  await pageM.screenshot({ path: path.join(DESTINO, 'despues-salto-390.png') })

  // 5ª rebanada: la segunda cadena también en móvil — el worklist es trabajo
  // de teléfono (§22: «review result» es trabajo móvil primario).
  await pageM.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await pageM.waitForSelector('a.nx-ident', { timeout: 15000 })
  await instrumentar(pageM)
  await pageM.locator('a.nx-ident').first().click()
  await pageM.waitForURL('**/expediente/**', { timeout: 15000 })
  const vtM2 = await leerVt(pageM)
  caso('móvil 390: Result queue→Patient result coreografía', vtM2.llamadas === 1, `llamadas=${vtM2.llamadas}`)
  await pageM.screenshot({ path: path.join(DESTINO, 'despues-pendientes-390.png') })
  await ctxM.close()

  await browser.close()

  const erroresApp = resultado.consola.filter((t) => !/ERR_TUNNEL_CONNECTION_FAILED|net::/.test(t))
  caso('consola sin errores de la app', erroresApp.length === 0, erroresApp.slice(0, 3).join(' | '))

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(`\n${resultado.casos.length - fallos}/${resultado.casos.length} en verde → ${DESTINO}/resultado.json`)
  if (fallos > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
