/**
 * EQUIVALENCIA FUNCIONAL DEL DICTADO DIFERIDO — V15-PERF-001, 4ª rebanada.
 *
 * La rebanada movió el pipeline de voz (`@/lib/asr/pipeline`: léxico,
 * normalización, corrector vigilado, guardián, siglas) a import dinámico en
 * los dos hooks de grabación. Diferir no puede significar perder: el módulo
 * tiene que LLEGAR cuando el médico pulsa grabar (la regla «el dato tiene que
 * LLEGAR», versión de UI — hermana de `verificar-paneles-diferidos-v15.mjs`).
 *
 * Qué verifica, en navegador real contra build de producción y micrófono
 * sintético (--use-fake-device-for-media-capture):
 *
 *   1. La carga inicial de /consulta NO trae el pipeline: se descarga el
 *      cuerpo de CADA .js inicial y se busca un literal que sólo vive en
 *      `guardian-sustituciones` («dicen cosas opuestas del paciente») — el
 *      marcador sobrevive a la minificación porque es un string de runtime.
 *   2. Al pulsar «Grabar la consulta» (+ consentimiento), la grabación
 *      ARRANCA de verdad (la UI entra en estado grabando) — el permiso de
 *      micrófono y la maquinaria no se rompieron con el diferimiento.
 *   3. Tras pulsar, la red muestra chunks nuevos y el marcador APARECE en
 *      uno de ellos: el precalentado de `iniciar()` pidió el pipeline en el
 *      momento pactado — al dictar, no al abrir.
 *   4. 0 errores de consola hasta ahí.
 *
 * No se llega a detener/transcribir: eso pide proveedores de ASR que el
 * entorno demo no tiene, y el contrato de ESTA rebanada es cuándo se carga
 * el módulo, no la transcripción entera (cubierta por sus propios guardianes).
 *
 * Uso (mismo patrón que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/verificar-dictado-diferido-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-perf'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PACIENTE_SEMBRADO = 'pac-refugio-alcantara'
const MARCADOR = 'dicen cosas opuestas del paciente'

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

const navegador = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {},
)
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
await contexto.grantPermissions(['microphone'], { origin: BASE })
const page = await contexto.newPage()

/**
 * MICRÓFONO SINTÉTICO POR WEB AUDIO — y por qué no bastan los flags de Chrome.
 *
 * En este contenedor `--use-fake-device-for-media-capture` no materializa
 * ningún dispositivo: `enumerateDevices()` devuelve VACÍO y `getUserMedia`
 * muere con NotFoundError (medido el 13-ago-2026, también con
 * `--use-file-for-fake-audio-capture` y con el headless shell). Así que el
 * arnés — SÓLO el arnés, la app no se toca — sustituye `getUserMedia` por un
 * stream real de Web Audio (oscilador → MediaStreamDestination): MediaRecorder
 * lo graba de verdad, el medidor RMS lo analiza de verdad, y todo el camino
 * del hook corre idéntico. Lo único fingido es la membrana del micrófono.
 */
await page.addInitScript(() => {
  const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
  if (!navigator.mediaDevices) return
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (original) { try { return await original(constraints) } catch { /* sin dispositivo: cae al sintético */ } }
    const ctx = new AudioContext({ sampleRate: 48000 })
    if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* la pista sale igual */ } }
    const osc = ctx.createOscillator()
    osc.frequency.value = 440
    const destino = ctx.createMediaStreamDestination()
    osc.connect(destino)
    osc.start()
    return destino.stream
  }
})

const erroresConsola = []
page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text().slice(0, 160)) })
const chunksJs = []
page.on('response', (r) => { if (/\.js(\?|$)/.test(r.url())) chunksJs.push(r.url()) })

await login(page)

// 1. Carga inicial de /consulta: el pipeline NO debe venir.
await page.goto(`${BASE}/consulta/${PACIENTE_SEMBRADO}`, { waitUntil: 'load' })
await page.waitForTimeout(4000)
const jsInicial = chunksJs.slice()
let marcadorInicial = false
for (const url of jsInicial) {
  const cuerpo = await page.request.get(url).then(r => r.text()).catch(() => '')
  if (cuerpo.includes(MARCADOR)) { marcadorInicial = true; break }
}
console.log(`carga inicial: ${jsInicial.length} .js · pipeline presente: ${marcadorInicial}`)

// 2. Pulsar grabar (+ consentimiento la primera vez).
await page.locator('button[aria-label^="Grabar la consulta"]').first().click()
const confirmar = page.locator('button:has-text("Confirmo el consentimiento e iniciar")')
let consentimientoVisto = false
try {
  await confirmar.waitFor({ state: 'visible', timeout: 3000 })
  consentimientoVisto = true
  await confirmar.click()
} catch { /* ya consintió en una corrida previa */ }
await page.waitForTimeout(3000)

// 3. ¿Arrancó de verdad, y llegó el pipeline con el arranque?
// El estado grabando no se anuncia con texto: MientrasHablas es un instrumento
// de aria-labels (Pausar/Terminar sólo existen MIENTRAS se graba).
const grabando = await page
  .locator('[aria-label="Terminar la grabación"], [aria-label="Pausar la grabación"], [aria-label="Reanudar la grabación"]')
  .first().isVisible().catch(() => false)
const nuevos = chunksJs.slice(jsInicial.length)
let marcadorTrasGrabar = false
for (const url of nuevos) {
  const cuerpo = await page.request.get(url).then(r => r.text()).catch(() => '')
  if (cuerpo.includes(MARCADOR)) { marcadorTrasGrabar = true; break }
}
// Diagnóstico cuando NO arranca: el hook pinta su error en pantalla — se lee.
const cuerpo = (await page.textContent('body')) || ''
const errorGrabacion = (cuerpo.match(/[^.]*(micrófono|No se pudo iniciar la grabación|no soporta grabación)[^.]*\./i) || [''])[0].trim()
await page.screenshot({ path: path.join(DESTINO, 'dictado-diferido-tras-click.png'), fullPage: false })
console.log(`tras pulsar grabar: grabando=${grabando} · +${nuevos.length} chunks · pipeline llegó: ${marcadorTrasGrabar}`)
console.log(`consentimiento visto: ${consentimientoVisto} · error visible: ${errorGrabacion || '(ninguno)'}`)
console.log(`errores de consola: ${erroresConsola.length}`)
if (erroresConsola.length) console.log(erroresConsola.slice(0, 5).join('\n'))

const veredicto = {
  fecha: new Date().toISOString(),
  jsInicial: jsInicial.length,
  pipelineEnCargaInicial: marcadorInicial,
  grabacionArranca: grabando,
  consentimientoVisto,
  errorVisible: errorGrabacion || null,
  chunksNuevosAlGrabar: nuevos.length,
  pipelineLlegaAlGrabar: marcadorTrasGrabar,
  erroresConsola: erroresConsola.length,
  // El contrato entero: fuera al abrir, dentro al dictar, y nada truena.
  pasa: !marcadorInicial && grabando && marcadorTrasGrabar && erroresConsola.length === 0,
}
fs.mkdirSync(DESTINO, { recursive: true })
fs.writeFileSync(path.join(DESTINO, 'dictado-diferido.json'), JSON.stringify(veredicto, null, 2))
console.log(`\n${veredicto.pasa ? 'PASA' : 'FALLA'} — escrito ${path.join(DESTINO, 'dictado-diferido.json')}`)

await contexto.close()
await navegador.close()
process.exit(veredicto.pasa ? 0 : 1)
