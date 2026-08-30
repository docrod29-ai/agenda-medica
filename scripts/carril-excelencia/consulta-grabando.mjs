#!/usr/bin/env node
/**
 * LA CONSULTA GRABANDO — el estado que ninguna sonda alcanzaba.
 *
 * ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────
 *
 * El trinquete de interfaz mide `/consulta` **en reposo**: cargada, sin dictado.
 * Y el trabajo de verdad de ese médico ocurre en el otro estado. Medir sólo el
 * reposo y decir «la consulta sale limpia» es medir la sala de espera y hablar
 * del quirófano.
 *
 * ── CÓMO ENTRA ──────────────────────────────────────────────────────────────
 *
 * Micrófono falso de Chromium (`--use-fake-device-for-media-stream`): un tono,
 * sin hardware. No transcribe nada —eso necesita proveedor, y aquí no hay— pero
 * enciende el grabador de verdad.
 *
 * Y **pasa por el consentimiento**, porque el producto lo exige antes de grabar.
 * Eso no es un obstáculo del arnés: es el control medicolegal, y la sonda lo
 * mide de paso.
 *
 * ── CÓMO SABE QUE ESTÁ GRABANDO (y no se lo cree) ───────────────────────────
 *
 * Tres señales, no una: los botones cambian («Pausar», «Terminar», «Detener y
 * generar nota»), aparece un cronómetro, y ese cronómetro **ha avanzado** en la
 * segunda lectura. La primera versión de esta sonda daba por bueno un
 * `[aria-live]` cualquiera y declaró «grabando» sobre la pantalla en reposo —
 * con su axe en cero, que parecía una buena noticia.
 *
 * ── EL CONSENTIMIENTO SÓLO SALE LA PRIMERA VEZ ──────────────────────────────
 *
 * A la segunda corrida, `DIÁLOGO DE CONSENTIMIENTO: {"hay":false}` y la
 * grabación arranca directa. **No es un fallo de la sonda ni del producto**: el
 * consentimiento queda asentado en la bitácora y en el expediente, y el propio
 * código dice que eso «es además lo que permite no volver a preguntarlo».
 *
 * Para volver a medir ese diálogo hay que re-sembrar el emulador.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   (emuladores sembrados + build y servidor CON la configuración del arnés)
 *   node scripts/carril-excelencia/consulta-grabando.mjs
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
/**
 * ENTRAR ES PARTE DE MEDIR.
 *
 * Si el campo de correo no aparece, la causa casi siempre es la misma y no es
 * la pantalla: un `npm run build` de las compuertas reconstruyó `.next` con
 * OTRA configuración —sin emuladores— mientras este servidor seguía en pie, así
 * que la aplicación apunta a Firebase de verdad y el formulario no llega a
 * montarse. Ha pasado SEIS veces en este carril.
 *
 * Un `TimeoutError` de Playwright no dice nada de eso. Esto sí.
 */
