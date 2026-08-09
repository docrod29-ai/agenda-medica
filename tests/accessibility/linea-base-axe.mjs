/**
 * Línea base de accesibilidad — axe-core sobre el golden flow autenticado.
 * V10 §27, §47 salida 10.
 *
 * Corre axe-core (WCAG 2.x A/AA) en cada pantalla crítica de Practice, en
 * escritorio (1440×900) y móvil (390×844), con la sesión del médico sintético.
 * Escribe el detalle en JSON y un resumen por consola.
 *
 * NO es la auditoría completa (teclado, lector de pantalla y foco se revisan a
 * mano — axe no los cubre); es la línea base automatizable y repetible.
 *
 * Requiere: app en BASE_URL con emuladores sembrados (mismo arnés que
 * capturar-golden-flow.mjs).
 *
 * Uso: node tests/accessibility/linea-base-axe.mjs [salida.json]
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const SALIDA = process.argv[2] || 'docs/design/capturas/axe-linea-base.json'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const CRED = { email: 'medico@sintetico.test', password: 'Captura-V10-Sintetica' }

const PANTALLAS = [
  { nombre: 'landing', ruta: '/', publica: true },
  { nombre: 'login', ruta: '/login', publica: true },
  { nombre: 'hoy', ruta: '/dashboard' },
  { nombre: 'calendario', ruta: '/calendario' },
  { nombre: 'citas', ruta: '/citas' },
  { nombre: 'pacientes', ruta: '/pacientes' },
  { nombre: 'expediente', ruta: '/expediente/pac-sint-01' },
  { nombre: 'consulta', ruta: '/consulta/pac-sint-03' },
  { nombre: 'pendientes', ruta: '/pendientes' },
]
const VIEWPORTS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'movil', width: 390, height: 844, movil: true },
]

// CHROMIUM: mismo fallback que capturar-golden-flow.mjs — navegador del sistema.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH || existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' }
    : {},
)
const resultados = { fecha: new Date().toISOString(), base: BASE, pantallas: [] }

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: !!vp.movil, hasTouch: !!vp.movil,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()

  const medir = async (p) => {
    await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.evaluate(AXE)
    const r = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const res = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      })
      return res.violations.map(v => ({
        id: v.id, impacto: v.impact, descripcion: v.help,
        nodos: v.nodes.length,
        ejemplo: v.nodes[0]?.target?.join(' ') ?? '',
      }))
    })
    resultados.pantallas.push({ pantalla: p.nombre, viewport: vp.nombre, violaciones: r })
    const criticas = r.filter(v => v.impacto === 'critical' || v.impacto === 'serious')
    console.log(`${p.nombre} @ ${vp.nombre}: ${r.length} tipos de violación (${criticas.length} serias/críticas)`)
  }

  // Públicas ANTES del login (/login con sesión redirige al dashboard).
  for (const p of PANTALLAS.filter(p => p.publica)) await medir(p)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#correo-electronico', CRED.email)
  await page.fill('#contrasena', CRED.password)
  await Promise.all([
    page.waitForURL(/dashboard|citas|calendario/, { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)
  // El tour de bienvenida taparía el dashboard: se salta por su botón real.
  const saltar = page.getByRole('button', { name: 'Saltar' }).first()
  await saltar.waitFor({ state: 'visible', timeout: 6000 })
    .then(() => saltar.click())
    .then(() => page.waitForTimeout(400))
    .catch(() => {}) // sin tour (ya visto en este contexto): seguir


  for (const p of PANTALLAS.filter(p => !p.publica)) await medir(p)

  await ctx.close()
}
await browser.close()

mkdirSync(dirname(SALIDA), { recursive: true })
writeFileSync(SALIDA, JSON.stringify(resultados, null, 2))
console.log(`Detalle en ${SALIDA}`)
