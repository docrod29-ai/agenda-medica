/** axe sobre una ruta, con el DETALLE de cada nodo — para poder arreglarlo. */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const [base, ruta, anchoStr] = process.argv.slice(2)
const w = Number(anchoStr || 1440)
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await (await nav.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } })).newPage()
await p.goto(base + ruta, { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.addScriptTag({ content: AXE })
const r = await p.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }))
for (const v of r.violations) {
  console.log(`\n${v.impact}·${v.id} — ${v.help}`)
  for (const n of v.nodes) {
    console.log('  target:', JSON.stringify(n.target))
    console.log('  html  :', n.html.slice(0, 180))
    for (const c of [...(n.any||[]), ...(n.all||[])]) console.log('  →', c.message.replace(/\s+/g,' ').slice(0, 260))
  }
}
if (!r.violations.length) console.log('sin violaciones')
await nav.close()
