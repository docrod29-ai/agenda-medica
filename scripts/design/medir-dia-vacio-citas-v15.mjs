/**
 * ¿LA AGENDA VACÍA DICE CUÁL DE LOS TRES VACÍOS ES — EN PANTALLA?
 *
 * La decisión se prueba en `v15-el-dia-vacio-dice-cual-de-los-tres.test.ts`.
 * Esto mira lo otro, que una prueba de fuente no puede ver:
 *
 *   1. que el mensaje LLEGA a la pantalla en los tres casos,
 *   2. que el aviso de «hay citas y el filtro las esconde» pesa como una
 *      línea y no como un héroe —el día NO está vacío, así que dibujar la
 *      ilustración de agenda vacía ahí sería ilustrar algo falso—,
 *   3. y que los gestos FUNCIONAN: «Quitar los filtros» devuelve las filas,
 *      «Ver el día siguiente» lleva al día que dice.
 *
 * Se navega como navega el médico —los botones de día anterior/siguiente y el
 * selector de estado—, no fabricando URLs: así la medición no depende de que
 * el arnés y la pantalla coincidan en la zona horaria.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-dia-vacio-citas-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-dia-vacio-citas'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const errores = []
const acta = { base: BASE, viewports: {} }

/** Lo que el médico ve donde deberían estar las filas. */
const leerVacio = (page) => page.evaluate(() => {
  const bloque = document.querySelector('.empty-state')
  const filas = document.querySelectorAll('.riel-entrada').length
  if (!bloque) return { hay: false, filas }
  const r = bloque.getBoundingClientRect()
  return {
    hay: true,
    filas,
    linea: bloque.classList.contains('empty-state--linea'),
    alto: Math.round(r.height),
    titulo: (bloque.querySelector('.empty-state-title')?.textContent ?? '').trim(),
    desc: (bloque.querySelector('.empty-state-desc')?.textContent ?? '').trim(),
    // La ilustración de marca: sólo puede estar donde el día SÍ está vacío.
    ilustracion: !!bloque.querySelector('.empty-illus'),
    botones: [...bloque.querySelectorAll('button')].map(b => (b.textContent ?? '').trim()).filter(Boolean),
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

  await page.goto(`${BASE}/citas`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)
  const conFilas = await leerVacio(page)

  /*
    CASO 2 — HAY CITAS Y EL FILTRO LAS ESCONDE.
    Se pide un estado que la siembra no tiene («Canceladas»): la lista queda
    en cero y el día sigue teniendo sus seis. Es el caso peligroso, el que
    antes decía lo mismo que un día libre.
  */
  await page.selectOption('select[aria-label="Filtrar por estado de la cita"]', 'cancelada')
  await page.waitForTimeout(500)
  const ocultas = await leerVacio(page)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}-ocultas-por-filtro.png`), fullPage: false })

  // El gesto tiene que FUNCIONAR, no sólo estar.
  let filasTrasQuitar = null
  const quitar = page.locator('.empty-state button:has-text("Quitar los filtros")')
  if (await quitar.count()) {
    await quitar.first().click()
    await page.waitForTimeout(900)
    filasTrasQuitar = await page.evaluate(() => document.querySelectorAll('.riel-entrada').length)
  }

  /*
    CASO 1 — EL DÍA LIBRE DE VERDAD, con trabajo el día siguiente.
    Se retrocede un día con el propio botón de la pantalla: ayer no tiene
    citas sembradas y el día siguiente (hoy) tiene seis, así que es donde el
    puntero de continuidad —el que antes desaparecía justo aquí— tiene que
    aparecer.
  */
  await page.click('button[aria-label="Día anterior"]')
  await page.waitForTimeout(900)
  const libre = await leerVacio(page)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}-dia-libre.png`), fullPage: false })

  let volvioAlDiaSiguiente = null
  const irSiguiente = page.locator('.empty-state button:has-text("Ver el día siguiente")')
  if (await irSiguiente.count()) {
    await irSiguiente.first().click()
    await page.waitForTimeout(1200)
    volvioAlDiaSiguiente = await page.evaluate(() => document.querySelectorAll('.riel-entrada').length)
  }

  acta.viewports[nombre] = { conFilas, ocultas, filasTrasQuitar, libre, volvioAlDiaSiguiente }

  console.log(`\n── ${nombre} ──`)
  console.log(`  con filas: ${conFilas.filas} filas, sin bloque vacío: ${!conFilas.hay}`)
  console.log(`  OCULTAS   → «${ocultas.titulo}» / «${ocultas.desc}»`)
  console.log(`              línea=${ocultas.linea} alto=${ocultas.alto}px ilustración=${ocultas.ilustracion} botones=[${ocultas.botones.join(', ')}]`)
  console.log(`              «Quitar los filtros» devolvió ${filasTrasQuitar} filas`)
  console.log(`  DÍA LIBRE → «${libre.titulo}» / «${libre.desc}»`)
  console.log(`              línea=${libre.linea} alto=${libre.alto}px ilustración=${libre.ilustracion} botones=[${libre.botones.join(', ')}]`)
  console.log(`              «Ver el día siguiente» aterrizó en ${volvioAlDiaSiguiente} filas`)

  await contexto.close()
}

await navegador.close()
acta.errores = errores
fs.writeFileSync(path.join(DESTINO, 'acta-dia-vacio.json'), JSON.stringify(acta, null, 2))
console.log(`\n${errores.length} errores de consola/página · acta en ${path.join(DESTINO, 'acta-dia-vacio.json')}`)
