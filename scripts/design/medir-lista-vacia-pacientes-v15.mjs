/**
 * ¿EL VACÍO DE /pacientes DICE CUÁNTOS HAY FUERA — EN PANTALLA?
 *
 * La decisión se prueba en `v15-la-lista-vacia-dice-cuantos-hay-fuera.test.ts`.
 * Esto mira lo que una prueba de fuente no puede ver:
 *
 *   1. que el mensaje LLEGA en los tres casos que la siembra puede producir,
 *   2. que pesa como una LÍNEA y no como un héroe —la lista no está vacía, sólo
 *      lo que se está mirando—,
 *   3. que el gesto FUNCIONA: «Ver todos A-Z» devuelve las filas y «Limpiar la
 *      búsqueda» también,
 *   4. y que el rescate de parecidos APARECE con filas reales: el caso que hoy
 *      termina en «Sin resultados» y en un expediente repetido.
 *
 * Se navega como navega el médico —el chip y el campo de búsqueda—, no
 * fabricando URLs.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-lista-vacia-pacientes-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-lista-vacia-pacientes'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

/** El dedazo + el orden cambiado: lo que la búsqueda por subcadena NO caza. */
const TERMINO_CON_PARECIDO = 'Villareal Esparsa, Joaquin'
/** Un nombre que no está en el padrón ni se parece a nadie. */
const TERMINO_SIN_PARECIDO = 'Zenaida Quiroz Bermúdez'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const errores = []
const acta = { base: BASE, terminos: { TERMINO_CON_PARECIDO, TERMINO_SIN_PARECIDO }, viewports: {} }

/** Lo que el médico ve donde deberían estar las filas. */
const leerVacio = (page) => page.evaluate(() => {
  const bloque = document.querySelector('.empty-state')
  const filas = document.querySelectorAll('.nx-fila-paciente').length
  const base = { filas }
  if (!bloque) {
    /*
      EL «ANTES» NO TIENE BLOQUE, Y AUN ASÍ HAY QUE MEDIRLO. Los tres vacíos
      viejos eran `<div>` sueltos: sin componente, sin clase y sin control.
      Devolver sólo `hay:false` confundiría «no hay estado vacío» con «hay
      filas», que es justamente el error que esta rebanada viene a arreglar en
      el producto — no se va a repetir en el instrumento. Cuando no hay filas
      NI bloque, se recoge el texto crudo de donde deberían estar.
    */
    if (filas > 0) return { ...base, hay: false }
    const zona = document.querySelector('.nx-canvas > div:last-of-type')
    const crudo = (zona?.textContent ?? '').trim().slice(0, 160)
    return { ...base, hay: false, crudo, controlesEnElVacio: zona ? zona.querySelectorAll('button, a').length : null }
  }
  const r = bloque.getBoundingClientRect()
  return {
    ...base,
    hay: true,
    linea: bloque.classList.contains('empty-state--linea'),
    alto: Math.round(r.height),
    titulo: (bloque.querySelector('.empty-state-title')?.textContent ?? '').trim(),
    desc: (bloque.querySelector('.empty-state-desc')?.textContent ?? '').trim(),
    // La ilustración de marca sólo puede estar donde el registro entero está
    // vacío: dibujarla sobre seis expedientes escondidos ilustraría algo falso.
    ilustracion: !!bloque.querySelector('.empty-illus'),
    // §24 — el camino de salida tiene que ser un control, no una negrita.
    botones: [...bloque.querySelectorAll('button')].map(b => (b.textContent ?? '').trim()).filter(Boolean),
  }
})

