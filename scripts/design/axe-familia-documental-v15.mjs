/**
 * ACCESIBILIDAD DE LA FAMILIA DOCUMENTAL — axe sobre las superficies que EMITEN
 * un documento clínico, en los dos anchos.
 *
 * ── POR QUÉ EXISTE ESTE MEDIDOR Y NO SE AMPLÍA EL QUE YA HABÍA ──────────────
 *
 * `axe-encuentro-v15.mjs` cubre seis superficies —Hoy, pacientes, expediente,
 * consulta sin firmar, operaciones, pendientes— y **la familia documental
 * nunca entró en su lista**. Eso no es una sospecha: es el hallazgo escrito de
 * `V15-FINAL-COHERENCE-001`, que explicó así por qué ninguna corrida de axe
 * había visto que `/nota` no tenía NINGÚN `<h1>`. El defecto llevaba ahí desde
 * que la familia existe, y el instrumento no podía verlo porque no miraba.
 *
 * Ampliar `PANTALLAS` allí habría sido lo cómodo y lo incorrecto: su acta
 * (`v15-encuentro-v29/acta-axe.json`) es evidencia de una iteración CERRADA por
 * lectura independiente, y la consumen otras corridas. Meterle cuatro
 * pantallas nuevas cambiaría sus números sin que nadie hubiera medido un ANTES.
 * Por eso éste escribe su propia acta, en su propia carpeta.
 *
 * ── QUÉ PRETENDE PROBAR, DICHO COMO NEGACIÓN ────────────────────────────────
 *
 * §7 del Release Gate exige que las propiedades obligatorias de accesibilidad
 * pasen en las pantallas críticas, y nota/receta/orden SON críticas: son donde
 * el médico emite un documento que cambia el tratamiento del paciente. Decir
 * «ACCESIBILIDAD: PASA» apoyándose en un instrumento que nunca las visitó
 * sería un falso verde de manual — verde por no mirar.
 *
 * Este medidor NO repara nada y NO cambia el producto. Sólo mira donde no se
 * había mirado, y publica lo que encuentre, sea limpio o no.
 *
 * ── CÓMO SE CORRE, Y POR QUÉ NO TRAE ARNÉS PROPIO ──────────────────────────
 *
 * `arnes-coherencia-v15.sh` ya acepta el medidor como argumento (`${1:-…}`) y
 * ya hace las CUATRO siembras que estas pantallas necesitan — en particular
 * `sembrar-receta-en-nota-firmada-v15.mjs`, sin la cual `/receta` no tiene
 * medicamentos que pintar y se mediría una pantalla que no es la que interesa.
 * Escribir un quinto arnés que repitiera esas cuatro siembras sería la deriva
 * que REG-318 persigue: dos listas idénticas que divergen a la tercera edición.
 *
 * Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *        --project demo-nexusmed-test \
 *        "bash scripts/design/arnes-coherencia-v15.sh scripts/design/axe-familia-documental-v15.mjs"
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import fs from 'node:fs'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = 'docs/design/capturas/v15-release-gate'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

// Las rutas son las MISMAS que mide la matriz de coherencia — se copian de su
// acta, no se inventan, para que las dos hablen de las mismas pantallas.
const PANTALLAS = [
  ['nota', '/nota/pac-aurelio-dominguez/nota-aurelio-1'],
  ['receta', '/receta/pac-luzmaria-cervantes/nota-luzmaria-1'],
  ['orden', '/orden/pac-aurelio-dominguez/nota-aurelio-1'],
  ['referencia', '/referencia/pac-aurelio-dominguez'],
]

mkdirSync(DESTINO, { recursive: true })
// La convención del repositorio: el `@playwright/test` instalado puede ser más
// nuevo que los navegadores del contenedor. Ya mató tres corridas.
const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
)

const acta = { fecha: new Date().toISOString(), base: BASE, viewports: {} }

for (const [vp, ancho, alto] of [['escritorio', 1440, 900], ['movil', 390, 844]]) {
  const ctx = await navegador.newContext({
    viewport: { width: ancho, height: alto }, isMobile: ancho < 700, hasTouch: ancho < 700,
    serviceWorkers: 'block',
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 40000 })
  try {
    const s = page.locator('button:has-text("Saltar")').first()
    await s.waitFor({ state: 'visible', timeout: 4000 }); await s.click()
  } catch { /* sin tour */ }

  acta.viewports[vp] = {}
  for (const [nombre, ruta] of PANTALLAS) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
    await page.waitForTimeout(3000)
    await page.addScriptTag({ content: AXE })
    const violaciones = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        resultTypes: ['violations'],
      })
      return r.violations.map(v => ({ regla: v.id, impacto: v.impact, nodos: v.nodes.length, ayuda: v.help }))
    })
    // El `<h1>` se publica junto a las violaciones porque REG-321 vive aquí: la
    // familia documental tenía que nombrar al paciente, y una corrida de axe
    // limpia sobre una pantalla sin encabezado seguiría siendo un mal resultado.
    const h1 = await page.evaluate(() => {
      const e = document.querySelector('h1')
      return e ? { texto: e.textContent.trim().slice(0, 60), px: getComputedStyle(e).fontSize } : null
    })
    acta.viewports[vp][nombre] = { violaciones, h1 }
    console.log(`${vp.padEnd(11)} ${nombre.padEnd(12)} ${violaciones.length} reglas · ${violaciones.map(v => `${v.regla}(${v.nodos})`).join(' ') || 'limpio'} · h1: ${h1 ? `«${h1.texto}» ${h1.px}` : 'NINGUNO'}`)
  }
  await ctx.close()
}

await navegador.close()
writeFileSync(`${DESTINO}/acta-axe-familia-documental.json`, JSON.stringify(acta, null, 2))

const todas = Object.values(acta.viewports).flatMap(v => Object.values(v).flatMap(x => x.violaciones))
const criticas = todas.filter(v => v.impacto === 'critical' || v.impacto === 'serious')
console.log('\nreglas distintas:', [...new Set(todas.map(v => v.regla))].sort().join(', ') || '(ninguna)')
console.log('violaciones critical/serious:', criticas.length)
console.log('acta →', `${DESTINO}/acta-axe-familia-documental.json`)
