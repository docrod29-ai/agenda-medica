/**
 * LA VUELTA EXACTA — §21 en navegador real, la cadena entera.
 *
 * Un guardián de texto prueba que el contrato DECIDE bien. No puede probar lo
 * único que el médico nota: que al volver está donde estaba. Eso son ruta,
 * desplazamiento, foco y paciente, y sólo se sabe midiéndolos.
 *
 *     HECHO → INSPECCIONAR → FUENTE REAL → VOLVER
 *           → MISMA RUTA · MISMO SITIO · MISMO FOCO · MISMO PACIENTE
 *
 * ── LO QUE MIDE, Y POR QUÉ CADA COSA ────────────────────────────────────────
 *
 *  · **La ida** — que salir a la fuente NO es navegación normal: la URL lleva
 *    un testigo, y el paciente y el sitio de la lista NO viajan en ella.
 *  · **La fuente** — que se aterriza en la consulta del MISMO paciente.
 *  · **La vuelta** — ruta, `scrollTop` de `<main>` y foco, comparados contra lo
 *    que se anotó ANTES de salir. Si algo no cuadra, inspeccionar cuesta más
 *    que no inspeccionar y la función muere sola.
 *  · **El fallo seguro** — el mismo testigo, colgado de la consulta de OTRO
 *    paciente, no puede ofrecer volver: tiene que declinar y decir por qué.
 *    Ésta es la invariante que separa esto de un truco de navegación.
 *  · **Un solo uso** — volver a entrar a la pantalla de origen no vuelve a
 *    mover el desplazamiento bajo el dedo.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-regreso-a-la-fuente-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-regreso-a-la-fuente'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

/* El pendiente CON traza (cuelga de `nota-luzmaria-1`) y el paciente de OTRA
   consulta, para el caso de fallo seguro. */
/* Se localiza por el `id` ESTABLE del disparador, no recorriendo el DOM: un
   `filter({hasText})` casa con CADA ancestro y `.last()` acaba devolviendo el
   botón de otra tarjeta — la trampa que este repositorio ya pagó dos veces
   (RTC-20 y el arnés de la lente). El id además es lo que el restaurador usa
   para devolver el foco: si esto deja de encontrarlo, el defecto es real. */
const TAREA_CON_TRAZA = 'tarea-receta-luzmaria'
const ID_DISPARADOR = `porque-${TAREA_CON_TRAZA}`
const OTRO_PACIENTE = 'pac-aurelio-dominguez'
const OTRA_NOTA = 'nota-aurelio-2'

fs.mkdirSync(DESTINO, { recursive: true })
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const errores = []
const casos = []
const ok = (n, pasa, detalle) => { casos.push({ nombre: n, pasa: !!pasa, detalle }); return pasa }
const captura = (page, n) => page.screenshot({ path: path.join(DESTINO, `${n}.png`) })

async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 40000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
    await s.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour */ }
}

