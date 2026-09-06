/**
 * LOS ESTADOS DE LA VOZ SE MIRAN PULSANDO EL MICRÓFONO.
 *
 * Chromium con micrófono FALSO (`--use-fake-device-for-media-stream`): el
 * `MediaRecorder` funciona de verdad, así que la máquina de estados del hook
 * (`inactivo → grabando → pausado → subiendo → listo | error`) recorre sus
 * transiciones reales. Sin esto, los estados de voz sólo se pueden leer.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base, salida, anchoStr] = process.argv.slice(2)
const w = Number(anchoStr || 1440)
mkdirSync(salida, { recursive: true })
const nav = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await nav.newContext({
  viewport: { width: w, height: w === 390 ? 844 : 900 },
  permissions: ['microphone'],
})
const p = await ctx.newPage()
const consola = []
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consola.push(m.type() + ': ' + m.text().slice(0, 200)) })
p.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 200)))

await p.goto(base + '/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
// El recorrido de bienvenida sale en la primera sesión y tapa la pantalla:
// se cierra antes de mirar nada más. Cuántos pasos tiene se cuenta de paso.
await p.waitForTimeout(2000)
let pasosTour = 0
for (let i = 0; i < 15; i++) {
  const dlg = p.locator('[role="dialog"][aria-label*="ienvenida"]')
  if (!(await dlg.count()) || !(await dlg.first().isVisible())) break
  pasosTour++
  const seguir = dlg.locator('button', { hasText: /Siguiente|Entendido|Empezar|Cerrar|Saltar|Listo|Omitir/i }).first()
  if (await seguir.count()) await seguir.click({ force: true })
  else { await p.keyboard.press('Escape') }
  await p.waitForTimeout(600)
}
console.log('pasos del recorrido de bienvenida:', pasosTour)

await p.goto(base + '/consulta/pac-001', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(3000)
// Por si el recorrido reaparece en esta pantalla.
for (let i = 0; i < 8; i++) {
  const dlg = p.locator('[role="dialog"][aria-label*="ienvenida"]')
  if (!(await dlg.count()) || !(await dlg.first().isVisible())) break
  const seguir = dlg.locator('button').last()
  await seguir.click({ force: true }).catch(() => {})
  await p.waitForTimeout(500)
}

const foto = async n => { await p.screenshot({ path: `${salida}/voz-${n}-${w}.png` }); return n }
/** Qué dice la pantalla ahora mismo sobre el micrófono. */
const leer = async () => p.evaluate(() => {
  const t = (document.querySelector('main') || document.body).innerText
  const dice = s => t.includes(s)
  return {
    dice: ['Grabar la consulta', 'Preparando el micrófono', 'Grabando', 'Pausa', 'Reanudar', 'Detener',
           'Procesando', 'Transcribiendo', 'Subiendo', 'Escuchando', 'Continuar']
      .filter(dice),
    hayMarco: !!document.querySelector('.nx-marco-escuchando, [class*="marco"]'),
    botones: [...document.querySelectorAll('main button')].map(b => (b.textContent || '').trim())
      .filter(Boolean).slice(0, 14),
  }
})

console.log('— inactivo —'); console.log(JSON.stringify(await leer(), null, 1)); await foto('1-inactivo')

