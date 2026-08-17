/**
 * ARNÉS RTC-29 — ¿`/operaciones` dejó de ser un lanzador, en el navegador?
 *
 * El guardián de vitest comprueba el catálogo y la forma en el fuente. Esto
 * comprueba que llegue a la pantalla, y de paso que el respaldo mudado siga
 * FUNCIONANDO desde su casa nueva: una capacidad que se mueve y no funciona en
 * el destino es peor que no haberla movido.
 *
 * Qué mide (escritorio 1440×900 y móvil 390×844):
 *   1. Cada destino visible enseña su «para qué» —no sólo la etiqueta— y el
 *      texto es distinto del nombre.
 *   2. Los grupos enseñan su cadencia.
 *   3. La anatomía es de LISTA: un contenedor con borde por grupo, no N cajas.
 *   4. Los destinos siguen estando TODOS (comparado con el catálogo declarado)
 *      y sus href no cambiaron.
 *   5. El respaldo vive aquí y su botón dispara una descarga de verdad
 *      (se intercepta el evento de descarga de Playwright).
 *   6. «Respaldo» ya NO está en la cabecera de /pacientes.
 *   7. Objetivos táctiles ≥44px y cero errores de consola.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/verificar-rtc29-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc29'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })
const errores = []
const condiciones = []
const anota = (ok, texto, detalle) => {
  condiciones.push({ ok: !!ok, texto, detalle: detalle ?? null })
  console.log(`  ${ok ? '✓' : '✗'} ${texto}${detalle ? ` — ${detalle}` : ''}`)
}

/* El catálogo declarado, leído del FUENTE: así «están todos» se compara contra
   la verdad del repositorio y no contra una lista escrita a mano aquí, que se
   desincronizaría el día que se añada un destino. */
const FUENTE = fs.readFileSync('src/app/(dashboard)/operaciones/page.tsx', 'utf8')
const bloque = FUENTE.slice(FUENTE.search(/const GRUPOS:/), FUENTE.indexOf('\n]', FUENTE.search(/const GRUPOS:/)))
const DECLARADOS = [...bloque.matchAll(/href:\s*'([^']+)'/g)].map(m => m[1])

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

async function entrar(page) {
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
}

