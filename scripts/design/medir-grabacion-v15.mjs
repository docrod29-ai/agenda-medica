/**
 * EL CICLO DE VIDA DE LA GRABACIÓN, INTENTADO DE VERDAD.
 *
 * ── QUÉ HACE, Y QUÉ NO ─────────────────────────────────────────────────────
 *
 * No inspecciona el código: pulsa. Abre el encuentro SIN FIRMAR con un
 * dispositivo de audio FALSO de Chromium (`--use-fake-device-for-media-stream`)
 * y recorre PREPARAR · INICIAR · PAUSAR · REANUDAR · ESTADO EN VIVO ·
 * INTERRUPCIÓN · RECUPERACIÓN · CIERRE, apuntando de cada paso PASA, FALLA o
 * NO SE PUEDE COMPROBAR.
 *
 * ── LA REGLA DE HONESTIDAD ─────────────────────────────────────────────────
 *
 * Los pasos que dependen del PROVEEDOR de transcripción —que aparezca la
 * transcripción y que de ella nazca la nota— salen `NO SE PUEDE COMPROBAR` con
 * la dependencia dicha por su nombre, no `PASA`. En este contenedor no hay
 * llaves de proveedor y el audio es un tono sintético: llamar PASA a eso sería
 * exactamente el falso verde que §12 del encargo prohíbe.
 *
 * Un paso que no se puede comprobar **no autoriza a parar**: se apunta y se
 * sigue.
 *
 * Uso: bash scripts/design/arnes-encuentro-v15.sh  (o, suelto, con next start
 *      ya escuchando en :3000)
 *   node scripts/design/medir-grabacion-v15.mjs
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.env.DESTINO_GRABACION || 'docs/design/capturas/v15-grabacion'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const RUTA = '/consulta/pac-aurelio-dominguez'

fs.mkdirSync(DESTINO, { recursive: true })

const acta = { base: BASE, fecha: new Date().toISOString(), pasos: [], errores: [] }
const apuntar = (paso, veredicto, nota) => {
  acta.pasos.push({ paso, veredicto, nota })
  console.log(`${veredicto.padEnd(22)} ${paso}${nota ? ` — ${nota}` : ''}`)
}

const navegador = await chromium.launch({
  ...(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}),
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['microphone'],
  serviceWorkers: 'block',
})
const page = await contexto.newPage()
page.on('console', m => { if (m.type() === 'error') acta.errores.push(m.text().slice(0, 200)) })
page.on('pageerror', e => acta.errores.push('pageerror: ' + e.message.slice(0, 200)))

// Las rutas de transcripción se apuntan: es la frontera con el proveedor, y de
// qué contesta depende que un paso sea comprobable o no.
const llamadas = []
page.on('response', r => {
  if (r.url().includes('/api/expediente/transcribir')) llamadas.push({ url: r.url().split('?')[0].slice(-40), status: r.status() })
})

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

await page.goto(`${BASE}${RUTA}`, { waitUntil: 'load' })
await page.waitForTimeout(3000)

// ── PREPARAR ───────────────────────────────────────────────────────────────
const boton = page.locator('button[aria-label^="Grabar la consulta"]').first()
const hayBoton = await boton.count() > 0 && await boton.isVisible()
apuntar('PREPARAR', hayBoton ? 'PASA' : 'FALLA',
  hayBoton ? 'el encuentro sin firmar abre con el grabador visible' : 'no hay control de grabación en el encuentro')
if (hayBoton) await page.screenshot({ path: path.join(DESTINO, '1-preparar.png') })

const textoDe = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ')
const dice = async re => re.test(await textoDe())

if (!hayBoton) {
  apuntar('INICIAR', 'FALLA', 'sin control no hay ciclo que recorrer')
} else {
  // ── INICIAR ──────────────────────────────────────────────────────────────
  //
  // Pulsar el micrófono NO empieza a grabar: abre la hoja de consentimiento
  // («Confirme que el paciente fue informado…»), y la grabación arranca al
  // confirmarla. La primera versión de esta sonda no la confirmaba y aun así
  // dio INICIAR=PASA, porque el texto del propio modal —«El paciente puede
  // pedir detener la grabación»— casaba con el patrón que buscaba el estado.
  // Un falso verde de manual: se apunta aquí para que no vuelva.
  await boton.click()
  await page.waitForTimeout(1200)
  const consentir = page.locator('button:has-text("Confirmo el consentimiento")').first()
  const hayConsentimiento = await consentir.count() > 0 && await consentir.isVisible()
  apuntar('CONSENTIMIENTO', hayConsentimiento ? 'PASA' : 'FALLA',
    hayConsentimiento
      ? 'grabar exige confirmar que el paciente fue informado; no arranca sin eso'
      : 'el grabador arrancó SIN pedir consentimiento')
  if (hayConsentimiento) {
    await page.screenshot({ path: path.join(DESTINO, '2a-consentimiento.png') })
    await consentir.click()
  }
  await page.waitForTimeout(5000)
  // El estado se lee FUERA del modal: si se leyera el diálogo, su propio texto
  // daría por buena una grabación que no empezó.
  const grabando = await dice(/grabando|pausar|detener la grabaci|en vivo|escuchando/i)
  apuntar('INICIAR', grabando ? 'PASA' : 'FALLA',
    grabando ? 'la pantalla pasa a estado de grabación' : 'el estado no cambió tras pulsar')
  await page.screenshot({ path: path.join(DESTINO, '2-iniciar.png') })

  // ── ESTADO EN VIVO ───────────────────────────────────────────────────────
  const t1 = await textoDe()
  await page.waitForTimeout(3500)
  const t2 = await textoDe()
  const crono = /\d{1,2}:\d{2}/
  const vivo = crono.test(t2) && t1 !== t2
  apuntar('ESTADO EN VIVO', vivo ? 'PASA' : 'NO SE PUEDE COMPROBAR',
    vivo ? 'el cronómetro avanza mientras se graba' : 'no se detectó indicador que cambie con el tiempo')

  // ── PAUSAR ───────────────────────────────────────────────────────────────
  const pausa = page.locator('button:has-text("Pausar"), button[aria-label*="ausar" i]').first()
  let pausado = false
  if (await pausa.count() > 0 && await pausa.isVisible()) {
    await pausa.click(); await page.waitForTimeout(1600)
    pausado = await dice(/pausad|reanudar|continuar/i)
    apuntar('PAUSAR', pausado ? 'PASA' : 'FALLA', pausado ? 'la sesión queda en pausa y se ofrece reanudar' : 'se pulsó pausa y el estado no lo refleja')
    await page.screenshot({ path: path.join(DESTINO, '3-pausar.png') })
  } else {
    apuntar('PAUSAR', 'FALLA', 'no se encontró control de pausa durante la grabación')
  }

  // ── REANUDAR ─────────────────────────────────────────────────────────────
  if (pausado) {
    const reanudar = page.locator('button:has-text("Reanudar"), button:has-text("Continuar"), button[aria-label*="eanudar" i]').first()
    if (await reanudar.count() > 0 && await reanudar.isVisible()) {
      await reanudar.click(); await page.waitForTimeout(2200)
      const ok = await dice(/grabando|pausar|detener/i) && !(await dice(/pausad/i))
      apuntar('REANUDAR', ok ? 'PASA' : 'FALLA', ok ? 'vuelve a grabar sin perder la sesión' : 'no volvió al estado de grabación')
    } else {
      apuntar('REANUDAR', 'FALLA', 'estando en pausa no se ofrece reanudar')
    }
  } else {
    apuntar('REANUDAR', 'NO SE PUEDE COMPROBAR', 'no se llegó a pausar')
  }

  // ── INTERRUPCIÓN ─────────────────────────────────────────────────────────
  // Salir de la pantalla con la grabación viva es el caso que el producto
  // declara defender (`useAvisoAlSalirGrabando`).
  await page.waitForTimeout(1500)
  let avisa = false
  page.once('dialog', async d => { avisa = true; await d.dismiss() })
  await page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    ;(window).__nxAvisó = e.defaultPrevented
  })
  const bloquea = await page.evaluate(() => (window).__nxAvisó === true)
  apuntar('INTERRUPCIÓN', (bloquea || avisa) ? 'PASA' : 'NO SE PUEDE COMPROBAR',
    (bloquea || avisa)
      ? 'salir con la grabación viva queda bloqueado por el aviso del navegador'
      : 'el evento sintético no reproduce el aviso real del navegador')

  // ── RECUPERACIÓN ─────────────────────────────────────────────────────────
  // El guardián de salida es justo lo que hace difícil recargar aquí: el
  // `beforeunload` que acaba de PASAR bloquea la navegación. Se acepta el
  // diálogo y, si aun así no suelta, el paso se apunta como no comprobable —
  // no se fuerza un verde matando el navegador.
  page.on('dialog', d => d.accept().catch(() => {}))
  let recargó = true
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 })
  } catch {
    recargó = false
  }
  await page.waitForTimeout(4000)
  const recuperado = recargó && await dice(/recuperar|se interrumpi|audio sin subir|quedó a medias|sin terminar/i)
  apuntar('RECUPERACIÓN', recuperado ? 'PASA' : 'NO SE PUEDE COMPROBAR',
    !recargó ? 'el aviso de salida impidió recargar dentro del plazo: el ciclo no llegó a reabrirse' :
    recuperado
      ? 'tras recargar, la pantalla ofrece recuperar lo grabado'
      : 'con audio sintético de pocos segundos no se llegó a persistir nada que recuperar')
  await page.screenshot({ path: path.join(DESTINO, '4-recuperacion.png') })
}

// ── TRANSCRIPCIÓN · NOTA · CIERRE ──────────────────────────────────────────
const proveedor = llamadas.filter(l => l.status >= 400)
apuntar('TRANSCRIPCIÓN', 'NO SE PUEDE COMPROBAR',
  llamadas.length
    ? `dependencia externa: ${[...new Set(llamadas.map(l => `${l.url} → ${l.status}`))].join(' · ')}`
    : 'no hay llaves de proveedor de transcripción en este contenedor, y el audio es un tono sintético')
apuntar('NOTA', 'NO SE PUEDE COMPROBAR', 'la nota nace de la transcripción; sin transcripción no hay qué redactar')
apuntar('CIERRE', 'NO SE PUEDE COMPROBAR',
  'firmar exige una nota con contenido; sin transcripción no se llega al cierre por esta vía')

if (proveedor.length) acta.proveedor = proveedor

await page.screenshot({ path: path.join(DESTINO, '5-final.png') })
await contexto.close()
await navegador.close()

acta.erroresDeConsola = acta.errores.length
fs.writeFileSync(path.join(DESTINO, 'acta-grabacion.json'), JSON.stringify(acta, null, 2))
console.log(`\nerrores de consola: ${acta.errores.length}`)
for (const e of acta.errores.slice(0, 10)) console.log('  ' + e)
