/**
 * RTC-22 — ¿cuántas veces dice el producto cómo se llama?
 *
 * ORT-17 + RT-20 contaron la marca duplicada —riel + topbar— en escritorio:
 * «Ausculta ×2». La franja de instrumentos existe para el ESTADO CLÍNICO
 * (§5: «current patient» es el primero de la lista); sin paciente en la ruta
 * se rellenaba con el nombre del consultorio, que el riel ya lleva en su
 * cabecera dos centímetros a la izquierda.
 *
 * Este arnés cuenta, no opina. En cada ancho y en dos clases de ruta —una sin
 * paciente y otra con paciente— mide:
 *
 *   · cuántos elementos VISIBLES pintan el nombre del consultorio;
 *   · si queda alguna identidad en pantalla (quitar el duplicado no puede
 *     dejar la aplicación sin nombre en el teléfono, donde el riel no existe);
 *   · qué enseña la franja cuando SÍ hay paciente, que es su trabajo real.
 *
 * El riel se oculta a ≤768px, así que la respuesta correcta depende del ancho
 * y por eso se mide en los dos.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-rtc22-marca-duplicada-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc22-marca'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const RUTAS = { 'sin paciente': '/dashboard', 'con paciente': '/expediente/pac-refugio-alcantara' }

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
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text().slice(0, 160)}`) })
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
      /* El nombre del consultorio, tal como lo pinta la aplicación. Se busca
         por TEXTO EXACTO en el nodo hoja: buscar por contenido dejaría dentro
         a cada ancestro y contaría el mismo rótulo ocho veces. */
      const nombre = document.querySelector('.sidebar-logo div div')?.textContent?.trim()
        || 'Ausculta'
      const hojas = [...document.querySelectorAll('div,span,a,h1,h2')]
        .filter(el => el.children.length === 0 && (el.textContent ?? '').trim() === nombre)
      return {
        nombreDelConsultorio: nombre,
        vecesEnElDom: hojas.length,
        vecesVisible: hojas.filter(visible).length,
        donde: hojas.filter(visible).map(el => el.closest('aside') ? 'riel'
          : el.closest('header') ? 'topbar'
          : el.closest('nav') ? 'nav' : 'otro'),
        /* Cuando SÍ hay paciente, la franja tiene que estar diciendo su
           nombre: si se quedara con el del consultorio, el arreglo habría
           tapado el trabajo de la franja en vez de hacerle sitio. */
        franjaDicePaciente: !!document.querySelector('.nx-instrument-strip-topbar .nx-ident-franja--clamp'),
        rielEnPantalla: !!(document.querySelector('aside.sidebar')
          && getComputedStyle(document.querySelector('aside.sidebar')).display !== 'none'),
      }
    })
    medidas[`${etiqueta}/${clase}`] = m
    console.log(
      `  ${etiqueta.padEnd(11)} ${clase.padEnd(13)} «${m.nombreDelConsultorio}» ${m.vecesVisible} visible(s) de ${m.vecesEnElDom} · ` +
      `donde: ${m.donde.join('+') || '—'} · riel en pantalla: ${m.rielEnPantalla} · la franja dice el paciente: ${m.franjaDicePaciente}`,
    )
    await page.screenshot({ path: path.join(DESTINO, `${etiqueta}-${clase.replace(' ', '-')}.png`) })
  }
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de consola · acta en ${path.join(DESTINO, 'medicion.json')}`)
