#!/usr/bin/env node
/**
 * V15-ORIGINALITY-REDTEAM — verificación del pago de RT-03.
 *
 * El equipo rojo midió en `hoy-movil.png` que `.prox-hero` no tenía regla
 * móvil: el CTA (flexShrink 0) dejaba la identidad del héroe en una columna
 * de ~110px partida en tres renglones. El arreglo hace envolver al héroe en
 * ≤560px con el CTA a renglón completo.
 *
 * Este script MIDE el después en navegador real (390px): el ancho útil de la
 * identidad y que el CTA ocupe su propio renglón completo. No confía en el
 * diff de CSS — mira cajas renderizadas (regla de la casa: el dato tiene que
 * LLEGAR; su hermana visual: la pantalla se mira, no se lee).
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/capturar-heroe-movil-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-redteam'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'

async function uidDelMedico() {
  const r = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    },
  )
  const j = await r.json()
  if (!j.localId) throw new Error(`No se pudo resolver el uid: ${JSON.stringify(j)}`)
  return j.localId
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const uid = await uidDelMedico()
  const navegador = await chromium.launch(
    process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  const context = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await context.addInitScript(({ u, pushKey }) => {
    try {
      localStorage.setItem(`nexus_tour_v1_${u}`, '1')
      localStorage.setItem(pushKey, '1')
    } catch {}
  }, { u: uid, pushKey: PUSH_DISMISS_KEY })
  const page = await context.newPage()

  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  await page.waitForSelector('.prox-hero .nx-ident', { timeout: 20000 })
  await page.waitForTimeout(1500)

  const medida = await page.evaluate(() => {
    const hero = document.querySelector('.prox-hero')
    const ident = hero?.querySelector('.nx-ident')
    const cta = hero?.querySelector('.prox-hero-cta')
    if (!hero || !ident || !cta) return null
    const h = hero.getBoundingClientRect()
    const i = ident.getBoundingClientRect()
    const c = cta.getBoundingClientRect()
    const lineas = Math.round(i.height / parseFloat(getComputedStyle(ident).lineHeight))
    return {
      heroAncho: Math.round(h.width),
      identAncho: Math.round(i.width),
      identRenglones: lineas,
      ctaAncho: Math.round(c.width),
      ctaDebajoDeIdent: c.top >= i.bottom,
    }
  })
  if (!medida) throw new Error('El héroe no está en el DOM — ¿la siembra tiene próxima cita?')

  const archivo = path.join(DESTINO, 'hoy-movil-heroe-despues.png')
  await page.screenshot({ path: archivo, fullPage: false })

  // El veredicto se imprime y se guarda; los umbrales son los del hallazgo:
  // antes el nombre vivía en ~110px — después debe tener el renglón casi
  // entero (el héroe menos el avatar y los gaps) y el CTA su propio renglón.
  const veredicto = {
    fecha: new Date().toISOString(),
    medida,
    identConRenglonCompleto: medida.identAncho > 200,
    ctaEnSuPropioRenglon: medida.ctaDebajoDeIdent && medida.ctaAncho > medida.heroAncho * 0.85,
  }
  fs.writeFileSync(path.join(DESTINO, 'acta-heroe-movil.json'), JSON.stringify(veredicto, null, 2))
  console.log(JSON.stringify(veredicto, null, 2))
  if (!veredicto.identConRenglonCompleto || !veredicto.ctaEnSuPropioRenglon) {
    console.error('FALLA: el héroe móvil sigue partido — el arreglo no llegó a la pantalla')
    process.exit(1)
  }
  await navegador.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
