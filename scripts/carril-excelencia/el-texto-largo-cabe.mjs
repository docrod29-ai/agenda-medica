/**
 * EL TEXTO LARGO CABE — la columna «long content», medida.
 *
 * Escribe en la nota un padecimiento actual de tamaño realista para una primera
 * vez, con una palabra impronunciable de 96 letras al final —el caso que rompe
 * cualquier corte de línea— y comprueba dos cosas a 1440 y a 390:
 *
 *  1. **Que nada se salga de lado.** Ni el documento ni ningún elemento de
 *     `<main>` pueden ser más anchos que la ventana.
 *  2. **Que el campo enseñe lo que tiene dentro.** Un campo de 70 px con 2 887 px
 *     de texto no es un campo: es una rendija.
 *
 * QUÉ LO TRAJO
 * ────────────
 * Medido antes del arreglo: escribiendo un padecimiento actual normal, el campo
 * se quedaba en **70 px mostrando 602 px de texto** en escritorio y **73 px de
 * 2 887 px** a 390. El médico relee lo que escribió —o lo que le dictó a la IA—
 * por una ventana de tres renglones, y justo antes de firmar, que es cuando más
 * falta hace leerlo entero. `resize: vertical` no lo salvaba: en un teléfono no
 * hay tirador que arrastrar.
 *
 * El desbordamiento lateral **ya estaba bien** y así se dice: el paciente 4 del
 * arnés lleva a propósito «el nombre compuesto más largo que un registro civil
 * mexicano admite», y el trinquete de interfaz mide desborde en 69 combinaciones
 * con él dentro. Lo que faltaba por mirar era el texto libre.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Listas largas**: cientos de citas, de pacientes o de cobros. Sin probar.
 * · Nombres largos en sitios donde no aparecen hoy (una receta impresa, un PDF).
 * · No juzga el TOPE: al pasar del 60 % de la ventana el campo hace su propio
 *   scroll, y que ése sea el punto correcto es una decisión, no una medida.
 * · Sólo la consulta. Otras pantallas con texto libre —adendas, comentarios— no
 *   se miran aquí.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const ANCHOS = (process.env.ANCHOS ?? '1440,390').split(',').map(Number)

const PARRAFO = 'El paciente refiere disnea de medianos esfuerzos de tres semanas de evolución, ortopnea de dos almohadas y edema vespertino de miembros inferiores que cede parcialmente con el decúbito; niega dolor torácico opresivo, síncope o palpitaciones sostenidas. '
const IMPRONUNCIABLE = 'antidisestablecimentarianismoelectroencefalografistaneumonoultramicroscopicosilicovolcanoconiosis'
const TEXTO = PARRAFO.repeat(14) + ' ' + IMPRONUNCIABLE

const nav = await chromium.launch({ executablePath: CHROME })
const fallos = []

for (const ancho of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } })
  const pag = await ctx.newPage()
  await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  try {
    await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
  } catch {
    console.error(`\n  No apareció el formulario de acceso en ${BASE}/login.`)
    console.error('  Casi seguro: el servidor sirve un build hecho SIN la configuración del arnés.\n')
    await nav.close()
    process.exit(2)
  }
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForTimeout(9000)
  await pag.goto(`${BASE}/consulta/pac-001`, { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(6500)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) {
      await b.click().catch(() => {})
      await pag.waitForTimeout(600)
    }
  }

  const campo = pag.locator('textarea[aria-label="Padecimiento actual"]').first()
  if (!(await campo.count().catch(() => 0))) {
    console.error(`\n  No se encontró el campo «Padecimiento actual» en ${ancho}px. ¿Cambió la nota?\n`)
    await nav.close()
    process.exit(2)
  }
  await campo.scrollIntoViewIfNeeded()
  await campo.fill(TEXTO)
  await pag.waitForTimeout(1200)

  const r = await pag.evaluate(() => {
    const anchos = []
    for (const e of document.querySelectorAll('main *')) {
      const b = e.getBoundingClientRect()
      if (b.width > innerWidth + 2) {
        anchos.push(`${e.tagName}.${(typeof e.className === 'string' ? e.className : '').split(' ').filter(Boolean)[0] || '-'} ${Math.round(b.width)}px`)
      }
    }
    const ta = document.querySelector('textarea[aria-label="Padecimiento actual"]')
    const tope = Math.max(160, Math.round(innerHeight * 0.6))
    return {
      desborde: document.documentElement.scrollWidth > innerWidth + 1,
      anchos: [...new Set(anchos)].slice(0, 4),
      alto: ta ? Math.round(ta.getBoundingClientRect().height) : 0,
      contenido: ta ? Math.round(ta.scrollHeight) : 0,
      tope,
    }
  })

  // El campo tiene que enseñar todo lo que quepa hasta el tope. 6px de holgura
  // por bordes y redondeos.
  const deberia = Math.min(r.contenido, r.tope)
  const enseña = r.alto >= deberia - 6

  const problemas = []
  if (r.desborde || r.anchos.length) problemas.push('SE SALE DE LADO')
  if (!enseña) problemas.push(`RENDIJA (${r.alto}px de ${r.contenido}px)`)
  if (problemas.length) fallos.push(`${ancho}px — ${problemas.join(' · ')}`)

  console.log(
    `  ${(problemas.join(' · ') || 'ok').padEnd(30)} ${String(ancho).padStart(4)}px · ` +
    `campo ${r.alto}px de ${r.contenido}px (tope ${r.tope}) · desborde ${r.desborde}`,
  )
  r.anchos.forEach(a => console.log('        se sale: ' + a))
  await ctx.close()
}

await nav.close()

if (fallos.length) {
  console.error('\n  El texto largo no cabe:\n' + fallos.map(f => '   · ' + f).join('\n') + '\n')
  process.exit(1)
}
console.log('\n  El texto largo cabe: nada se sale de lado y el campo enseña lo que tiene.\n')
