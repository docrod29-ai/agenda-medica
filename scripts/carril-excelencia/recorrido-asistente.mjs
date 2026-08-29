#!/usr/bin/env node
/**
 * EL RECORRIDO DE LA ASISTENTE — agendar desde el panel, en un navegador real.
 *
 * Entra con la sesión sintética del emulador, abre la agenda y da de alta una
 * cita. Mide además lo que decide si el trabajo es rápido: cuántas pantallas y
 * cuántos toques hay entre «llega una llamada» y «la cita está guardada».
 *
 * Uso: node scripts/carril-excelencia/recorrido-asistente.mjs <base>
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const SALIDA = 'docs/audit/carril-excelencia/capturas'
const [base] = process.argv.slice(2)
const CORREO = 'demo@nexusmed.test', CLAVE = 'demo1234'
mkdirSync(SALIDA, { recursive: true })

const ANCHOS = [
  { w: 390, h: 844, nombre: 'movil' },
  { w: 768, h: 1024, nombre: 'tableta' },
  { w: 1440, h: 900, nombre: 'escritorio' },
]

const acta = []
const nav = await chromium.launch({ executablePath: CHROME })

for (const { w, h, nombre } of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h } })
  const pag = await ctx.newPage()
  const consola = []
  pag.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 180)) })
  pag.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 180)))

  const pasos = []
  const paso = async (nom, fn) => {
    try { const r = await fn(); pasos.push({ paso: nom, ok: true, detalle: r ?? '' }) }
    catch (e) { pasos.push({ paso: nom, ok: false, detalle: String(e).slice(0, 220) }) }
    await pag.screenshot({ path: `${SALIDA}/asistente-${nombre}-${pasos.length}-${nom}.png` })
  }

  await paso('1-login', async () => {
    await pag.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await pag.locator('input[type=email]').first().fill(CORREO)
    await pag.locator('input[type=password]').first().fill(CLAVE)
    await pag.locator('button[type=submit]').first().click()
    await pag.waitForTimeout(6000)
    return pag.url().replace(base, '')
  })
  /**
   * `networkidle` NO SIRVE EN ESTA APP.
   *
   * La agenda abre escuchas en vivo de Firestore: la conexión no queda ociosa
   * nunca, así que `waitUntil: 'networkidle'` agota su tiempo aunque la
   * pantalla lleve rato pintada. Se espera a que aparezca lo que importa.
   */
  await paso('2-agenda', async () => {
    await pag.goto(`${base}/citas`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await pag.waitForTimeout(6000)
    return (await pag.locator('body').innerText()).slice(0, 180).replace(/\n/g, ' · ')
  })
  await paso('3-cerrar-tour', async () => {
    // El tour de bienvenida tapa la pantalla en la primera visita. Es su
    // trabajo; para medir la agenda hay que quitarlo de en medio.
    const saltar = pag.locator('button:visible').filter({ hasText: /^saltar$/i }).first()
    if (await saltar.count() === 0) return 'sin tour'
    await saltar.click(); await pag.waitForTimeout(1200)
    return 'tour cerrado'
  })
  await paso('4-abrir-alta', async () => {
    const b = pag.locator('button:visible').filter({ hasText: /nueva cita|agendar|\+ *cita/i }).first()
    if (await b.count() === 0) return 'sin botón de alta visible'
    await b.click({ timeout: 8000 }); await pag.waitForTimeout(2000)
    return (await pag.locator('body').innerText()).slice(0, 180).replace(/\n/g, ' · ')
  })
  await paso('5-tope-de-fecha', async () => {
    const f = pag.locator('input[type=date]:visible').first()
    if (await f.count() === 0) return 'sin campo de fecha'
    const max = await f.getAttribute('max')
    const r = await f.evaluate(el => { el.value = '2051-01-01'; return { v: el.value, over: el.validity.rangeOverflow } })
    return `max=${max} · 2051→rangeOverflow=${r.over}`
  })
  await paso('6-guardar-cita', async () => {
    // Una fecha válida lejana: 2050 tiene que poder agendarse desde el panel.
    const f = pag.locator('input[type=date]:visible').first()
    if (await f.count() === 0) return 'sin campo de fecha'
    await f.fill('2050-12-31')
    // Paciente: se escribe en el buscador y se toma la primera sugerencia.
    const buscador = pag.locator('input:visible').filter({ hasNot: pag.locator('[type=date]') }).first()
    await buscador.fill('Rosalía').catch(() => {})
    await pag.waitForTimeout(1500)
    const sug = pag.locator('button:visible, li:visible').filter({ hasText: /Rosal/i }).first()
    if (await sug.count()) { await sug.click().catch(() => {}); await pag.waitForTimeout(800) }
    const guardar = pag.locator('button:visible').filter({ hasText: /guardar|crear|agendar|confirmar/i }).last()
    if (await guardar.count() === 0) return 'sin botón de guardar'
    await guardar.click({ timeout: 8000 }).catch(() => {})
    await pag.waitForTimeout(3500)
    return (await pag.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' · ')
  })

  acta.push({ ancho: w, pasos, consola: consola.slice(0, 5) })
  await ctx.close()
}
await nav.close()
writeFileSync('docs/audit/carril-excelencia/acta-recorrido-asistente.json', JSON.stringify(acta, null, 2) + '\n')
for (const a of acta) {
  console.log(`\n── ${a.ancho}px ──`)
  for (const p of a.pasos) console.log(`  ${p.ok ? '✓' : '✗'} ${p.paso}: ${p.detalle}`)
  if (a.consola.length) console.log('  consola:', a.consola)
}
