/**
 * CAPTURAS DEL GOLDEN FLOW AUTENTICADO — arnés V10 (B-V10-2, V10 §33/§39).
 *
 * Requiere: emuladores Auth+Firestore levantados y sembrados
 * (scripts/design/sembrar-emulador-v10.mjs) y `next dev` en :3000.
 *
 * Produce: docs/design/capturas/v10/<fecha>/<pantalla>-<viewport>.png
 *          + resultados axe-core y errores de consola por pantalla (JSON).
 *
 * Solo emuladores y datos sintéticos. No toca producción.
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:3000'
const EMAIL = 'medico@demo-nexusmed.test'
const PASSWORD = 'demo-visual-v10'

const FECHA = process.argv[2] || new Date().toISOString().slice(0, 10)
const OUT = path.join('docs/design/capturas/v10', FECHA)
fs.mkdirSync(OUT, { recursive: true })

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  narrow: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
}

/** Pantallas del golden flow. `todos: true` → 4 viewports; si no, desktop+mobile. */
const PANTALLAS = [
  { id: 'login', ruta: '/login', todos: false },
  { id: 'dashboard', ruta: '/dashboard', todos: true },
  { id: 'agenda-citas', ruta: '/citas', todos: true },
  { id: 'calendario', ruta: '/calendario', todos: false },
  { id: 'pacientes', ruta: '/pacientes', todos: false },
  { id: 'expediente', ruta: '/expediente/pac-01', todos: true },
  { id: 'consulta', ruta: '/consulta/pac-03', todos: true },
  { id: 'nota', ruta: '/nota/pac-01/nota-01', todos: false },
  // La receta cuelga de una nota FIRMADA: /receta/{patientId}/{notaId}
  { id: 'receta', ruta: '/receta/pac-01/nota-01', todos: false },
]

/** `--solo=a,b` recaptura sólo esas pantallas (iteración rápida). */
const SOLO = (process.argv.find(a => a.startsWith('--solo=')) || '').slice(7)
const ACTIVAS = SOLO ? PANTALLAS.filter(p => SOLO.split(',').includes(p.id)) : PANTALLAS

const axeSource = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const executablePath = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium'
const browser = await chromium.launch({
  executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
  headless: true, args: ['--no-proxy-server'],
})

const RESUMEN_PATH = path.join(OUT, 'resumen.json')
const resumen = fs.existsSync(RESUMEN_PATH)
  ? JSON.parse(fs.readFileSync(RESUMEN_PATH, 'utf8'))
  : { fecha: FECHA, pantallas: {} }
// Una recaptura parcial reemplaza los datos de ESA pantalla, no los del resto.
for (const p of ACTIVAS) delete resumen.pantallas[p.id]

async function login(context) {
  const page = await context.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await Promise.all([
    page.waitForURL(/dashboard|citas|setup/, { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2500)
  const url = page.url()
  await page.close()
  return url
}

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({ viewport: vp, locale: 'es-MX' })
  // Estado de "usuario que ya trabaja": el tour de primer uso y el opt-in de
  // push ya fueron vistos. El primer uso se captura aparte (primer-uso-*.png).
  await context.addInitScript(() => {
    try {
      localStorage.setItem('agenda-medica:push-dismissed', '1')
      const orig = Storage.prototype.getItem
      Storage.prototype.getItem = function (k) {
        if (String(k).startsWith('nexus_tour_')) return '1'
        return orig.call(this, k)
      }
    } catch { /* noop */ }
  })
  const urlTrasLogin = await login(context)
  if (vpName === 'desktop') console.log('tras login →', urlTrasLogin)

  for (const p of ACTIVAS) {
    if (!p.todos && vpName !== 'desktop' && vpName !== 'mobile') continue
    const page = await context.newPage()
    const errores = []
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)) })
    page.on('pageerror', (e) => errores.push('PAGEERROR: ' + String(e).slice(0, 300)))
    try {
      await page.goto(BASE + p.ruta, { waitUntil: 'networkidle', timeout: 45000 })
    } catch { /* networkidle puede no llegar con snapshots vivos; captura igual */ }
    await page.waitForTimeout(3000)
    const file = path.join(OUT, `${p.id}--${vpName}.png`)
    await page.screenshot({ path: file, fullPage: false })

    resumen.pantallas[p.id] ??= { ruta: p.ruta, viewports: {}, axe: null, erroresConsola: [] }
    resumen.pantallas[p.id].viewports[vpName] = path.basename(file)
    resumen.pantallas[p.id].erroresConsola.push(...errores.slice(0, 5))

    // axe una sola vez por pantalla (en desktop)
    if (vpName === 'desktop') {
      try {
        await page.evaluate(axeSource)
        const axe = await page.evaluate(async () => {
          const r = await window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
          })
          return r.violations.map(v => ({
            id: v.id, impact: v.impact, help: v.help, nodos: v.nodes.length,
            ejemplo: v.nodes[0]?.target?.join(' ') ?? '',
          }))
        })
        resumen.pantallas[p.id].axe = axe
      } catch (e) {
        resumen.pantallas[p.id].axe = [{ id: '_error', help: String(e).slice(0, 200) }]
      }
    }
    await page.close()
    console.log(`📸 ${p.id} @ ${vpName}`)
  }
  await context.close()
}

await browser.close()
fs.writeFileSync(RESUMEN_PATH, JSON.stringify(resumen, null, 2))
console.log('✅ capturas y resumen en', OUT)
