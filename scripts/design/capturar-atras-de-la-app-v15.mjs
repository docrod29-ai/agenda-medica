/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-NOTE-PLAN-CONTINUITY-001 (Fase 8),
 * cuarta rebanada: `useSmartBack` ahora sí regresa de verdad.
 *
 * La corrida anterior dejó medido (no supuesto) que el botón "Atrás" QUE
 * PINTA LA APP en `/orden` navegaba SIEMPRE a su `fallback` fijo
 * (`/expediente/[patientId]`), nunca de vuelta a `/consulta/[patientId]
 * ?nota=...`, porque `useSmartBack` leía `window.history.state.idx` — un
 * campo que no existe en Next 16.2.12 App Router. El arreglo de esta
 * rebanada cambia la señal a `window.navigation.currentEntry.index` (la
 * Navigation API del navegador, no de Next).
 *
 * Repite el mismo camino real que la corrida anterior (firma con
 * medicamentos Y estudios a la vez), pero esta vez pulsa el botón "Atrás"
 * DE LA APP — no `page.goBack()` — en DOS de las diez pantallas que usan el
 * hook: `/orden` y `/receta`.
 *
 * Uso: node scripts/design/capturar-atras-de-la-app-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-atras-de-la-app'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = { pasos: [], axe: {}, consola: {} }
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'es-MX' })
  const page = await contexto.newPage()
  const erroresConsola = []
  page.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(msg.text()) })
  page.on('pageerror', (err) => erroresConsola.push(String(err)))

  const paso = (nombre, extra) => { resultado.pasos.push({ nombre, ...extra }); console.log('✓', nombre, extra ? JSON.stringify(extra) : '') }

  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  paso('login')

  await page.goto(`${BASE}/configuracion`, { waitUntil: 'load' })
  await page.getByText('Saltar', { exact: true }).click({ timeout: 2500 }).catch(() => null)
  const cedulaInput = page.locator('#cfg-cedula-profesional')
  if (await cedulaInput.count() && !(await cedulaInput.inputValue())) {
    await page.locator('#cfg-nombre-del-medico').fill('Dra. Captura V15')
    await cedulaInput.fill('12345678')
    await page.getByRole('button', { name: /^Guardar$/ }).first().click()
    await page.waitForTimeout(800)
  }
  paso('cédula profesional configurada')

  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.getByText('Saltar', { exact: true }).click({ timeout: 2500 }).catch(() => null)
  await page.waitForSelector('text=Tipo de nota', { timeout: 15000 }).catch(async () => {
    await page.locator('button[aria-label^="Tipo de nota"]').click()
  })
  paso('consulta abierta (nota nueva, sin ?nota=)', { url: page.url() })

  const abrirTipo = page.locator('button[aria-label^="Tipo de nota"]')
  if (await abrirTipo.count()) {
    const yaAbierto = await page.getByText('Tipo de nota', { exact: true }).isVisible().catch(() => false)
    if (!yaAbierto) await abrirTipo.click()
  }
  await page.getByRole('button', { name: 'Valoración Inmunocomprometido', exact: true }).click()

  await page.waitForSelector('text=Elige el motivo de la interconsulta', { timeout: 10000 }).catch(() => null)
  await page.locator('select').first().selectOption('profilaxis')
  await page.locator('select').nth(1).selectOption('VIH')

  await page.getByRole('button', { name: /Serologías basales/ }).first().click()
  const chipVih = page.getByRole('button', { name: 'VIH Ag/Ab 4ª gen', exact: true })
  for (let i = 0; i < 3; i++) {
    const encendido = await chipVih.evaluate(el => getComputedStyle(el).color.includes('130') || el.getAttribute('style')?.includes('rgb(59, 130, 246)'))
    if (encendido) break
    await chipVih.click()
    await page.waitForTimeout(150)
  }

  const checkboxFarmaco = page.locator('text=Fármacos nombrados en las recomendaciones').locator('xpath=following::input[@type="checkbox"][1]')
  if (await checkboxFarmaco.count()) await checkboxFarmaco.check()

  await page.getByRole('button', { name: 'Aplicar a la nota clínica' }).click()
  await page.waitForTimeout(400)

  const filasMed = page.locator('input[placeholder="Medicamento"]')
  if (!(await filasMed.count()) || !(await filasMed.first().inputValue())) {
    await page.getByRole('button', { name: 'Agregar medicamento' }).click()
  }
  const ultimaFilaNombre = filasMed.last()
  if (!(await ultimaFilaNombre.inputValue())) await ultimaFilaNombre.fill('Trimetoprim/sulfametoxazol')
  const idxUltima = (await filasMed.count()) - 1
  const dosisInput = page.locator('input[placeholder="Dosis"]').nth(idxUltima)
  if (!(await dosisInput.inputValue())) await dosisInput.fill('160/800 mg')
  const frecInput = page.locator('input[placeholder="Frecuencia"]').nth(idxUltima)
  if (!(await frecInput.inputValue())) await frecInput.fill('cada 24 horas')

  const impresionYPlan = page.getByPlaceholder('Conclusión de la valoración y seguimiento')
  if (await impresionYPlan.count() && !(await impresionYPlan.inputValue())) {
    await impresionYPlan.fill('Valoración infectológica inicial. Profilaxis y estudios solicitados según huésped. Reevaluar con resultados.')
  }
  paso('nota preparada: medicamentos + estudios a la vez')

  await page.waitForTimeout(300)

  await page.getByRole('button', { name: 'Firmar y cerrar nota' }).click()
  for (let i = 0; i < 4; i++) {
    const confirmar = page.getByRole('button', { name: /Firmar$|Los revisé, firmar|Los reviso y los asumo|Firmar así/ })
    if (await confirmar.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmar.click()
      await page.waitForTimeout(400)
    } else break
  }
  await page.waitForSelector('text=Nota firmada y sellada', { timeout: 15000 }).catch(() => null)
  await page.waitForTimeout(600)

  const urlTrasFirmar = page.url()
  const notaIdEnUrl = (urlTrasFirmar.match(/nota=([^&]+)/) || [])[1] || null
  paso('firmada — URL con ?nota=', { urlTrasFirmar, notaIdEnUrl })

  // ── PRIMERA PANTALLA: /orden — botón "Atrás" DE LA APP ────────────────
  await page.getByRole('button', { name: /Imprimir la orden de estudios/ }).click()
  await page.waitForURL(/\/orden\//, { timeout: 15000 })
  await page.waitForTimeout(1500)
  const urlOrden = page.url()
  paso('navegó a /orden', { urlOrden })

  const indiceNavAlLlegarOrden = await page.evaluate(() => window.navigation?.currentEntry?.index)
  const botonAtrasOrden = page.getByRole('button', { name: /^Atrás$/ })
  const hayBotonAtrasOrden = await botonAtrasOrden.count()
  if (hayBotonAtrasOrden) await botonAtrasOrden.click()
  await page.waitForTimeout(1000)
  const urlTrasBotonOrden = page.url()
  paso('botón "Atrás" DE LA APP en /orden (useSmartBack, con el arreglo)', {
    indiceNavAlLlegarOrden,
    hayBotonAtrasOrden: !!hayBotonAtrasOrden,
    urlTrasBotonOrden,
    volvioAConsultaConNota: urlTrasBotonOrden.includes('/consulta/') && urlTrasBotonOrden.includes(`nota=${notaIdEnUrl}`),
    fueAlFallbackFijoDeExpediente: urlTrasBotonOrden.includes('/expediente/'),
  })
  const panelTrasVolverDeOrden = await page.getByText('Ya está firmada. Falta esto').isVisible().catch(() => false)
  paso('checklist de cierre sigue visible tras el botón Atrás de /orden', { panelTrasVolverDeOrden })
  await page.screenshot({ path: path.join(DESTINO, '01-tras-atras-de-orden.png'), fullPage: true })

  // ── SEGUNDA PANTALLA: /receta — botón "Atrás" DE LA APP ────────────────
  const botonReceta = page.getByRole('button', { name: /Imprimir la receta/ })
  if (await botonReceta.count()) {
    await botonReceta.click()
    await page.waitForURL(/\/receta\//, { timeout: 15000 })
    await page.waitForTimeout(1500)
    const urlReceta = page.url()
    paso('navegó a /receta', { urlReceta })

    const indiceNavAlLlegarReceta = await page.evaluate(() => window.navigation?.currentEntry?.index)
    const botonAtrasReceta = page.getByRole('button', { name: /^Atrás$/ })
    const hayBotonAtrasReceta = await botonAtrasReceta.count()
    if (hayBotonAtrasReceta) await botonAtrasReceta.click()
    await page.waitForTimeout(1000)
    const urlTrasBotonReceta = page.url()
    paso('botón "Atrás" DE LA APP en /receta (useSmartBack, con el arreglo)', {
      indiceNavAlLlegarReceta,
      hayBotonAtrasReceta: !!hayBotonAtrasReceta,
      urlTrasBotonReceta,
      volvioAConsultaConNota: urlTrasBotonReceta.includes('/consulta/') && urlTrasBotonReceta.includes(`nota=${notaIdEnUrl}`),
      fueAlFallbackFijoDeExpediente: urlTrasBotonReceta.includes('/expediente/'),
    })
    await page.screenshot({ path: path.join(DESTINO, '02-tras-atras-de-receta.png'), fullPage: true })
  } else {
    paso('sin botón "Imprimir la receta" visible — se omite la segunda pantalla', {})
  }

  await page.addScriptTag({ content: axeSource })
  resultado.axe.final = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
  })

  resultado.consola = erroresConsola

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