async function entrar(pag, base) {
  await pag.goto(base + '/login', { waitUntil: 'domcontentloaded' })
  try {
    await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
  } catch {
    console.error('\n  No apareció el formulario de acceso en ' + base + '/login.')
    console.error('  Casi seguro: el servidor sirve un build hecho SIN la configuración del')
    console.error('  arnés. Para el servidor, borra .next, construye con las variables del')
    console.error('  arnés (NEXT_PUBLIC_FIREBASE_EMULATORS=1 …) y arranca otra vez.\n')
    process.exit(2)
  }
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForTimeout(9000)
}

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const nav = await chromium.launch({
  executablePath: CHROME,
  // Micrófono falso: un tono, sin hardware. No transcribe nada —eso necesita
  // proveedor— pero SÍ enciende el estado «grabando» de la pantalla.
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
})
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
const pag = await ctx.newPage()
const errores = []
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text().slice(0, 120)) })
// QUÉ ruta falla, no sólo que algo falló: «503» a secas no distingue un trozo
// en vivo (best-effort, el producto lo cuenta aparte) de la transcripción final.
pag.on('response', r => { if (r.status() >= 400) errores.push(`HTTP ${r.status()} ← ${new URL(r.url()).pathname}`) })
await entrar(pag, 'http://localhost:3300')
await pag.goto('http://localhost:3300/consulta/pac-001', { waitUntil: 'domcontentloaded' })
await pag.waitForTimeout(8000)
for (const t of [/^saltar$/i, /^entendido$/i]) {
  const b = pag.locator('button:visible').filter({ hasText: t }).first()
  if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(700) }
}
// ¿Hay soporte y botón?
const antes = await pag.evaluate(() => ({
  botones: [...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent || '').trim()).filter(Boolean).slice(0, 25),
}))
console.log('botones visibles:', JSON.stringify(antes.botones))
const grabar = pag.locator('button').filter({ hasText: /grabar|dictar|iniciar/i }).first()
const n = await grabar.count().catch(() => 0)
if (!n) {
  console.error('\n  NO se encontró el botón de grabar. O el servidor no sirve el build del')
  console.error('  arnés, o la pantalla cambió. No se mide lo que no se encuentra.\n')
  await nav.close(); process.exit(2)
}
if (n) {
  const soporte = await pag.evaluate(() => ({
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    mimeWebm: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm'),
    mimeOpus: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus'),
    getUserMedia: !!navigator.mediaDevices?.getUserMedia,
    seguro: window.isSecureContext,
  }))
  console.log('soporte del navegador:', JSON.stringify(soporte))
  const gum = await pag.evaluate(async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      const n = s.getAudioTracks().length; s.getTracks().forEach(t => t.stop()); return `ok, ${n} pista(s)` }
    catch (e) { return 'falló: ' + (e && e.name) + ' ' + (e && e.message) }
  })
  console.log('getUserMedia directo:', gum)
  await grabar.click().catch(e => console.log('no se pudo pulsar:', e.message))
  await pag.waitForTimeout(6000)
  // GRABAR PIDE CONSENTIMIENTO ANTES. No es un fallo: es el requisito
  // medicolegal que el propio código documenta. Se mide ESE diálogo también.
  const dlg = await pag.evaluate(() => {
    const d = document.querySelector('[role="dialog"], [role="alertdialog"]')
    return d ? { hay: true, texto: (d.textContent||'').replace(/\s+/g,' ').slice(0,160),
                 modal: d.getAttribute('aria-modal'),
                 botones: [...d.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(Boolean) } : { hay: false }
  })
  console.log('DIÁLOGO DE CONSENTIMIENTO:', JSON.stringify(dlg))
  if (dlg.hay) {
    await pag.addScriptTag({ content: AXE })
    const ax = await pag.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
      return { total: r.violations.reduce((s,v)=>s+v.nodes.length,0),
               det: r.violations.flatMap(v => v.nodes.slice(0,2).map(n => `${v.id}[${v.impact}] ${n.html.slice(0,90)}`)) }
    })
    console.log(`AXE del consentimiento: ${ax.total}`)
    ax.det.forEach(d => console.log('   ', d))
    // Trampa de foco: 15 tabulaciones.
    let fuera = 0
    for (let i = 0; i < 15; i++) {
      await pag.keyboard.press('Tab')
      const dentro = await pag.evaluate(() => {
        const d = document.querySelector('[role="dialog"], [role="alertdialog"]')
        return !!(d && document.activeElement && d.contains(document.activeElement))
      })
      if (!dentro) fuera++
    }
    console.log(`consentimiento · tabulaciones fuera: ${fuera} de 15`)
    // Aceptar y seguir hasta el estado de grabación.
    const aceptar = pag.locator('[role="dialog"] button, [role="alertdialog"] button')
      .filter({ hasText: /confirmo|acepto|de acuerdo|continuar/i }).first()
    if (await aceptar.count().catch(()=>0)) { await aceptar.click().catch(()=>{}); await pag.waitForTimeout(6000) }
    else console.log('   (no se encontró botón de aceptar)')
  }
  // ¿DE VERDAD está grabando? Señales concretas, no un selector generoso:
  // el botón cambia de nombre, aparece un cronómetro, y el `MediaRecorder`
  // del navegador dice su estado. Un `[aria-live]` cualquiera no prueba nada.
  const est = await pag.evaluate(() => {
    const botones = [...document.querySelectorAll('button')]
      .map(b => (b.getAttribute('aria-label') || b.textContent || '').trim())
      .filter(t => /grabar|deten|pausa|reanud|termin/i.test(t))
    const cronometro = (document.body.innerText || '').match(/\b\d{1,2}:\d{2}\b/g) || []
    return { botones, cronometro: cronometro.slice(0, 3),
             pistasActivas: (navigator.mediaDevices ? 'api presente' : 'sin api') }
  })
  console.log('¿grabando de verdad?', JSON.stringify(est))
  // Segunda lectura 4 s después: si hay cronómetro, tiene que HABER AVANZADO.
  await pag.waitForTimeout(4000)
  const est2 = await pag.evaluate(() => ((document.body.innerText || '').match(/\b\d{1,2}:\d{2}\b/g) || []).slice(0, 3))
  console.log('cronómetro 4s después:', JSON.stringify(est2))
  await pag.addScriptTag({ content: AXE })
  const r = await pag.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
    return { total: r.violations.reduce((s,v)=>s+v.nodes.length,0),
             det: r.violations.flatMap(v => v.nodes.slice(0,3).map(n => {
               const el = document.querySelector(n.target.join(' '))
               const b = el?.getBoundingClientRect()
               return `${v.id}[${v.impact}] ${Math.round(b?.width||0)}x${Math.round(b?.height||0)} sel=${n.target.join(' ').slice(0,60)}\n        html=${n.html.slice(0,150)}\n        por=${(n.failureSummary||'').replace(/\n/g,' ').slice(0,180)}`
             })) }
  })
  console.log(`AXE GRABANDO: ${r.total}`)
  r.det.forEach(d => console.log('   ', d))
  /**
   * LOS CONTROLES DE LA GRABACIÓN: pausar, reanudar, terminar.
   *
   * Ninguno necesita proveedor de transcripción —son locales al `MediaRecorder`—
   * así que se pueden medir aquí. «Detener y generar nota» NO se pulsa: llama al
   * modelo, y eso sí está bloqueado por fuera.
   *
   * De cada paso se comprueba lo mismo que del arranque: que el estado CAMBIÓ de
   * verdad (el cronómetro se congela al pausar y vuelve a correr al reanudar) y
   * que la pantalla no pierde accesibilidad por el camino.
   */
  const leerReloj = () => pag.evaluate(() => {
    // Cada cadena con forma de reloj, CON el elemento del que sale: en esta
    // pantalla hay varias (la hora de la cita, el reloj del sistema) y quedarse
    // con la primera del `innerText` puede estar leyendo cualquier otra cosa.
    const out = []
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue
      const t = (el.textContent || '').trim()
      if (/^\d{1,2}:\d{2}$/.test(t)) out.push(`${el.tagName}.${(typeof el.className === 'string' ? el.className.split(' ')[0] : '')}=${t}`)
    }
    return out.join(' | ')
  })
  const axeAhora = async (donde) => {
    await pag.addScriptTag({ content: AXE })
    const r = await pag.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
      return { total: r.violations.reduce((s,v)=>s+v.nodes.length,0),
               det: r.violations.flatMap(v => v.nodes.slice(0,2).map(n => `${v.id}[${v.impact}] ${n.html.slice(0,90)}`)) }
    })
    console.log(`AXE ${donde}: ${r.total}`)
    r.det.forEach(d => console.log('   ', d))
  }

  /**
   * Por NOMBRE ACCESIBLE, no por texto.
   *
   * Los controles de grabación son iconos con `aria-label` —«Pausar la
   * grabación», «Terminar la grabación»—, que es lo correcto. Un
   * `filter({ hasText })` mira el texto del elemento y no encuentra ninguno:
   * la sonda informó «no se encontró el control» de dos botones que estaban
   * ahí, con nombre y todo.
   */
  const pulsar = async (re) => {
    const b = pag.getByRole('button', { name: re }).first()
    if (!(await b.count().catch(() => 0))) return false
    await b.click().catch(() => {}); await pag.waitForTimeout(3500); return true
  }

  if (await pulsar(/pausar/i)) {
    const a = await leerReloj(); await pag.waitForTimeout(4000); const b = await leerReloj()
    console.log(`PAUSADO: reloj ${a} → ${b} ${a === b ? '(congelado, correcto)' : '(SIGUIÓ CORRIENDO)'}`)
    await axeAhora('pausado')
    if (await pulsar(/reanudar|continuar/i)) {
      const c = await leerReloj(); await pag.waitForTimeout(4000); const d = await leerReloj()
      console.log(`REANUDADO: reloj ${c} → ${d} ${c !== d ? '(vuelve a correr, correcto)' : '(SIGUE PARADO)'}`)
      await axeAhora('reanudado')
    } else console.log('REANUDAR: no se encontró el control')
  } else console.log('PAUSAR: no se encontró el control')

  if (await pulsar(/terminar la grabaci/i)) {
    await pag.waitForTimeout(3000)
    const tras = await pag.evaluate(() => [...document.querySelectorAll('button')]
      .map(b => (b.getAttribute('aria-label') || b.textContent || '').trim())
      .filter(t => /grabar|deten|pausa|reanud|termin/i.test(t)))
    console.log('TERMINADO · controles:', JSON.stringify(tras))
    /**
     * ¿QUÉ VE EL MÉDICO CUANDO LA TRANSCRIPCIÓN NO PUEDE HACERSE?
     *
     * Aquí no hay proveedor de ASR, así que la ruta contesta 503. Eso no es un
     * defecto del producto —es el límite del arnés— pero **lo que la pantalla
     * hace con ese 503 sí es del producto**, y es la pregunta cara: tras una
     * grabación, un fallo silencioso deja al médico sin saber si lo que dictó
     * existe en alguna parte.
     */
    // Los avisos se auto-descartan: si se mira una sola vez a los 6 s, uno que
    // duró 3 no existió. Se vigila el DOM desde el instante de detener.
    await pag.evaluate(() => {
      window.__avisos = []
      const ver = () => {
        for (const e of document.querySelectorAll('[role="alert"], [role="status"], [class*=toast]')) {
          const t = (e.textContent || '').trim()
          if (t && !window.__avisos.includes(t)) window.__avisos.push(t)
        }
      }
      ver()
      new MutationObserver(ver).observe(document.body, { childList: true, subtree: true, characterData: true })
    })
    await pag.waitForTimeout(12000)
    const vistos = await pag.evaluate(() => window.__avisos || [])
    console.log('AVISOS VIGILADOS 12s:', JSON.stringify(vistos))
    const despues = await pag.evaluate(() => ({
      avisos: [...document.querySelectorAll('[role="alert"], [role="status"], [class*=toast]')]
        .map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 6),
      dice: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
    }))
    console.log('TRAS EL 503 · avisos:', JSON.stringify(despues.avisos))
    // ¿Se pinta el error del grabador, o se ofrece recuperar el audio?
    const senales = await pag.evaluate(() => {
      const txt = (document.body.innerText || '')
      const busca = (re) => (txt.match(re) || [])[0] || null
      return {
        errorGrabador: busca(/no est[áa] configurad[oa][^\n]{0,60}/i)
          || busca(/no se pudo transcribir[^\n]{0,60}/i)
          || busca(/transcripci[óo]n[^\n]{0,40}(fall|error|no)[^\n]{0,40}/i),
        ofreceRecuperar: busca(/recuperar[^\n]{0,60}/i) || busca(/audio guardado[^\n]{0,60}/i),
        vuelveAOfrecerGrabar: /Grabar la conversaci[óo]n completa/.test(txt),
      }
    })
    console.log('SEÑALES AL MÉDICO:', JSON.stringify(senales))
    console.log('TRAS EL 503 · pantalla:', despues.dice.slice(0, 300))
    await axeAhora('tras terminar')
  } else console.log('TERMINAR: no se encontró el control')
}

console.log('errores de consola:', errores.length)
errores.slice(0,4).forEach(e => console.log('   ', e))
await nav.close()
