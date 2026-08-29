#!/usr/bin/env node
/**
 * CAPTURAS DEL CARRIL DE EXCELENCIA — navegador real, tres anchos.
 *
 * Una regla de este repositorio: «no se aprueba una interfaz leyendo el
 * código» (`.claude/rules/design-system.md`). Esto es su instrumento mínimo:
 * lanza Chromium de verdad, recorre las rutas que se le pidan a 390 / 768 /
 * 1440 y deja la captura y la consola en `docs/audit/carril-excelencia/`.
 *
 * `executablePath` apunta al Chromium preinstalado del entorno: la versión de
 * `@playwright/test` del repositorio pide una descarga que aquí no existe, y
 * bajarla no es la prueba — verla, sí.
 *
 * Uso:  node scripts/carril-excelencia/capturar.mjs <base> <ruta> [ruta...]
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const ANCHOS = [
  { w: 390, h: 844, nombre: 'movil' },
  { w: 768, h: 1024, nombre: 'tableta' },
  { w: 1440, h: 900, nombre: 'escritorio' },
]
const SALIDA = 'docs/audit/carril-excelencia/capturas'

const [base, ...rutas] = process.argv.slice(2)
if (!base || !rutas.length) {
  console.error('uso: capturar.mjs <base> <ruta> [ruta...]')
  process.exit(2)
}

mkdirSync(SALIDA, { recursive: true })
const navegador = await chromium.launch({ executablePath: CHROME })
const acta = []

for (const ruta of rutas) {
  for (const { w, h, nombre } of ANCHOS) {
    const ctx = await navegador.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    const pag = await ctx.newPage()
    const consola = []
    pag.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consola.push(`${m.type()}: ${m.text().slice(0, 200)}`) })
    pag.on('pageerror', e => consola.push(`pageerror: ${String(e).slice(0, 200)}`))
    const slug = (ruta === '/' ? 'landing' : ruta.replace(/^\//, '').replace(/[^\w-]/g, '_')) + '-' + nombre
    let estado = 'ok'
    try {
      const resp = await pag.goto(base + ruta, { waitUntil: 'networkidle', timeout: 45000 })
      estado = String(resp?.status() ?? '?')
    } catch (e) { estado = 'ERROR: ' + String(e).slice(0, 120) }
    await pag.screenshot({ path: `${SALIDA}/${slug}.png`, fullPage: false })
    // ¿La página se desborda a lo ancho? Un body que hace scroll horizontal es
    // el defecto responsive más común y el más fácil de no ver.
    const desborde = await pag.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    acta.push({ ruta, ancho: w, estado, desbordeHorizontal: desborde, consola })
    await ctx.close()
  }
}
await navegador.close()
writeFileSync('docs/audit/carril-excelencia/acta-capturas.json', JSON.stringify(acta, null, 2) + '\n')
for (const a of acta) console.log(`${a.ruta} @${a.ancho}  http=${a.estado}  desborde=${a.desbordeHorizontal}  consola=${a.consola.length}`)
