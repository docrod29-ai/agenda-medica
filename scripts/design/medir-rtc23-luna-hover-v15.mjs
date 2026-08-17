/**
 * RTC-23 (mitad de la luna) — ¿qué hace el conmutador de tema al pasar el
 * ratón, y sigue avisando de que se puede pulsar?
 *
 * Quitar una animación decorativa es fácil; quitarla y llevarse por delante la
 * señal de que el control existe, también. Este arnés mira el `:hover` REAL en
 * `/login` —donde el toggle sigue flotando, porque fuera del panel no hay riel
 * ni topbar donde alojarlo— y comprueba las dos cosas a la vez:
 *
 *   · que el icono ya NO gira;
 *   · que el `:hover` conserva sus señales útiles (contraste y escala).
 *
 * Se mide en `/login` a propósito: es público, no necesita sesión y es una de
 * las superficies donde este botón se le pinta a quien todavía no es cliente.
 *
 * Uso (no necesita emuladores; sólo el servidor):
 *   bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc23-luna-hover-v15.mjs
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc23-luna'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
const errores = []
page.on('pageerror', e => errores.push(`pageerror: ${e.message}`))

await page.goto(`${BASE}/login`, { waitUntil: 'load' })
await page.waitForTimeout(1200)

const leer = () => page.evaluate(() => {
  const b = document.querySelector('.theme-toggle')
  if (!b) return null
  const svg = b.querySelector('svg')
  const csB = getComputedStyle(b)
  const csS = svg ? getComputedStyle(svg) : null
  return {
    existe: true,
    botonTransform: csB.transform,
    color: csB.color,
    svgTransform: csS?.transform ?? null,
    /* La rotación se lee de la matriz: `rotate(20deg)` llega como
       matrix(0.94, 0.34, -0.34, 0.94, 0, 0), no como el texto original. */
    svgGirado: !!csS && csS.transform !== 'none' && !/^matrix\(1, 0, 0, 1,/.test(csS.transform),
  }
})

const reposo = await leer()
if (!reposo) {
  console.log('  el conmutador de tema no está en /login: revisa este arnés antes que el producto')
} else {
  await page.hover('.theme-toggle')
  await page.waitForTimeout(500)          // que termine cualquier transición
  const hover = await leer()

  console.log(`  reposo   svg ${reposo.svgTransform} · botón ${reposo.botonTransform} · color ${reposo.color}`)
  console.log(`  hover    svg ${hover.svgTransform} · botón ${hover.botonTransform} · color ${hover.color}`)
  console.log(`  el icono gira al hover: ${hover.svgGirado}`)
  console.log(`  el hover SIGUE avisando: escala ${hover.botonTransform !== reposo.botonTransform} · contraste ${hover.color !== reposo.color}`)
  await page.screenshot({ path: path.join(DESTINO, 'login-hover-1440.png') })
  fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, reposo, hover, errores }, null, 2))
}

await contexto.close()
await navegador.close()
console.log(`\n${errores.length} errores de página · acta en ${path.join(DESTINO, 'medicion.json')}`)
