/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-ENCOUNTER-MODE-001 (§40 Real Browser
 * Requirement, §36 Visible-Progress Contract).
 *
 * Prueba que el FlowRail SE ATENÚA de verdad cuando `EVENTO_GRABANDO` suena
 * con `activo: true`, y que se recupera al apagarse — no sólo que el JSX lo
 * declara. Simula la señal con el mismo `CustomEvent` que dispara
 * `avisarEscucha()` en `useGrabacionAudio` (mismo evento, mismo `detail`); no
 * activa el micrófono real, que no es lo que este cambio toca.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm
 * start` apuntando a los emuladores (mismo método que
 * `capturar-flow-rail-v15.mjs`).
 *
 * Uso:
 *   node scripts/design/capturar-flow-rail-quieto-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-encounter-mode-flow-rail-quieto'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

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
 * Estado real del riel: clase quieto en el <aside>, opacidad de íconos
 * decorativos (deben bajar), visibilidad de texto secundario (debe
 * ocultarse), y — lo que protege contraste — opacidad Y texto de las
 * ETIQUETAS de navegación y del nombre del consultorio (deben quedarse
 * exactamente en 1 / visibles, nunca tocados).
 */
async function medir(page) {
  return page.evaluate(() => {
    const aside = document.querySelector('.nx-flow-rail')
    const iconosQuietos = [...document.querySelectorAll('.nx-flow-rail .nx-flow-rail-quiet-icon, .nx-flow-rail .nav-item:not(.active) .nav-icon')]
    const textoOculto = [...document.querySelectorAll('.nx-flow-rail .nx-flow-rail-quiet-hide')]
    const etiquetas = [...document.querySelectorAll('.nx-flow-rail .nav-item span')]
    const activo = document.querySelector('.nx-flow-rail .nav-item.active')
    const nombreConsultorio = document.querySelector('.nx-flow-rail .sidebar-logo > div:nth-child(2) > div:first-child')
    return {
      claseQuieto: aside?.classList.contains('nx-flow-rail--quieto') ?? null,
      opacidadIconosQuietos: iconosQuietos.map(el => getComputedStyle(el).opacity),
      textoSecundarioVisible: textoOculto.map(el => getComputedStyle(el).display !== 'none'),
      opacidadEtiquetas: etiquetas.map(el => getComputedStyle(el).opacity),
      opacidadActivo: activo ? getComputedStyle(activo).opacity : null,
      textoActivo: activo?.textContent?.trim() ?? null,
      opacidadNombreConsultorio: nombreConsultorio ? getComputedStyle(nombreConsultorio).opacity : null,
      nombreConsultorioVisible: nombreConsultorio ? getComputedStyle(nombreConsultorio).display !== 'none' : null,
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  })
  const uid = await uidDelMedico()
  await context.addInitScript((u) => {
    try { localStorage.setItem(`nexus_tour_v1_${u}`, '1') } catch { /* noop */ }
  }, uid)
  const page = await context.newPage()
  const erroresConsola = []
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  await login(page)

  const resultado = {}

  // ── Caso 1: /expediente/[patientId] — activo debe ser "Paciente" ──────────
  await page.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  resultado.antesDeGrabar = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, 'expediente--antes.png'), fullPage: false })

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: true } }))
  })
  await page.waitForTimeout(400) // deja correr la transición CSS de 0.2s
  resultado.grabando = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, 'expediente--grabando.png'), fullPage: false })

  // El foco en el botón de búsqueda (contiene un .nx-flow-rail-quiet-icon) debe
  // restaurar la opacidad de SU ícono a 1, sin apagar los demás.
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300) // deja correr la transición CSS de 0.2s
  resultado.conFocoDentro = await page.evaluate(() => {
    const enfocado = document.activeElement
    const enFlowRail = enfocado ? document.querySelector('.nx-flow-rail')?.contains(enfocado) : false
    const iconoDelEnfocado = enfocado?.querySelector('.nx-flow-rail-quiet-icon, .nav-icon')
    return {
      enFlowRail,
      tag: enfocado?.tagName ?? null,
      opacidadIconoDelEnfocado: iconoDelEnfocado ? getComputedStyle(iconoDelEnfocado).opacity : null,
    }
  })

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: false } }))
  })
  await page.waitForTimeout(400)
  resultado.despuesDeGrabar = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, 'expediente--despues.png'), fullPage: false })

  // ── Caso 2: /consulta/[patientId] — activo debe ser "Encuentro" ───────────
  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  resultado.consultaAntes = await medir(page)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: true } }))
  })
  await page.waitForTimeout(400)
  resultado.consultaGrabando = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, 'consulta--grabando.png'), fullPage: false })

  // Axe con el FlowRail ya atenuado — el atenuado no debe introducir una violación nueva.
  await page.evaluate(axeSource)
  const axeResultado = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodos: v.nodes.length,
      ejemplo: v.nodes[0]?.target?.join(' ') ?? '',
    }))
  })

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: false } }))
  })
  await page.waitForTimeout(400)
  resultado.consultaDespues = await medir(page)

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  fs.writeFileSync(path.join(DESTINO, 'axe-consulta-grabando.json'), JSON.stringify(axeResultado, null, 2))
  if (erroresConsola.length) {
    fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))
  }

  await context.close()
  await browser.close()

const resumenDeUnCaso = (nombre, m) => console.log(
  `  ${nombre}: quieto=${m.claseQuieto} activo="${m.textoActivo}" opacidadActivo=${m.opacidadActivo} ` +
  `opacidadNombreConsultorio=${m.opacidadNombreConsultorio} nombreConsultorioVisible=${m.nombreConsultorioVisible} ` +
  `opacidadEtiquetas=${JSON.stringify(m.opacidadEtiquetas)} opacidadIconosQuietos=${JSON.stringify(m.opacidadIconosQuietos)} ` +
  `textoSecundarioVisible=${JSON.stringify(m.textoSecundarioVisible)}`
)

  console.log('\n── Resumen ──')
  console.log('expediente:')
  resumenDeUnCaso('antes', resultado.antesDeGrabar)
  resumenDeUnCaso('grabando', resultado.grabando)
  resumenDeUnCaso('después', resultado.despuesDeGrabar)
  console.log('  con foco dentro:', JSON.stringify(resultado.conFocoDentro))
  console.log('consulta:')
  resumenDeUnCaso('antes', resultado.consultaAntes)
  resumenDeUnCaso('grabando', resultado.consultaGrabando)
  resumenDeUnCaso('después', resultado.consultaDespues)
  console.log('axe violaciones (consulta, grabando):', axeResultado.length, JSON.stringify(axeResultado))
  console.log('errores de consola:', erroresConsola.length)
}

main().catch(e => { console.error(e); process.exit(1) })
