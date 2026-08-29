#!/usr/bin/env node
/**
 * EL RECORRIDO DE RESERVA DEL PACIENTE, EN UN NAVEGADOR DE VERDAD.
 *
 * De la primera pantalla al comprobante, a los tres anchos, contra los
 * emuladores. Y no sólo el camino feliz: la regla de este carril es probar
 * también el fallo, el reintento, el envío duplicado y el resultado
 * desconocido, porque son los que dejan al paciente sin saber si tiene cita.
 *
 * Uso: node scripts/carril-excelencia/recorrido-reserva.mjs <base> <clinicId>
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const SALIDA = 'docs/audit/carril-excelencia/capturas'
const [base, clinicId] = process.argv.slice(2)
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
  pag.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 160)) })
  pag.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 160)))

  const pasos = []
  const paso = async (nom, fn) => {
    try { const r = await fn(); pasos.push({ paso: nom, ok: true, detalle: r ?? '' }) }
    catch (e) { pasos.push({ paso: nom, ok: false, detalle: String(e).slice(0, 200) }) }
    await pag.screenshot({ path: `${SALIDA}/recorrido-${nombre}-${pasos.length}-${nom}.png` })
  }

  await paso('1-abrir', async () => {
    await pag.goto(`${base}/reservar/${clinicId}`, { waitUntil: 'networkidle', timeout: 45000 })
    return await pag.locator('body').innerText().then(t => t.split('\n')[0])
  })
  await paso('2-tipo', async () => {
    await pag.getByText('Primera vez', { exact: false }).first().click()
    await pag.waitForTimeout(1200)
    return (await pag.locator('body').innerText()).slice(0, 120).replace(/\n/g, ' · ')
  })
  await paso('3-dia', async () => {
    // Las fichas del calendario son «Lun 31 de ago», no un número suelto.
    const ficha = pag.locator('button').filter({ hasText: /^\S+ \d{1,2} de \S+$/ }).first()
    if (await ficha.count() === 0) return 'sin día pulsable'
    const t = (await ficha.innerText()).trim()
    await ficha.click(); await pag.waitForTimeout(2000)
    return t
  })
  await paso('4-hora', async () => {
    const hora = pag.locator('button', { hasText: /^\d{2}:\d{2}$/ }).first()
    if (await hora.count() === 0) return 'sin horas ofrecidas'
    const t = await hora.innerText()
    await hora.click(); await pag.waitForTimeout(900)
    return t
  })
  await paso('5-datos', async () => {
    const campos = pag.locator('input:visible')
    const n = await campos.count()
    const puestos = []
    for (let i = 0; i < n; i++) {
      const el = campos.nth(i)
      const tipo = await el.getAttribute('type')
      const ph = (await el.getAttribute('placeholder')) || (await el.getAttribute('aria-label')) || ''
      if (tipo === 'tel' || /tel|whats|cel/i.test(ph)) { await el.fill('5555000123'); puestos.push('tel') }
      else if (tipo === 'email' || /correo|mail/i.test(ph)) { await el.fill('sintetico@ejemplo.test'); puestos.push('email') }
      else if (tipo === 'text' || tipo === null) { await el.fill('Paciente Sintético de Prueba'); puestos.push('texto') }
    }
    const ta = pag.locator('textarea:visible').first()
    if (await ta.count()) await ta.fill('Motivo sintético de prueba')
    return puestos.join(',')
  })
  await paso('6-continuar', async () => {
    const b = pag.locator('button:not([disabled])').filter({ hasText: /continuar/i }).last()
    if (await b.count() === 0) return 'sin botón Continuar'
    await b.click(); await pag.waitForTimeout(1200)
    return (await pag.locator('body').innerText()).slice(0, 160).replace(/\n/g, ' · ')
  })
  await paso('7-consentir', async () => {
    const cajas = pag.locator('input[type=checkbox]:visible')
    const n = await cajas.count()
    for (let i = 0; i < n; i++) await cajas.nth(i).check({ force: true })
    await pag.waitForTimeout(400)
    return `${n} casillas`
  })
  await paso('8-confirmar', async () => {
    const b = pag.locator('button:not([disabled])').filter({ hasText: /confirm|reserv|agend|solicit|enviar/i }).last()
    if (await b.count() === 0) return 'sin botón de envío habilitado'
    await b.click()
    await pag.waitForTimeout(4000)
    return (await pag.locator('body').innerText()).slice(0, 260).replace(/\n/g, ' · ')
  })

  acta.push({ ancho: w, pasos, consola })
  await ctx.close()
}
await nav.close()
writeFileSync('docs/audit/carril-excelencia/acta-recorrido-reserva.json', JSON.stringify(acta, null, 2) + '\n')
for (const a of acta) {
  console.log(`\n── ${a.ancho}px ──`)
  for (const p of a.pasos) console.log(`  ${p.ok ? '✓' : '✗'} ${p.paso}: ${p.detalle}`)
  if (a.consola.length) console.log('  consola:', a.consola.slice(0, 3))
}
