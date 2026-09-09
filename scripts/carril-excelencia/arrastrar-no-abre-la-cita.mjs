/**
 * ARRASTRAR NO ABRE LA CITA — el `click` que viene después del `pointerup`.
 *
 * QUÉ LO TRAJO
 * ────────────
 * La primera vez que se MIRÓ el arrastre en un navegador, en vez de leerlo. El
 * código decía lo correcto: al soltar un gesto que de verdad movió el puntero
 * se llama a `e.stopPropagation()` y no se abre la cita. Y aun así, al soltar
 * sobre una hora ocupada, la pantalla enseñaba las dos cosas a la vez — el
 * aviso «Ahí no cabe (09:00 – 09:30)» Y el diálogo «Editar cita» encima.
 *
 * La causa: `stopPropagation` sobre `pointerup` no cancela el `click`. El
 * navegador manda el `click` DESPUÉS, como evento aparte; detener la
 * propagación de uno no dice nada del otro. Leyendo el diff se ve bien.
 *
 * Por qué importa más de lo que parece: el médico arrastra una cita porque el
 * paciente está al teléfono. Que al soltar se le abra un formulario encima —con
 * «Guardar cambios» y una hora que él no eligió— es exactamente el momento en
 * que se guarda algo sin querer.
 *
 * QUÉ COMPRUEBA
 * ─────────────
 *  1. Un clic limpio SÍ abre «Editar cita». Sin este caso, un bloque muerto
 *     pasaría los demás.
 *  2. Arrastrar y soltar NO abre el diálogo.
 *  3. Y el arrastre HIZO algo: o la cita cambió de hora, o salió el aviso de
 *     que ahí no cabe. Un gesto que no abre nada y tampoco mueve nada no está
 *     arreglado: está roto de otra manera.
 *  4. AL REVÉS — un movimiento POR DEBAJO del umbral de 4 px sigue siendo un
 *     clic y abre la cita. Es lo que separa «no abre tras arrastrar» de «ya no
 *     abre nunca», que sería un defecto peor que el original.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo Chromium.** No hay WebKit en este entorno: esto no prueba iPhone ni
 *   el gesto táctil real, que tiene su propio retardo de clic.
 * · Sólo la vista de SEMANA. La de día y la de mes no arrastran hoy.
 * · No juzga a qué hora cae la cita: eso es aritmética y la sellan los goldens
 *   `arrastrar-una-cita-la-deja-pegada-a-la-anterior` y
 *   `el-raton-y-el-teclado-mueven-la-cita-al-mismo-sitio`.
 * · Deja la agenda sintética movida. Se resiembra antes de la siguiente medición.
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
await p.waitForURL(/dashboard|citas|calendario/, { timeout: 30000 })
try {
  await p.getByRole('button', { name: 'Saltar', exact: true }).first().click({ timeout: 6000 })
  await p.waitForTimeout(1200)
} catch { /* el tour ya estaba visto */ }

await p.goto(BASE + '/calendario')
await p.waitForSelector('.nx-agenda-bloque', { timeout: 30000 })
await p.waitForTimeout(1500)

const fallos = []
const caso = (ok, texto) => { console.log(`  ${ok ? '·' : '✗'} ${texto}`); if (!ok) fallos.push(texto) }

/** ¿Está abierto el formulario de la cita? */
const hayDialogo = () => p.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-modal="true"]')
  return !!d && /Editar cita/.test(d.textContent || '')
})

/** El aviso de que ahí no cabe, si salió. */
const hayAviso = () => p.evaluate(() => /Ahí no cabe/.test(document.body.innerText))

const cerrarSiAbierto = async () => {
  if (await hayDialogo()) { await p.keyboard.press('Escape'); await p.waitForTimeout(800) }
}

/** La hora que enseña un bloque, para saber si de verdad se movió. */
const horaDelBloque = i => p.evaluate(n => {
  const b = document.querySelectorAll('.nx-agenda-bloque')[n]
  return b ? (b.getAttribute('title') || '') : ''
}, i)

/** Arrastra el bloque `i` `dy` píxeles hacia abajo. */
async function arrastrar(i, dy) {
  const c = await p.locator('.nx-agenda-bloque').nth(i).boundingBox()
  const x = c.x + c.width / 2
  const y = c.y + c.height / 2
  await p.mouse.move(x, y)
  await p.mouse.down()
  // En pasos, como una mano. El paso intermedio NO puede pasarse de `dy`: con
  // un salto fijo de 8 px, el caso «temblor de 2 px» cruzaría el umbral por
  // culpa del arnés y mediría lo contrario de lo que dice medir.
  await p.mouse.move(x, y + Math.sign(dy) * Math.min(8, Math.abs(dy)), { steps: 4 })
  await p.mouse.move(x, y + dy, { steps: 10 })
  await p.waitForTimeout(400)
  await p.mouse.up()
  await p.waitForTimeout(2200)
}

// ── 1 · un clic limpio abre la cita ──────────────────────────────────────────
await p.locator('.nx-agenda-bloque').first().click()
await p.waitForTimeout(1500)
caso(await hayDialogo(), 'un clic limpio abre «Editar cita»')
await cerrarSiAbierto()

// ── 2 y 3 · arrastrar no abre, pero sí hace algo ─────────────────────────────
const antes = await horaDelBloque(0)
await arrastrar(0, 55)
const abrio = await hayDialogo()
caso(!abrio, 'arrastrar y soltar NO abre «Editar cita»')
await cerrarSiAbierto()
const despues = await horaDelBloque(0)
const aviso = await hayAviso()
caso(aviso || despues !== antes,
  `el arrastre hizo algo: ${aviso ? 'avisó de que ahí no cabe' : `movió la cita (${antes.slice(0, 40)} → ${despues.slice(0, 40)})`}`)

// ── 4 · AL REVÉS — por debajo del umbral sigue siendo un clic ────────────────
await p.waitForTimeout(1500)
await arrastrar(0, 2)
caso(await hayDialogo(), 'un temblor de 2 px sigue siendo un clic y abre la cita')
await cerrarSiAbierto()

await nav.close()
console.log(fallos.length === 0
  ? '\n  Arrastrar mueve; soltar no abre nada que el médico no pidió.'
  : `\n  ${fallos.length} fallo(s). Soltar un arrastre abre un formulario con «Guardar cambios» encima.`)
process.exit(fallos.length === 0 ? 0 : 1)
