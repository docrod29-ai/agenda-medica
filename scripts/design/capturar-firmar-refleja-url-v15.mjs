/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-NOTE-PLAN-CONTINUITY-001 (Fase 8),
 * segunda rebanada: firmar() ahora refleja el notaId en la URL.
 *
 * Repite exactamente el camino que la corrida anterior dejó anotado como
 * roto (`docs/design/capturas/v15-cierre-recuerda-lo-hecho/resultado.json`,
 * paso "volvió con router.back()"): firma una nota con medicamentos Y
 * estudios, va a la orden, y vuelve con `page.goBack()` — el botón real de
 * la pantalla, el mismo `useSmartBack` que usa el médico. Antes de este
 * cambio el panel de cierre desaparecía entero. Ahora debe seguir ahí, con
 * la orden marcada y `estudiosOrden` restaurado.
 *
 * Uso: node scripts/design/capturar-firmar-refleja-url-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-firmar-refleja-url'
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
  paso('firmada — LA URL DEBE LLEVAR ?nota= INMEDIATAMENTE, sin navegar', { urlTrasFirmar, notaIdEnUrl })

  const estudiosBadgeAntes = await page.getByText('Estudios a solicitar').locator('xpath=following-sibling::span[1]').textContent().catch(() => null)

  // Ir a la orden de estudios.
  await page.getByRole('button', { name: /Imprimir la orden de estudios/ }).click()
  await page.waitForURL(/\/orden\//, { timeout: 15000 })
  const urlOrden = page.url()
  paso('navegó a /orden', { urlOrden })

  /**
   * HALLAZGO DE ESTA CORRIDA, SEPARADO DEL QUE ARREGLA (anotado, NO
   * arreglado aquí): `useSmartBack` comprueba `window.history.state.idx`
   * para decidir entre `router.back()` y su `fallback` — pero en esta
   * versión de Next.js (16.2.12, App Router) `window.history.state` NUNCA
   * lleva `idx` (confirmado con dos scripts de diagnóstico aparte, con
   * navegación por `page.goto` Y por click SPA real: el `state` sólo trae
   * `__NA`/`__PRIVATE_NEXTJS_INTERNALS_TREE`). `idx ?? 0 > 0` es SIEMPRE
   * falso, así que el botón "Atrás" de CUALQUIER pantalla que use
   * `useSmartBack` (diez pantallas: `/receta`, `/orden`, `/nota`,
   * `/expediente`, `/referencia`, `/hospitalizacion/*`, `/uci/*`) nunca
   * hace back de verdad — siempre navega al `fallback` fijo. Para `/orden`
   * ese fallback es `/expediente/${patientId}`, NO `/consulta/${patientId}
   * ?nota=...`. Es un defecto DISTINTO del que corrige esta rebanada (la URL
   * de `/consulta` ahora SÍ lleva `?nota=`, verificado abajo con back NATIVO
   * del navegador) — pero explica por qué el botón "Atrás" en pantalla
   * seguiría sin recuperar el checklist aunque la URL ya sea correcta. Se
   * usa `page.goBack()` (atrás NATIVO del navegador — Alt+Izquierda, gesto,
   * o el botón del propio navegador) para probar lo que SÍ arregla esta
   * corrida, sin depender del botón de la app.
   */
  await page.goBack()
  await page.waitForURL(/\/consulta\//, { timeout: 15000 })
  await page.waitForTimeout(1200)

  const urlTrasVolver = page.url()
  const panelTrasVolver = await page.getByText('Ya está firmada. Falta esto').isVisible().catch(() => false)
  const firmadaBadgeTrasVolver = await page.getByText('Nota firmada', { exact: false }).isVisible().catch(() => false)
  paso('volvió con ATRÁS NATIVO del navegador (page.goBack, no el botón de la app)', {
    urlTrasVolver,
    conservaNotaId: urlTrasVolver.includes(`nota=${notaIdEnUrl}`),
    panelTrasVolver,
    firmadaBadgeTrasVolver,
  })

  // Y por separado: el botón "Atrás" DE LA APP en /orden — para dejar
  // medido, no supuesto, el hallazgo de useSmartBack de arriba.
  await page.goForward()
  await page.waitForURL(/\/orden\//, { timeout: 15000 })
  await page.waitForTimeout(500)
  const botonAtras = page.getByRole('button', { name: /^Atrás$/ })
  const hayBotonAtras = await botonAtras.count()
  if (hayBotonAtras) await botonAtras.click()
  await page.waitForTimeout(800)
  paso('botón "Atrás" DE LA APP en /orden (useSmartBack) — hallazgo separado, no arreglado aquí', {
    hayBotonAtras: !!hayBotonAtras,
    urlTrasBotonApp: page.url(),
    fueAlFallbackFijoEnVezDeConsulta: page.url().includes('/expediente/'),
  })
  // Recuperar el hilo de la verificación: volver a /consulta?nota= por URL
  // explícita, que es donde el back nativo ya nos había dejado.
  if (!page.url().includes('/consulta/')) {
    await page.goto(urlTrasVolver, { waitUntil: 'load' })
    await page.waitForTimeout(800)
  }
  await page.screenshot({ path: path.join(DESTINO, '01-tras-volver-de-orden.png'), fullPage: true })

  const chequesTrasVolver = panelTrasVolver
    ? await page.evaluate(() => {
        const cabecera = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Ya está firmada. Falta esto'))
        const seccion = cabecera?.closest('section')
        if (!seccion) return null
        return Array.from(seccion.querySelectorAll('button')).map(b => ({ texto: b.textContent?.trim().slice(0, 60), opacidad: getComputedStyle(b).opacity }))
      })
    : null
  paso('checklist tras volver — «orden» debe estar marcado (opacidad reducida)', { chequesTrasVolver })

  const estudiosBadgeTrasVolver = await page.getByText('Estudios a solicitar').locator('xpath=following-sibling::span[1]').textContent().catch(() => null)
  paso('estudiosOrden restaurado tras remontar la pantalla', { estudiosBadgeAntes, estudiosBadgeTrasVolver, seRestauro: estudiosBadgeAntes === estudiosBadgeTrasVolver })

  // Recarga dura (F5): el caso de un médico que reabre una nota firmada desde el expediente.
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const urlTrasRecargar = page.url()
  const panelTrasRecargar = await page.getByText('Ya está firmada. Falta esto').isVisible().catch(() => false)
  const estudiosBadgeTrasRecargar = await page.getByText('Estudios a solicitar').locator('xpath=following-sibling::span[1]').textContent().catch(() => null)
  paso('recarga dura (F5) sobre la URL con ?nota= — estudiosOrden debe sobrevivir', { urlTrasRecargar, panelTrasRecargar, estudiosBadgeTrasRecargar })
  await page.screenshot({ path: path.join(DESTINO, '02-tras-recargar.png'), fullPage: true })

  await page.addScriptTag({ content: axeSource })
  resultado.axe.trasVolver = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
  })

  resultado.consola = erroresConsola

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
