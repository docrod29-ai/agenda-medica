#!/usr/bin/env node
/**
 * AXE SOBRE LOS RECORRIDOS DE ESTE CARRIL — a 390, 768 y 1440.
 *
 * No es una auditoría general de la aplicación: eso ya existe
 * (`scripts/design/axe-v10.mjs`, con su línea base). Esto mira **las pantallas
 * que este carril tocó** y las que forman los dos recorridos que ha probado —
 * reserva del paciente y alta de la asistente— para que ningún arreglo de este
 * carril haya empeorado la accesibilidad, y para ver qué queda.
 *
 * Lo que axe NO ve, dicho para que nadie lo suponga: el orden de tabulación
 * real, si el foco queda atrapado, si un mensaje se anuncia cuando aparece, y
 * si el texto tiene sentido. Eso se mira aparte.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const base = process.argv[2] || 'http://localhost:3200'
const RUTAS = process.argv.slice(3)
mkdirSync('docs/audit/carril-excelencia', { recursive: true })

const ANCHOS = [{ w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }]
const nav = await chromium.launch({ executablePath: CHROME })
const acta = []

/** Con `--sesion` entra primero con la cuenta sintética del emulador. */
const CON_SESION = process.env.AXE_SESION === '1'

for (const ruta of RUTAS) {
  for (const { w, h } of ANCHOS) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h } })
    const pag = await ctx.newPage()
    if (CON_SESION) {
      await pag.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
      await pag.waitForTimeout(2500)
      await pag.locator('input[type=email]').first().fill('demo@nexusmed.test').catch(() => {})
      await pag.locator('input[type=password]').first().fill('demo1234').catch(() => {})
      await pag.locator('button[type=submit]').first().click().catch(() => {})
      await pag.waitForTimeout(6000)
    }
    await pag.goto(base + ruta, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await pag.waitForTimeout(4000)
    // El tour de bienvenida tapa la pantalla en la primera visita.
    const saltar = pag.locator('button:visible').filter({ hasText: /^saltar$/i }).first()
    if (await saltar.count().catch(() => 0)) { await saltar.click().catch(() => {}); await pag.waitForTimeout(1200) }
    await pag.addScriptTag({ content: AXE })
    const r = await pag.evaluate(async () => {
      // @ts-expect-error axe se inyecta arriba
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
      return res.violations.map(v => ({ id: v.id, impacto: v.impact, n: v.nodes.length, ayuda: v.help }))
    })
    acta.push({ ruta, ancho: w, violaciones: r })
    await ctx.close()
  }
}
await nav.close()
writeFileSync('docs/audit/carril-excelencia/acta-axe.json', JSON.stringify(acta, null, 2) + '\n')

const porRegla = new Map()
for (const a of acta) for (const v of a.violaciones) {
  const k = `${v.impacto}·${v.id}`
  porRegla.set(k, (porRegla.get(k) ?? 0) + v.n)
}
for (const a of acta) {
  const criticas = a.violaciones.filter(v => v.impacto === 'critical' || v.impacto === 'serious')
  console.log(`${a.ruta.padEnd(34)} ${String(a.ancho).padStart(4)}px  total=${a.violaciones.length}  graves=${criticas.length}${criticas.length ? '  → ' + criticas.map(v => v.id).join(', ') : ''}`)
}
console.log('\n── por regla (nodos) ──')
for (const [k, n] of [...porRegla.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
