/**
 * ¿LAS NUEVE PANTALLAS CONVERTIDAS ENTRAN POR EL MISMO SITIO — Y SIGUEN IGUAL?
 *
 * Nueve páginas del panel escribían a mano, byte por byte, la definición de
 * `.nx-canvas` (`padding: 24 · maxWidth: 1100 · margin: 0 auto`). Cambiarlas a
 * la clase no debería moverlas ni un píxel en escritorio. «No debería» no es
 * una medición: la lección `nx-stat-grid` de este repositorio dice justo que
 * un número en línea y una hoja pueden discrepar en silencio.
 *
 * Y en móvil SÍ cambia algo, a propósito: ocho de las nueve no llevaban
 * `.page-pad`, así que no recibían el recorte de ≤480px y se quedaban en 24px
 * de padding donde el resto del producto usa 16. Al entrar por `.nx-canvas` lo
 * reciben. Eso hay que verlo, no suponerlo.
 *
 * Se mide, por ruta y en dos anchos:
 *   · el ancho máximo calculado del lienzo,
 *   · su padding,
 *   · y el BORDE IZQUIERDO por el que se entra a leer — el píxel que §20 pide
 *     que no salte al cambiar de pantalla.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-lienzo-compartido-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-lienzo-compartido'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

/** Las convertidas que se pueden abrir sin un id de por medio. */
const RUTAS = ['/citas', '/configuracion', '/farmacia', '/finanzas', '/crm', '/cumplimiento', '/cumplimiento/retencion']

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const errores = []
const acta = { base: BASE, viewports: {} }

for (const [nombre, viewport] of [['escritorio-1440', { width: 1440, height: 900 }], ['movil-390', { width: 390, height: 844 }]]) {
  const contexto = await navegador.newContext({ viewport, serviceWorkers: 'block' })
  const page = await contexto.newPage()
  page.on('pageerror', e => errores.push(`[${nombre}] pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${nombre}] console: ${m.text()}`) })

  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
    await s.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour */ }

  const filas = {}
  console.log(`\n── ${nombre} ──`)
  for (const ruta of RUTAS) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(1400)
    const m = await page.evaluate(() => {
      const el = document.querySelector('.nx-canvas')
      if (!el) return { hay: false }
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        hay: true,
        maxWidth: cs.maxWidth,
        padding: cs.padding,
        // El píxel por el que se entra a leer: borde del lienzo + su padding.
        bordeTexto: Math.round(r.left + parseFloat(cs.paddingLeft)),
      }
    })
    filas[ruta] = m
    console.log(`  ${ruta.padEnd(26)} ${m.hay ? `maxWidth=${m.maxWidth} padding=${m.padding} bordeTexto=${m.bordeTexto}px` : 'SIN .nx-canvas'}`)
  }

  // El salto lateral: si el borde por el que se entra a leer cambia entre
  // pantallas, el médico no navega al mismo objeto (§20).
  const bordes = Object.values(filas).filter(f => f.hay).map(f => f.bordeTexto)
  const salto = bordes.length ? Math.max(...bordes) - Math.min(...bordes) : null
  console.log(`  salto lateral entre las ${bordes.length} rutas: ${salto}px`)

  await page.goto(`${BASE}/citas`, { waitUntil: 'load' })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}-citas.png`) })

  acta.viewports[nombre] = { filas, salto }
  await contexto.close()
}

await navegador.close()
acta.errores = errores
fs.writeFileSync(path.join(DESTINO, 'acta-lienzo-compartido.json'), JSON.stringify(acta, null, 2))
console.log(`\n${errores.length} errores de consola/página · acta en ${path.join(DESTINO, 'acta-lienzo-compartido.json')}`)
