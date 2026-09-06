/**
 * LA CONFIRMACIÓN NO SE DISPARA SOLA — el teclado del diálogo destructivo.
 *
 * QUÉ LO TRAJO
 * ────────────
 * Auditando el teclado del producto (unidad 99). El diálogo de `confirm()` —el
 * que pregunta «¿Eliminar esta cita permanentemente?» y el que gobierna TODA
 * confirmación destructiva de la aplicación— tenía el teclado escrito a mano y
 * le faltaba la trampa de foco.
 *
 * Medido en Chromium el 2-sep, con el diálogo abierto:
 *
 *   · **cinco tabulaciones sacaban el foco del diálogo** y lo dejaban en el
 *     enlace «Encuentro» de la navegación de detrás — a pesar del
 *     `aria-modal="true"`, que le promete a la tecnología de apoyo que lo de
 *     atrás está inerte;
 *   · y el Enter estaba atado a la VENTANA, así que pulsarlo sobre ese enlace,
 *     creyendo que se navegaba, **borraba la cita**: la lista pasó de 7 a 6.
 *
 * Una tecla apuntada a otra cosa ejecutando un acto destructivo e irreversible
 * es lo más caro que puede hacer justo el diálogo que existe para que nada se
 * borre sin querer.
 *
 * QUÉ COMPRUEBA
 * ─────────────
 *  1. El foco entra al diálogo al abrirse, y entra en el botón SEGURO.
 *  2. Ninguna tabulación —ni hacia delante ni hacia atrás— lo saca.
 *  3. Escape cierra sin borrar.
 *  4. Enter con el foco en «Cancelar» NO borra. Es la prueba del atajo: si el
 *     Enter volviera a la ventana, aquí borraría mientras el médico cancela.
 *  5. Enter con el foco en el botón destructivo SÍ borra. Sin este caso, un
 *     diálogo que no confirma nunca pasaría los cuatro anteriores.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo Chromium.** No hay WebKit en este entorno: esto no prueba iPhone.
 * · Sólo el diálogo de `confirm()`. Los demás los mide
 *   `todo-dialogo-se-cierra-con-escape`, y los que ninguno de los dos sabe
 *   abrir NO se vigilan.
 * · No dice nada de lectores de pantalla reales: mide dónde está el foco, no
 *   lo que alguien oye.
 * · Deja la agenda con una cita menos. Es un arnés sobre datos sintéticos:
 *   se resiembra antes de la siguiente medición.
 */
import { chromium } from 'playwright'

const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'

const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()

await p.goto(BASE + '/login')
await p.fill('input[type=email]', 'demo@nexusmed.test')
await p.fill('input[type=password]', 'demo1234')
await p.click('button[type=submit]')
await p.waitForURL(/dashboard|citas/, { timeout: 30000 })
try {
  await p.getByRole('button', { name: 'Saltar', exact: true }).first().click({ timeout: 6000 })
  await p.waitForSelector('text=BIENVENIDO A AUSCULTA', { state: 'detached', timeout: 6000 })
} catch { /* el tour ya estaba visto */ }

const citas = () => p.evaluate(() => document.querySelectorAll('button[aria-label^="Más acciones"]').length)

/** Abre el menú de la primera cita y pide borrarla. Devuelve cuántas había. */
async function pedirBorrar() {
  await p.goto(BASE + '/citas')
  await p.waitForTimeout(2500)
  const antes = await citas()
  await p.locator('button[aria-label^="Más acciones"]').first().click()
  await p.waitForTimeout(600)
  await p.locator('[role="menu"] button', { hasText: 'Eliminar cita' }).first().click()
  await p.waitForTimeout(900)
  return antes
}

const estado = () => p.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-modal="true"]')
  const a = document.activeElement
  return {
    hay: !!d,
    dentro: !!(d && a && d.contains(a)),
    foco: a ? (a.textContent || '').trim().slice(0, 24) : 'ninguno',
  }
})

const fallos = []
const caso = (ok, texto) => { console.log(`  ${ok ? '·' : '✗'} ${texto}`); if (!ok) fallos.push(texto) }

// ── 1 · el foco entra, y entra en el botón seguro ────────────────────────────
let antes = await pedirBorrar()
let e = await estado()
caso(e.hay, 'el diálogo se abre')
caso(e.dentro, `el foco entra al diálogo (está en «${e.foco}»)`)
caso(!/elimin|borrar/i.test(e.foco), `el foco NO empieza en el botón destructivo (está en «${e.foco}»)`)

// ── 2 · ninguna tabulación lo saca ───────────────────────────────────────────
let fugas = 0
for (let i = 0; i < 20; i++) { await p.keyboard.press('Tab'); if (!(await estado()).dentro) fugas++ }
for (let i = 0; i < 20; i++) { await p.keyboard.press('Shift+Tab'); if (!(await estado()).dentro) fugas++ }
caso(fugas === 0, `40 tabulaciones y el foco no se va (fugas: ${fugas})`)

// ── 3 · Escape cierra sin borrar ─────────────────────────────────────────────
await p.keyboard.press('Escape')
await p.waitForTimeout(900)
caso(!(await estado()).hay, 'Escape cierra el diálogo')
caso((await citas()) === antes, `Escape NO borra (${antes} citas antes y después)`)

// ── 4 · Enter sobre «Cancelar» no borra ──────────────────────────────────────
antes = await pedirBorrar()
await p.locator('[role="dialog"] button', { hasText: 'Cancelar' }).first().focus()
await p.keyboard.press('Enter')
await p.waitForTimeout(1200)
const trasCancelar = await citas()
caso(!(await estado()).hay, 'Enter sobre «Cancelar» cierra el diálogo')
caso(trasCancelar === antes, `Enter sobre «Cancelar» NO borra (${antes} → ${trasCancelar})`)

// ── 5 · Enter sobre el botón destructivo sí borra ────────────────────────────
antes = await pedirBorrar()
await p.locator('[role="dialog"] button', { hasText: 'Eliminar' }).first().focus()
await p.keyboard.press('Enter')
await p.waitForTimeout(1500)
const trasEliminar = await citas()
caso(trasEliminar === antes - 1, `Enter sobre «Eliminar» sí borra (${antes} → ${trasEliminar})`)

await nav.close()
console.log(fallos.length === 0
  ? '\n  La confirmación destructiva no se dispara sola.'
  : `\n  ${fallos.length} fallo(s). El diálogo que existe para que nada se borre sin querer, borra sin querer.`)
process.exit(fallos.length === 0 ? 0 : 1)