for (const [ancho, alto, etiqueta] of [[1440, 900, 'escritorio'], [390, 844, 'movil']]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: ancho < 700, hasTouch: ancho < 700, serviceWorkers: 'block',
    acceptDownloads: true,
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text()}`) })
  page.on('pageerror', e => errores.push(`[${etiqueta}] pageerror: ${e.message}`))
  await entrar(page)

  await page.goto(`${BASE}/operaciones`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)

  const m = await page.evaluate(() => {
    const raiz = document.querySelector('main') ?? document.body
    const enlaces = [...raiz.querySelectorAll('a[href^="/"]')]
      .filter(a => a.closest('section'))
      .map(a => {
        const spans = [...a.querySelectorAll('span')]
        const r = a.getBoundingClientRect()
        return {
          href: a.getAttribute('href'),
          etiqueta: (spans[1]?.textContent ?? '').trim(),
          para: (spans[2]?.textContent ?? '').trim(),
          alto: Math.round(r.height),
        }
      })
    const cadencias = [...raiz.querySelectorAll('section')]
      .map(s => {
        const h2 = s.querySelector('h2')
        const cad = h2?.parentElement?.querySelector('span')
        return h2 ? { titulo: (h2.textContent ?? '').trim(), cadencia: (cad?.textContent ?? '').trim() } : null
      })
      .filter(Boolean)
    /* ¿Lista o azulejos? Un contenedor con borde por grupo significa que las
       filas comparten frontera; N cajas con borde propio es el lanzador. */
    const contenedoresConBorde = [...raiz.querySelectorAll('section > div')]
      .filter(d => getComputedStyle(d).borderTopWidth !== '0px').length
    return { enlaces, cadencias, contenedoresConBorde }
  })

  const conPara = m.enlaces.filter(e => e.para && e.para !== e.etiqueta)
  anota(m.enlaces.length > 0, `[${etiqueta}] el índice pinta destinos`, `${m.enlaces.length}`)
  anota(
    conPara.length === m.enlaces.length,
    `[${etiqueta}] todos los destinos visibles dicen para qué sirven`,
    `${conPara.length}/${m.enlaces.length}` +
      (conPara.length ? ` · p.ej. «${conPara[0].etiqueta} — ${conPara[0].para}»` : ''),
  )

  const conCadencia = m.cadencias.filter(c => c.cadencia)
  anota(
    m.cadencias.length > 0 && conCadencia.length === m.cadencias.length,
    `[${etiqueta}] todos los grupos dicen su cadencia`,
    conCadencia.map(c => `${c.titulo}: ${c.cadencia}`).join(' · '),
  )

  anota(
    m.contenedoresConBorde > 0 && m.contenedoresConBorde <= m.cadencias.length,
    `[${etiqueta}] anatomía de lista: un contenedor con borde por grupo`,
    `${m.contenedoresConBorde} contenedores para ${m.cadencias.length} grupos`,
  )

  /* NADA SE PERDIÓ. Se comparan los href visibles contra los declarados que el
     modo/`rutaPermitida` no filtra. Hospital y UCI son MODULOS_OPT_IN: en un
     consultorio sin ellos NO deben aparecer, y su ausencia no es una pérdida
     (la trampa que ya cazó el arnés de RTC-09). */
  const vistos = new Set(m.enlaces.map(e => e.href))
  const opcionales = new Set(['/hospitalizacion', '/uci'])
  const perdidos = DECLARADOS.filter(h => !vistos.has(h) && !opcionales.has(h))
  anota(
    perdidos.length === 0,
    `[${etiqueta}] ningún destino se cayó del índice`,
    `declarados ${DECLARADOS.length} · visibles ${vistos.size}${perdidos.length ? ` · PERDIDOS: ${perdidos.join(', ')}` : ''}`,
  )

  const bajitos = m.enlaces.filter(e => e.alto < 44)
  anota(bajitos.length === 0, `[${etiqueta}] objetivos táctiles ≥44px (§24)`,
    bajitos.map(e => `${e.etiqueta}: ${e.alto}px`).join(' · ') || 'todos ≥44')

  /* EL RESPALDO MUDADO: que esté no basta — tiene que DESCARGAR. */
  const boton = page.locator('button:has-text("Descargar todo el consultorio")')
  const existe = await boton.count()
  anota(existe === 1, `[${etiqueta}] el respaldo vive en /operaciones`)
  if (existe === 1) {
    try {
      const [descarga] = await Promise.all([
        page.waitForEvent('download', { timeout: 25000 }),
        boton.click(),
      ])
      anota(
        /^respaldo_ausculta_\d{4}-\d{2}-\d{2}\.ndjson$/.test(descarga.suggestedFilename()),
        `[${etiqueta}] y descarga de verdad, con el nombre de siempre`,
        descarga.suggestedFilename(),
      )
    } catch (e) {
      anota(false, `[${etiqueta}] y descarga de verdad, con el nombre de siempre`, String(e).slice(0, 120))
    }
  }

  await page.screenshot({ path: path.join(DESTINO, `operaciones-${etiqueta}.png`), fullPage: false })

  /* Y en /pacientes ya no está. */
  await page.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await page.waitForTimeout(2200)
  const enCabecera = await page.locator('button:has-text("Respaldo")').count()
  anota(enCabecera === 0, `[${etiqueta}] «Respaldo» salió de la cabecera de /pacientes`, `${enCabecera} botones`)

  await contexto.close()
}

await navegador.close()
anota(errores.length === 0, 'cero errores de consola', errores.slice(0, 4).join(' | ') || 'ninguno')

const pasan = condiciones.filter(c => c.ok).length
fs.writeFileSync(
  path.join(DESTINO, 'acta-rtc29.json'),
  JSON.stringify({ base: BASE, pasan, total: condiciones.length, condiciones, errores }, null, 2),
)
console.log(`\n${pasan}/${condiciones.length} condiciones · ${errores.length} errores de consola`)
process.exit(pasan === condiciones.length ? 0 : 1)
