/**
 * RTC-24 — ¿cuántos nombres tiene el objeto central, y son sinónimos o no?
 *
 * ORT-19 contó cuatro: «Encuentro / Iniciar consulta / Consulta / Nueva
 * consulta con IA». El último murió con RTC-13. De los tres que quedan, la
 * pregunta no es cuántos son sino **si nombran lo mismo**: un producto puede
 * tener legítimamente un LUGAR y una ACCIÓN con nombres distintos, y puede
 * tener dos acciones distintas que se parecen.
 *
 * Este arnés no cuenta cadenas en el fuente: mira lo que se pinta y **a dónde
 * apunta**. Dos rótulos distintos que llevan al MISMO sitio en la MISMA
 * pantalla son un sinónimo que el médico tiene que aprender; dos rótulos que
 * llevan a sitios distintos son dos cosas.
 *
 * Mide, en escritorio y en móvil, sobre una ruta de paciente y una sin él:
 *   · el rótulo y el `href` del contexto del riel;
 *   · el rótulo y el `href` de la acción central del pulgar;
 *   · los rótulos de las acciones de la pantalla que llevan a `/consulta/`.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc24-nombres-del-encuentro-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc24-nombres'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const RUTAS = { 'con paciente': '/expediente/pac-refugio-alcantara', 'sin paciente': '/dashboard' }

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const errores = []
const medidas = {}

for (const [ancho, alto, etiqueta] of [[1440, 900, 'escritorio'], [390, 844, 'movil']]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: ancho < 700, hasTouch: ancho < 700, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('pageerror', e => errores.push(`[${etiqueta}] pageerror: ${e.message}`))

  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
    await s.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour */ }

  for (const [clase, ruta] of Object.entries(RUTAS)) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(2400)

    const m = await page.evaluate(() => {
      const visible = el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      }
      const texto = el => (el.textContent ?? '').trim().replace(/\s+/g, ' ')
      const destino = el => {
        const a = el.closest('a[href]') ?? el.querySelector('a[href]')
        return a ? new URL(a.getAttribute('href'), location.origin).pathname : null
      }
      /*
        SE BUSCA POR NOMBRE, NO POR `href`.

        La primera versión de este arnés filtraba por destino `/consulta/…`
        leyendo `a[href]`, y devolvió «ningún control lleva a un encuentro» en
        una pantalla donde «Nueva consulta» se ve a simple vista. La razón: ese
        control es un `<button>` que navega por JS (`navegarConContinuidad`,
        §20), y un botón no tiene `href` que leer.

        La pregunta de RTC-24 es de VOCABULARIO —cuántos nombres tiene el
        objeto—, así que se enumera por lo que se LEE, y el destino se anota
        cuando el marcado lo declara. Tercer instrumento ciego de esta corrida,
        y otra vez lo delató el número: «ninguno» contradecía la captura.
      */
      const VOCABULARIO = /consulta|encuentro/i
      const haciaElEncuentro = [...document.querySelectorAll('a[href], button')]
        .filter(visible)
        .map(el => ({
          rotulo: texto(el).slice(0, 30),
          destino: destino(el),
          navegaPorJs: el.tagName === 'BUTTON' && !el.closest('a[href]'),
          zona: el.closest('aside') ? 'riel' : el.closest('.bottom-nav-wrap') ? 'pulgar' : el.closest('header') ? 'topbar' : 'pantalla',
        }))
        .filter(x => VOCABULARIO.test(x.rotulo) || (x.destino && /^\/consulta\//.test(x.destino)))
      const porDestino = {}
      for (const x of haciaElEncuentro) {
        const clave = x.destino ?? (x.navegaPorJs ? 'destino por JS (sin href)' : 'sin destino')
        ;(porDestino[clave] ??= []).push(`${x.rotulo} (${x.zona})`)
      }
      return { haciaElEncuentro, porDestino }
    })

    medidas[`${etiqueta}/${clase}`] = m
    console.log(`\n  ${etiqueta} · ${clase}`)
    for (const [dest, rotulos] of Object.entries(m.porDestino)) {
      const nombres = [...new Set(rotulos.map(r => r.split(' (')[0]))]
      console.log(`    ${dest} ← ${rotulos.length} control(es), ${nombres.length} nombre(s) distinto(s): ${rotulos.join(' · ')}`)
    }
    if (!Object.keys(m.porDestino).length) console.log('    (ningún control visible lleva a un encuentro)')
  }
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de página · acta en ${path.join(DESTINO, 'medicion.json')}`)
