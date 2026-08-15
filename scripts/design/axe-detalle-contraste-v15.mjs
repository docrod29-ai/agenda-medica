/**
 * DETALLE DEL CONTRASTE EN LA FAMILIA DOCUMENTAL — quién falla, con qué
 * colores y con qué texto.
 *
 * `axe-familia-documental-v15.mjs` publica «color-contrast(1)» en `/receta` y
 * `/orden` a 1440. Un conteo no basta para decidir si eso bloquea una
 * publicación: **no es lo mismo un texto clínico que un rótulo decorativo**, y
 * §19 sólo llama bloqueante al defecto de accesibilidad que cae sobre una
 * ACCIÓN CRÍTICA. Así que antes de clasificar hay que ver el nodo.
 *
 * Este medidor no repara nada. Devuelve, por cada nodo que axe marca: el
 * selector, el texto, el color de tinta, el de fondo, la razón exacta de axe y
 * si el nodo es un control.
 *
 * Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *        --project demo-nexusmed-test \
 *        "bash scripts/design/arnes-coherencia-v15.sh scripts/design/axe-detalle-contraste-v15.mjs"
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import fs from 'node:fs'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = 'docs/design/capturas/v15-release-gate'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const PANTALLAS = [
  ['receta', '/receta/pac-luzmaria-cervantes/nota-luzmaria-1'],
  ['orden', '/orden/pac-aurelio-dominguez/nota-aurelio-1'],
]

mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const acta = { fecha: new Date().toISOString(), base: BASE, hallazgos: [] }

const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
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

for (const [nombre, ruta] of PANTALLAS) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  await page.addScriptTag({ content: AXE })
  const detalle = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } })
    return r.violations.flatMap(v => v.nodes.map(n => {
      const el = document.querySelector(n.target[0])
      const cs = el ? getComputedStyle(el) : null
      return {
        selector: n.target.join(' '),
        texto: (el?.textContent || '').trim().slice(0, 80),
        etiqueta: el?.tagName,
        esControl: !!el?.closest('button, a, [role="button"]'),
        // `dentroDeVistaPrevia`: el papel que se imprime vive en su propio
        // contenedor; un fallo AHÍ es del artefacto medicolegal, no del cromo.
        dentroDeVistaPrevia: !!el?.closest('.vista-previa, .papel, [class*="preview"], [class*="papel"]'),
        color: cs?.color, fondo: cs?.backgroundColor, px: cs?.fontSize, peso: cs?.fontWeight,
        razon: n.any?.[0]?.message || '',
        datos: n.any?.[0]?.data || null,
      }
    }))
  })
  acta.hallazgos.push({ pantalla: nombre, ruta, nodos: detalle })
  console.log(`\n═══ ${nombre} (${ruta}) ═══`)
  for (const d of detalle) {
    console.log(`  selector      ${d.selector}`)
    console.log(`  texto         «${d.texto}»`)
    console.log(`  etiqueta      ${d.etiqueta} · ¿control? ${d.esControl} · ¿en la vista previa del papel? ${d.dentroDeVistaPrevia}`)
    console.log(`  tinta/fondo   ${d.color} sobre ${d.fondo} · ${d.px}/${d.peso}`)
    console.log(`  razón axe     ${d.razon}`)
    console.log(`  datos         ${JSON.stringify(d.datos)}`)
  }
}

await ctx.close()
await navegador.close()
writeFileSync(`${DESTINO}/acta-contraste-familia-documental.json`, JSON.stringify(acta, null, 2))
console.log('\nacta →', `${DESTINO}/acta-contraste-familia-documental.json`)
