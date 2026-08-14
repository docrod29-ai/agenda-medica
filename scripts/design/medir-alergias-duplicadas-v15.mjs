/**
 * RTC-14, MEDIDO POR FIN — ¿cuántas veces se pinta la alergia en el primer
 * pliegue de una consulta?
 *
 * El registro canónico lo tenía escrito como P2 desde el panel de equipo rojo
 * («Alergias: pintadas DOS veces en el mismo pliegue… ~12 % del viewport
 * móvil»), pero **no se había podido medir nunca**: hasta el 14-ago-2026
 * ningún paciente de la siembra tenía alergias registradas ni notas, así que
 * en el navegador la pantalla salía siempre en su estado vacío.
 *
 * Con la siembra que crea historia, la duplicación se ve a la primera. Esto la
 * cuenta y la sitúa, para decidir sobre números:
 *
 *   · cuántos elementos DISTINTOS enseñan la alergia en el primer pliegue;
 *   · dónde está cada uno y cuánto viewport ocupan entre todos;
 *   · a qué altura queda la identidad del paciente y el botón de grabar —lo
 *     que de verdad se hace en esta pantalla— con todo eso por delante.
 *
 * No cambia nada: informa. La decisión de qué presentación sobrevive tiene
 * peso clínico (una es EDITABLE y la otra enseña los alérgenos ya
 * interpretados) y se toma con el acta delante, no de memoria.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-alergias-duplicadas-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc14'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
/* Con alergia registrada y con historia: el caso que hasta hoy no existía. */
const CON_ALERGIA = 'pac-luzmaria-cervantes'

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
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text()}`) })
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

  for (const ruta of [`/consulta/${CON_ALERGIA}`, `/expediente/${CON_ALERGIA}`]) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(2600)
    const m = await page.evaluate(() => {
      const raiz = document.querySelector('main') ?? document.body
      const caja = el => {
        const r = el.getBoundingClientRect()
        return { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) }
      }
      /* Los elementos MÁS PROFUNDOS que dicen «Alergias:» — sin esto, cada
         contenedor padre cuenta como una aparición más y el número miente
         hacia arriba. */
      const conAlergias = [...raiz.querySelectorAll('*')]
        .filter(el => (el.textContent ?? '').includes('Alergias:'))
        .filter(el => ![...el.children].some(h => (h.textContent ?? '').includes('Alergias:')))
      const enPliegue = conAlergias.filter(el => el.getBoundingClientRect().top < window.innerHeight)
      const identidad = raiz.querySelector('.nx-vt-paciente, .nx-ancla-nombre')
      const grabar = [...raiz.querySelectorAll('button')]
        .find(b => (b.textContent ?? '').includes('Grabar la consulta'))
      return {
        apariciones: conAlergias.length,
        aparicionesEnElPrimerPliegue: enPliegue.length,
        donde: enPliegue.map(el => ({ ...caja(el), texto: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) })),
        pixelesDeAlergiaEnElPliegue: enPliegue.reduce((n, el) => n + caja(el).h, 0),
        identidadA: identidad ? caja(identidad).y : null,
        grabarA: grabar ? caja(grabar).y : null,
        viewport: window.innerHeight,
      }
    })
    medidas[`${etiqueta}${ruta}`] = m
    console.log(
      `  ${etiqueta.padEnd(11)} ${ruta.padEnd(34)} alergia ×${m.aparicionesEnElPrimerPliegue} en el pliegue ` +
      `(${m.pixelesDeAlergiaEnElPliegue}px de ${m.viewport}) · identidad a ${m.identidadA}px · grabar a ${m.grabarA}px`,
    )
    await page.screenshot({ path: path.join(DESTINO, `${ruta.split('/')[1]}-${etiqueta}.png`) })
  }
  await contexto.close()
}

await navegador.close()
fs.writeFileSync(path.join(DESTINO, 'medicion.json'), JSON.stringify({ base: BASE, medidas, errores }, null, 2))
console.log(`\n${errores.length} errores de consola · acta en ${path.join(DESTINO, 'medicion.json')}`)
