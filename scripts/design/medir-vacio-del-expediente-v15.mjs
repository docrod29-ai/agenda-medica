/**
 * ¿EL EXPEDIENTE LLENO SIGUE DICIENDO QUE ESTÁ VACÍO EN LA PESTAÑA HOSPITAL?
 *
 * La decisión se prueba en `v15-el-expediente-lleno-no-dice-que-esta-vacio`.
 * Esto mira lo que una prueba de fuente no puede ver: que el aviso LLEGA a la
 * pantalla, que el gesto lleva de vuelta a las notas que existen, y que el
 * bloque pesa como una línea y no como un héroe.
 *
 * El caso se reproduce con la siembra tal cual: sus pacientes tienen notas de
 * consultorio y ninguna hospitalaria, así que basta con abrir un expediente y
 * pulsar «Hospital» — la pantalla donde antes se leía «Sin notas todavía. La
 * primera consulta que firmes aparece aquí.» sobre un expediente con historia.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-vacio-del-expediente-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-vacio-del-expediente'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const errores = []
const acta = { base: BASE, viewports: {} }

const leerVacio = (page) => page.evaluate(() => {
  const b = document.querySelector('.empty-state')
  /*
    NO HAY MARCA ESTABLE EN LA FILA — se lee el conteo QUE LA PANTALLA DICE.

    La primera versión contaba `.exp-nota, [data-nota-id]`, que no existen:
    `NotaCard` no lleva clase ni atributo propio. El arnés informó «0 filas»
    en un expediente con dos notas y «devolvió 0 filas» tras pulsar el gesto —
    un aprobado vacío idéntico al de la cascada de /citas. Añadir un atributo
    sólo para medir sería falsear el sujeto; el encabezado «N consultas ·
    desde …» ya es del producto y dice justo lo que hace falta.
  */
  const enc = [...document.querySelectorAll('.t-overline')]
    .map(e => (e.textContent ?? '').trim())
    .find(t => /\d+\s+consultas?/.test(t)) ?? ''
  const filas = Number((enc.match(/(\d+)\s+consultas?/) ?? [])[1] ?? 0)
  if (!b) return { hay: false, filas }
  const r = b.getBoundingClientRect()
  return {
    hay: true,
    filas,
    linea: b.classList.contains('empty-state--linea'),
    alto: Math.round(r.height),
    titulo: (b.querySelector('.empty-state-title')?.textContent ?? '').trim(),
    desc: (b.querySelector('.empty-state-desc')?.textContent ?? '').trim(),
    ilustracion: !!b.querySelector('.empty-illus'),
    botones: [...b.querySelectorAll('button')].map(x => (x.textContent ?? '').trim()).filter(Boolean),
  }
})

for (const [nombre, viewport] of [['escritorio-1440', { width: 1440, height: 900 }], ['movil-390', { width: 390, height: 844 }]]) {
  const contexto = await navegador.newContext({ viewport, serviceWorkers: 'block' })
  const page = await contexto.newPage()
  page.on('pageerror', e => errores.push(`[${nombre}] pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${nombre}] console: ${m.text()}`) })

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

  /*
    SE VA DIRECTO AL EXPEDIENTE SEMBRADO, y no por la lista.

    La primera versión buscaba `a[href^="/expediente/"]` en `/pacientes` y no
    encontraba ninguno: las filas navegan por JS, no con un enlace. El arnés
    informó «expediente abierto: null» y luego midió una pantalla que no era
    la del caso — el mismo defecto de instrumento que ya mordió en RTC-24.
    `pac-aurelio-dominguez` tiene notas de consultorio firmadas y ninguna
    hospitalaria: es exactamente el caso.
  */
  const abierto = '/expediente/pac-aurelio-dominguez'
  await page.goto(`${BASE}${abierto}`, { waitUntil: 'load' })
  await page.waitForTimeout(2800)

  const enConsulta = await leerVacio(page)

  // La pestaña Hospital: aquí vivía el defecto.
  const pulsado = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').trim() === 'Hospital')
    if (!b) return false
    b.click(); return true
  })
  await page.waitForTimeout(900)
  const enHospital = await leerVacio(page)
  if (!enHospital.hay) { console.log('  SIN bloque vacío en Hospital — el caso no se reprodujo; revisa la siembra.') }
  await page.screenshot({ path: path.join(DESTINO, `${nombre}-pestana-hospital.png`) })

  // El gesto tiene que DEVOLVER las notas, no sólo estar.
  let filasTrasVolver = null
  const volver = page.locator('.empty-state button:has-text("Ver notas de Consulta")')
  if (await volver.count()) {
    await volver.first().click()
    await page.waitForTimeout(900)
    filasTrasVolver = (await leerVacio(page)).filas
  }

  acta.viewports[nombre] = { abierto, pulsado, enConsulta, enHospital, filasTrasVolver }
  console.log(`\n── ${nombre} ──`)
  console.log(`  expediente abierto: ${abierto} · pestaña Hospital pulsada: ${pulsado}`)
  console.log(`  en Consulta: ${enConsulta.hay ? `«${enConsulta.titulo}»` : `sin bloque vacío (${enConsulta.filas} filas)`}`)
  console.log(`  en HOSPITAL → «${enHospital.titulo}» / «${enHospital.desc}»`)
  if (enHospital.hay) console.log(`                línea=${enHospital.linea} alto=${enHospital.alto}px ilustración=${enHospital.ilustracion} botones=[${enHospital.botones.join(', ')}]`)
  console.log(`  «Ver notas de Consulta» devolvió ${filasTrasVolver} filas`)

  await contexto.close()
}

await navegador.close()
acta.errores = errores
fs.writeFileSync(path.join(DESTINO, 'acta-vacio-del-expediente.json'), JSON.stringify(acta, null, 2))
console.log(`\n${errores.length} errores de consola/página · acta en ${path.join(DESTINO, 'acta-vacio-del-expediente.json')}`)
