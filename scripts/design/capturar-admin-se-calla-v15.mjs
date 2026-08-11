/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-ENCOUNTER-MODE-001, §8.5 «nonessential
 * admin disappears» (hallazgo #5 del baseline: menú de motor de IA + avisos
 * de créditos/plan DENTRO de `/consulta/[patientId]`).
 *
 * A diferencia de `capturar-flow-rail-quieto-v15.mjs` (que simula
 * `EVENTO_GRABANDO` con un `CustomEvent` porque el shell vive en OTRO árbol de
 * componentes), esta verificación graba de VERDAD: `audio.estado` es estado
 * interno de `useGrabacionAudio()` dentro de la propia página, no hay evento
 * externo que simular. Se usa un micrófono FALSO de Chromium
 * (`--use-fake-device-for-media-stream` + `--use-fake-ui-for-media-stream`)
 * para que `getUserMedia`/`MediaRecorder` corran de verdad, y se intercepta
 * SÓLO la frontera de red hacia el proveedor de ASR/IA (no hay llave real de
 * AssemblyAI/Whisper/Anthropic en este entorno) — todo lo demás (React,
 * efectos, DOM) corre sin tocar.
 *
 * NO se ejercita la diarización completa al detener (el submit+poll de
 * `/api/expediente/transcribir-diarizado` cuelga en este sandbox por algo
 * ajeno a este cambio — probablemente el intento de subir el audio a Firebase
 * Storage dentro de `guardarAudioDeLaConsulta`, que no tiene emulador
 * levantado aquí). En vez de depender de esa vuelta completa, el aviso de
 * créditos se dispara pulsando «Procesar con IA» directamente (visible y
 * habilitado en cuanto hay transcripción, sin importar `audio.estado`) — el
 * MISMO botón, la MISMA ruta mockeada, sin pasar por la diarización.
 *
 * Requiere: emuladores Auth (9099) + Firestore (8080), siembra de
 * `sembrar-capturas.mjs`, `.env.local` demo, build de producción + `npm
 * start` apuntando a los emuladores (mismo método que las capturas hermanas
 * de esta fase).
 *
 * Uso:
 *   node scripts/design/capturar-admin-se-calla-v15.mjs [carpetaDestino]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-admin-se-calla'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PATIENT_ID = 'pac-aurelio-dominguez'

const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = fs.readFileSync(axePath, 'utf8')

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

/**
 * Estado real del DOM: menú de motor de IA + el aviso de créditos agotados.
 *
 * OJO: `sinCreditos` también dispara un TOAST transitorio con el mismo título
 * («Se acabaron tus consultas con IA del mes») — buscar sólo ese título
 * daría un falso positivo mientras el toast está en pantalla. Se busca el
 * CUERPO del aviso persistente, que el toast no lleva.
 */
