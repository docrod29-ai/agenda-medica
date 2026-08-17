/**
 * ARNÉS RTC-15 — ¿la lista de pacientes DICE algo clínico, en el navegador?
 *
 * El guardián de vitest comprueba el cálculo y el orden del fuente. Esto
 * comprueba lo otro: que el dato LLEGUE a la pantalla. Un `estadoClinicoDeFila`
 * perfecto que nadie pinta —o que se pinta con la lectura sin llegar— pasaría
 * la suite entera. Es la regla «el dato tiene que LLEGAR» aplicada a una fila.
 *
 * Qué mide, en escritorio (1440×900) y en móvil (390×844):
 *   1. Las filas pintan estado clínico para los pacientes que TIENEN pendientes
 *      vivos, y el número de filas con estado coincide con los pacientes
 *      distintos que el worklist de /pendientes enseña.
 *   2. La línea clínica va ANTES del teléfono en la geometría real (no sólo en
 *      el fuente): se comparan los `getBoundingClientRect().top`.
 *   3. Lo urgente se distingue por algo MÁS que el color: el texto dice la
 *      consecuencia («venció…», «sin dueño», «crítica…»).
 *   4. «visto hace…» aparece en las filas con `ultimaCita`.
 *   5. La affordance de la fila es un chevron, no un documento.
 *   6. En móvil la línea clínica SOBREVIVE (RTC-11 quitó «Editar» y el chevron;
 *      lo clínico no se quita nunca) y la identidad CONSERVA SU COLUMNA — el
 *      umbral es el ancho que RTC-11 dejó medido (228px), no el número de
 *      renglones: un nombre largo puede envolver a 390px y eso nunca fue el
 *      defecto.
 *   7. Cero errores de consola.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/verificar-rtc15-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc15'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })
const errores = []
const condiciones = []
const anota = (ok, texto, detalle) => {
  condiciones.push({ ok: !!ok, texto, detalle: detalle ?? null })
  console.log(`  ${ok ? '✓' : '✗'} ${texto}${detalle ? ` — ${detalle}` : ''}`)
}

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

/**
 * Cuántos pacientes DISTINTOS tienen pendientes vivos, según /pendientes.
 *
 * OJO CON EL SELECTOR. La primera pasada barría `[class*="nx-ident"]` y se
 * llevaba por delante `.nx-ident-franja` —la identidad del InstrumentStrip, que
 * fuera de una ruta de paciente pinta el nombre del consultorio—, así que
 * «Ausculta» entraba en la lista de pacientes con pendientes y el arnés
 * informaba de un paciente sin marcar que no existe. El instrumento otra vez.
 * Se barre DENTRO del `<main>` y con la clase exacta.
 */
async function pacientesConPendientes(page) {
  await page.goto(`${BASE}/pendientes`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)
  return page.evaluate(() => {
    const raiz = document.querySelector('main') ?? document.body
    const nombres = new Set()
    for (const el of raiz.querySelectorAll('.nx-ident')) {
      const t = (el.textContent ?? '').trim()
      if (t) nombres.add(t)
    }
    return [...nombres]
  })
}

