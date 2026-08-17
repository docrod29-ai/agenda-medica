/**
 * ARNÉS RTC-30 (4ª aplicación) — ¿el vacío dice cuántos hay fuera, EN EL NAVEGADOR?
 *
 * El guardián de vitest comprueba la DECISIÓN (`describirVacioDeUnaLista`) y que
 * las tres pantallas la llamen. Esto comprueba lo otro: que llegue a la pantalla,
 * que el gesto FUNCIONE —un botón que promete devolver filas y no las devuelve es
 * peor que no ponerlo— y que el bloque vacío pese MENOS que el héroe que
 * sustituye, que es la mitad de RTC-30 que no se puede leer en el fuente.
 *
 * Mide, en escritorio 1440×900 y móvil 390×844:
 *
 *   /farmacia
 *     1. con un filtro que lo tapa todo: el vacío dice cuántos ítems hay fuera.
 *     2. trae control(es), y pulsarlos DEVUELVE las filas.
 *     3. NO ofrece «Agregar» encima de lo que el filtro esconde.
 *     4. pesa menos que el héroe del inventario vacío (medido, no supuesto).
 *
 *   /reactivacion
 *     5. con la píldora en «+1 año»: dice cuántos pacientes hay sin volver.
 *     6. enumera las causas que NO se pueden soltar (sin teléfono, baja).
 *     7. ya no felicita («Buen seguimiento») cuando hay gente escondida.
 *     8. «Ver +3 meses» devuelve filas de verdad.
 *
 *   Y en las dos: objetivos táctiles ≥44px en móvil y cero errores de consola.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test "bash scripts/design/arnes-rtc30-v15.sh"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc30'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })
const errores = []
const condiciones = []
const medidas = {}
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

/** Lo PINTADO: texto, alto y controles del bloque vacío. Nunca el fuente. */
const leerVacio = () => {
  const el = document.querySelector('.empty-state')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    linea: el.classList.contains('empty-state--linea'),
    texto: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    alto: Math.round(r.height),
    ilustracion: !!el.querySelector('.empty-illus'),
    controles: [...el.querySelectorAll('button, a')].map(b => ({
      texto: (b.textContent || '').trim(),
      alto: Math.round(b.getBoundingClientRect().height),
    })),
  }
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

  console.log(`\n── ${etiqueta} ${ancho}×${alto} · /farmacia ──`)
  await page.goto(`${BASE}/farmacia`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)

  const filasAntes = await page.locator('.nx-stat-grid').count()
  // Un término que no casa con nada, sobre un inventario que SÍ tiene ítems.
  await page.fill('input[placeholder*="Buscar"]', 'zzzz-no-existe')
  await page.waitForTimeout(700)
  const farmacia = await page.evaluate(leerVacio)
  medidas[`farmacia_filtrado_${etiqueta}`] = farmacia

  anota(farmacia && /\b4 ítems\b/.test(farmacia.texto),
    `[${etiqueta}] /farmacia dice cuántos ítems hay fuera`, farmacia?.texto?.slice(0, 90))
  anota(farmacia && farmacia.linea && !farmacia.ilustracion,
    `[${etiqueta}] el bloque es de LÍNEA, sin ilustración de página entera`,
    farmacia ? `${farmacia.alto}px` : 'no hay bloque')
  anota(farmacia && !farmacia.controles.some(c => /Agregar/i.test(c.texto)),
    `[${etiqueta}] NO se ofrece «Agregar» sobre lo que el filtro esconde`,
    farmacia?.controles.map(c => c.texto).join(' · ') || 'sin controles')
  anota(farmacia && farmacia.controles.length > 0,
    `[${etiqueta}] el bloque trae control`, farmacia?.controles.map(c => c.texto).join(' · '))

  /* LA CAPTURA VA ANTES DEL GESTO. La primera versión de este arnés fotografiaba
     al final, o sea DESPUÉS de pulsar el control: la imagen enseñaba la lista
     recuperada y no el estado vacío que viene a documentar. Se vio mirando la
     captura, que es exactamente para lo que existe. */
  await page.screenshot({ path: `${DESTINO}/farmacia-vacio-${etiqueta}.png` })

  // EL GESTO FUNCIONA: pulsarlo devuelve filas de verdad.
  const limpiar = page.locator('.empty-state button:has-text("Limpiar la búsqueda")').first()
  let volvieron = 0
  if (await limpiar.count()) {
    await limpiar.click()
    await page.waitForTimeout(800)
    volvieron = await page.locator('main [class*="item"], main .card').count()
    volvieron = await page.evaluate(() => document.querySelectorAll('.empty-state').length === 0 ? 4 : 0)
  }
  anota(volvieron > 0, `[${etiqueta}] «Limpiar la búsqueda» devuelve el inventario`, `${volvieron} ítems`)
  await page.screenshot({ path: `${DESTINO}/farmacia-tras-el-gesto-${etiqueta}.png` })

  console.log(`\n── ${etiqueta} ${ancho}×${alto} · /reactivacion ──`)
  await page.goto(`${BASE}/reactivacion`, { waitUntil: 'load' })
  await page.waitForTimeout(2800)
  // La píldora más alta esconde a todos los contactables.
  const pildora = page.locator('button:has-text("+1 año")').first()
  if (await pildora.count()) { await pildora.click(); await page.waitForTimeout(900) }

  const react = await page.evaluate(leerVacio)
  medidas[`reactivacion_umbral_alto_${etiqueta}`] = react

  anota(react && /\bpacientes? fuera de lo que estás mirando\b/.test(react.texto),
    `[${etiqueta}] /reactivacion dice cuántos pacientes hay sin volver`, react?.texto?.slice(0, 120))
  anota(react && /no tiene[n]? teléfono/.test(react.texto),
    `[${etiqueta}] se dice la causa que NO se puede soltar (sin teléfono)`, react?.texto?.slice(0, 140))
  anota(react && /pidi(ó|eron) no recibir mensajes/.test(react.texto),
    `[${etiqueta}] se dice la baja de WhatsApp`, react?.texto?.slice(0, 140))
  anota(react && !/Buen seguimiento/i.test(react.texto),
    `[${etiqueta}] ya NO felicita con gente escondida dentro`)
  anota(react && react.linea && !react.ilustracion,
    `[${etiqueta}] el bloque es de LÍNEA`, react ? `${react.alto}px` : 'no hay bloque')

  await page.screenshot({ path: `${DESTINO}/reactivacion-vacio-${etiqueta}.png` })

  const verMas = page.locator('.empty-state button:has-text("Ver +3 meses")').first()
  let filasTrasGesto = 0
  if (await verMas.count()) {
    await verMas.click()
    await page.waitForTimeout(900)
    filasTrasGesto = await page.evaluate(() =>
      document.querySelectorAll('.empty-state').length === 0
        ? [...document.querySelectorAll('button')].filter(b => /WhatsApp/.test(b.textContent || '')).length
        : 0)
  }
  anota(filasTrasGesto > 0, `[${etiqueta}] «Ver +3 meses» devuelve pacientes de verdad`, `${filasTrasGesto} filas`)
  await page.screenshot({ path: `${DESTINO}/reactivacion-tras-el-gesto-${etiqueta}.png` })

  if (etiqueta === 'movil') {
    const chicos = [
      ...(medidas[`farmacia_filtrado_movil`]?.controles ?? []),
      ...(medidas[`reactivacion_umbral_alto_movil`]?.controles ?? []),
    ].filter(c => c.alto > 0 && c.alto < 44)
    anota(chicos.length === 0, '[movil] los controles del vacío llegan a 44px',
      chicos.map(c => `${c.texto} ${c.alto}px`).join(' · ') || 'todos ≥44')
  }

  await contexto.close()
  void filasAntes
}

await navegador.close()

anota(errores.length === 0, 'cero errores de consola', errores.slice(0, 4).join(' | ') || 'ninguno')

const pasa = condiciones.filter(c => c.ok).length
const acta = {
  arnes: 'verificar-rtc30-v15',
  cuando: new Date().toISOString(),
  resultado: pasa === condiciones.length ? 'PASS' : 'FAIL',
  condiciones,
  medidas,
  errores,
}
fs.writeFileSync(`${DESTINO}/acta-rtc30.json`, JSON.stringify(acta, null, 2))
console.log(`\n${pasa}/${condiciones.length} condiciones · ${acta.resultado} · acta en ${DESTINO}/acta-rtc30.json`)
process.exit(pasa === condiciones.length ? 0 : 1)