/** ¿Se ofrecen parecidos, y cuáles? */
const leerParecidos = (page) => page.evaluate(() => {
  const encabezados = [...document.querySelectorAll('.t-overline')].map(e => (e.textContent ?? '').trim())
  const cabecera = encabezados.find(t => t.includes('parecen'))
  if (!cabecera) return { cabecera: null, nombres: [] }
  return {
    cabecera,
    nombres: [...document.querySelectorAll('.nx-fila-paciente .nx-ident')].map(f => (f.textContent ?? '').trim()),
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

  await page.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)
  const conFilas = await leerVacio(page)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}-con-filas.png`), fullPage: false })

  /*
    CASO A — EL CHIP LOS ESCONDE A TODOS.
    «Con alerta» no tiene ninguno en la siembra y el registro tiene seis. Es el
    caso que antes pintaba una pantalla en blanco indistinguible de un
    consultorio recién abierto.
  */
  await page.click('button:has-text("Con alerta")')
  await page.waitForTimeout(600)
  const porChip = await leerVacio(page)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}-chip-sin-nadie.png`), fullPage: false })

  let filasTrasVerTodos = null
  const verTodos = page.locator('.empty-state button:has-text("Ver todos A-Z")')
  if (await verTodos.count()) {
    await verTodos.first().click()
    await page.waitForTimeout(800)
    filasTrasVerTodos = await page.evaluate(() => document.querySelectorAll('.nx-fila-paciente').length)
  }

  /*
    CASO B — LA BÚSQUEDA NO CASA, PERO HAY UN PARECIDO.
    El dedazo y el orden cambiado. Antes: «Sin resultados», callejón sin salida
    y un botón «Nuevo paciente» esperando arriba a la derecha.
  */
  const campo = page.locator('input[aria-label^="Buscar un paciente"]')
  await campo.fill(TERMINO_CON_PARECIDO)
  await page.waitForTimeout(700)
  const conParecido = await leerVacio(page)
  const rescate = await leerParecidos(page)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}-busqueda-con-parecido.png`), fullPage: false })

  /*
    CASO C — LA BÚSQUEDA NO CASA Y NO SE PARECE A NADIE.
    Aquí NO se pinta la cabecera de «se parecen»: sobre cero filas sería peor
    que no ponerla.
  */
  await campo.fill(TERMINO_SIN_PARECIDO)
  await page.waitForTimeout(700)
  const sinParecido = await leerVacio(page)
  const sinRescate = await leerParecidos(page)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}-busqueda-sin-parecido.png`), fullPage: false })

  let filasTrasLimpiar = null
  const limpiar = page.locator('.empty-state button:has-text("Limpiar la búsqueda")')
  if (await limpiar.count()) {
    await limpiar.first().click()
    await page.waitForTimeout(800)
    filasTrasLimpiar = await page.evaluate(() => document.querySelectorAll('.nx-fila-paciente').length)
  }

  acta.viewports[nombre] = { conFilas, porChip, filasTrasVerTodos, conParecido, rescate, sinParecido, sinRescate, filasTrasLimpiar }

  console.log(`\n── ${nombre} ──`)
  console.log(`  con filas: ${conFilas.filas} filas, sin bloque vacío: ${!conFilas.hay}`)
  console.log(`  CHIP      → «${porChip.titulo ?? porChip.crudo}» / «${porChip.desc ?? ''}»`)
  console.log(`              bloque=${porChip.hay} línea=${porChip.linea ?? '—'} alto=${porChip.alto ?? '—'}px ilustración=${porChip.ilustracion ?? '—'} controles=[${(porChip.botones ?? []).join(', ') || (porChip.controlesEnElVacio ?? '—')}]`)
  console.log(`              «Ver todos A-Z» devolvió ${filasTrasVerTodos} filas`)
  console.log(`  PARECIDO  → «${conParecido.titulo ?? conParecido.crudo}» / «${conParecido.desc ?? ''}»`)
  console.log(`              bloque=${conParecido.hay} línea=${conParecido.linea ?? '—'} alto=${conParecido.alto ?? '—'}px controles=[${(conParecido.botones ?? []).join(', ') || (conParecido.controlesEnElVacio ?? '—')}]`)
  console.log(`              rescate: «${rescate.cabecera}» → [${(rescate.nombres ?? []).join(' · ')}]`)
  console.log(`  SIN NADIE → «${sinParecido.titulo ?? sinParecido.crudo}» / «${sinParecido.desc ?? ''}»`)
  console.log(`              rescate: ${sinRescate.cabecera === null ? 'no se pinta (correcto)' : `«${sinRescate.cabecera}» ← DEFECTO`}`)
  console.log(`              «Limpiar la búsqueda» devolvió ${filasTrasLimpiar} filas`)

  await contexto.close()
}

await navegador.close()
acta.errores = errores
fs.writeFileSync(path.join(DESTINO, 'acta-lista-vacia.json'), JSON.stringify(acta, null, 2))
console.log(`\n${errores.length} errores de consola/página · acta en ${path.join(DESTINO, 'acta-lista-vacia.json')}`)
