/**
 * ARNÉS RTC-10 — ¿qué hay en el PRIMER VIEWPORT del expediente?
 *
 * El equipo rojo midió que la primera pantalla de un expediente no traía «un
 * solo dato clínico»: fila de exportación + tres tarjetas KPI (dos VACÍAS), y
 * la historia clínica empezando ~675px abajo. Este arnés convierte esa frase
 * en números que se pueden comparar antes y después, en el navegador real:
 *
 *   · `pliegueHistoria`   — a cuántos px del inicio del documento empieza el
 *                           encabezado «Historia clínica».
 *   · `primerDatoClinico` — la posición del primer elemento que enseña un dato
 *                           clínico de VERDAD (un signo, un diagnóstico, una
 *                           nota), no un rótulo ni una caja vacía.
 *   · `tarjetasVacias`    — cuántas tarjetas del resumen dicen «sin …».
 *   · `botonesDeExport`   — cuántos botones de exportación/documentos hay por
 *                           encima del primer dato clínico.
 *   · `dentroDelPliegue`  — qué de todo eso cabe en el alto del viewport.
 *
 * Se mide con un paciente CON datos y con uno SIN datos (recién creado): el
 * defecto de las tarjetas vacías sólo existe en el segundo, y una medición que
 * sólo mirara al primero lo declararía arreglado sin tocarlo.
 *
 * Uso:
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-primer-viewport-expediente-v15.mjs [destino]"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-rtc10'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'

fs.mkdirSync(DESTINO, { recursive: true })

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
const errores = []
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()) })
page.on('pageerror', e => errores.push(`pageerror: ${e.message}`))

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

/**
 * Los pacientes sembrados, por id fijo. La primera versión los descubría con
 * `a[href^="/expediente/"]` desde la lista y encontraba CERO: RTC-11 dejó la
 * fila abriendo con un `<button>` (la identidad es el control, no un enlace),
 * así que el selector medía una superficie que ya no existe. Los ids vienen de
 * `scripts/design/sembrar-capturas.mjs` — la misma siembra que ejecuta el arnés.
 *
 * `pac-refugio-alcantara` TIENE notas y signos; `pac-catalina-ibarra` y
 * `pac-luzmaria-cervantes` sirven de contraste. El defecto de las tarjetas
 * vacías sólo se ve en un expediente sin datos, y medir sólo al que los tiene
 * lo declararía arreglado sin tocarlo.
 */
const rutas = [
  '/expediente/pac-refugio-alcantara',
  '/expediente/pac-catalina-ibarra',
  '/expediente/pac-luzmaria-cervantes',
]

const medirRuta = async (ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(2200)
  return await page.evaluate(() => {
    const y = el => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null
    const texto = el => (el?.textContent ?? '').trim()

    /**
     * SE MIDEN LANDMARKS CON `id`, NO HEURÍSTICOS DE «¿ESTO PARECE CLÍNICO?».
     *
     * Dos versiones anteriores de este arnés intentaron detectar «el primer
     * dato clínico» leyendo el DOM a ojo, y las dos se equivocaron en la
     * dirección peligrosa —la que APRUEBA el defecto—: la primera contaba el
     * contador «Consultas: 6» de la tarjeta Actividad (metadato de uso, no del
     * paciente) y daba el baseline por bueno; la segunda enganchaba un nodo
     * del ancla de identidad a 71px. Un instrumento que aprueba el defecto que
     * viene a medir es peor que no tener instrumento.
     *
     * Los anclas del Clinical Spine (§7) ya existen y son inequívocas. RTC-10
     * se contesta comparando ALTURAS entre ellas, sin adivinar nada.
     */
    const problemas = document.querySelector('#spine-problemas')
    const pendientes = document.querySelector('#spine-pendientes')
    const encuentros = document.querySelector('#spine-encuentros')
    const herramientas = document.querySelector('#spine-herramientas')
    const datosPaciente = [...document.querySelectorAll('button')]
      .find(b => /^Datos del paciente/.test(texto(b)))

    const vacias = [...document.querySelectorAll('div')]
      .filter(d => /^Sin (signos|diagnósticos)/i.test(texto(d))).length
    const exports = [...document.querySelectorAll('button')]
      .filter(b => /Expediente completo|FHIR|Carta de referencia/i.test(texto(b)))

    const yEnc = y(encuentros)
    const arribaDeLaHistoria = el => y(el) != null && yEnc != null && y(el) < yEnc

    return {
      alto: window.innerHeight,
      yEstadoClinico: y(problemas),
      yPendientes: y(pendientes),
      yHistoria: yEnc,
      yDatosPaciente: y(datosPaciente),
      yHerramientas: y(herramientas),
      // Lo que RTC-10 pide, en tres booleanos que no admiten interpretación:
      /* «No está» y «está mal puesto» son cosas distintas y el acta lo dice:
         los pacientes sembrados no tienen notas FIRMADAS con dx ni fármacos,
         así que `#spine-problemas` no se pinta para ninguno. Reportarlo como
         «después de la historia» sería una afirmación falsa sobre el producto
         — la misma familia de error que las dos versiones anteriores de este
         arnés, sólo que en la dirección contraria. */
      estadoClinicoPresente: problemas != null,
      estadoClinicoAntesDeLaHistoria: problemas == null ? null : arribaDeLaHistoria(problemas),
      pendientesPresentes: pendientes != null && pendientes.getBoundingClientRect().height > 0,
      pendientesAntesDeLaHistoria: pendientes == null ? null : arribaDeLaHistoria(pendientes),
      cajasModuloAntesDeLaHistoria:
        [datosPaciente, herramientas].filter(arribaDeLaHistoria).length,
      estadoClinicoDentroDelPliegue: y(problemas) != null && y(problemas) <= window.innerHeight,
      tarjetasVacias: vacias,
      botonesDeExportSobreLaHistoria: exports.filter(arribaDeLaHistoria).length,
    }
  })
}

const medidas = {}
for (const ruta of rutas) {
  const m = await medirRuta(ruta)
  medidas[ruta] = m
  console.log(`  ${ruta}
      estado clínico: ${m.estadoClinicoPresente ? `@${m.yEstadoClinico}px ${m.estadoClinicoAntesDeLaHistoria ? 'antes de la historia ✓' : 'DESPUÉS de la historia ✗'}` : 'no aplica (sin dx/fármacos en notas firmadas)'}
      pendientes: ${m.pendientesPresentes ? `@${m.yPendientes}px ${m.pendientesAntesDeLaHistoria ? '✓ antes de la historia' : '✗ después'}` : 'no aplica (este paciente no tiene)'} · historia @${m.yHistoria}px
      cajas-módulo antes de la historia: ${m.cajasModuloAntesDeLaHistoria} · tarjetas vacías: ${m.tarjetasVacias} · export sobre la historia: ${m.botonesDeExportSobreLaHistoria}`)
  await page.screenshot({ path: path.join(DESTINO, `viewport${ruta.replace(/\//g, '-')}.png`) })
}

await contexto.close()
await navegador.close()

const acta = { base: BASE, viewport: '1440x900', medidas, erroresDeConsola: errores }
fs.writeFileSync(path.join(DESTINO, `medicion-${process.env.ETIQUETA || 'baseline'}.json`), JSON.stringify(acta, null, 2))
console.log(`\nacta: ${path.join(DESTINO, `medicion-${process.env.ETIQUETA || 'baseline'}.json`)}`)
