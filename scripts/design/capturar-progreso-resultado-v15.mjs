/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-RESULTS-CLOSURE-001 (Fase 6),
 * primera rebanada: `ProgresoResultado` en `/pendientes`.
 *
 * Mismo método que sus hermanos de fase (`capturar-today-continuidad-v15.mjs`,
 * `capturar-patient-anchor-v15.mjs`): emuladores Auth/Firestore reales +
 * siembra sintética (`sembrar-capturas.mjs`, que ahora incluye tareas de
 * resultado en tres estados distintos) + build de producción + `npm start`.
 *
 * Mide, no supone:
 *  · las TRES tareas de resultado sembradas muestran su pista de 8 etapas
 *    con la etapa "actual" correcta para su estado real;
 *  · las tareas que NO son de resultado (seguimiento, reconciliación) NO
 *    llevan pista;
 *  · las tres etapas sin dato (Decisión/Acción/Aviso al paciente) se leen
 *    en el DOM real con estilo itálico distinto — no se confunden con
 *    "hecha";
 *  · axe-core sobre la pantalla con las pistas pobladas.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080) vivos, siembra ya
 * corrida, `.env.local` demo con NEXT_PUBLIC_FIREBASE_EMULATORS=1, `npm start`
 * apuntando a los emuladores.
 *
 * Uso: node scripts/design/capturar-progreso-resultado-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-progreso-resultado'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

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
  const resultado = { pistas: null, sinPistaEnNoResultado: null, axe: {}, consola: {} }

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
    await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
    await page.waitForSelector('text=Espirometría de control', { timeout: 15000 }).catch(() => null)
    await page.waitForTimeout(1000)

    if (vp.nombre === 'desktop') {
      resultado.pistas = await page.evaluate(() => {
        // Cada tarjeta es el .nx-progreso-resultado que sigue al <strong> del
        // título — medido por texto, no por índice, porque el orden del
        // worklist (ordenWorklist) puede cambiar.
        const tarjetas = Array.from(document.querySelectorAll('.nx-progreso-resultado'))
        return tarjetas.map(pista => {
          const tarjeta = pista.closest('div[style*="grid"]') ?? pista.parentElement
          const titulo = tarjeta?.querySelector('strong')?.textContent?.trim() ?? '(sin título)'
          const etapas = Array.from(pista.querySelectorAll('span')).map(s => ({
            texto: s.textContent.trim(),
            estilo: getComputedStyle(s).fontStyle,
            color: getComputedStyle(s).color,
          }))
          return { titulo, etapas }
        })
      })

      resultado.sinPistaEnNoResultado = await page.evaluate(() => {
        // 'Seguimiento de EPOC' y 'Confirmar si la metformina' NO son tipos
        // de resultado: su tarjeta no debe llevar .nx-progreso-resultado.
        const strongs = Array.from(document.querySelectorAll('strong'))
        const buscar = (texto) => {
          const el = strongs.find(s => s.textContent.includes(texto))
          if (!el) return { encontrado: false, tienePista: null }
          const tarjeta = el.closest('div[style*="grid"]')
          return { encontrado: true, tienePista: !!tarjeta?.querySelector('.nx-progreso-resultado') }
        }
        return {
          seguimiento: buscar('Seguimiento de EPOC'),
          reconciliacion: buscar('Confirmar si la metformina'),
        }
      })
    }

    await page.screenshot({ path: path.join(DESTINO, `pendientes--${vp.nombre}.png`), fullPage: true })

    await page.addScriptTag({ content: axeSource })
    const axeResult = await page.evaluate(async () => await window.axe.run(document, {
      resultTypes: ['violations'],
    }))
    resultado.axe[vp.nombre] = axeResult.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
    resultado.consola[vp.nombre] = erroresConsola

    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
