/**
 * ATRIBUCIÓN DEL EXCEDENTE DE JS DE /consulta — V15-PERF-001, 3ª rebanada.
 *
 * El baseline midió que /consulta transfiere ~734 KB de JS contra ~490 KB de
 * sus hermanas de la cadena clínica. Antes de cortar nada hay que saber QUÉ
 * es ese excedente — y el camino obvio (`ANALYZE=true npm run build`) está
 * muerto en este build: @next/bundle-analyzer es un plugin de webpack y
 * Next 16 compila con Turbopack, que lo ignora en silencio (no produce
 * .next/analyze/*). La atribución honesta se hace donde importa: en el
 * navegador, con los chunks que de verdad viajan.
 *
 * Método:
 *   1. login (sesión puesta, no medida), SW bloqueado y caché apagada —
 *      mismo frío honesto que medir-perf-v15.mjs;
 *   2. visitar /expediente y registrar cada respuesta .js con su peso;
 *   3. visitar /consulta e igual;
 *   4. el diff (chunks que /consulta carga y /expediente no) ES el
 *      excedente; para cada chunk del diff se descarga el cuerpo y se
 *      extraen los marcadores de módulo que Turbopack deja en el código
 *      ("src/components/...", "src/lib/...", "node_modules/<paquete>") con
 *      los bytes aproximados entre marcador y marcador — suficiente para
 *      acusar módulos, no para contabilidad exacta.
 *
 * Uso (mismo patrón que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/atribuir-js-consulta-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-perf'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE_SEMBRADO = 'pac-refugio-alcantara'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  const saltar = page.locator('button:has-text("Saltar")').first()
  try {
    await saltar.waitFor({ state: 'visible', timeout: 4000 })
    await saltar.click()
    await saltar.waitFor({ state: 'hidden', timeout: 4000 })
  } catch { /* sin tour esta vez */ }
}

/** Visita la ruta y devuelve Map<url, bytes> de cada .js transferido. */
async function chunksDe(page, ruta) {
  const vistos = new Map()
  const handler = async (resp) => {
    const url = resp.url()
    if (!/\.js(\?|$)/.test(url)) return
    try {
      const cuerpo = await resp.body()
      vistos.set(url, cuerpo.length)
    } catch { /* respuesta ya descartada */ }
  }
  page.on('response', handler)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await page.waitForTimeout(4500)
  page.off('response', handler)
  return vistos
}

/**
 * Acusa a los módulos dentro de un chunk: Turbopack deja las rutas de módulo
 * como claves de texto plano. Se mide el hueco entre marcador y marcador —
 * aproximado, pero suficiente para saber quién pesa.
 */
function acusarModulos(texto) {
  const marcador = /"\[project\]\/([^"]{3,160}?)(?: \[[^"]*)?"/g
  const golpes = []
  let m
  while ((m = marcador.exec(texto)) !== null) golpes.push({ ruta: m[1], desde: m.index })
  const pesos = new Map()
  for (let i = 0; i < golpes.length; i++) {
    const hasta = i + 1 < golpes.length ? golpes[i + 1].desde : texto.length
    const bytes = hasta - golpes[i].desde
    // node_modules se agrega por paquete; src por archivo.
    let clave = golpes[i].ruta
    const np = clave.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
    if (np) clave = `node_modules/${np[1]}`
    pesos.set(clave, (pesos.get(clave) || 0) + bytes)
  }
  return pesos
}

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await contexto.newPage()
const cdp = await contexto.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

await login(page)

const expediente = await chunksDe(page, `/expediente/${PACIENTE_SEMBRADO}`)
const consulta = await chunksDe(page, `/consulta/${PACIENTE_SEMBRADO}`)

const kb = (b) => Math.round(b / 1024)
const totalExp = [...expediente.values()].reduce((a, b) => a + b, 0)
const totalCon = [...consulta.values()].reduce((a, b) => a + b, 0)
console.log(`expediente: ${expediente.size} chunks, ${kb(totalExp)} KB (cuerpo)`)
console.log(`consulta:   ${consulta.size} chunks, ${kb(totalCon)} KB (cuerpo)`)

// El excedente: chunks que consulta carga y expediente no.
const soloConsulta = [...consulta.entries()].filter(([url]) => !expediente.has(url))
const excedente = soloConsulta.reduce((a, [, b]) => a + b, 0)
console.log(`\nexcedente (sólo-consulta): ${soloConsulta.length} chunks, ${kb(excedente)} KB\n`)

// Descargar cada chunk del excedente y acusar módulos.
const acusados = new Map()
for (const [url, bytes] of soloConsulta.sort((a, b) => b[1] - a[1])) {
  const resp = await page.request.get(url)
  const texto = await resp.text()
  const pesos = acusarModulos(texto)
  const top = [...pesos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  console.log(`── ${kb(bytes)} KB  ${url.split('/').pop().slice(0, 60)}`)
  for (const [ruta, peso] of top) console.log(`     ${String(kb(peso)).padStart(5)} KB  ${ruta}`)
  for (const [ruta, peso] of pesos) acusados.set(ruta, (acusados.get(ruta) || 0) + peso)
}

console.log('\n══ ACUSADOS DEL EXCEDENTE (agregado, top 30) ══')
const ranking = [...acusados.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
for (const [ruta, peso] of ranking) console.log(`  ${String(kb(peso)).padStart(6)} KB  ${ruta}`)

fs.mkdirSync(DESTINO, { recursive: true })
fs.writeFileSync(
  path.join(DESTINO, 'atribucion-consulta.json'),
  JSON.stringify({
    fecha: new Date().toISOString(),
    expedienteKB: kb(totalExp),
    consultaKB: kb(totalCon),
    excedenteKB: kb(excedente),
    chunksSoloConsulta: soloConsulta.map(([url, b]) => ({ url: url.split('/').pop(), kb: kb(b) })),
    acusados: ranking.map(([ruta, b]) => ({ ruta, kb: kb(b) })),
  }, null, 2),
)
console.log(`\nEscrito ${path.join(DESTINO, 'atribucion-consulta.json')}`)

await contexto.close()
await navegador.close()
