/**
 * LA BANDA DE ATENCIÓN DICE LA VERDAD.
 *
 * Las unidades 78 a 81 pusieron en la rejilla del calendario una banda que
 * distingue las horas en que el consultorio atiende de las que no: el horario,
 * el horario partido, el del médico filtrado y los días festivos. Las cuatro se
 * midieron **a mano**, con datos sintéticos que después se borraron, y así quedó
 * escrito: «medido una vez, no vigilado».
 *
 * Esto es la diferencia. Siembra la configuración, mide, y **la devuelve como
 * estaba pase lo que pase**.
 *
 * POR QUÉ IMPORTA QUE ESTÉ VIGILADO
 * ─────────────────────────────────
 * Las cuatro veces el defecto fue el mismo: **el motor ya sabía y la pantalla no
 * se había enterado**. `getAvailableSlots` se salta el descanso, `getDaySchedule`
 * devuelve `null` en festivo, `configParaMedico` resuelve el horario del médico —
 * y la rejilla pintaba todo abierto. Es un defecto que no rompe ninguna prueba y
 * que sólo se ve mirando la pantalla, así que sin arnés vuelve.
 *
 * QUÉ SIEMBRA, Y QUÉ ESPERA
 * ─────────────────────────
 * Un consultorio de 09:00 a 20:00 con la comida de 14:00 a 16:00, el miércoles
 * de la semana visible declarado festivo, y dos médicos —uno con horario propio
 * de sólo tarde (16:00–19:00)—. Con eso:
 *
 *  · 07:00 y 08:00 cerradas: antes de abrir.
 *  · 09:00–13:00 abiertas, salvo el festivo y los días inactivos.
 *  · 14:00 y 15:00 cerradas: la comida.
 *  · 16:00–19:00 abiertas.
 *  · La columna del miércoles, cerrada ENTERA.
 *  · Con el filtro puesto en el médico de tarde, sólo 16, 17 y 18 abiertas.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo la vista de semana.** Ni el día ni el mes llevan banda.
 * · **No juzga si el tinte se ve LO BASTANTE.** Comprueba que la celda cerrada
 *   se pinte con el token elegido (`--bg`) y la abierta no —que es la decisión,
 *   y se puede comprobar—, pero no inventa un umbral perceptual: eso sería un
 *   número sacado de la manga. Que el tinte se lea se juzgó mirando capturas en
 *   los dos temas.
 * · No distingue «cerrado por festivo» de «cerrado porque no se atiende»: la
 *   pantalla tampoco, y está dicho como riesgo.
 * · Si el guion muere de forma violenta —un `kill -9`— la configuración sembrada
 *   se queda puesta. El `finally` cubre los fallos normales, no eso.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const PROYECTO = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-nexusmed-v10'
const CLINICA = process.env.CLINICA ?? 'consultorio-demo-v10'
const ZONA = process.env.ZONA_CONSULTORIO ?? 'America/Mexico_City'
const ADMIN = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }
const DOC = `http://${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents`

/** El miércoles de la semana que el calendario va a abrir. */
const hoyISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const [a, m, d] = hoyISO.split('-').map(Number)
const hoy = new Date(a, m - 1, d, 12)
const lunes = new Date(a, m - 1, d + (hoy.getDay() === 0 ? -6 : 1 - hoy.getDay()), 12)
const miercoles = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 2, 12)
const FESTIVO = `${miercoles.getFullYear()}-${String(miercoles.getMonth() + 1).padStart(2, '0')}-${String(miercoles.getDate()).padStart(2, '0')}`

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const diaSembrado = (ini, fin, descansos) => ({ mapValue: { fields: {
  activo: { booleanValue: true },
  inicio: { stringValue: ini }, fin: { stringValue: fin },
  ...(descansos ? { descansos: { arrayValue: { values: descansos.map(x => ({ mapValue: { fields: {
    inicio: { stringValue: x[0] }, fin: { stringValue: x[1] },
  } } })) } } } : {}),
} } })

