/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-NOTE-PLAN-CONTINUITY-001 (Fase 8),
 * quinta rebanada: el cierre agenda el seguimiento (Note → … → Follow-up).
 *
 * Repite el camino ya conocido de esta fase (Valoración Inmunocomprometido →
 * medicamentos Y estudios a la vez, para que el panel de cierre se quede en
 * pantalla) y añade lo nuevo: pone fecha en «Próxima consulta» ANTES de
 * firmar, y después mide:
 *
 *   1. el checklist de cierre trae «Agendar el seguimiento»;
 *   2. la hoja del paciente trae «Su próxima cita» EN PALABRAS (no ISO);
 *   3. pulsar el paso navega a /citas?d=<fecha> y la agenda aterriza en ESE
 *      día (el otro lado del enlace — «el dato tiene que LLEGAR»);
 *   4. al volver (atrás nativo), el paso está marcado hecho (opacidad 0.55).
 *
 * Uso: node scripts/design/capturar-cierre-agenda-seguimiento-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-cierre-agenda-seguimiento'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'
/** Fecha del control: fija y futura, para que el resultado sea reproducible. */
const FECHA_SEGUIMIENTO = '2026-09-08'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function prepararYFirmar(page, paso) {
  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.getByText('Saltar', { exact: true }).click({ timeout: 2500 }).catch(() => null)
  await page.waitForSelector('text=Tipo de nota', { timeout: 15000 }).catch(async () => {
    await page.locator('button[aria-label^="Tipo de nota"]').click()
  })

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
    await impresionYPlan.fill('Valoración infectológica inicial. Profilaxis y estudios solicitados según huésped. Control con resultados.')
  }

  // LO NUEVO DE ESTA REBANADA: la fecha de control, ANTES de firmar
  // (el input se deshabilita con la nota firmada).
  await page.fill('#proximo-seguimiento', FECHA_SEGUIMIENTO)
  paso('nota preparada: medicamentos + estudios + fecha de próxima consulta', { fecha: FECHA_SEGUIMIENTO })

  // La hoja del paciente debe decir «Su próxima cita» EN PALABRAS ya desde
  // antes de firmar (se compone en vivo de lo que el médico revisó).
  const hojaCita = await page.getByText('Su próxima cita').isVisible().catch(() => false)
  const hojaCitaTexto = hojaCita
    ? await page.getByText('Su próxima cita').locator('xpath=following::li[1] | following::div[1]').first().textContent().catch(() => null)
    : null
  paso('hoja del paciente — bloque «Su próxima cita»', {
    visible: hojaCita,
    texto: hojaCitaTexto?.trim().slice(0, 80) ?? null,
    enPalabrasNoISO: !!hojaCitaTexto && !hojaCitaTexto.includes(FECHA_SEGUIMIENTO) && /septiembre/i.test(hojaCitaTexto),
  })

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
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const resultado = { pasos: [], axe: {}, consola: [] }
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

  await prepararYFirmar(page, paso)

  const urlTrasFirmar = page.url()
  paso('firmada', { urlTrasFirmar, llevaNota: /nota=/.test(urlTrasFirmar) })

  // 1. El checklist trae «Agendar el seguimiento», con su consecuencia.
  const pasoSeguimiento = page.getByRole('button', { name: /Agendar el seguimiento/ })
  const seguimientoEnChecklist = await pasoSeguimiento.isVisible().catch(() => false)
  paso('checklist de cierre — «Agendar el seguimiento» presente', { seguimientoEnChecklist })
  await page.screenshot({ path: path.join(DESTINO, '01-checklist-con-seguimiento.png'), fullPage: true })

  // 2. Pulsarlo navega a /citas?d=<fecha> — y la agenda aterriza en ESE día.
  await pasoSeguimiento.click()
  await page.waitForURL(/\/citas\?/, { timeout: 15000 })
  await page.waitForTimeout(1200)
  const urlCitas = page.url()
  const diaEnAgenda = await page.locator('input[type="date"]').first().inputValue().catch(() => null)
  paso('navegó a la agenda del día del control — el otro lado del enlace', {
    urlCitas,
    llevaD: urlCitas.includes(`d=${FECHA_SEGUIMIENTO}`),
    diaEnAgenda,
    agendaAterrizoEnElDia: diaEnAgenda === FECHA_SEGUIMIENTO,
  })
  await page.screenshot({ path: path.join(DESTINO, '02-agenda-en-el-dia-del-control.png'), fullPage: true })

  // 3. Volver (atrás nativo): el paso queda marcado hecho.
  await page.goBack()
  await page.waitForURL(/\/consulta\//, { timeout: 15000 })
  await page.waitForTimeout(1200)
  const marcado = await page.evaluate(() => {
    const boton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Agendar el seguimiento'))
    return boton ? { opacidad: getComputedStyle(boton).opacity, texto: boton.textContent?.trim().slice(0, 60) } : null
  })
  paso('tras volver — el paso «Agendar el seguimiento» marcado hecho', {
    marcado,
    opacidadReducida: !!marcado && Number(marcado.opacidad) < 1,
  })
  await page.screenshot({ path: path.join(DESTINO, '03-tras-volver-seguimiento-marcado.png'), fullPage: true })

  await page.addScriptTag({ content: axeSource })
  resultado.axe.consulta = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
  })

  // ── Móvil (390) — el mismo cierre, apilado ──────────────────────────────
  const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-MX', hasTouch: true, isMobile: true })
  const pm = await movil.newPage()
  pm.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(`[móvil] ${msg.text()}`) })
  await pm.goto(`${BASE}/login`, { waitUntil: 'load' })
  await pm.fill('input[type="email"]', EMAIL)
  await pm.fill('input[type="password"]', PASSWORD)
  await pm.click('button[type="submit"]')
  await pm.waitForURL('**/dashboard**', { timeout: 30000 })
  /**
   * El flujo COMPLETO otra vez en móvil (no reabrir la nota de escritorio:
   * al reabrir, el paso legítimamente NO reaparece — la nota no guarda
   * `proximoSeguimiento`, limitación documentada — y eso mediría la
   * limitación, no la funcionalidad).
   */
  await prepararYFirmar(pm, (n, e) => paso(`[móvil] ${n}`, e))
  const seguimientoMovilBtn = pm.getByRole('button', { name: /Agendar el seguimiento/ })
  const seguimientoMovil = await seguimientoMovilBtn.isVisible().catch(() => false)
  if (seguimientoMovil) await seguimientoMovilBtn.scrollIntoViewIfNeeded().catch(() => null)
  paso('móvil 390 — «Agendar el seguimiento» en el cierre', { seguimientoMovilVisible: seguimientoMovil })
  await pm.screenshot({ path: path.join(DESTINO, '04-movil-cierre.png'), fullPage: true })
  if (seguimientoMovil) {
    await seguimientoMovilBtn.click()
    await pm.waitForURL(/\/citas\?/, { timeout: 15000 }).catch(() => null)
    const diaMovil = await pm.locator('input[type="date"]').first().inputValue().catch(() => null)
    paso('móvil 390 — aterriza en la agenda del día del control', {
      urlCitasMovil: pm.url(),
      diaMovil,
      aterrizo: diaMovil === FECHA_SEGUIMIENTO,
    })
    await pm.screenshot({ path: path.join(DESTINO, '05-movil-agenda.png'), fullPage: true })
  }
  await movil.close()

  resultado.consola = erroresConsola
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify({ axe: resultado.axe, consola: resultado.consola }, null, 2))
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
