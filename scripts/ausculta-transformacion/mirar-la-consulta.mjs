/**
 * MIRAR UNA PANTALLA DEL MÉDICO EN EL TELÉFONO.
 *
 * Sonda de OBSERVAR: no arregla nada, cuenta lo que hay. 390×844 por omisión,
 * que es un iPhone en Chromium — y Chromium NO es un iPhone.
 *
 * Nació mirando la consulta y se generalizó a la segunda pantalla, en vez de
 * copiarse: una sonda por pantalla son cinco sondas que divergen, y la que
 * mide de más gana por accidente.
 *
 *   node scripts/ausculta-transformacion/mirar-la-consulta.mjs \
 *        http://localhost:3200  <carpeta de salida>  [ancho]  [ruta]
 *
 * Necesita el arnés con emuladores (`arnes:emuladores` · `arnes:sembrar` ·
 * `arnes:dev`) y por eso NO corre en CI.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [base, salida, anchoStr, rutaArg] = process.argv.slice(2)
const ruta = rutaArg || '/consulta/pac-001'
const w = Number(anchoStr || 390)
mkdirSync(salida, { recursive: true })
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const ctx = await nav.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 },
  permissions: ['microphone'], hasTouch: w === 390, isMobile: w === 390 })
const p = await ctx.newPage()
const consola = []
p.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 160)) })
p.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 160)))

await p.goto(base + '/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(1500)
for (let i = 0; i < 15; i++) {
  const d = p.locator('[role="dialog"][aria-label*="ienvenida"]')
  if (!(await d.count()) || !(await d.first().isVisible())) break
  const b = d.locator('button', { hasText: /Siguiente|Entendido|Empezar|Cerrar|Saltar|Listo|Omitir/i }).first()
  if (await b.count()) await b.click({ force: true }); else await p.keyboard.press('Escape')
  await p.waitForTimeout(500)
}
await p.goto(base + ruta, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(3500)
for (let i = 0; i < 8; i++) {
  const d = p.locator('[role="dialog"][aria-label*="ienvenida"]')
  if (!(await d.count()) || !(await d.first().isVisible())) break
  await d.locator('button').last().click({ force: true }).catch(() => {})
  await p.waitForTimeout(400)
}
const nombre = ruta.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'raiz'
await p.screenshot({ path: `${salida}/${nombre}-${w}.png`, fullPage: false })

/**
 * ── EL RECORRIDO, PORQUE `fullPage` AQUÍ NO CAPTURA LA PÁGINA ───────────────
 *
 * El cascarón `(dashboard)` fija el documento al alto de la ventana y scrollea
 * un `<main>` de dentro. `fullPage: true` extiende el DOCUMENTO, y el documento
 * ya cabe: no tiene nada que extender.
 *
 * O sea que el archivo `…-completa.png` salía **byte a byte idéntico** al del
 * pliegue. Comprobado con `md5sum` en las cinco pantallas ya auditadas de esta
 * rama —consulta, expediente, citas, dashboard y pendientes—: las cinco. En
 * `/pendientes` eso era enseñar 844 px de 2 407: el 35 % de la pantalla, con un
 * nombre de archivo que prometía el 100 %.
 *
 * Y `document.documentElement.scrollHeight` decía 844 por el mismo motivo, así
 * que el número tampoco delataba nada.
 *
 * Es la familia «el dato tiene que LLEGAR» en la herramienta que audita: la
 * captura se tomó, se guardó, se miró — y no contenía lo que su nombre decía.
 * Peor que no tenerla, porque se mira y se da la pantalla por vista.
 *
 * No se apaña mutando el layout (poner `overflow: visible` para que el
 * documento crezca cambiaría lo que se está midiendo). Se recorre el scroller
 * de verdad y se guarda cada pantalla, que es lo que un humano mira.
 */
const altoReal = await p.evaluate(() => {
  const e = [...document.querySelectorAll('body *')].find(
    x => x.scrollHeight > x.clientHeight + 10 && ['auto', 'scroll'].includes(getComputedStyle(x).overflowY))
  return e ? e.scrollHeight : document.documentElement.scrollHeight
})
/** Deja el scroller —el de dentro si lo hay, si no la ventana— en `y`. */
const irA = y => p.evaluate(v => {
  const e = [...document.querySelectorAll('body *')].find(
    x => x.scrollHeight > x.clientHeight + 10 && ['auto', 'scroll'].includes(getComputedStyle(x).overflowY))
  if (e) e.scrollTop = v; else scrollTo(0, v)
}, y)
const alturaDeVentana = w === 390 ? 844 : 900
const pantallas = []
/* Se solapan 64 px entre pantallas: sin solape, una fila partida justo por el
   corte no se ve entera en ninguna de las dos. */
for (let i = 0, y = 0; i < 10 && y < altoReal; i++, y += alturaDeVentana - 64) {
  await irA(y)
  await p.waitForTimeout(400)
  const f = `${nombre}-${w}-recorrido-${i}.png`
  await p.screenshot({ path: `${salida}/${f}` })
  pantallas.push(f)
}
await irA(0)
await p.waitForTimeout(300)

