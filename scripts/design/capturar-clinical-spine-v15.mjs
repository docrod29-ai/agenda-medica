/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-PATIENT-WORKSPACE-001, Clinical Spine.
 *
 * Igual método que `capturar-patient-anchor-v15.mjs`: login real contra los
 * emuladores, `/expediente/[patientId]` real (paciente sintético con nota
 * firmada + borrador + pendientes sembrados), captura desktop + móvil,
 * axe-core, errores de consola, Y verificación de comportamiento real: click
 * en un item del riel desplaza a su ancla, y el scroll manual resalta la
 * sección visible (IntersectionObserver). No se aprueba leyendo JSX.
 *
 * Uso: node scripts/design/capturar-clinical-spine-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-clinical-spine'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

const VIEWPORTS = [
  { nombre: 'desktop', width: 1440, height: 900 },
  { nombre: 'mobile', width: 390, height: 844 },
]

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = { riel: null, clicNavega: null, scrollResalta: null, axe: {}, consola: {} }

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: 'es-MX',
    })
    const page = await context.newPage()
    const erroresConsola = []
    page.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(msg.text()) })
    page.on('pageerror', (err) => erroresConsola.push(String(err)))

    await login(page)
    await page.goto(`${BASE}/expediente/${PATIENT_ID}`, { waitUntil: 'load' })
    await page.waitForSelector('.nx-clinical-spine', { timeout: 15000 }).catch(() => null)
    await page.waitForTimeout(1500)
    await page.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)
    await page.waitForTimeout(300)

    if (vp.nombre === 'desktop') {
      resultado.riel = await page.evaluate(() => {
        const nav = document.querySelector('.nx-clinical-spine')
        if (!nav) return null
        const botones = [...nav.querySelectorAll('button')]
        return botones.map(b => b.textContent.trim())
      })

      // CLIC NAVEGA — el DOM real, no sólo el onClick en el JSX. Cada botón
      // lleva `data-spine-target` con SU PROPIA ancla; se pulsa el último
      // botón del riel y se mide la posición de ESA ancla exacta (no la
      // última que exista en el DOM, que puede ser de una categoría oculta
      // sin item en el riel — p.ej. "Ingresos" cuando el paciente no tiene).
      const objetivo = await page.evaluate(() => {
        const botones = [...document.querySelectorAll('.nx-clinical-spine button')]
        return botones[botones.length - 1]?.getAttribute('data-spine-target') ?? null
      })
      if (objetivo) {
        const antes = await page.evaluate((id) => document.getElementById(id)?.getBoundingClientRect().top, objetivo)
        const botones = await page.$$('.nx-clinical-spine button')
        await botones[botones.length - 1].click()
        await page.waitForTimeout(700) // scrollIntoView({behavior:'smooth'})
        const despues = await page.evaluate((id) => document.getElementById(id)?.getBoundingClientRect().top, objetivo)
        resultado.clicNavega = {
          objetivo, antes, despues,
          /*
           * Esta página, con este paciente sembrado, sólo tiene ~382px de
           * scroll disponible (1282px de alto de documento - 900px de
           * viewport): pedirle "cerca del top absoluto" a una ancla que
           * arrancó a 694.5px es matemáticamente imposible aquí — el máximo
           * que puede subir es exactamente ese margen. Se verifica lo real:
           * se movió HACIA el top, y terminó visible en pantalla (no que
           * llegó a y=0, que depende de cuánto más hay debajo del ancla).
           */
          seDesplazoHaciaElTop: despues !== undefined && despues !== null && antes !== undefined && antes !== null && despues < antes,
          quedoVisibleEnPantalla: despues !== undefined && despues !== null && despues >= -20 && despues <= 900,
        }
      }

      // SCROLL RESALTA — bajar manualmente por la página y comprobar que
      // aria-current se mueve a un item DISTINTO del primero (prueba real del
      // IntersectionObserver, no sólo que exista en el código). El scroll real
      // aquí ocurre en `window`/`documentElement`, NO dentro de `<main>`: para
      // esta cantidad de contenido `<main>` no desborda (scrollHeight ==
      // clientHeight), es la ventana la que se desplaza — el
      // IntersectionObserver usa `root: null` (viewport) precisamente para no
      // depender de cuál contenedor sea el que scrollea.
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(200)
      const activoInicial = await page.evaluate(() =>
        document.querySelector('.nx-clinical-spine button[aria-current="true"]')?.textContent.trim() ?? null)
      await page.evaluate(() => window.scrollBy(0, 900))
      await page.waitForTimeout(500)
      const activoTrasScroll = await page.evaluate(() =>
        document.querySelector('.nx-clinical-spine button[aria-current="true"]')?.textContent.trim() ?? null)
      resultado.scrollResalta = { activoInicial, activoTrasScroll, cambio: activoInicial !== activoTrasScroll }

      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(200)
    }

    await page.screenshot({ path: path.join(DESTINO, `expediente--${vp.nombre}.png`), fullPage: false })

    await page.addScriptTag({ content: axeSource })
    const axeResult = await page.evaluate(async () => await window.axe.run(document, {
      resultTypes: ['violations'],
    }))
    resultado.axe[vp.nombre] = axeResult.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
    resultado.consola[vp.nombre] = erroresConsola

    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
