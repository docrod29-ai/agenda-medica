/** Las mismas rutas, en TEMA CLARO: axe + captura. Ambos temas son producto. */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const [base, salida, ...rutas] = process.argv.slice(2)
mkdirSync(salida, { recursive: true })
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let total = 0
for (const ruta of rutas) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
  const p = await ctx.newPage()
  // El tema se fija por atributo, como lo hace el conmutador del producto.
  await p.addInitScript(() => {
    try { localStorage.setItem('nexus-theme', 'light') } catch {}
    document.documentElement.setAttribute('data-theme', 'light')
  })
  await p.goto(base + ruta, { waitUntil: 'networkidle' })
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await p.waitForTimeout(900)
  const slug = (ruta === '/' ? 'landing' : ruta.replace(/^\//, '').replace(/[^\w-]/g, '_'))
  await p.screenshot({ path: `${salida}/${slug}-claro.png` })
  await p.addScriptTag({ content: AXE })
  const r = await p.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }))
  const graves = r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  total += graves.reduce((n, v) => n + v.nodes.length, 0)
  console.log(ruta.padEnd(24), 'graves=' + graves.reduce((n, v) => n + v.nodes.length, 0),
    graves.map(v => v.id).join(',') || '')
  for (const v of graves) for (const n of v.nodes.slice(0, 2)) {
    console.log('   ', n.html.slice(0, 130))
    console.log('    →', (n.any[0]?.message || '').replace(/\s+/g, ' ').slice(0, 190))
  }
  await ctx.close()
}
console.log('\nTOTAL graves en tema claro:', total)
await nav.close()
