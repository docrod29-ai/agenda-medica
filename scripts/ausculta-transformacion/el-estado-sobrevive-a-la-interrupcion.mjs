/**
 * EL ESTADO SOBREVIVE A LA INTERRUPCIÓN — el eje que la regla nombra y nadie medía.
 *
 * `.claude/rules/design-system.md` cierra su lista de comprobaciones con «y se
 * comprueba que **el estado sobrevive**». Estaba escrito y no lo medía nadie: el
 * arnés miraba maquetación, contraste, foco y objetivos táctiles — no memoria.
 *
 * Y en un teléfono es lo que más pasa. Al médico lo interrumpen: sale a mirar la
 * agenda, el navegador mata la pestaña, alguien le llama. Si la nota a medio
 * dictar se pierde, no se pierde una pantalla: se pierde la consulta.
 *
 * ── LOS TRES ESCALONES, DE MENOS A MÁS DURO ─────────────────────────────────
 *
 *  1. **Salir y volver** — navegar a «Hoy» y regresar. Sobrevive lo que viva en
 *     memoria de la aplicación.
 *  2. **Recargar** — se pierde toda la memoria de la página. Sólo sobrevive lo
 *     que esté persistido.
 *  3. **Pestaña nueva** — ni siquiera comparte el estado de sesión de la
 *     anterior.
 *
 * ── LO MEDIDO EL 2-SEP-2026, a 390 px ───────────────────────────────────────
 *
 *     escribir el motivo + una tensión (128/84)
 *     salir a Hoy y volver   texto ✓   TA ✓   y avisa del borrador
 *     recargar               texto ✓   TA ✓   y avisa del borrador
 *     pestaña nueva          texto ✓   TA ✓
 *
 * Las tres pasan. El guion se deja **precisamente porque pasan**: este eje no
 * tenía instrumento, y lo que no se mide deja de ser cierto en el primer
 * refactor que cambie dónde vive el borrador.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Sólo la consulta. La receta, la orden y el editor de configuración tienen su
 *   propio estado y no se miran aquí.
 * · No comprueba QUÉ mecanismo lo persiste ni dónde: sólo que el dato vuelva.
 * · No prueba con la sesión cerrada, ni tras limpiar IndexedDB —que es lo que
 *   hace el cierre de sesión por `data-privacy.md`—, ni sin red.
 * · No es un iPhone: Chromium a 390 px. Safari desaloja pestañas con criterios
 *   propios.
 *
 * Todo lo que escribe es SINTÉTICO y va contra el emulador del arnés.
 *
 *   npm run arnes:emuladores · arnes:sembrar · arnes:dev
 *   node scripts/ausculta-transformacion/el-estado-sobrevive-a-la-interrupcion.mjs
 *
 * NO corre en CI: necesita emuladores y navegador.
 */
import { chromium } from 'playwright'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(String(e).slice(0, 100)))
await p.goto('http://localhost:3200/login', { waitUntil: 'domcontentloaded' })
await p.fill('input[type=email]', 'demo@nexusmed.test'); await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { timeout: 30000 }).catch(()=>{})
await p.waitForTimeout(1500)
for (let i = 0; i < 15; i++) {
  const d = p.locator('[role="dialog"][aria-label*="ienvenida"], .nx-tour-card')
  if (!(await d.count()) || !(await d.first().isVisible())) break
  const b = d.locator('button', { hasText: /Siguiente|Entendido|Empezar|Cerrar|Saltar|Listo|Omitir/i }).first()
  if (await b.count()) await b.click({ force: true }); else await p.keyboard.press('Escape')
  await p.waitForTimeout(450)
}
await p.goto('http://localhost:3200/consulta/pac-001', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(4000)

const MARCA = 'PRUEBA DE ESTADO — texto sintético que no corresponde a nadie'
// Se escribe en el primer campo de texto largo de la nota (motivo de consulta).
const area = p.locator('textarea').first()
const hay = await area.count()
if (!hay) { console.log(JSON.stringify({ error: 'no se encontró textarea en la consulta' })); await nav.close(); process.exit(0) }
await area.fill(MARCA)
// Y un signo vital, que es otro estado distinto.
const ta = p.locator('#signo-ta')
if (await ta.count()) await ta.fill('128/84')
await p.waitForTimeout(1200)

const antes = await p.evaluate(m => ({
  enTextarea: (document.querySelector('textarea')?.value || '').includes(m),
  ta: document.querySelector('#signo-ta')?.value ?? null,
}), MARCA)

// Salir a «Hoy» y volver — la interrupción típica.
await p.goto('http://localhost:3200/dashboard', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2500)
await p.goto('http://localhost:3200/consulta/pac-001', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(4500)

const despues = await p.evaluate(m => {
  const t = [...document.querySelectorAll('textarea')].map(e => e.value || '')
  return { enAlgunTextarea: t.some(v => v.includes(m)),
    ta: document.querySelector('#signo-ta')?.value ?? null,
    // ¿avisa de que había un borrador?
    mencionaBorrador: /borrador|sin guardar|recuperar|continuar/i.test(document.body.innerText) }
}, MARCA)

// EL CASO DURO: el navegador del teléfono mata la pestaña y el médico la
// reabre. Eso no es navegar: es perder toda la memoria de la página.
await p.reload({ waitUntil: 'domcontentloaded' })
await p.waitForTimeout(5000)
const trasRecargar = await p.evaluate(m => {
  const t = [...document.querySelectorAll('textarea')].map(e => e.value || '')
  return { enAlgunTextarea: t.some(v => v.includes(m)),
    ta: document.querySelector('#signo-ta')?.value ?? null,
    mencionaBorrador: /borrador|sin guardar|recuperar|continuar/i.test(document.body.innerText) }
}, MARCA)

// Y EL MÁS DURO: pestaña nueva, sin memoria de sesión de la anterior.
const p2 = await ctx.newPage()
await p2.goto('http://localhost:3200/consulta/pac-001', { waitUntil: 'domcontentloaded' })
await p2.waitForTimeout(5000)
const enPestanaNueva = await p2.evaluate(m => {
  const t = [...document.querySelectorAll('textarea')].map(e => e.value || '')
  return { enAlgunTextarea: t.some(v => v.includes(m)),
    ta: document.querySelector('#signo-ta')?.value ?? null }
}, MARCA)

console.log(JSON.stringify({ antes, despues, trasRecargar, enPestanaNueva, erroresDePagina: errs.slice(0, 3) }, null, 1))
await nav.close()
