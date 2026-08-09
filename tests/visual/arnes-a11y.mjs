/**
 * LÍNEA BASE DE ACCESIBILIDAD V10 — axe-core sobre el golden flow autenticado.
 *
 * Mismos prerrequisitos que arnes-capturas.mjs. axe-core NO es dependencia del
 * repo: se instala al vuelo (`npm i --no-save axe-core`) para no engordar el
 * paquete por una herramienta de auditoría.
 *
 * Corre WCAG 2.x A/AA en escritorio (1440) y móvil (390) y escribe
 * tests/visual/capturas/reporte-a11y.json con las violaciones y sus nodos.
 * Es LÍNEA BASE (V10 §47.10): mide, no falla — el gate llegará en V10-A11Y-001.
 */
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const BASE = process.env.ARNES_BASE_URL ?? 'http://localhost:3000'
const EMAIL = 'dra.demo@nexusmed.test'
const PASSWORD = 'NexusMED-arnes-2026'
const DIR = join(dirname(fileURLToPath(import.meta.url)), 'capturas')

const RUTAS = [
  { ruta: '/login', nombre: 'login', publica: true },
  { ruta: '/dashboard', nombre: 'hoy' },
  { ruta: '/citas', nombre: 'agenda' },
  { ruta: '/pacientes', nombre: 'pacientes' },
  { ruta: '/expediente/pac-sint-01', nombre: 'expediente' },
  { ruta: '/consulta/pac-sint-03', nombre: 'consulta' },
]

const navegador = await chromium.launch({
  executablePath: process.env.ARNES_CHROMIUM ?? undefined,
  args: ['--no-proxy-server'],
})

const resultados = []

for (const vp of [{ nombre: '1440', width: 1440, height: 900 }, { nombre: '390', width: 390, height: 844, movil: true }]) {
  const contexto = await navegador.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: !!vp.movil, hasTouch: !!vp.movil,
    locale: 'es-MX', timezoneId: 'America/Chihuahua',
  })
  await contexto.addInitScript(() => {
    try {
      localStorage.setItem('nexus_tour_v1_medico-demo', '1')
      localStorage.setItem('agenda-medica:push-dismissed', '1')
    } catch { /* sin almacenamiento, el tour saldrá y axe lo medirá también */ }
  })
  const page = await contexto.newPage()

  let sesionIniciada = false
  for (const r of RUTAS) {
    if (!r.publica && !sesionIniciada) {
      await page.goto(`${BASE}/login`, { waitUntil: 'load' })
      await page.waitForSelector('#correo-electronico', { timeout: 30000 })
      await page.fill('#correo-electronico', EMAIL)
      await page.fill('#contrasena', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard**', { timeout: 30000 })
      sesionIniciada = true
    }
    await page.goto(`${BASE}${r.ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(3500)
    await page.addScriptTag({ content: AXE })
    const res = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      })
      return r.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help,
        nodos: v.nodes.length,
        ejemplos: v.nodes.slice(0, 3).map(n => n.target.join(' ')),
      }))
    })
    resultados.push({ pantalla: r.nombre, viewport: vp.nombre, violaciones: res })
    console.log(`✓ axe ${r.nombre} @ ${vp.nombre}: ${res.length} tipos de violación`)
  }
  await contexto.close()
}

writeFileSync(join(DIR, 'reporte-a11y.json'), JSON.stringify(resultados, null, 2))
const graves = resultados.flatMap(r => r.violaciones.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => `${r.pantalla}@${r.viewport}:${v.id}`))
console.log(`✓ reporte-a11y.json · ${graves.length} hallazgos critical/serious`)
await navegador.close()
