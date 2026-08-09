#!/usr/bin/env node
/**
 * LÍNEA BASE DE ACCESIBILIDAD — V10-TRUTH-001 salida 10.
 *
 * Corre DENTRO del arnés (emuladores + siembra + next start en :3000):
 *   bash scripts/design/arnes-capturas-v10.sh axe
 *
 * Inyecta axe-core (el del repo, node_modules/axe-core) en cada pantalla del
 * golden flow, autenticado y con datos sintéticos, en 1440×900 y 390×844, y
 * corre las reglas WCAG 2.x A/AA (la regla del repo pide WCAG 2.2 AA;
 * axe-core cubre 2.0/2.1 AA completo y las 2.2 que tiene implementadas).
 *
 * SALIDA: tests/accessibility/axe-baseline-v10.json — la línea base COMPLETA,
 * con cada violación (regla, impacto, nodos, selector del primer nodo). Es
 * línea base de auditoría, NO compuerta de CI: la compuerta nace en
 * V10-A11Y-001 cuando haya cero P0 que proteger (una compuerta sobre una
 * línea con violaciones conocidas sólo enseña a ignorar el rojo).
 *
 * Lo que axe NO mide y esta línea base tampoco: orden de tabulación real,
 * foco visible al navegar con teclado, trampa de foco en modales, lectores
 * de pantalla. Eso se mide a mano en V10-A11Y-001 (queda declarado aquí para
 * que la línea base no se lea como «todo lo demás pasa» — señalar de menos).
 */
import { chromium } from 'playwright-core'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.CAPTURA_BASE_URL ?? 'http://localhost:3000'
const EMAIL = 'medico@demo.nexusmed.test'
const PASSWORD = 'NexusDemo-2026'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const VIEWPORTS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '390',  width: 390,  height: 844 },
]

const PANTALLAS = [
  { nombre: 'login',      ruta: '/login', sinSesion: true },
  { nombre: 'dashboard',  ruta: '/dashboard' },
  { nombre: 'citas',      ruta: '/citas' },
  { nombre: 'calendario', ruta: '/calendario' },
  { nombre: 'pacientes',  ruta: '/pacientes' },
  { nombre: 'expediente', ruta: '/expediente/pac-demo-001' },
  { nombre: 'consulta',   ruta: '/consulta/pac-demo-001' },
]

async function correrAxe(page) {
  await page.addScriptTag({ content: AXE })
  return await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    })
    return r.violations.map(v => ({
      regla: v.id,
      impacto: v.impact,
      wcag: v.tags.filter(t => /^wcag\d/.test(t)),
      descripcion: v.help,
      nodos: v.nodes.length,
      primerNodo: v.nodes[0]?.target?.join(' ') ?? null,
      resumenPrimerNodo: (v.nodes[0]?.failureSummary ?? '').slice(0, 300),
    }))
  })
}

async function esperarQuieto(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2000)
}

async function main() {
  mkdirSync('tests/accessibility', { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  })
  const resultado = {
    _que: 'Línea base axe-core del golden flow — V10-TRUTH-001 salida 10. Auditoría, no compuerta.',
    _capturadoEl: new Date().toISOString().slice(0, 10),
    _reglas: 'wcag2a wcag2aa wcag21a wcag21aa wcag22aa',
    _noMide: 'tab-order real, foco visible, trampas de foco, lector de pantalla — V10-A11Y-001 a mano',
    axeVersion: JSON.parse(readFileSync('node_modules/axe-core/package.json', 'utf8')).version,
    pantallas: {},
  }

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'es-MX' })
    const page = await ctx.newPage()

    // login por la interfaz real
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
    // axe sobre el login ANTES de entrar
    await esperarQuieto(page)
    resultado.pantallas[`login-${vp.nombre}`] = await correrAxe(page)
    console.log(`axe OK · login @ ${vp.nombre} · ${resultado.pantallas[`login-${vp.nombre}`].length} reglas violadas`)

    await page.fill('input[type="email"], input[name="email"]', EMAIL)
    await page.fill('input[type="password"], input[name="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 30000 })
    await esperarQuieto(page)
    const saltar = page.getByText('Saltar', { exact: true }).first()
    if (await saltar.isVisible().catch(() => false)) await saltar.click()
    const despues = page.getByText('Después', { exact: true }).first()
    if (await despues.isVisible().catch(() => false)) await despues.click()
    await page.waitForTimeout(400)

    for (const p of PANTALLAS) {
      if (p.sinSesion) continue
      await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'domcontentloaded' })
      await esperarQuieto(page)
      resultado.pantallas[`${p.nombre}-${vp.nombre}`] = await correrAxe(page)
      console.log(`axe OK · ${p.nombre} @ ${vp.nombre} · ${resultado.pantallas[`${p.nombre}-${vp.nombre}`].length} reglas violadas`)
    }
    await ctx.close()
  }
  await browser.close()

  // Resumen agregado: reglas distintas por impacto, y total de nodos
  const todas = Object.values(resultado.pantallas).flat()
  const porImpacto = {}
  for (const v of todas) porImpacto[v.impacto] = (porImpacto[v.impacto] ?? 0) + v.nodos
  resultado.resumen = {
    pantallasAuditadas: Object.keys(resultado.pantallas).length,
    reglasDistintas: [...new Set(todas.map(v => v.regla))].sort(),
    nodosPorImpacto: porImpacto,
  }

  writeFileSync('tests/accessibility/axe-baseline-v10.json', JSON.stringify(resultado, null, 2))
  console.log('LINEA BASE ESCRITA · reglas distintas:', resultado.resumen.reglasDistintas.join(', '))
}

main().catch((e) => { console.error(e); process.exit(1) })
