#!/usr/bin/env node
/**
 * ¿SE PUEDE RESERVAR UNA CITA SIN TOCAR EL RATÓN?
 *
 * axe no contesta esto. axe mira el árbol accesible; el teclado es una
 * secuencia. Un formulario puede tener todas sus etiquetas correctas y aun así
 * ser imposible de completar con Tab si un paso no recibe el foco, si el foco
 * se pierde al cambiar de paso, o si el anillo de foco no se ve.
 *
 * Recorre el alta del paciente pulsando SÓLO Tab y Enter, y en cada paso anota:
 * qué elemento tiene el foco, si su anillo es visible, y si se pudo avanzar.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base, clinicId] = process.argv.slice(2)

const nav = await chromium.launch({ executablePath: CHROME })
const acta = []

for (const { w, h, nombre } of [{ w: 390, h: 844, nombre: 'movil' }, { w: 1440, h: 900, nombre: 'escritorio' }]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h } })
  const pag = await ctx.newPage()
  await pag.goto(`${base}/reservar/${clinicId}`, { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(2500)

  const enfocado = () => pag.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return { etiqueta: '(body)', anillo: false }
    const cs = getComputedStyle(el)
    const texto = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 40)
    // Anillo visible = outline con grosor, o box-shadow que no sea 'none'.
    const anillo = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none')
    return { etiqueta: `${el.tagName.toLowerCase()}«${texto}»`, anillo }
  })

  /** Tab hasta encontrar un elemento cuyo texto case, y pulsarlo con Enter. */
  const tabHasta = async (re, max = 60) => {
    for (let i = 0; i < max; i++) {
      await pag.keyboard.press('Tab')
      await pag.waitForTimeout(90)
      const f = await enfocado()
      if (re.test(f.etiqueta)) return f
    }
    return null
  }

  const pasos = []
  const paso = async (nom, fn) => {
    const r = await fn().catch(e => ({ error: String(e).slice(0, 120) }))
    pasos.push({ paso: nom, ...(r ?? { ok: false }) })
  }

  await paso('tipo-de-consulta', async () => {
    const f = await tabHasta(/Primera vez/i)
    if (!f) return { ok: false, detalle: 'no se alcanza con Tab' }
    await pag.keyboard.press('Enter'); await pag.waitForTimeout(1500)
    return { ok: true, detalle: f.etiqueta, anillo: f.anillo }
  })
  await paso('dia', async () => {
    const f = await tabHasta(/\d{1,2} de /i)
    if (!f) return { ok: false, detalle: 'no se alcanza con Tab' }
    await pag.keyboard.press('Enter'); await pag.waitForTimeout(2200)
    return { ok: true, detalle: f.etiqueta, anillo: f.anillo }
  })
  await paso('hora', async () => {
    const f = await tabHasta(/\d{2}:\d{2}/)
    if (!f) return { ok: false, detalle: 'no se alcanza con Tab' }
    await pag.keyboard.press('Enter'); await pag.waitForTimeout(1200)
    return { ok: true, detalle: f.etiqueta, anillo: f.anillo }
  })
  await paso('formulario', async () => {
    /**
     * El campo de nombre puede llegar YA enfocado (autoFocus). Si se pulsa Tab
     * a ciegas se escribe el nombre en el teléfono, el nombre queda vacío y el
     * botón «Continuar» se queda deshabilitado — o sea, la prueba reportaría
     * un defecto de teclado que en realidad es suyo. Se mira antes de teclear.
     */
    let f = await enfocado()
    const yaEnUnCampo = await pag.evaluate(() => document.activeElement?.tagName === 'INPUT')
    if (!yaEnUnCampo) f = await tabHasta(/^input/i, 20)
    // Se rellena por NOMBRE de campo, no por orden de tabulación.
    const puestos = []
    for (let i = 0; i < 8; i++) {
      const info = await pag.evaluate(() => {
        const el = document.activeElement
        if (!el || el.tagName !== 'INPUT') return null
        return { tipo: el.getAttribute('type'), ph: el.getAttribute('placeholder') || '', id: el.id || '' }
      })
      if (info) {
        if (/tel/.test(info.tipo || '') || /telefono|614/i.test(info.id + info.ph)) { await pag.keyboard.type('5555003333'); puestos.push('tel') }
        else if (/email/.test(info.tipo || '')) { await pag.keyboard.type('teclado@ejemplo.test'); puestos.push('correo') }
        else { await pag.keyboard.type('Teclado Sintetico de Prueba'); puestos.push('nombre') }
      }
      await pag.keyboard.press('Tab'); await pag.waitForTimeout(90)
      const g = await enfocado()
      if (/Continuar/i.test(g.etiqueta)) break
    }
    return { ok: puestos.includes('nombre') && puestos.includes('tel'), detalle: puestos.join(',') || 'ningún campo', anillo: f?.anillo ?? null }
  })
  await paso('continuar', async () => {
    const f = await tabHasta(/Continuar/i)
    if (!f) return { ok: false, detalle: 'no se alcanza con Tab' }
    await pag.keyboard.press('Enter'); await pag.waitForTimeout(1500)
    return { ok: true, detalle: f.etiqueta, anillo: f.anillo }
  })
  await paso('consentimientos-y-confirmar', async () => {
    // Las casillas se marcan con Espacio, no con Enter.
    for (let i = 0; i < 40; i++) {
      await pag.keyboard.press('Tab'); await pag.waitForTimeout(80)
      const tipo = await pag.evaluate(() => document.activeElement?.getAttribute('type'))
      if (tipo === 'checkbox') await pag.keyboard.press('Space')
      const f = await enfocado()
      if (/confirm|reserv|agend|solicit/i.test(f.etiqueta)) {
        await pag.keyboard.press('Enter'); await pag.waitForTimeout(4000)
        const texto = (await pag.locator('body').innerText()).slice(0, 120).replace(/\n/g, ' · ')
        return { ok: /solicitada|✅|gracias/i.test(texto), detalle: texto, anillo: f.anillo }
      }
    }
    return { ok: false, detalle: 'no se alcanzó el botón de confirmar' }
  })

  acta.push({ ancho: w, pasos })
  await pag.screenshot({ path: `docs/audit/carril-excelencia/capturas/teclado-${nombre}.png` })
  await ctx.close()
}
await nav.close()
writeFileSync('docs/audit/carril-excelencia/acta-teclado.json', JSON.stringify(acta, null, 2) + '\n')
for (const a of acta) {
  console.log(`\n── ${a.ancho}px, sólo teclado ──`)
  for (const p of a.pasos) console.log(`  ${p.ok ? '✓' : '✗'} ${p.paso}: ${p.detalle}${p.anillo === false ? '  ⚠ SIN ANILLO DE FOCO' : ''}`)
}