const leerConfig = async () => {
  const r = await fetch(`${DOC}/clinics/${CLINICA}/config/main`, { headers: ADMIN })
  if (!r.ok) throw new Error(`no se pudo leer la configuración: ${r.status}`)
  return (await r.json()).fields ?? {}
}
/** Escribe SÓLO los campos que este guion toca, con máscara: no pisa el resto. */
const escribirCampos = async (fields, mascara) => {
  const qs = mascara.map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${DOC}/clinics/${CLINICA}/config/main?${qs}`, {
    method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`PATCH config: ${r.status} ${await r.text()}`)
}
const crearMedico = async (id, fields) => {
  const r = await fetch(`${DOC}/clinics/${CLINICA}/doctors?documentId=${id}`, {
    method: 'POST', headers: ADMIN, body: JSON.stringify({ fields }),
  })
  if (!r.ok && r.status !== 409) throw new Error(`crear médico ${id}: ${r.status}`)
}
const borrarMedico = (id) =>
  fetch(`${DOC}/clinics/${CLINICA}/doctors/${id}`, { method: 'DELETE', headers: ADMIN }).catch(() => {})

const MEDICO_TARDE = 'arnes-banda-medico-tarde'
const MEDICO_NORMAL = 'arnes-banda-medico-normal'

/*
 * Se guarda lo que había ANTES de tocar nada. Restaurar «a los valores por
 * defecto» no es restaurar: si el consultorio sembrado ya tenía horario propio,
 * borrarlo lo dejaría distinto de como estaba.
 */
const antes = await leerConfig()
const teniaHorario = 'horario' in antes
const teniaFestivos = 'diasFestivos' in antes

let nav
const fallos = []
try {
  await escribirCampos({
    horario: { mapValue: { fields: Object.fromEntries(DIAS.map(x => [x, diaSembrado('09:00', '20:00', [['14:00', '16:00']])])) } },
    diasFestivos: { arrayValue: { values: [{ stringValue: FESTIVO }] } },
  }, ['horario', 'diasFestivos'])
  await crearMedico(MEDICO_NORMAL, {
    nombre: { stringValue: 'Arnes Medico Del Consultorio' },
    especialidad: { stringValue: 'Medicina Interna' }, activo: { booleanValue: true },
  })
  await crearMedico(MEDICO_TARDE, {
    nombre: { stringValue: 'Arnes Medico De Tarde' },
    especialidad: { stringValue: 'Medicina Interna' }, activo: { booleanValue: true },
    horarioPropio: { booleanValue: true },
    horario: { mapValue: { fields: Object.fromEntries(DIAS.map(x => [x, diaSembrado('16:00', '19:00')])) } },
  })

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
  await pag.goto(`${BASE}/calendario`, { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(10000)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(800) }
  }

  /** Filas y columnas de la rejilla, leídas del DOM. */
  const medir = () => pag.evaluate(() => {
    const filas = [...new Set([...document.querySelectorAll('.nx-agenda-celda')].map(e => e.parentElement))]
    const porFila = {}
    const porColumna = [0, 1, 2, 3, 4, 5, 6].map(() => ({ abiertas: 0, total: 0 }))
    for (const f of filas) {
      const etiqueta = (f.firstElementChild?.textContent || '').trim()
      const celdas = [...f.querySelectorAll('.nx-agenda-celda')]
      porFila[etiqueta] = { abiertas: celdas.filter(c => !c.hasAttribute('data-cerrado')).length, total: celdas.length }
      celdas.forEach((c, i) => {
        if (!porColumna[i]) return
        porColumna[i].total++
        if (!c.hasAttribute('data-cerrado')) porColumna[i].abiertas++
      })
    }
    return { porFila, porColumna }
  })

  const r = await medir()
  const filas = Object.keys(r.porFila)
  if (filas.length < 10) {
    console.error(`\n  Sólo se vieron ${filas.length} filas de hora. El guion no está midiendo.\n`)
    process.exit(2)
  }
  const abiertasEn = (h) => r.porFila[h]?.abiertas ?? -1
  console.log('  filas: ' + filas.map(h => `${h}=${abiertasEn(h)}`).join(' '))

  /* Las horas que TIENEN que estar cerradas en toda la semana. */
  for (const h of ['07:00', '08:00', '14:00', '15:00']) {
    if (abiertasEn(h) !== 0) fallos.push(`${h} debería estar cerrada en toda la semana y hay ${abiertasEn(h)} celdas abiertas`)
  }
  /* Y las que tienen que estar abiertas en algún día. */
  for (const h of ['09:00', '13:00', '16:00', '19:00']) {
    if (abiertasEn(h) <= 0) fallos.push(`${h} está dentro del horario y no hay ninguna celda abierta`)
  }

  /*
   * Y QUE ALGO LA PINTE. El atributo puede estar puesto y la hoja no tener
   * regla que lo dibuje —«escrito y sin conectar», la familia de siempre— y
   * hasta aquí este arnés habría dado verde con la banda invisible.
   *
   * No se inventa un umbral de «se ve lo bastante»: eso sería un número sacado
   * de la manga, y aquí no se hace. Se comprueba la DECISIÓN: la celda cerrada
   * se pinta con `--bg` —la superficie de debajo de la rejilla, que es el token
   * elegido y funciona en los dos temas— y la abierta no.
   */
  const pintura = await pag.evaluate(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    const aRgb = (hex) => {
      const h = hex.replace('#', '')
      return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`
    }
    const celdas = [...document.querySelectorAll('.nx-agenda-celda')]
    const cerrada = celdas.find(c => c.hasAttribute('data-cerrado'))
    const abierta = celdas.find(c => !c.hasAttribute('data-cerrado'))
    return {
      esperado: aRgb(bg),
      fondoCerrada: cerrada ? getComputedStyle(cerrada).backgroundColor : null,
      fondoAbierta: abierta ? getComputedStyle(abierta).backgroundColor : null,
    }
  })
  console.log(`  pintura  · cerrada ${pintura.fondoCerrada} · abierta ${pintura.fondoAbierta} · --bg ${pintura.esperado}`)
  if (pintura.fondoCerrada !== pintura.esperado) {
    fallos.push(`la celda cerrada lleva el atributo pero se pinta ${pintura.fondoCerrada}, no \`--bg\` (${pintura.esperado}): la banda está puesta y no se ve`)
  }
  if (pintura.fondoAbierta === pintura.esperado) {
    fallos.push('la celda ABIERTA se pinta igual que la cerrada: la banda no distingue nada')
  }

  /* La columna del festivo, cerrada entera. */
  const cabeceras = await pag.evaluate(() => [...document.querySelectorAll('div')]
    .filter(e => /^\d{1,2}$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).width) === 28)
    .map(e => (e.textContent || '').trim()))
  const diaFestivo = String(Number(FESTIVO.slice(8, 10)))
  const iFestivo = cabeceras.indexOf(diaFestivo)
  console.log(`  columnas: ${cabeceras.map((c, i) => `${c}=${r.porColumna[i]?.abiertas ?? '?'}`).join(' ')} · festivo: ${diaFestivo}`)
  if (iFestivo < 0) {
    console.error(`\n  El día festivo sembrado (${FESTIVO}) no está en la semana abierta. El guion no midió el festivo.\n`)
    process.exit(2)
  }
  if (r.porColumna[iFestivo].abiertas !== 0) {
    fallos.push(`el ${diaFestivo} es festivo y su columna tiene ${r.porColumna[iFestivo].abiertas} celdas abiertas`)
  }

  /* Y el horario del médico filtrado. */
  const disparador = pag.locator('button:visible').filter({ hasText: /todos los médicos/i }).first()
  if (!(await disparador.count().catch(() => 0))) {
    console.log('  filtro   · no apareció el filtro de médico — el horario propio queda sin medir')
  } else {
    await disparador.click().catch(() => {})
    await pag.waitForTimeout(1200)
    const opcion = pag.locator('button:visible').filter({ hasText: /Arnes Medico De Tarde/i }).first()
    if (!(await opcion.count().catch(() => 0))) {
      console.log('  filtro   · el médico de tarde no aparece en el menú — sin medir')
    } else {
      await opcion.click().catch(() => {})
      await pag.waitForTimeout(4500)
      const f = (await medir()).porFila
      const ab = (h) => f[h]?.abiertas ?? -1
      console.log(`  con filtro (16:00–19:00): 15:00=${ab('15:00')} 16:00=${ab('16:00')} 18:00=${ab('18:00')} 19:00=${ab('19:00')}`)
      if (ab('16:00') <= 0) fallos.push('el médico de tarde atiende a las 16:00 y la banda la da por cerrada')
      if (ab('15:00') !== 0) fallos.push('el médico de tarde NO atiende a las 15:00 y la banda la da por abierta')
      if (ab('19:00') !== 0) fallos.push('el médico de tarde termina a las 19:00 y la banda da esa franja por abierta')
    }
  }

  /* ── Y LA VISTA DE DÍA ───────────────────────────────────────────────────
   * Llevaba la banda desde la unidad 83. Se mide aquí y no en un guion aparte
   * porque la configuración sembrada ya está puesta: medirla en otro sitio
   * costaría sembrarla dos veces.
   */
  /*
   * SE QUITA EL FILTRO ANTES, y no es un detalle: la primera versión medía el
   * día con el médico de tarde todavía seleccionado y acusaba al producto de dar
   * las 11:00 por cerradas. Lo estaban — para ÉL, que entra a las 16:00. El
   * defecto era del guion. (De paso queda visto que el horario del médico llega
   * también a la vista de día.)
   */
  const volverATodos = pag.locator('button:visible').filter({ hasText: /Arnes Medico De Tarde/i }).first()
  if (await volverATodos.count().catch(() => 0)) {
    await volverATodos.click().catch(() => {})
    await pag.waitForTimeout(1200)
    const todos = pag.locator('button:visible').filter({ hasText: /todos los médicos/i }).first()
    if (await todos.count().catch(() => 0)) { await todos.click().catch(() => {}); await pag.waitForTimeout(3500) }
  }

  const botonDia = pag.locator('button:visible').filter({ hasText: /^Día$/ }).first()
  if (!(await botonDia.count().catch(() => 0))) {
    console.log('  día      · no apareció el conmutador de vista — la vista de día queda sin medir')
  } else {
    await botonDia.click().catch(() => {})
    await pag.waitForTimeout(4000)
    const dia = await pag.evaluate(() => {
      const celdas = [...document.querySelectorAll('.nx-agenda-celda')]
      return celdas.map(c => ({
        etiqueta: (c.querySelector('div')?.textContent || '').trim(),
        cerrada: c.hasAttribute('data-cerrado'),
      }))
    })
    const cerradaEn = (h) => dia.find(x => x.etiqueta.startsWith(h))?.cerrada
    console.log(`  día      · ${dia.length} franjas · 08:00 cerrada=${cerradaEn('08:00')} · 11:00 cerrada=${cerradaEn('11:00')} · 14:00 cerrada=${cerradaEn('14:00')} · 17:00 cerrada=${cerradaEn('17:00')}`)
    if (!dia.length) {
      console.log('  día      · la rejilla del día salió vacía — sin medir')
    } else {
      if (cerradaEn('08:00') === false) fallos.push('vista de día: las 08:00 son antes de abrir y la banda las da por abiertas')
      if (cerradaEn('14:00') === false) fallos.push('vista de día: las 14:00 son la comida y la banda las da por abiertas')
      if (cerradaEn('11:00') === true) fallos.push('vista de día: las 11:00 están dentro del horario y la banda las da por cerradas')
      if (cerradaEn('17:00') === true) fallos.push('vista de día: las 17:00 están dentro del horario y la banda las da por cerradas')
    }
  }

} finally {
  /*
   * Y SE DEVUELVE TODO. Con la forma que tenía antes, no con «lo normal»: si el
   * consultorio ya traía horario propio, borrarlo lo dejaría distinto.
   */
  await escribirCampos(
    {
      ...(teniaHorario ? { horario: antes.horario } : {}),
      ...(teniaFestivos ? { diasFestivos: antes.diasFestivos } : {}),
    },
    ['horario', 'diasFestivos'],
  ).catch(e => console.error('  AVISO: no se pudo devolver la configuración:', String(e).slice(0, 120)))
  await borrarMedico(MEDICO_TARDE)
  await borrarMedico(MEDICO_NORMAL)
  if (nav) await nav.close().catch(() => {})
}

if (fallos.length) {
  console.error('\n  LA BANDA DE ATENCIÓN NO DICE LA VERDAD:\n'
    + fallos.map(f => '   · ' + f).join('\n')
    + '\n  El motor ya lo sabe; la pantalla se ha vuelto a quedar atrás.\n')
  process.exit(1)
}
console.log('\n  La banda dice la verdad: horario, comida, festivo y médico filtrado.\n')
