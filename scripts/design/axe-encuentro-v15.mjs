/**
 * ACCESIBILIDAD DE LO QUE ESTA REBANADA TOCÓ — axe sobre las seis superficies
 * críticas, en los dos anchos.
 *
 * No reemplaza a `axe-v10.mjs`: ése corre con la siembra `demo.nexusmed.test` y
 * ESCRIBE la línea base de V10 (`tests/accessibility/axe-baseline-v10.json`).
 * Pisarla desde aquí, con otra siembra y otro subconjunto de pantallas, dejaría
 * la línea base diciendo algo que no midió. Éste corre con la siembra de
 * capturas, cubre las superficies críticas de §29 —incluidas `/operaciones` y el
 * encuentro SIN FIRMAR, que la de V10 no visita— y escribe su propia acta.
 *
 * Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *        --project demo-nexusmed-test "bash scripts/design/arnes-axe-v15.sh"
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import fs from 'node:fs'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = 'docs/design/capturas/v15-encuentro-v29'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const PANTALLAS = [
  ['hoy', '/dashboard'],
  ['pacientes', '/pacientes'],
  ['expediente', '/expediente/pac-aurelio-dominguez'],
  ['consulta-sin-firmar', '/consulta/pac-aurelio-dominguez'],
  ['operaciones', '/operaciones'],
  ['pendientes', '/pendientes'],
]

mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const acta = { fecha: new Date().toISOString(), base: BASE, viewports: {} }

for (const [vp, ancho, alto] of [['escritorio', 1440, 900], ['movil', 390, 844]]) {
  const ctx = await navegador.newContext({
    viewport: { width: ancho, height: alto }, isMobile: ancho < 700, hasTouch: ancho < 700,
    serviceWorkers: 'block',
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 40000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
  } catch { /* sin tour */ }

  acta.viewports[vp] = {}
  for (const [nombre, ruta] of PANTALLAS) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(3000)
    await page.addScriptTag({ content: AXE })
    const violaciones = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        resultTypes: ['violations'],
      })
      return r.violations.map(v => ({ regla: v.id, impacto: v.impact, nodos: v.nodes.length, ayuda: v.help }))
    })
    acta.viewports[vp][nombre] = violaciones
    console.log(`${vp.padEnd(11)} ${nombre.padEnd(20)} ${violaciones.length} reglas · ${violaciones.map(v => `${v.regla}(${v.nodos})`).join(' ') || 'limpio'}`)
  }
  await ctx.close()
}

await navegador.close()
writeFileSync(`${DESTINO}/acta-axe.json`, JSON.stringify(acta, null, 2))

const todas = Object.values(acta.viewports).flatMap(v => Object.values(v).flat())
console.log('\nreglas distintas:', [...new Set(todas.map(v => v.regla))].sort().join(', ') || '(ninguna)')