for (const [ancho, alto, etiqueta] of [[1440, 900, 'escritorio'], [390, 844, 'movil']]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: ancho < 700, hasTouch: ancho < 700, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text().slice(0, 200)}`) })
  page.on('pageerror', e => errores.push(`[${etiqueta}] pageerror: ${e.message}`))

  await entrar(page)

  /* ── 1 · EL ORIGEN, y un sitio que de verdad se pueda perder ───────────── */
  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.waitForSelector('button:has-text("¿Por qué está aquí?")', { timeout: 20000 })

  // Se baja a propósito: un regreso medido desde el tope no prueba nada.
  await page.evaluate(() => {
    const m = document.querySelector('main')
    if (m) m.scrollTop = Math.min(500, Math.max(0, m.scrollHeight - m.clientHeight))
  })
  await page.waitForTimeout(400)

  const antes = await page.evaluate(() => ({
    ruta: location.pathname,
    scroll: document.querySelector('main')?.scrollTop ?? -1,
  }))
  ok(`[${etiqueta}] hay sitio que perder antes de salir`, antes.scroll > 0, `scrollTop=${antes.scroll}`)
  await captura(page, `${etiqueta}-1-origen`)

  /* ── 2 · INSPECCIONAR el pendiente que SÍ tiene traza ──────────────────── */
  const disparador = page.locator(`#${ID_DISPARADOR}`).first()
  await disparador.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const antes2 = await page.evaluate(() => ({
    scroll: document.querySelector('main')?.scrollTop ?? -1,
  }))
  const disparadorId = await disparador.getAttribute('id')
  await disparador.click()
  await page.waitForSelector('.nx-porque-traza', { timeout: 10000 })
  await captura(page, `${etiqueta}-2-lente-con-traza`)
  ok(`[${etiqueta}] el disparador tiene id estable`, !!disparadorId && disparadorId.startsWith('porque-'), String(disparadorId))

  /* ── 3 · LA IDA: no es navegación normal ───────────────────────────────── */
  await page.locator('.nx-porque-traza').first().click()
  await page.waitForURL('**/consulta/**', { timeout: 20000 })
  await page.waitForTimeout(1800)
  await captura(page, `${etiqueta}-3-en-la-fuente`)

  const enFuente = await page.evaluate(() => ({
    url: location.pathname + location.search,
    paciente: document.querySelector('.nx-vt-paciente')?.textContent?.trim() ?? '',
    volver: document.querySelector('.nx-volver')?.textContent?.trim() ?? '',
    declinado: document.querySelector('.nx-volver-declinado')?.textContent?.trim() ?? '',
  }))
  const testigo = new URL('http://x' + enFuente.url).searchParams.get('volver') ?? ''

  ok(`[${etiqueta}] la URL lleva un testigo`, testigo.length > 0, testigo.slice(0, 12) + '…')
  ok(`[${etiqueta}] el testigo NO lleva PHI ni el sitio de la lista`,
    !/luz|maria|cervantes|500|pendientes/i.test(testigo), testigo.slice(0, 24))
  ok(`[${etiqueta}] se aterriza en la consulta del MISMO paciente`,
    /Luz Mar[ií]a/i.test(enFuente.paciente), enFuente.paciente)
  ok(`[${etiqueta}] la fuente OFRECE volver, con el nombre del origen`,
    /Volver a Pendientes/i.test(enFuente.volver), enFuente.volver)

  /* ── 4 · FALLO SEGURO: el mismo testigo en OTRO paciente ───────────────── */
  await page.goto(`${BASE}/consulta/${OTRO_PACIENTE}?nota=${OTRA_NOTA}&volver=${encodeURIComponent(testigo)}`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  await captura(page, `${etiqueta}-4-otro-paciente-declina`)
  const ajeno = await page.evaluate(() => ({
    paciente: document.querySelector('.nx-vt-paciente')?.textContent?.trim() ?? '',
    volver: document.querySelectorAll('.nx-volver').length,
    declinado: document.querySelector('.nx-volver-declinado')?.textContent?.trim() ?? '',
  }))
  ok(`[${etiqueta}] con OTRO paciente NO se ofrece volver`, ajeno.volver === 0, `controles=${ajeno.volver}`)
  ok(`[${etiqueta}] y lo DICE en vez de callarse`, /otro paciente/i.test(ajeno.declinado), ajeno.declinado.slice(0, 80))

  /* ── 5 · LA VUELTA EXACTA ──────────────────────────────────────────────── */
  await page.goBack({ waitUntil: 'load' })
  await page.waitForSelector('.nx-volver', { timeout: 20000 })
  await page.locator('.nx-volver').first().click()
  await page.waitForURL('**/pendientes**', { timeout: 20000 })
  await page.waitForTimeout(2200)   // la lista vuelve de Firestore y se repone
  await captura(page, `${etiqueta}-5-de-vuelta`)

  const vuelta = await page.evaluate(() => ({
    ruta: location.pathname,
    scroll: document.querySelector('main')?.scrollTop ?? -1,
    focoId: document.activeElement?.id ?? '',
  }))
  ok(`[${etiqueta}] vuelve a la MISMA ruta`, vuelta.ruta === antes.ruta, `${antes.ruta} → ${vuelta.ruta}`)
  ok(`[${etiqueta}] vuelve al MISMO sitio de la lista`,
    Math.abs(vuelta.scroll - antes2.scroll) <= 2, `${antes2.scroll} → ${vuelta.scroll}`)
  ok(`[${etiqueta}] el foco vuelve al disparador EXACTO`,
    !!disparadorId && vuelta.focoId === disparadorId, `${disparadorId} → ${vuelta.focoId}`)

  /* ── 6 · UN SOLO USO: no vuelve a moverse solo ─────────────────────────── */
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0 })
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' })
  await page.waitForTimeout(600)
  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  const segunda = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? -1)
  ok(`[${etiqueta}] el contrato es de un solo uso (no repone dos veces)`, segunda === 0, `scrollTop=${segunda}`)

  await contexto.close()
}

await navegador.close()

const acta = {
  fecha: new Date().toISOString(),
  base: BASE,
  casos,
  erroresDeConsola: errores,
  resumen: `${casos.filter(c => c.pasa).length}/${casos.length} PASS · ${errores.length} errores de consola`,
}
fs.writeFileSync(path.join(DESTINO, 'acta-regreso.json'), JSON.stringify(acta, null, 2))
for (const c of casos) console.log(`${c.pasa ? '  ok ' : '  NO '} ${c.nombre}${c.detalle ? ` — ${c.detalle}` : ''}`)
if (errores.length) { console.log('\n  errores de consola:'); for (const e of errores) console.log(`   · ${e}`) }
console.log(`\n  ${acta.resumen}`)
process.exit(casos.every(c => c.pasa) && errores.length === 0 ? 0 : 1)
