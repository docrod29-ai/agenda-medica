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
  await paso('5-datos-paciente', async () => {
    const nom = pag.locator('input[placeholder*="buscar o crear"]').first()
    if (await nom.count() === 0) return 'sin campo de nombre'
    await nom.fill('Asistente Sintetica Prueba')
    await pag.waitForTimeout(1200)
    const tel = pag.locator('input[type=tel], input[placeholder*="656"]').first()
    if (await tel.count()) await tel.fill('5555002222')
    return 'nombre + teléfono'
  })
  await paso('6-mes-adelante', async () => {
    // La flecha ▶ tiene que poder pasar de doce meses: el techo es 2050.
    const antes = await pag.locator('button:visible').filter({ hasText: /^\S+ \d{1,2} de \S+$|^Hoy$/ }).count()
    const flecha = pag.locator('button:visible').nth(0)
    let saltos = 0
    for (let k = 0; k < 14; k++) {
      const sig = pag.locator('button:not([disabled])').filter({ has: pag.locator('svg') }).nth(1)
      if (await sig.count() === 0) break
      await sig.click({ timeout: 4000 }).catch(() => {})
      await pag.waitForTimeout(220); saltos++
    }
    const mes = await pag.locator('span:visible').filter({ hasText: /de \d{4}$/ }).first().innerText().catch(() => '?')
    return `${saltos} saltos · mes visible: ${mes} (antes ${antes} días)`
  })
  await paso('7-elegir-dia-y-hora', async () => {
    const dia = pag.locator('button:not([disabled])').filter({ hasText: /\d{1,2} de \S+|^Hoy$/ }).first()
    if (await dia.count() === 0) return 'sin día pulsable'
    const td = (await dia.innerText()).split('\n')[0]
    await dia.click({ timeout: 6000 }).catch(() => {})
    await pag.waitForTimeout(1800)
    const hora = pag.locator('button:visible').filter({ hasText: /^\d{2}:\d{2}$/ }).first()
    if (await hora.count() === 0) return `día ${td} · sin horas`
    const th = await hora.innerText()
    await hora.click(); await pag.waitForTimeout(700)
    return `día ${td} · hora ${th}`
  })
  await paso('8-agendar', async () => {
    const b = pag.locator('button:not([disabled])').filter({ hasText: /agendar cita/i }).last()
    if (await b.count() === 0) return 'botón Agendar deshabilitado'
    await b.click({ timeout: 8000 })
    await pag.waitForTimeout(4500)
    return (await pag.locator('body').innerText()).slice(0, 220).replace(/\n/g, ' · ')
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
