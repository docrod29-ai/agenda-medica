/**
 * EL ÁREA DE GOLPE DE UNA FILA DE CITA — cuánto mide de verdad al dedo.
 *
 * Mide con hit-testing (`elementFromPoint`, barrido de 1 px) el alto EFECTIVO de
 * las filas de «Agenda de hoy», que es distinto de su alto visible: el mecanismo
 * de `globals.css` estira el área de golpe con un pseudo invisible y no mueve un
 * píxel de lo que se ve.
 *
 * Nació con REG-442, y con TRES trampas que costaron media hora y quedan
 * cerradas aquí para que no se repitan:
 *
 *  1. **El recorrido de bienvenida tapaba las filas.** El hit-testing contestaba
 *     `DIV.nx-tour-card` y parecía que el arreglo no servía. Se cierra antes.
 *     (El arnés `capturar-tactiles-de-enlace-v15` lo apaga por `localStorage`,
 *     que es más limpio; aquí se cierra a clics porque comparte la siembra de
 *     `arnes:sembrar`, que no fija esa clave.)
 *  2. **Las filas están BAJO EL PLIEGUE.** `elementFromPoint` sólo ve dentro de
 *     la ventana y devuelve `null` fuera: un barrido sobre una fila que no está
 *     a la vista mide cero y miente. Cada fila se trae a la vista antes.
 *  3. **`getBoundingClientRect` no ve el pseudo.** Medir la caja del enlace da
 *     39 y seguirá dando 39 con el arreglo puesto: lo que cambia es a quién
 *     atribuye el navegador un punto, y eso sólo se sabe preguntándoselo.
 *
 * POR QUÉ NO SE AÑADIÓ AL ARNÉS QUE YA EXISTE: `capturar-tactiles-de-enlace-v15`
 * usa su propia siembra y sus propias credenciales (`medico@capturas.demo`), que
 * este contenedor no tiene. Se intentó, no se pudo ejecutar, y se retiró en vez
 * de dejar ahí código sin probar.
 *
 *   npm run arnes:emuladores · arnes:sembrar · arnes:dev
 *   node scripts/ausculta-transformacion/el-area-de-golpe-de-una-fila-de-cita.mjs
 *
 * NO corre en CI: necesita emuladores y navegador.
 */
import { chromium } from 'playwright'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
await p.goto('http://localhost:3200/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test'); await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(()=>{})
await p.waitForTimeout(1500)
// EL RECORRIDO DE BIENVENIDA TAPA LAS FILAS. Sin cerrarlo, el hit-testing
// contesta `DIV.nx-tour-card` y parece que el arreglo no sirve. Tercera vez que
// este modal contamina una medición en esta rama.
for (let i = 0; i < 15; i++) {
  const d = p.locator('[role="dialog"][aria-label*="ienvenida"], .nx-tour-card')
  if (!(await d.count()) || !(await d.first().isVisible())) break
  const b = d.locator('button', { hasText: /Siguiente|Entendido|Empezar|Cerrar|Saltar|Listo|Omitir/i }).first()
  if (await b.count()) await b.click({ force: true }); else await p.keyboard.press('Escape')
  await p.waitForTimeout(450)
}
await p.waitForTimeout(1500)
const n = await p.evaluate(() => document.querySelectorAll('.cita-principal').length)
const out = []
for (let i = 0; i < Math.min(n, 6); i++) {
  // LA FILA SE TRAE A LA VISTA ANTES DE MEDIR: elementFromPoint sólo ve dentro
  // de la ventana, y devuelve null fuera — un barrido sobre una fila bajo el
  // pliegue mide cero y parece que el arreglo no sirve.
  await p.evaluate(k => document.querySelectorAll('.cita-principal')[k]
    .scrollIntoView({ block: 'center', behavior: 'instant' }), i)
  await p.waitForTimeout(120)
  out.push(await p.evaluate(k => {
    const el = document.querySelectorAll('.cita-principal')[k]
    const b = el.getBoundingClientRect(); const x = Math.round(b.left + b.width / 2)
    const esEl = y => { const h = document.elementFromPoint(x, y); return !!h && h.closest('.cita-principal') === el }
    let arriba = Math.round(b.top) + 1, abajo = Math.round(b.bottom) - 1
    for (let y = arriba; y > b.top - 30; y--) { if (!esEl(y)) break; arriba = y }
    for (let y = abajo; y < b.bottom + 30; y++) { if (!esEl(y)) break; abajo = y }
    const q = y => { const h = document.elementFromPoint(x, y)
      return h ? h.tagName + '.' + (h.className||'').toString().split(' ')[0] : 'null' }
    return { visible: Math.round(b.height), golpe: abajo - arriba + 1,
      posicionDelEnlace: getComputedStyle(el).position,
      aTresAbajo: q(Math.round(b.bottom) + 3), aUnoAbajo: q(Math.round(b.bottom) + 1),
      texto: (el.innerText||'').trim().replace(/\s+/g,' ').slice(0, 24) }
  }, i))
}
console.log(JSON.stringify(out, null, 1))
await nav.close()
