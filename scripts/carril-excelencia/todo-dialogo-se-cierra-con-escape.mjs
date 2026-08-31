/**
 * TODO DIÁLOGO SE CIERRA CON ESCAPE Y RECIBE EL FOCO.
 *
 * La regla de diseño de este repositorio nombra el defecto con todas las
 * letras: «modal que no atrapa el foco ni cierra con Escape» falla la compuerta.
 * Estaba escrita y **no la medía nadie**: el arnés de foco mira los campos de
 * formulario, no los diálogos.
 *
 * QUÉ COMPRUEBA, con el diálogo abierto de verdad
 * ───────────────────────────────────────────────
 *  1. **El foco entra.** Sin eso, quien usa lector de pantalla abre el diálogo y
 *     se queda donde estaba: para él el diálogo no ha ocurrido.
 *  2. **Escape lo cierra.**
 *  3. **El foco vuelve a quien lo abrió**, no al principio de la página.
 *
 * QUÉ SE MIDIÓ EL 30-AGO-2026
 * ───────────────────────────
 * De los diálogos alcanzables, **el panel de ayuda era el único roto**, y lo
 * estaba entero: `foco entra: false · sigue abierto tras Escape: sí`. Es el
 * único `role="dialog"` del producto que no usaba `useDialogoDeTeclado` — se
 * escribió antes de que el gancho existiera y se quedó atrás.
 *
 * POR QUÉ ESTE GUION ABRE LOS DIÁLOGOS EN VEZ DE LEER EL CÓDIGO
 * ────────────────────────────────────────────────────────────
 * Porque «usa el gancho» y «se comporta» no son lo mismo: el gancho puede estar
 * llamado con un `ref` que no llega al elemento, o con `abierto` mal cableado, y
 * el código se leería bien. Se abre, se pulsa Escape y se mira dónde quedó el
 * foco.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo los diálogos que este guion sabe abrir.** Los que piden un estado
 *   difícil —un cobro a medias, una firma— no se miran, y no estar aquí
 *   significa que NO se vigilan.
 * · No mide la trampa de foco (que Tab no se escape): eso pide contar
 *   tabulaciones y es otra medición.
 * · No comprueba el aviso de cierre de sesión, que a propósito NO cierra con
 *   Escape — desactivar un control de seguridad sin querer es el defecto
 *   contrario.
 * · No dice nada de lectores de pantalla reales.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'

/**
 * Cada diálogo con: dónde vive, cómo se abre y cómo se reconoce.
 * `abridor` es un selector; `dialogo` identifica el diálogo ya abierto.
 */
const DIALOGOS = [
  {
    nombre: 'panel de ayuda',
    ruta: '/citas',
    abridor: '[aria-label="Abrir ayuda"]',
    dialogo: '[role=dialog][aria-label="Asistente de ayuda"]',
  },
  {
    nombre: 'paleta de búsqueda',
    ruta: '/citas',
    abridor: null,           // se abre con el teclado
    teclas: 'Control+KeyK',
    dialogo: '[role=dialog]',
  },
]

const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
const pag = await ctx.newPage()

await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
try {
  await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
} catch {
  console.error(`\n  No apareció el formulario de acceso en ${BASE}/login.`)
  console.error('  Casi seguro: el servidor sirve un build hecho SIN la configuración del arnés.\n')
  await nav.close(); process.exit(2)
}
await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
await pag.locator('input[type=password]').first().fill('demo1234')
await pag.locator('button[type=submit]').first().click()
await pag.waitForTimeout(9000)

const fallos = []
let medidos = 0

for (const d of DIALOGOS) {
  await pag.goto(BASE + d.ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await pag.waitForTimeout(7000)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(800) }
  }

  // Se abre, y se recuerda QUIÉN lo abrió para saber si el foco vuelve.
  let quienAbrio = null
  if (d.abridor) {
    const b = pag.locator(d.abridor).first()
    if (!(await b.count().catch(() => 0))) {
      console.log(`  ${'sin abrir'.padEnd(11)} ${d.nombre} — no se encontró su disparador`)
      continue
    }
    await b.focus().catch(() => {})
    quienAbrio = await pag.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || null)
    await b.click().catch(() => {})
  } else {
    quienAbrio = await pag.evaluate(() => document.activeElement?.tagName || null)
    await pag.keyboard.press(d.teclas)
  }
  await pag.waitForTimeout(2000)

  const abierto = await pag.locator(d.dialogo).count().catch(() => 0)
  if (!abierto) {
    console.log(`  ${'sin abrir'.padEnd(11)} ${d.nombre} — no llegó a abrirse`)
    continue
  }
  medidos++

  const focoEntra = await pag.evaluate(sel => {
    const caja = document.querySelector(sel)
    return !!(caja && document.activeElement && caja.contains(document.activeElement))
  }, d.dialogo)

  await pag.keyboard.press('Escape')
  await pag.waitForTimeout(1200)
  const sigueAbierto = await pag.locator(d.dialogo).count().catch(() => 0)
  const focoTras = await pag.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || null)
  const focoVuelve = quienAbrio !== null && focoTras === quienAbrio

  const mal = []
  if (!focoEntra) mal.push('el foco NO entra')
  if (sigueAbierto) mal.push('Escape NO lo cierra')
  else if (!focoVuelve) mal.push(`el foco no vuelve a quien lo abrió (${quienAbrio} → ${focoTras})`)

  console.log(`  ${(mal.length ? 'FALLA' : ' ok  ').padEnd(11)} ${d.nombre.padEnd(22)} foco entra ${focoEntra} · cierra con Escape ${!sigueAbierto} · foco vuelve ${focoVuelve}`)
  if (mal.length) fallos.push(`${d.nombre}: ${mal.join(' · ')}`)

  // Si Escape no lo cerró, se cierra a mano para no arrastrarlo al siguiente.
  if (sigueAbierto) await pag.keyboard.press('Escape').catch(() => {})
}

await nav.close()

if (!medidos) {
  console.error('\n  No se pudo abrir ningún diálogo. El guion no está midiendo.\n')
  process.exit(2)
}
if (fallos.length) {
  console.error(`\n  DIÁLOGOS QUE NO SE PUEDEN USAR CON EL TECLADO (${medidos} medidos):\n`
    + fallos.map(f => '   · ' + f).join('\n')
    + '\n  La regla de diseño lo nombra: un modal que no atrapa el foco ni cierra con\n'
    + '  Escape falla la compuerta.\n')
  process.exit(1)
}
console.log(`\n  ${medidos} diálogos: el foco entra, Escape cierra y el foco vuelve.\n`)