// Arrancar la grabación
const arranque = p.locator('button', { hasText: /Grabar la consulta/i }).first()
if (await arranque.count()) {
  await arranque.click()
  await p.waitForTimeout(1200)
  // Grabar exige consentimiento del paciente: sale un diálogo antes del
  // micrófono, y eso es correcto. Se acepta para poder ver los estados.
  const acepto = p.locator('[role="dialog"] button', { hasText: /Acept|Sí|Continuar|Confirm|Grabar/i }).first()
  if (await acepto.count()) {
    console.log('  (hubo compuerta de consentimiento, se acepta)')
    await acepto.click({ force: true }).catch(() => {})
  }
  await p.waitForTimeout(4000)
  console.log('\n— tras pulsar grabar —'); console.log(JSON.stringify(await leer(), null, 1)); await foto('2-grabando')

  // EL CONTROL FLOTANTE TIENE QUE VOLVER AL DESPLAZARSE. Si el observador
  // está mal, acabo de BORRAR el botón de detener para una nota larga.
  const pildora = () => p.locator('button', { hasText: /Detener y generar nota/i })
  console.log('\n— píldora con el panel a la vista —', await pildora().count(), '(se espera 0)')
  // El lienzo de este shell hace scroll DENTRO de <main>, no en la ventana:
  // `window.scrollTo` no movía nada y la comprobación era falsa en verde.
  await p.evaluate(() => {
    const m = document.querySelector('main')
    if (m && m.scrollHeight > m.clientHeight) m.scrollTop = 1400
    else window.scrollTo(0, 1400)
  })
  await p.waitForTimeout(1200)
  console.log('— píldora tras desplazarse —', await pildora().count(), '(se espera 1)')
  await foto('4-desplazado')
  // LA PREGUNTA CORRECTA NO ES «¿tapa algo ahora?» sino «¿queda algún control
  // AL QUE NO SE PUEDA LLEGAR?». Un control tapado a media página se destapa
  // desplazándose; el del final, no — y ése es el criterio de
  // `nada-flotante-tapa-un-control.mjs`. Así que se baja del todo y se mira ahí.
  await p.evaluate(() => {
    const m = document.querySelector('main')
    if (m) m.scrollTop = m.scrollHeight
    else window.scrollTo(0, document.body.scrollHeight)
  })
  await p.waitForTimeout(900)
  console.log('— abajo del todo, tapa algún control —', await p.evaluate(() => {
    const pil = [...document.querySelectorAll('div')].find(d => d.textContent?.includes('Detener y generar nota') && getComputedStyle(d).position === 'fixed')
    if (!pil) return 'no está'
    const r = pil.getBoundingClientRect()
    const tapados = []
    for (const c of document.querySelectorAll('main input, main textarea, main button')) {
      const q = c.getBoundingClientRect()
      if (q.width === 0 || pil.contains(c)) continue
      if (q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) {
        const enc = document.elementFromPoint((Math.max(q.left, r.left) + Math.min(q.right, r.right)) / 2,
                                              (Math.max(q.top, r.top) + Math.min(q.bottom, r.bottom)) / 2)
        if (enc && pil.contains(enc)) tapados.push(c.tagName + ' ' + (c.getAttribute('placeholder') || c.textContent || '').slice(0, 30))
      }
    }
    return tapados.length ? tapados : 'ninguno'
  }))
  await p.evaluate(() => {
    const m = document.querySelector('main')
    if (m) m.scrollTop = 0
    window.scrollTo(0, 0)
  })
  await p.waitForTimeout(1000)
  console.log('— píldora al volver arriba —', await pildora().count(), '(se espera 0)')

  const pausa = p.locator('button', { hasText: /Pausa/i }).first()
  if (await pausa.count()) {
    await pausa.click(); await p.waitForTimeout(1500)
    console.log('\n— pausado —'); console.log(JSON.stringify(await leer(), null, 1)); await foto('3-pausado')
  } else console.log('\n— pausado — NO hay control de pausa a la vista')
} else {
  console.log('\nNo se encontró el botón de grabar.')
}
console.log('\nconsola:', consola.slice(0, 8))
console.log('MediaRecorder disponible:', await p.evaluate(() => typeof MediaRecorder !== 'undefined'))
console.log('micrófonos:', await p.evaluate(async () => {
  try { const d = await navigator.mediaDevices.enumerateDevices(); return d.filter(x => x.kind === 'audioinput').length }
  catch (e) { return 'ERROR ' + String(e).slice(0, 80) }
}))
await nav.close()