const m = await p.evaluate(() => {
  const vis = e => { const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' }
  const controles = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]')].filter(vis)
  /**
   * Un elemento FUERA del orden de tabulación y de uno o dos píxeles no es un
   * objetivo táctil: es un auxiliar que abre un control visible de al lado (el
   * `input[type=date]` oculto de la agenda, REG-439). Contarlo era gritar en
   * falso, y una sonda que grita en falso se acaba ignorando — la lección de
   * REG-434. WCAG 2.5.8 habla de objetivos de PUNTERO; esto no lo es.
   */
  const auxiliarOculto = (e, r) => e.tabIndex < 0 && (r.width <= 2 || r.height <= 2)
  const chicos = controles.filter(e => {
    const r = e.getBoundingClientRect()
    if (auxiliarOculto(e, r)) return false
    return r.width < 44 || r.height < 44
  })
  /* Se marcan para poder MEDIRLOS de verdad en la segunda pasada (ver abajo):
     la caja no es el área de golpe. El atributo se retira al terminar. */
  chicos.forEach((e, i) => e.setAttribute('data-sonda-chico', String(i)))
  const nombre = e => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
  const noBoton = [...document.querySelectorAll('[onclick], [role="button"]')].filter(e => vis(e) && e.tagName !== 'BUTTON' && e.tagName !== 'A')
  const campos = [...document.querySelectorAll('input, select, textarea')].filter(vis)
  const sinEtiqueta = campos.filter(e => !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')
    && !(e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) && !e.closest('label'))
  return {
    alto: document.documentElement.scrollHeight,
    anchoScroll: document.documentElement.scrollWidth,
    desbordaH: document.documentElement.scrollWidth > window.innerWidth + 1,
    /**
     * LO QUE TERMINA FUERA DE LA VENTANA — y `desbordaH` NO lo ve.
     *
     * Un bloque puede acabar más allá del borde derecho sin que el documento
     * desborde: si algún ancestro tiene `overflow: hidden`, lo que sobra no se
     * puede alcanzar, se CORTA. Ahí no hay barra que arrastrar y la página
     * parece sana.
     *
     * Añadido tras REG-441, donde 24 bloques de la columna del editor de la
     * receta terminaban en x = 396 con la ventana en 390 y `desbordaH` decía
     * `false`. La medición que encuentra el defecto tiene que vivir en la sonda,
     * no en un guion de usar y tirar.
     */
    terminanFueraDeLaVentana: (() => {
      const vw = window.innerWidth
      const fuera = [...document.querySelectorAll('body *')].filter(e => {
        if (!vis(e)) return false
        const r = e.getBoundingClientRect()
        return r.right > vw + 1 && r.width > 40 && (e.innerText || '').trim().length > 0
      })
      return { cuantos: fuera.length, ejemplos: fuera.slice(0, 5).map(e => {
        const r = e.getBoundingClientRect()
        return `${nombre(e)} · der ${Math.round(r.right)} (se sale ${Math.round(r.right - vw)})`
      }) }
    })(),
    controlesVisibles: controles.length,
    candidatosChicos: chicos.length,
    interactivosQueNoSonBoton: noBoton.length,
    camposSinEtiqueta: sinEtiqueta.length,
    ejemplosSinEtiqueta: sinEtiqueta.slice(0, 8).map(nombre),
    pestanas: [...document.querySelectorAll('[role="tab"]')].filter(vis).map(e => e.innerText.trim().slice(0, 24)),
    encabezados: [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(e => e.tagName + ' ' + e.innerText.trim().slice(0, 44)).slice(0, 24),
    hayH1: document.querySelectorAll('h1').length,
    // ¿cuánto de la primera pantalla es cabecera/navegación en vez de trabajo?
    primeraPantalla: [...document.querySelectorAll('body *')].filter(e => {
      const r = e.getBoundingClientRect(); return vis(e) && r.top < 200 && r.height > 20 && r.width > 200
    }).length,
  }
})
/**
 * ── SEGUNDA PASADA: EL ÁREA DE GOLPE, NO LA CAJA ────────────────────────────
 *
 * `getBoundingClientRect` **no puede ver el pseudo** que estira el área táctil.
 * `globals.css` tiene, bajo `@media (pointer: coarse)`, una familia de enlaces
 * —`a.nx-ident`, `.nx-cta-aviso`, `.nx-enlace-tactil`, `.cita-principal`— que
 * llegan a 44 px al dedo sin mover un píxel de lo que se ve (REG-442). Medidos
 * por su caja salen a 20 y la sonda los denunciaba.
 *
 * En `/pendientes` eso eran **siete de siete**: el nombre del paciente que
 * encabeza cada pendiente es `a.nx-ident`, ya cubierto, y la sonda pedía
 * arreglar lo que ya estaba arreglado. Un número que es cien por ciento ruido
 * no se lee — y la vez que traiga un objetivo pequeño de verdad, tampoco.
 *
 * ── POR QUÉ NO SE FILTRA POR CLASE ──────────────────────────────────────────
 *
 * Lo barato era «no cuentes `a.nx-ident`». Eso es CREERLE al CSS: el día que
 * alguien saque esa clase de la familia, o mueva la regla fuera de la media
 * query, la sonda seguiría callada y el enlace volvería a tocarse en 20 px.
 * Aquí se le pregunta al navegador a quién atribuye cada punto —el mismo
 * barrido de `el-area-de-golpe-de-una-fila-de-cita.mjs`—, así que el mecanismo
 * roto reaparece en la cuenta solo.
 *
 * ── LAS DOS TRAMPAS DE MEDIR ASÍ (REG-442, pagadas ya una vez) ──────────────
 *
 * · `elementFromPoint` sólo ve DENTRO de la ventana: fuera devuelve `null` y el
 *   barrido mide cero. Cada candidato se trae a la vista antes.
 * · Lo que no se pueda medir **no se descuenta**: sale en `noMedidos`. Un
 *   candidato que desaparece del DOM entre las dos pasadas no puede convertirse
 *   en un aprobado silencioso.
 */
const golpes = []
const noMedidos = []
for (let i = 0; i < m.candidatosChicos; i++) {
  const sel = `[data-sonda-chico="${i}"]`
  const hay = await p.evaluate(s => {
    const e = document.querySelector(s); if (!e) return false
    e.scrollIntoView({ block: 'center', behavior: 'instant' }); return true
  }, sel)
  if (!hay) { noMedidos.push(i); continue }
  await p.waitForTimeout(60)
  const r = await p.evaluate(s => {
    const el = document.querySelector(s); if (!el) return null
    const b = el.getBoundingClientRect()
    if (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) return null
    const cx = Math.round(b.left + b.width / 2), cy = Math.round(b.top + b.height / 2)
    /**
     * EL PUNTO CUENTA SÓLO SI TOCA AL ELEMENTO O A ALGO SUYO.
     *
     * La primera versión aceptaba también `h.contains(el)` —o sea, al PADRE— y
     * el barrido se derramaba por la tarjeta entera: un enlace de 20 px medía
     * 59 de golpe y la sonda lo absolvía. Una medición que aprueba de más es
     * peor que la que gritaba en falso: aquélla molestaba, ésta esconde.
     */
    const esEl = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)) }
    let arr = cy, aba = cy, izq = cx, der = cx
    for (let y = cy; y > b.top - 40 && y > 0; y--) { if (!esEl(cx, y)) break; arr = y }
    for (let y = cy; y < b.bottom + 40 && y < innerHeight; y++) { if (!esEl(cx, y)) break; aba = y }
    for (let x = cx; x > b.left - 40 && x > 0; x--) { if (!esEl(x, cy)) break; izq = x }
    for (let x = cx; x < b.right + 40 && x < innerWidth; x++) { if (!esEl(x, cy)) break; der = x }
    const nom = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName)
      .trim().replace(/\s+/g, ' ').slice(0, 40)
    return { nom, cajaW: Math.round(b.width), cajaH: Math.round(b.height),
      golpeW: der - izq + 1, golpeH: aba - arr + 1 }
  }, sel)
  if (!r) { noMedidos.push(i); continue }
  golpes.push(r)
}
await p.evaluate(() => document.querySelectorAll('[data-sonda-chico]')
  .forEach(e => e.removeAttribute('data-sonda-chico')))

