/**
 * EL CALENDARIO ABRE EN EL «HOY» DEL CONSULTORIO, NO EN EL DEL APARATO.
 *
 * Esta pantalla tenía DOS nociones de «hoy» a la vez:
 *
 *  · la vista de día y el resaltado de la cabecera usaban `hoyISO()` — el día en
 *    la **zona del consultorio**, que es la correcta y la que usa el resto del
 *    producto;
 *  · pero la semana que se abría salía de `new Date()` — el reloj del **aparato**.
 *
 * Cuando los dos no coinciden, la rejilla abre en otra semana y **el resaltado
 * de hoy desaparece**: ningún día marcado, porque el día que habría que marcar
 * no está en la semana pintada. El médico abre su agenda y se encuentra una
 * semana vacía sin ancla ninguna.
 *
 * Y no es un caso raro: para un consultorio en México con el aparato en UTC pasa
 * **todas las tardes, de las 18:00 en adelante** — justo la consulta vespertina.
 *
 * MEDIDO EL 31-AGO-2026, ANTES DEL ARREGLO
 * ────────────────────────────────────────
 * El navegador decía «Mon Aug 31 2026», el consultorio decía 30-ago, y el
 * calendario abría en «31 ago – 6 sep 2026» **sin un solo día resaltado**.
 * Se descubrió por accidente: el arnés de las citas fuera de hora empezó a
 * fallar sólo en la vista de semana, y al mirar la captura estaba esto detrás.
 *
 * CÓMO SE PROVOCA
 * ───────────────
 * Se le da al navegador una zona horaria que va **por delante** de la del
 * consultorio, con la hora puesta en la franja donde los días ya no coinciden.
 * Así el desacuerdo ocurre de verdad, sin tocar el reloj de la máquina.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · Sólo la vista de SEMANA al abrir. No comprueba qué pasa al navegar con las
 *   flechas y volver.
 * · No cubre el cambio de día con la pantalla abierta (medianoche en vivo).
 * · No mira la vista de mes.
 * · Sólo una zona por delante. No prueba una por detrás, que produce el defecto
 *   simétrico y que este guion **no vigila**.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
/** Una zona bien por delante de México: ahí el día cambia antes. */
const ZONA_DEL_APARATO = process.env.ZONA_APARATO ?? 'Pacific/Kiritimati'

const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: ZONA_DEL_APARATO })
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

await pag.goto(`${BASE}/calendario`, { waitUntil: 'domcontentloaded' })
await pag.waitForTimeout(9000)
for (const t of [/^saltar$/i, /^entendido$/i]) {
  const b = pag.locator('button:visible').filter({ hasText: t }).first()
  if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(800) }
}

const r = await pag.evaluate(() => {
  const teal = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim()
  const aRgb = (hex) => {
    const h = hex.replace('#', '')
    return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`
  }
  /*
   * El resaltado se busca por el COLOR DE MARCA calculado, que es lo que ve el
   * medico, y no por una clase que un refactor renombra sin cambiar nada. Las
   * casillas de la cabecera son los circulos de 28px con un numero dentro.
   */
  const casillas = [...document.querySelectorAll('div')].filter(e =>
    /^\d{1,2}$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).width) === 28)
  const esperado = aRgb(teal)
  return {
    diaDelAparato: new Date().toDateString(),
    numeros: casillas.map(e => (e.textContent || '').trim()),
    marcados: casillas.filter(e => getComputedStyle(e).color === esperado).map(e => (e.textContent || '').trim()),
  }
})

// Y que dia es en el consultorio: la referencia contra la que se juzga.
const diaDelConsultorio = new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.ZONA_CONSULTORIO ?? 'America/Mexico_City',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const diaEsperado = String(Number(diaDelConsultorio.slice(8, 10)))

await nav.close()

console.log(`  aparato en ${ZONA_DEL_APARATO}: «${r.diaDelAparato}»`)
console.log(`  consultorio: ${diaDelConsultorio} -> se espera el ${diaEsperado} marcado`)
console.log(`  dias en la cabecera: ${r.numeros.join(', ') || '(ninguno)'}`)
console.log(`  marcados como hoy:  ${r.marcados.join(', ') || '(ninguno)'}`)

const fallos = []
if (!r.numeros.includes(diaEsperado)) {
  fallos.push(`la semana abierta no contiene el ${diaEsperado}, que es hoy en el consultorio`)
}
if (!r.marcados.includes(diaEsperado)) {
  fallos.push(`el ${diaEsperado} no esta marcado como hoy - el medico abre su agenda sin ancla`)
}
if (r.marcados.length > 1) fallos.push(`hay ${r.marcados.length} dias marcados como hoy`)

if (fallos.length) {
  console.error('\n  EL CALENDARIO NO ESTA ANCLADO EN EL HOY DEL CONSULTORIO:\n'
    + fallos.map(f => '   · ' + f).join('\n') + '\n')
  process.exit(1)
}
/*
 * ── Y LA VISTA DE MES ────────────────────────────────────────────────────────
 * La unidad 77 dejó el mes escrito como riesgo residual («no se miró»). Se mira:
 * comparte el ancla y la misma lectura de día, así que si una está bien la otra
 * debería estarlo — «debería» es justo lo que este carril no acepta.
 */
console.log('')
const nav2 = await chromium.launch({ executablePath: CHROME })
const ctx2 = await nav2.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: ZONA_DEL_APARATO })
const pag2 = await ctx2.newPage()
await pag2.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await pag2.locator('input[type=email]').first().fill('demo@nexusmed.test')
await pag2.locator('input[type=password]').first().fill('demo1234')
await pag2.locator('button[type=submit]').first().click()
await pag2.waitForTimeout(9000)
await pag2.goto(`${BASE}/calendario`, { waitUntil: 'domcontentloaded' })
await pag2.waitForTimeout(8000)
for (const t of [/^saltar$/i, /^entendido$/i]) {
  const b = pag2.locator('button:visible').filter({ hasText: t }).first()
  if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag2.waitForTimeout(700) }
}
const botonMes = pag2.locator('button:visible').filter({ hasText: /^Mes$/ }).first()
let mes = null
if (await botonMes.count().catch(() => 0)) {
  await botonMes.click().catch(() => {})
  await pag2.waitForTimeout(4500)
  mes = await pag2.evaluate(() => {
    const teal = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim()
    const h = teal.replace('#', '')
    const esperado = `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`
    return [...document.querySelectorAll('main *')]
      .filter(e => /^\d{1,2}$/.test((e.textContent || '').trim()) && getComputedStyle(e).color === esperado)
      .map(e => (e.textContent || '').trim())
  })
}
await nav2.close()

if (mes === null) {
  console.log('  mes · no se encontró el conmutador de vista — el MES queda sin medir')
} else {
  console.log(`  mes · marcados como hoy: ${mes.join(', ') || '(ninguno)'} · se espera el ${diaEsperado}`)
  if (!mes.includes(diaEsperado)) {
    console.error('\n  LA VISTA DE MES NO MARCA EL HOY DEL CONSULTORIO.\n')
    process.exit(1)
  }
}

console.log('\n  El calendario abre en la semana del consultorio, con su día marcado.\n')
