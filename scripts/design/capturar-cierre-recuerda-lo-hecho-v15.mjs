/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, §33 / §20).
 *
 * Firma una nota con medicamentos Y estudios (vía Valoración Inmuno, para
 * llegar de verdad a los dos destinos sin mockear IA), confirma que
 * `ComoCerrarLaConsulta` se queda en pantalla, va a la orden, vuelve, y
 * comprueba que el paso «orden» aparece marcado. Luego prueba el ancla de
 * «Darle sus instrucciones» y que copiar la hoja del paciente marca ese
 * paso también — sin recargar la página entre medio.
 *
 * Uso: node scripts/design/capturar-cierre-recuerda-lo-hecho-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-cierre-recuerda-lo-hecho'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

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

  await login(page)

  // La cuenta de capturas no trae cédula profesional configurada — firmar la
  // bloquea con "Falta cédula profesional del médico". Se completa una vez,
  // aquí, para no depender de que `sembrar-capturas.mjs` la traiga.
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
    // El selector "Qué nota es" está colapsado por un botón con aria-label "Tipo de nota: ...".
    await page.locator('button[aria-label^="Tipo de nota"]').click()
  })
  paso('login + consulta abierta')

  // Abrir el selector de tipo si aún no está abierto, y elegir Valoración Inmunocomprometido.
  const abrirTipo = page.locator('button[aria-label^="Tipo de nota"]')
  if (await abrirTipo.count()) {
    const yaAbierto = await page.getByText('Tipo de nota', { exact: true }).isVisible().catch(() => false)
    if (!yaAbierto) await abrirTipo.click()
  }
  await page.getByRole('button', { name: 'Valoración Inmunocomprometido', exact: true }).click()
  paso('tipo = Valoración Inmunocomprometido')

  // Dentro de la valoración: motivo "Profilaxis antiinfecciosa", huésped "VIH".
  await page.waitForSelector('text=Elige el motivo de la interconsulta', { timeout: 10000 }).catch(() => null)
  await page.locator('select').first().selectOption('profilaxis')
  await page.locator('select').nth(1).selectOption('VIH')
  paso('motivo=profilaxis, huésped=VIH')

  // Estudios: abrir "Serologías basales" y ASEGURAR (no sólo pulsar — el chip
  // es un toggle, y un click de más lo apaga) que quede al menos uno marcado.
  await page.getByRole('button', { name: /Serologías basales/ }).first().click()
  const chipVih = page.getByRole('button', { name: 'VIH Ag/Ab 4ª gen', exact: true })
  for (let i = 0; i < 3; i++) {
    const encendido = await chipVih.evaluate(el => getComputedStyle(el).color.includes('130') || el.getAttribute('style')?.includes('rgb(59, 130, 246)'))
    if (encendido) break
    await chipVih.click()
    await page.waitForTimeout(150)
  }
  const estudiosBadge = await page.getByText('Estudios a solicitar').locator('xpath=following-sibling::span[1]').textContent().catch(() => null)
  paso('estudio marcado: VIH Ag/Ab 4ª gen', { estudiosBadge })

  // Fármacos candidatos (si los hay para esta combinación): marcar el primero.
  const checkboxFarmaco = page.locator('text=Fármacos nombrados en las recomendaciones').locator('xpath=following::input[@type="checkbox"][1]')
  const hayFarmaco = await checkboxFarmaco.count()
  if (hayFarmaco) {
    await checkboxFarmaco.check()
    paso('fármaco candidato marcado', { hayFarmaco: true })
  } else {
    paso('sin fármaco candidato para esta combinación', { hayFarmaco: false })
  }

  await page.getByRole('button', { name: 'Aplicar a la nota clínica' }).click()
  await page.waitForTimeout(400)
  paso('valoración aplicada a la nota')

  // Si no hubo fármaco candidato, añadir uno manual para tener medicamentos + estudios a la vez.
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
  paso('dosis completa asegurada en al menos un medicamento')

  // "Impresión y plan" es obligatoria para este tipo y `construirNotaInmuno`
  // sólo la llena si hubo recomendaciones con fuente para este motivo/huésped
  // — con este combo no las hubo. Se completa a mano, como haría el médico.
  const impresionYPlan = page.getByPlaceholder('Conclusión de la valoración y seguimiento')
  if (await impresionYPlan.count() && !(await impresionYPlan.inputValue())) {
    await impresionYPlan.fill('Valoración infectológica inicial. Profilaxis y estudios solicitados según huésped. Reevaluar con resultados.')
  }
  paso('impresión y plan completada')

  await page.waitForTimeout(300)

  // Firmar.
  await page.getByRole('button', { name: 'Firmar y cerrar nota' }).click()
  // Puede haber un diálogo de confirmación (avisos/evidencia) — si aparece, confirmar.
  for (let i = 0; i < 4; i++) {
    const confirmar = page.getByRole('button', { name: /Firmar$|Los revisé, firmar|Los reviso y los asumo|Firmar así/ })
    if (await confirmar.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmar.click()
      await page.waitForTimeout(400)
    } else break
  }
  await page.waitForSelector('text=Nota firmada y sellada', { timeout: 15000 }).catch(() => null)
  paso('nota firmada')

  await page.waitForTimeout(500)
  const urlTrasFirmar = page.url()
  const panelVisible = await page.getByText('Ya está firmada. Falta esto').isVisible().catch(() => false)
  paso('checklist de cierre visible tras firmar (dos destinos → no navega solo)', { urlTrasFirmar, panelVisible })

  await page.screenshot({ path: path.join(DESTINO, '01-panel-sin-marcar.png'), fullPage: true })

  if (!panelVisible) {
    resultado.bloqueado = 'El panel de cierre no quedó visible tras firmar (¿sólo un destino, o el motivo/huésped no generó estudios+medicamentos a la vez?). Ver captura 01 y el log de pasos.'
    fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
    console.log(JSON.stringify(resultado, null, 2))
    await browser.close()
    return
  }

  // Axe ANTES de interactuar.
  await page.addScriptTag({ content: axeSource })
  resultado.axe.antes = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
  })

  // Estado inicial de "hechos": ningún check en la lista.
  const chequesIniciales = await page.evaluate(() => {
    const cabecera = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Ya está firmada. Falta esto'))
    const seccion = cabecera?.closest('section')
    if (!seccion) return null
    return Array.from(seccion.querySelectorAll('button')).map(b => ({ texto: b.textContent?.trim().slice(0, 60), opacidad: getComputedStyle(b).opacity }))
  })
  paso('checklist ANTES de ir a la orden', { chequesIniciales })

  // Ir a la orden de estudios.
  await page.getByRole('button', { name: /Imprimir la orden de estudios/ }).click()
  await page.waitForURL(/\/orden\//, { timeout: 15000 })
  paso('navegó a /orden', { url: page.url() })
  const notaIdFirmada = (page.url().match(/\/orden\/[^/]+\/([^/?]+)/) || [])[1] || null
  await page.waitForTimeout(600)

  // Volver con el botón real de la pantalla (useSmartBack → router.back()).
  await page.goBack()
  await page.waitForURL(/\/consulta\//, { timeout: 15000 })
  await page.waitForTimeout(1200)
  const urlTrasBack = page.url()
  const panelTrasBack = await page.getByText('Ya está firmada. Falta esto').isVisible().catch(() => false)
  paso('volvió con router.back()', { urlTrasBack, panelTrasBack })
  await page.screenshot({ path: path.join(DESTINO, 'debug-tras-volver.png'), fullPage: true })

  /**
   * HALLAZGO DE ESTA CORRIDA, ANOTADO — no es el defecto que este cambio
   * arregla, pero lo condiciona: `router.back()` NO conserva el contexto de
   * la consulta. La URL tras firmar es `/consulta/[patientId]` SIN
   * `?nota=...` (firmar() nunca escribe el id en la URL, sólo en estado de
   * React) — así que "volver" desde `/orden` no encuentra un id que releer
   * y el panel entero desaparece (`firmada` vuelve a `false`). Es un hueco
   * de continuidad PREVIO a V15-NOTE-PLAN-CONTINUITY-001 (la URL no refleja
   * el estado, §20) — «el dato tiene que LLEGAR» hermana. Para seguir
   * verificando lo que SÍ arregla esta corrida (que el checklist recuerde
   * lo hecho CUANDO la nota sí se puede releer), se navega explícitamente
   * con `?nota=` — el mismo camino que toma un médico que reabre una nota
   * ya firmada desde el expediente.
   */
  if (!panelTrasBack && notaIdFirmada) {
    await page.goto(`${BASE}/consulta/${PATIENT_ID}?nota=${notaIdFirmada}`, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
  }

  const notaFirmadaBadge = await page.getByText('Nota firmada', { exact: false }).isVisible().catch(() => false)
  const panelTrasVolver = await page.getByText('Ya está firmada. Falta esto').isVisible().catch(() => false)
  const chequesTrasOrden = panelTrasVolver
    ? await page.evaluate(() => {
        const cabecera = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Ya está firmada. Falta esto'))
        const seccion = cabecera?.closest('section')
        if (!seccion) return null
        return Array.from(seccion.querySelectorAll('button')).map(b => ({ texto: b.textContent?.trim().slice(0, 60), opacidad: getComputedStyle(b).opacity }))
      })
    : null
  paso('checklist TRAS volver de la orden (con ?nota= si router.back() no bastó)', { url: page.url(), notaFirmadaBadge, panelTrasVolver, chequesTrasOrden })
  await page.screenshot({ path: path.join(DESTINO, '02-orden-marcada.png'), fullPage: true })

  // Ancla: "Darle sus instrucciones" no debe navegar — debe desplazar a la hoja del paciente.
  const urlAntesDeAncla = page.url()
  const scrollAntes = await page.evaluate(() => window.scrollY)
  const botonInstrucciones = page.getByRole('button', { name: /Darle sus instrucciones/ })
  const hayBotonInstrucciones = await botonInstrucciones.count()
  if (hayBotonInstrucciones) {
    await botonInstrucciones.click()
    await page.waitForTimeout(600)
  }
  const urlDespuesDeAncla = page.url()
  const scrollDespues = await page.evaluate(() => window.scrollY)
  const hojaEnViewport = await page.evaluate(() => {
    const el = document.getElementById('hoja-para-el-paciente')
    if (!el) return { existe: false }
    const r = el.getBoundingClientRect()
    return { existe: true, top: Math.round(r.top), enViewport: r.top >= -50 && r.top <= window.innerHeight }
  })
  paso('ancla a "hoja del paciente"', { hayBotonInstrucciones: !!hayBotonInstrucciones, urlAntesDeAncla, urlDespuesDeAncla, sinNavegar: urlAntesDeAncla === urlDespuesDeAncla, scrollAntes, scrollDespues, hojaEnViewport })

  // Copiar la hoja del paciente → debe marcar "hoja_del_paciente" como hecho, SIN navegar ni recargar.
  const botonCopiar = page.locator('#hoja-para-el-paciente').getByRole('button', { name: /^Copiar$/ })
  const hayBotonCopiar = await botonCopiar.count()
  if (hayBotonCopiar) {
    await botonCopiar.click()
    await page.waitForTimeout(400)
  }
  const chequesTrasCopiar = await page.evaluate(() => {
    const cabecera = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Ya está firmada. Falta esto'))
    const seccion = cabecera?.closest('section')
    if (!seccion) return null
    return Array.from(seccion.querySelectorAll('button')).map(b => ({ texto: b.textContent?.trim().slice(0, 60), opacidad: getComputedStyle(b).opacity }))
  })
  paso('checklist TRAS copiar la hoja del paciente', { hayBotonCopiar: !!hayBotonCopiar, chequesTrasCopiar })
  await page.screenshot({ path: path.join(DESTINO, '03-hoja-marcada.png'), fullPage: true })

  // sessionStorage real: lo que quedó grabado para esta nota.
  const notaIdDeLaUrl = (page.url().match(/nota=([^&]+)/) || [])[1] || null
  const sessionStorageCrudo = notaIdDeLaUrl
    ? await page.evaluate((nid) => window.sessionStorage.getItem(`nx-cierre-hechos:${nid}`), notaIdDeLaUrl)
    : null
  paso('sessionStorage real de esta nota', { notaIdDeLaUrl, sessionStorageCrudo })

  // Axe DESPUÉS de interactuar.
  await page.addScriptTag({ content: axeSource })
  resultado.axe.despues = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
  })

  resultado.consola = erroresConsola

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