async function medir(page) {
  return page.evaluate(() => {
    const porTexto = (t) => Array.from(document.querySelectorAll('body *')).some(
      el => el.children.length === 0 && el.textContent?.includes(t),
    )
    return {
      grabando: !!document.querySelector('button[title="Detener y transcribir"]'),
      menuDeIA: porTexto('Motor de IA para esta nota'),
      avisoSinCreditos: porTexto('La IA se pausó para no generarte cargos extra'),
    }
  })
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CAPTURA_CHROMIUM_DESCARGADO
      ? '/opt/pw-browsers/chromium' : undefined,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'es-MX',
    permissions: ['microphone'],
  })
  const page = await context.newPage()
  const erroresConsola = []
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()) })
  page.on('pageerror', (e) => erroresConsola.push(String(e)))

  // ── Frontera de red: sólo el proveedor de ASR/IA se intercepta ────────────
  let chunkVisto = false
  await page.route('**/api/expediente/transcribir-chunk', async (route) => {
    chunkVisto = true
    await route.fulfill({ json: { ok: true, text: 'Paciente refiere cefalea leve de dos días de evolución.' } })
  })
  // El tope de créditos: la forma MÁS simple y segura de reproducir el aviso
  // «Se acabaron tus consultas con IA del mes» sin depender de estado real de
  // facturación — sólo ejercita el render condicional (`sinCreditos &&
  // !grabandoAhora()`), no la lógica de negocio (que ya tiene sus propios
  // guardianes en `tope-cortesia-no-corta-a-quien-paga.test.ts` y hermanos).
  await page.route('**/api/expediente/procesar', async (route) => {
    await route.fulfill({ json: { ok: false, sinCreditos: true, usadas: 30, limite: 30 } })
  })

  await login(page)
  await page.goto(`${BASE}/consulta/${PATIENT_ID}`, { waitUntil: 'load' })
  await page.getByText('Saltar', { exact: true }).click({ timeout: 2000 }).catch(() => null)

  const resultado = {}

  // ── 1) Antes de grabar ─────────────────────────────────────────────────
  await page.waitForTimeout(800)
  resultado.antesDeGrabar = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, '01-antes.png') })

  // ── 2) Grabación real (micrófono falso); consentimiento la 1ª vez ───────
  await page.getByRole('button', { name: /Grabar la consulta/ }).click()
  const modalConsentimiento = page.getByRole('button', { name: 'Confirmo el consentimiento e iniciar' })
  if (await modalConsentimiento.isVisible({ timeout: 5000 }).catch(() => false)) {
    await modalConsentimiento.click({ timeout: 15000 })
  }
  await page.waitForSelector('button[title="Detener y transcribir"]', { timeout: 15000 })
  resultado.justEmpezo = await medir(page)

  // Esperar al primer trozo EN VIVO real (flush cada 20s por defecto) — es lo
  // que puebla `voz.transcripcion` DURANTE `audio.estado === 'grabando'` sin
  // que `voz.grabando` (Web Speech) se entere; es exactamente el hallazgo #5.
  const limiteChunk = Date.now() + 26000
  while (!chunkVisto && Date.now() < limiteChunk) await page.waitForTimeout(500)
  await page.waitForTimeout(500) // deja que el efecto de React pinte el nuevo texto

  resultado.grabandoConTranscripcionParcial = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, '02-grabando-menu-ausente.png') })

  // ── 3) Aviso de créditos disparado MIENTRAS SIGUE GRABANDO: debe quedarse
  //    apagado — es la prueba directa de `!grabandoAhora()` en el propio
  //    aviso, sin pasar por la diarización (que cuelga en este sandbox por
  //    algo ajeno a este cambio, ver cabecera). ─────────────────────────────
  const btnProcesar = page.getByRole('button', { name: /Procesar con IA/ })
  await btnProcesar.click()
  await page.waitForTimeout(600)
  resultado.creditosAgotadosMientrasGraba = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, '03-creditos-agotados-pero-grabando.png') })

  // ── 4) Detener: el mismo aviso, ya con sinCreditos=true, debe APARECER en
  //    cuanto `grabandoAhora()` deja de ser true — sin esperar a 'listo'. ──
  await page.click('button[title="Detener y transcribir"]')
  await page.waitForSelector('*:has-text("Se acabaron tus consultas con IA del mes")', { timeout: 8000 }).catch(() => null)
  await page.waitForTimeout(500)
  resultado.despuesDeDetenerAvisoAparece = await medir(page)
  await page.screenshot({ path: path.join(DESTINO, '04-detenido-aviso-aparece.png') })

  // Axe mientras el aviso está visible: el apagado/encendido no debe introducir violaciones nuevas.
  await page.evaluate(axeSource)
  const axeResultado = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodos: v.nodes.length }))
  })

  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  fs.writeFileSync(path.join(DESTINO, 'axe.json'), JSON.stringify(axeResultado, null, 2))
  if (erroresConsola.length) fs.writeFileSync(path.join(DESTINO, 'consola-errores.json'), JSON.stringify(erroresConsola, null, 2))

  await context.close()
  await browser.close()

  console.log('\n── Resumen ──')
  console.log('antesDeGrabar:', JSON.stringify(resultado.antesDeGrabar))
  console.log('justEmpezo:', JSON.stringify(resultado.justEmpezo))
  console.log('chunkVisto:', chunkVisto)
  console.log('grabandoConTranscripcionParcial (menú de IA debe estar AUSENTE):', JSON.stringify(resultado.grabandoConTranscripcionParcial))
  console.log('creditosAgotadosMientrasGraba (aviso debe seguir AUSENTE):', JSON.stringify(resultado.creditosAgotadosMientrasGraba))
  console.log('despuesDeDetenerAvisoAparece (aviso debe APARECER):', JSON.stringify(resultado.despuesDeDetenerAvisoAparece))
  console.log('axe violaciones:', axeResultado.length, JSON.stringify(axeResultado))
  console.log('errores de consola:', erroresConsola.length, JSON.stringify(erroresConsola))
}

main().catch((e) => { console.error(e); process.exit(1) })
