/**
 * UNA CITA FUERA DE LA REJILLA SIGUE SIENDO UNA CITA.
 *
 * La rejilla del calendario iba de 07:00 a 19:00 escrito a mano, y cada cita se
 * pintaba metiéndola en la celda de su hora. Una cita a las 20:30 no encuentra
 * celda: **no se pinta en ninguna parte**. Ni atenuada, ni en un «+2 más», ni
 * con un aviso. El médico mira su semana y ve la tarde libre.
 *
 * MEDIDO EL 30-AGO-2026, ANTES DEL ARREGLO
 * ────────────────────────────────────────
 * Dos citas confirmadas de hoy, a las 06:30 y a las 20:30:
 *
 *     /calendario (semana) -> 06:30 visible: false · 20:30 visible: false
 *     /calendario (día)    -> 06:30 visible: false · 20:30 visible: false
 *     /citas      (lista)  -> 06:30 visible: true  · 20:30 visible: true
 *
 * La lista sí las tiene. Sólo desaparecen en la pantalla donde el médico mira
 * su día. Se incluye `/citas` en la medición justamente por eso: sin ella no se
 * sabría si el defecto es de la rejilla o de la consulta, y son cosas distintas.
 *
 * CÓMO SE SIEMBRA
 * ───────────────
 * Dos citas escritas directamente en el consultorio sembrado, a horas que la
 * rejilla vieja no tenía. Se borran al terminar, pase lo que pase: dejarlas
 * movería los conteos de los otros arneses.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo los extremos**, 06:30 y 20:30. No prueba las 24 horas.
 * · No mira la vista de MES, que no usa rejilla de horas.
 * · No comprueba que se pueda AGENDAR en la fila nueva, sólo que la cita se vea.
 * · No mira el horario partido: `DaySchedule` admite huecos dentro del día y la
 *   rejilla los enseña como horas normales, igual que antes.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const PROYECTO = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-nexusmed-v10'
const CLINICA = process.env.CLINICA ?? 'consultorio-demo-v10'
const ADMIN = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }

const HOY = new Date()
const hoyISO = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, '0')}-${String(HOY.getDate()).padStart(2, '0')}`
const FUERA = ['06:30', '20:30']
const docId = (h) => `arnes-fuera-de-hora-${h.replace(':', '')}`

const sembrar = async (h) => {
  const url = `http://${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/clinics/${CLINICA}/appointments?documentId=${docId(h)}`
  const r = await fetch(url, {
    method: 'POST', headers: ADMIN,
    body: JSON.stringify({ fields: {
      pacienteId: { stringValue: 'pac-001' },
      pacienteNombre: { stringValue: `Arnes Fuera De Hora ${h}` },
      pacienteTelefono: { stringValue: '5555000000' },
      fechaHora: { stringValue: `${hoyISO} ${h}` },
      duracion: { integerValue: '30' }, tipo: { stringValue: 'Seguimiento' },
      motivo: { stringValue: 'Control' }, estado: { stringValue: 'confirmada' },
      confirmada: { booleanValue: true }, createdAt: { stringValue: `${hoyISO}T08:00:00.000Z` },
    } }),
  })
  if (!r.ok && r.status !== 409) throw new Error(`sembrar ${h}: ${r.status} ${await r.text()}`)
}
const borrar = (h) => fetch(
  `http://${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/clinics/${CLINICA}/appointments/${docId(h)}`,
  { method: 'DELETE', headers: ADMIN },
).catch(() => {})

let nav
const fallos = []
try {
  for (const h of FUERA) await sembrar(h)

  nav = await chromium.launch({ executablePath: CHROME })
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  const pag = await ctx.newPage()
  await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  try {
    await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
  } catch {
    console.error(`\n  No apareció el formulario de acceso en ${BASE}/login.`)
    console.error('  Casi seguro: el servidor sirve un build hecho SIN la configuración del arnés.\n')
    process.exit(2)
  }
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForTimeout(9000)

  const quitarBienvenida = async () => {
    for (const t of [/^saltar$/i, /^entendido$/i]) {
      const b = pag.locator('button:visible').filter({ hasText: t }).first()
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(700) }
    }
  }
  /*
   * SE PREGUNTA AL BLOQUE, NO AL TEXTO DE LA PÁGINA.
   *
   * La primera versión buscaba el nombre en `document.body.innerText` y dio un
   * FALSO NEGATIVO: en la vista de semana el bloque existe —se ve en el DOM, con
   * su `title` y su etiqueta— pero su nombre no sale por `innerText`, porque el
   * bloque es una caja absoluta y estrecha con el texto recortado. Decía «no se
   * ve» de dos citas que sí estaban pintadas. Se pregunta por los bloques, que
   * es lo que de verdad ocupa un sitio en la rejilla.
   */
  const bloquesDeLaRejilla = () => pag.evaluate(() =>
    [...document.querySelectorAll('.nx-agenda-bloque')]
      .map(b => `${b.getAttribute('title') || ''} ${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`))

  for (const [ruta, vista] of [['/calendario', 'semana'], ['/calendario', 'día'], ['/citas', 'lista']]) {
    await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await pag.waitForTimeout(7500)
    await quitarBienvenida()
    if (vista === 'día') {
      const b = pag.locator('button:visible').filter({ hasText: /^Día$/ }).first()
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(4000) }
    }
    /* En el calendario manda el bloque; en la lista, el texto de la página. */
    const donde = ruta === '/citas'
      ? [await pag.evaluate(() => document.body.innerText || '')]
      : await bloquesDeLaRejilla()
    const ve = (h) => donde.some(t => t.includes(`Arnes Fuera De Hora ${h}`))
    const vistas = FUERA.filter(ve)
    const faltan = FUERA.filter(h => !ve(h))
    console.log(`  ${(faltan.length ? 'FALTA' : ' ok  ')} ${ruta} (${vista}) · se ven ${vistas.length} de ${FUERA.length}` +
      (faltan.length ? ` · no se ve: ${faltan.join(', ')}` : ''))
    if (faltan.length) fallos.push(`${ruta} (${vista}) esconde ${faltan.join(' y ')}`)
  }
} finally {
  for (const h of FUERA) await borrar(h)
  if (nav) await nav.close().catch(() => {})
}

if (fallos.length) {
  console.error('\n  HAY CITAS QUE EL CALENDARIO NO ENSEÑA EN NINGUNA PARTE:\n'
    + fallos.map(f => '   · ' + f).join('\n')
    + '\n  Que no se vea no significa que no esté: el médico mira su día y lo ve libre.\n')
  process.exit(1)
}
console.log('\n  Ninguna cita se queda fuera de la rejilla.\n')
