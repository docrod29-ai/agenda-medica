/**
 * VERIFICACIÓN EN NAVEGADOR REAL — V15-VISUAL-SYSTEM-001 (Fase 10, novena
 * rebanada: MOTION §18 pasos 8-9 medido, no leído). §40 Real Browser
 * Requirement.
 *
 * Lo que la hoja no puede apagar, medido de verdad: `scrollIntoView` con
 * `behavior` de JavaScript ignora el `scroll-behavior: auto !important` del
 * apagador global de §24. El arreglo (`comportamientoScroll()` en
 * `src/lib/ui/movimiento.ts`) se mide aquí con `emulateMedia`:
 *
 *   1. Con `reducedMotion: 'reduce'`: clic en un botón del ClinicalSpine →
 *      el destino tiene que estar YA en su sitio ~80ms después (salto
 *      directo), y no moverse más entre 80ms y 680ms.
 *   2. Con `reducedMotion: 'no-preference'`: el mismo clic sigue ANIMANDO
 *      (a 80ms el destino aún viaja) y LLEGA (~900ms) — la equivalencia
 *      funcional: quitar el defecto no quitó el desplazamiento suave de
 *      quien no pidió menos movimiento.
 *   3. El apagador CSS de §24 sigue vivo, medido con getComputedStyle:
 *      `.page-transition` pinta animation-duration 0.01ms bajo reduce.
 *   4. El marco de escucha (simulado con el MISMO CustomEvent `nx:grabando`
 *      de `avisarEscucha()`) queda FIJO bajo reduce — dos muestras de
 *      box-shadow separadas 1.3s son idénticas: apagar la animación no
 *      apagó la información de que el micrófono está abierto.
 *
 * Nota de honestidad: si el documento del expediente sembrado es demasiado
 * corto para que el salto del spine recorra >100px, la medición del punto 2
 * (animación en vuelo a 80ms) se declara NO CONCLUYENTE en el JSON en vez de
 * fingirse medida. Este arnés no corre axe: el cambio no añade ni quita un
 * solo nodo del DOM (sólo cambia el CÓMO del desplazamiento), y la octava
 * rebanada ya midió axe de estas mismas pantallas sin cambios de DOM desde
 * entonces.
 *
 * Uso (dentro de emulators:exec, igual que sus hermanos):
 *   node_modules/.bin/firebase emulators:exec --only auth,firestore \
 *     --project demo-nexusmed-test \
 *     "bash scripts/design/arnes-breakpoints-v15.sh scripts/design/medir-motion-reduced-v15.mjs"
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.CAPTURA_BASE_URL || 'http://localhost:3000'
const DESTINO = process.argv[2] || 'docs/design/capturas/v15-motion-reduced'
const EMAIL = 'medico@capturas.demo'
const PASSWORD = 'captura-v10-demo'
const PUSH_DISMISS_KEY = 'agenda-medica:push-dismissed'
const PACIENTE = 'pac-refugio-alcantara'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

/** Clic en el último botón del spine y tres lecturas del scroll del
 *  contenedor real (`<main>`): antes, ~80ms después, ~680ms después.
 *  Se mide `scrollTop` — no el rect del destino — porque las secciones del
 *  expediente cargan asíncronas y un empujón de layout movería el rect sin
 *  que nadie haya desplazado nada (le pasó a la primera corrida de este
 *  arnés). Antes de medir se espera a que el documento sea DESPLAZABLE:
 *  medir un salto en una página que aún no puede desplazarse mide la carga,
 *  no el movimiento. */
async function medirSalto(page) {
  return page.evaluate(async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms))
    const scroller = document.querySelector('main') || document.scrollingElement
    // Hasta 8s a que las secciones asíncronas den altura suficiente.
    for (let i = 0; i < 80 && scroller.scrollHeight - scroller.clientHeight < 150; i++) await espera(100)
    if (scroller.scrollHeight - scroller.clientHeight < 150) return { error: 'el documento nunca fue desplazable >150px' }
    const botones = [...document.querySelectorAll('nav.nx-clinical-spine button')]
    if (botones.length === 0) return { error: 'sin botones de spine' }
    const boton = botones[botones.length - 1]
    const etiqueta = boton.textContent
    scroller.scrollTop = 0
    await espera(200)
    const antes = scroller.scrollTop
    boton.click()
    await espera(80)
    const a80 = scroller.scrollTop
    await espera(600)
    const a680 = scroller.scrollTop
    return { etiqueta, antes, a80, a680, recorrido: Math.abs(a680 - antes) }
  })
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })
  // El contenedor trae Chromium preinstalado en /opt/pw-browsers/chromium;
  // si la versión de @playwright/test pide otra carpeta versionada, se usa
  // el ejecutable fijo en vez de descargar un navegador nuevo.
  const browser = await chromium.launch(
    fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
  )
  const resultado = { fecha: new Date().toISOString(), base: BASE }
  const errores = []

  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await contexto.newPage()
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()) })
  await page.addInitScript(k => localStorage.setItem(k, '1'), PUSH_DISMISS_KEY)

  await login(page)

  // ── 1+3+4: con reduced motion ─────────────────────────────────────────────
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${BASE}/expediente/${PACIENTE}`, { waitUntil: 'load' })
  await page.waitForSelector('nav.nx-clinical-spine button', { timeout: 20000 })

  resultado.apagadorCss = await page.evaluate(() => {
    const el = document.querySelector('.page-transition')
    if (!el) return { error: 'sin .page-transition' }
    const s = getComputedStyle(el)
    return { animationDuration: s.animationDuration }
  })

  const reduce = await medirSalto(page)
  resultado.conReduce = {
    ...reduce,
    saltoInstantaneo: !reduce.error && Math.abs(reduce.a80 - reduce.a680) < 2 && Math.abs(reduce.antes - reduce.a80) > 2,
  }

  // El marco de escucha fijo (simulación por evento, como la octava rebanada).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: true } })))
  await page.waitForTimeout(400)
  resultado.marcoFijo = await page.evaluate(async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms))
    const marco = document.querySelector('.nx-marco-escuchando')
    if (!marco) return { presente: false, nota: 'el marco no se monta en esta pantalla — medición no aplicable aquí' }
    const m1 = getComputedStyle(marco).boxShadow
    await espera(1300)
    const m2 = getComputedStyle(marco).boxShadow
    return { presente: true, fijo: m1 === m2, m1, m2 }
  })
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('nx:grabando', { detail: { activo: false } })))

  // ── 2: sin preferencia, el suave sigue vivo y LLEGA ──────────────────────
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(`${BASE}/expediente/${PACIENTE}`, { waitUntil: 'load' })
  await page.waitForSelector('nav.nx-clinical-spine button', { timeout: 20000 })
  const suave = await medirSalto(page)
  const concluyente = !suave.error && suave.recorrido > 100
  resultado.sinPreferencia = {
    ...suave,
    concluyente,
    enVueloA80: concluyente ? Math.abs(suave.a80 - suave.a680) > 2 : null,
    llega: !suave.error && Math.abs(suave.antes - suave.a680) > 2,
    nota: concluyente ? undefined : 'recorrido <=100px: la fase en vuelo no es medible con fiabilidad en este documento',
  }

  await page.screenshot({ path: path.join(DESTINO, 'expediente-tras-salto.png') })
  resultado.erroresConsola = errores

  await browser.close()
  fs.writeFileSync(path.join(DESTINO, 'resultado.json'), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