const chicosDeVerdad = golpes.filter(g => g.golpeW < 44 || g.golpeH < 44)
/* Los que la CAJA denunciaba y el GOLPE absuelve. Se enseñan en vez de
   callarse: son la prueba de que el mecanismo de REG-442 está puesto, y el día
   que esta lista se vacíe sola habrá que preguntarse por qué. */
const salvadosPorElPseudo = golpes.filter(g => (g.cajaW < 44 || g.cajaH < 44) && g.golpeW >= 44 && g.golpeH >= 44)

console.log(JSON.stringify({
  ruta, ancho: w, ...m,
  /* El alto de VERDAD: el del scroller interno, no el del documento — que en
     este cascarón siempre mide una ventana. Ver el recorrido, arriba. */
  altoReal, pantallasDelRecorrido: pantallas.length, pantallas,
  objetivosChicos: chicosDeVerdad.length,
  ejemplosChicos: chicosDeVerdad.slice(0, 12)
    .map(g => `${g.nom} caja ${g.cajaW}x${g.cajaH} · golpe ${g.golpeW}x${g.golpeH}`),
  salvadosPorElPseudo: salvadosPorElPseudo.length,
  ejemplosSalvados: salvadosPorElPseudo.slice(0, 6)
    .map(g => `${g.nom} caja ${g.cajaW}x${g.cajaH} → golpe ${g.golpeW}x${g.golpeH}`),
  /* NO se descuentan: un candidato que no se pudo medir no es un aprobado. */
  noMedidos: noMedidos.length,
  erroresDeConsola: consola.slice(0, 10),
}, null, 2))
await nav.close()