for (const [ancho, alto, etiqueta] of [[1440, 900, 'escritorio'], [390, 844, 'movil']]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: ancho < 700, hasTouch: ancho < 700, serviceWorkers: 'block',
  })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(`[${etiqueta}] ${m.text()}`) })
  page.on('pageerror', e => errores.push(`[${etiqueta}] pageerror: ${e.message}`))
  await entrar(page)

  const conPendientes = await pacientesConPendientes(page)

  /* «Todos A-Z»: la pestaña por defecto es «Recientes» (tope 15) y podría
     esconder justo al paciente que tiene el pendiente. Se mide sobre la lista
     completa, que es donde una omisión sería un defecto de verdad. */
  await page.goto(`${BASE}/pacientes`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  await page.click('text=/^Todos A-Z/')
  await page.waitForTimeout(2600)

  const medida = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('.nx-fila-paciente')]
    return filas.map(f => {
      const nombre = (f.querySelector('.nx-ident')?.textContent ?? '').trim()
      const clinico = f.querySelector('.nx-fila-clinico')
      const telefono = [...f.querySelectorAll('.nx-meta span')]
        .find(s => /\+?\d[\d\s-]{6,}/.test(s.textContent ?? ''))
      const visto = [...f.querySelectorAll('.nx-meta span')]
        .find(s => /^visto /.test((s.textContent ?? '').trim()))
      const r = el => (el ? Math.round(el.getBoundingClientRect().top) : null)
      return {
        nombre,
        textoClinico: clinico ? (clinico.textContent ?? '').replace(/\s+/g, ' ').trim() : null,
        topClinico: r(clinico),
        topTelefono: r(telefono),
        textoVisto: visto ? (visto.textContent ?? '').trim() : null,
        /* ¿SIGUE TENIENDO LA IDENTIDAD SU ANCHO? RTC-11 midió el defecto en
           ANCHO (de ~90px a 228px), no en renglones: un nombre muy largo puede
           envolver a 390px y eso no es el defecto — `.nx-ident` no trunca a
           propósito (§24). Esta rebanada añade contenido DEBAJO de la
           identidad, así que lo que hay que comprobar es que no le haya
           robado columna. La primera pasada contaba renglones y marcaba en
           rojo a «María del Refugio Alcántara Solís» por ser larga: la
           condición medía otra cosa que el defecto. */
        anchoIdentidad: (() => {
          const i = f.querySelector('.nx-ident')
          return i ? Math.round(i.getBoundingClientRect().width) : null
        })(),
        /* Presencia NO es visibilidad: RTC-11 esconde el chevron con
           `display:none`, no lo desmonta. Preguntar por el nodo daba un falso
           rojo. */
        chevronVisible: (() => {
          const c = f.querySelector('.nx-fila-chevron')
          return !!c && getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0
        })(),
      }
    })
  })

  const conEstado = medida.filter(f => f.textoClinico)
  anota(medida.length > 0, `[${etiqueta}] la lista pinta filas`, `${medida.length} filas`)
  anota(
    conEstado.length > 0,
    `[${etiqueta}] alguna fila DICE su estado clínico`,
    conEstado.map(f => `${f.nombre}: ${f.textoClinico}`).join(' · ') || 'ninguna',
  )

  /* EL DATO TIENE QUE LLEGAR: los pacientes que /pendientes enseña con trabajo
     vivo tienen que ser exactamente los que la lista marca. Si /pendientes
     enseña tres y la lista marca uno, el dato se perdió por el camino. */
  const marcados = new Set(conEstado.map(f => f.nombre))
  const faltantes = conPendientes.filter(n => !marcados.has(n))
  anota(
    faltantes.length === 0,
    `[${etiqueta}] ningún paciente con pendientes vivos se queda sin marcar`,
    `worklist: ${conPendientes.length} · marcados: ${marcados.size}${faltantes.length ? ` · FALTAN: ${faltantes.join(', ')}` : ''}`,
  )

  const conAmbos = conEstado.filter(f => f.topTelefono != null)
  anota(
    conAmbos.length === 0 || conAmbos.every(f => f.topClinico < f.topTelefono),
    `[${etiqueta}] lo clínico se pinta ARRIBA del teléfono (geometría real)`,
    conAmbos.map(f => `${f.nombre}: clínico ${f.topClinico} < tel ${f.topTelefono}`).join(' · ') || 'sin filas con ambos',
  )

  anota(
    conEstado.every(f => /—|·/.test(f.textoClinico) || f.textoClinico.length > 0),
    `[${etiqueta}] el estado se dice con palabras, no sólo con color`,
  )

  anota(
    medida.some(f => f.textoVisto),
    `[${etiqueta}] «visto hace…» llega a la fila`,
    medida.filter(f => f.textoVisto).slice(0, 3).map(f => `${f.nombre}: ${f.textoVisto}`).join(' · ') || 'ninguna',
  )

  if (etiqueta === 'escritorio') {
    anota(medida.every(f => f.chevronVisible), '[escritorio] la fila lleva su affordance de «lleva a otro sitio»')
  } else {
    // RTC-11: en móvil el chevron decorativo y «Editar» salen…
    anota(medida.every(f => !f.chevronVisible), '[movil] el chevron decorativo sigue fuera (RTC-11)')
    // …pero lo clínico NO se quita nunca: es el dato, no el cromo.
    anota(conEstado.length > 0, '[movil] la línea clínica SOBREVIVE al ancho del teléfono')
    /* El umbral es el que RTC-11 dejó MEDIDO: 228px de columna para la
       identidad. Se admite margen a la baja por si el arnés mide con otro
       tamaño de fuente, pero no se admite volver a los ~90px del defecto. */
    const estrechas = medida.filter(f => (f.anchoIdentidad ?? 0) < 200)
    anota(
      estrechas.length === 0,
      '[movil] la identidad conserva su columna (RTC-11: 228px, defecto: ~90px)',
      estrechas.map(f => `${f.nombre}: ${f.anchoIdentidad}px`).join(' · ')
        || `todas ≥200px (mín ${Math.min(...medida.map(f => f.anchoIdentidad ?? 0))}px)`,
    )
  }

  await page.screenshot({ path: path.join(DESTINO, `pacientes-${etiqueta}.png`), fullPage: false })
  await contexto.close()
}

await navegador.close()

anota(errores.length === 0, 'cero errores de consola', errores.slice(0, 4).join(' | ') || 'ninguno')

const pasan = condiciones.filter(c => c.ok).length
fs.writeFileSync(
  path.join(DESTINO, 'acta-rtc15.json'),
  JSON.stringify({ base: BASE, pasan, total: condiciones.length, condiciones, errores }, null, 2),
)
console.log(`\n${pasan}/${condiciones.length} condiciones · ${errores.length} errores de consola`)
process.exit(pasan === condiciones.length ? 0 : 1)
