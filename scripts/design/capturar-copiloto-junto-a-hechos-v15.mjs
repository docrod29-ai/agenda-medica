/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-ENCOUNTER-MODE-001, §8 comportamiento
 * #8 «contextual intelligence appears beside relevant facts».
 *
 * Mismo método que las capturas hermanas de esta fase: login real contra los
 * emuladores, `/consulta/[patientId]` real, captura desktop + móvil,
 * axe-core, errores de consola.
 *
 * A diferencia de las capturas anteriores de esta fase, aquí hace falta
 * DISPARAR una sugerencia real del Copiloto para comprobar que aparece
 * donde toca: se agrega un diagnóstico y un medicamento
 * (`Amoxicilina`) que choca con la alergia a Penicilina YA sembrada
 * para `pac-aurelio-dominguez` — dispara `alergiaVsReceta` (crítica), la
 * ruta más determinista del motor (src/lib/expediente/copiloto.ts).
 *
 * Mide, con `getBoundingClientRect().top` real (no lectura de JSX):
 *  - que el bloque de Diagnósticos/Medicamentos queda ARRIBA del Copiloto;
 *  - que el Copiloto (con la sugerencia crítica real, visible en el DOM)
 *    queda ARRIBA de "Validación + Acciones" (Firmar/Guardar/Descartar).
 *
 * Uso: node scripts/design/capturar-copiloto-junto-a-hechos-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-copiloto-junto-a-hechos'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

const VIEWPORTS = [
  { nombre: 'desktop', width: 1440, height: 900 },
  { nombre: 'mobile', width: 390, height: 844 },
]

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
  const resultado = { medicion: null, axe: {}, consola: {} }

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: 'es-MX',
    })
    const page = await context.newPage()
    const erroresConsola = []
    page.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(msg.text()) })
    page.on('pageerror', (err) => erroresConsola.push(String(err)))

    await login(page)
    await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
    await page.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)
    await page.waitForSelector('button:has-text("Agregar diagnóstico")', { timeout: 20000 })

    // ── Captura el estado ANTES: sin diagnóstico/medicamento, el Copiloto
    //    calla (sugerencias.length === 0 → no se pinta nada) ──
    const copilotoAntes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('strong')).some(n => n.textContent?.includes('Para este paciente') || n.textContent?.includes('cosa que revisar')))

    // ── Agrega un diagnóstico ──
    await page.click('button:has-text("Agregar diagnóstico")')
    const inputDx = page.locator('input[placeholder*="Faringitis"]').first()
    await inputDx.fill('Diabetes mellitus tipo 2, descontrolada')
    await page.waitForTimeout(300)
    // Cierra el autocomplete CIE-10 si abrió una lista, sin seleccionar nada de ella.
    await page.keyboard.press('Escape').catch(() => null)

    // ── Agrega un medicamento que choca con la alergia registrada (Penicilina) ──
    await page.click('button:has-text("Agregar medicamento")')
    const inputMed = page.locator('input[placeholder="Medicamento"]').first()
    await inputMed.fill('Amoxicilina')
    await inputMed.blur()
    await page.waitForTimeout(400)

    if (vp.nombre === 'desktop') {
      resultado.medicion = await page.evaluate(() => {
        // Búsqueda por texto restringida a nodos HOJA (sin hijos elemento):
        // document.querySelectorAll('*') incluye <html>/<body>, cuyo
        // textContent es TODA la página — el primer "match" siempre sería el
        // documento entero, no el nodo real. Sólo cuentan hojas.
        const porTextoHoja = (sel, t) => Array.from(document.querySelectorAll(sel))
          .find(b => b.children.length === 0 && b.textContent?.includes(t))
        const porTexto = (sel, t) => Array.from(document.querySelectorAll(sel))
          .find(b => b.textContent?.includes(t))
        const seccionDiagnosticos = Array.from(document.querySelectorAll('h3,h2,strong'))
          .find(n => n.textContent?.trim() === 'Diagnósticos')
        const seccionMedicamentos = document.getElementById('seccion-medicamentos')
        const sugerenciaCritica = porTextoHoja('span', 'choca con una alergia registrada')
        const copilotoBloque = sugerenciaCritica
          ? sugerenciaCritica.closest('div[style*="border"]') ?? sugerenciaCritica
          : porTexto('strong', 'Para este paciente')
        const validacionAcciones = porTexto('button', 'Firmar y cerrar nota')
        if (!seccionMedicamentos || !copilotoBloque || !validacionAcciones) {
          return {
            encontrado: false,
            hayMedicamentos: !!seccionMedicamentos,
            hayCopiloto: !!copilotoBloque,
            hayFirmar: !!validacionAcciones,
            hayCriticaEnDOM: !!sugerenciaCritica,
          }
        }
        const rDx = seccionDiagnosticos ? seccionDiagnosticos.getBoundingClientRect() : null
        const rMed = seccionMedicamentos.getBoundingClientRect()
        const rCopiloto = copilotoBloque.getBoundingClientRect()
        const rFirmar = validacionAcciones.getBoundingClientRect()
        return {
          encontrado: true,
          hayCriticaEnDOM: !!sugerenciaCritica,
          textoCritica: sugerenciaCritica?.textContent?.slice(0, 160) ?? null,
          topDiagnosticos: rDx?.top ?? null,
          topMedicamentos: rMed.top,
          topCopiloto: rCopiloto.top,
          topFirmar: rFirmar.top,
          medicamentosAntesDeCopiloto: rMed.top < rCopiloto.top,
          copilotoAntesDeFirmar: rCopiloto.top < rFirmar.top,
        }
      })
    }

    resultado[`copilotoAntesDeAgregarDatos_${vp.nombre}`] = copilotoAntes

    await page.screenshot({ path: path.join(DESTINO, `consulta--${vp.nombre}--con-sugerencia.png`), fullPage: true })

    await page.addScriptTag({ content: axeSource })
    const axeResult = await page.evaluate(async () => await window.axe.run(document, {
      resultTypes: ['violations'],
    }))
    resultado.axe[vp.nombre] = axeResult.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      detalle: v.nodes.map(n => ({ target: n.target, html: n.html, resumen: n.failureSummary })),
    }))
    resultado.consola[vp.nombre] = erroresConsola

    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
