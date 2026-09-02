#!/usr/bin/env node
/**
 * CANCELAR UNA CITA, PULSANDO DE VERDAD.
 *
 * El `confirm()` nativo que había aquí no se ve en una captura: se ve
 * DISPARÁNDOLO. Este guion pulsa «Cancelar» y cuenta los diálogos nativos que
 * el navegador levanta —tienen que ser cero—, fotografía la confirmación que
 * los sustituye y comprueba sus tres salidas.
 *
 * **No confirma la cancelación.** Se recorre el camino hasta el borde y se
 * vuelve: mutar la cita sembrada cambiaría lo que miden las capturas de después.
 * La mutación en sí ya la cubre `portal-estados`.
 *
 * Token de alcance AGENDA a propósito: las citas viven en el cubo general
 * (40/10 min) y no en el clínico (15/10 min), que es el que se agota midiendo.
 *
 *   PORTAL_PACIENTE_SECRET=… node scripts/ausculta-transformacion/cancelar-una-cita.mjs <base> <salida>
 */
import { chromium } from 'playwright'
import { tokenDelPortal } from '../carril-excelencia/token-del-portal.mjs'

const BASE = process.argv[2] ?? 'http://localhost:3200'
const SALIDA = process.argv[3] ?? 'docs/audit/ausculta-transformacion/portal'
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const TOKEN = tokenDelPortal('agenda')
if (!TOKEN) { console.error('Falta PORTAL_PACIENTE_SECRET'); process.exit(2) }

const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
const pag = await ctx.newPage()
const nativos = []
pag.on('dialog', d => { nativos.push(`${d.type()}: ${d.message()}`); d.dismiss() })
await pag.goto(`${BASE}/mi/${TOKEN}`, { waitUntil: 'domcontentloaded' })
await pag.waitForSelector('nav[aria-label="Secciones"]', { timeout: 60000 })
await pag.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
const cuenta = s => pag.locator(s).count()
/* `\s*` a los lados y no `^Cancelar$`: el botón lleva un icono delante, así que
   su `textContent` es « Cancelar» con un espacio. Con la expresión pegada, el
   arnés no encontraba un botón que estaba en pantalla — y la primera lectura
   fue «no existe» en vez de «lo estoy buscando mal». */
const cancelar = pag.locator('main button').filter({ hasText: /^\s*Cancelar\s*$/ }).first()
/* Se ESPERA a la cita, no se cuenta a ciegas: la lista se pinta cuando vuelve
   la sesión, y contar antes daba cero y parecía que el botón no existía. */
await cancelar.waitFor({ state: 'visible', timeout: 30000 }).catch(async () => {
  console.error('\n  No apareció la cita. Lo que hay en pantalla:')
  console.error((await pag.evaluate(() => document.querySelector('main')?.innerText) ?? '').slice(0, 500))
  await nav.close(); process.exit(2)
})
console.log(`  botón «Cancelar» presente: ${await cancelar.count()}`)
await cancelar.click()
await pag.waitForTimeout(600)

const panel = pag.locator('[aria-label="Confirmar la cancelación"]')
console.log(`  diálogos NATIVOS del navegador: ${nativos.length ? nativos.join(' / ') : 'ninguno'}`)
console.log(`  confirmación en la propia pantalla: ${await panel.count()}`)
console.log(`  dice la ventana del consultorio: ${await panel.getByText(/horas de anticipación/).count()}`)
console.log(`  aria-expanded del botón: ${await cancelar.getAttribute('aria-expanded')}`)
for (const t of ['Sí, cancelar', 'Mejor reagendar', 'Dejarla como está']) {
  const b = panel.locator('button').filter({ hasText: t })
  const caja = await b.first().boundingBox().catch(() => null)
  console.log(`    salida «${t}»: ${await b.count()}  ${caja ? `${Math.round(caja.width)}×${Math.round(caja.height)}` : 'sin caja'}`)
}
await pag.screenshot({ path: `${SALIDA}/cancelar-390-dark.png`, fullPage: true })

/* «Mejor reagendar» tiene que llevar al panel de horarios, no sólo cerrar. */
await panel.locator('button').filter({ hasText: 'Mejor reagendar' }).click()
await pag.waitForTimeout(1500)
console.log(`  tras «Mejor reagendar» → confirmación cerrada: ${(await panel.count()) === 0}`)
console.log(`  tras «Mejor reagendar» → panel de horarios abierto: ${await cuenta('input[type="date"]')}`)

/* Y «Dejarla como está» deja la cita intacta. */
await cancelar.click(); await pag.waitForTimeout(500)
await panel.locator('button').filter({ hasText: 'Dejarla como está' }).click()
await pag.waitForTimeout(500)
console.log(`  tras «Dejarla como está» → confirmación cerrada: ${(await panel.count()) === 0}`)
console.log(`  la cita sigue ahí: ${await cancelar.count()}`)
console.log(`\n  diálogos NATIVOS en todo el recorrido: ${nativos.length}`)
await nav.close()
