#!/usr/bin/env node
/**
 * TRINQUETE DE INTERFAZ — la protección de regresión que faltaba.
 *
 * ── POR QUÉ NO ES UNA COMPARACIÓN DE PÍXELES ────────────────────────────────
 *
 * Lo obvio para «regresión visual» es guardar capturas y compararlas. Aquí eso
 * daría una compuerta ROJA cada día, y por construcción:
 *
 *   · la rejilla dibuja la HORA ACTUAL, que se mueve cada minuto;
 *   · la siembra fecha en el día en curso, así que la semana cambia sola;
 *   · el mes cambia la maqueta del calendario sin que nadie toque nada.
 *
 * Una compuerta que se pone roja sola se desactiva en una semana, y entonces no
 * protege nada. Peor que no tenerla: da la sensación de estar cubierto.
 *
 * Así que esto fija lo que SÍ es estable y sí es lo que importa: las
 * propiedades medibles de la interfaz que este carril arregló. Si mañana
 * alguien vuelve a apagar el riel en `/citas`, o mete una violación de axe, o
 * hace que la página se desborde a lo ancho, esto lo dice — y lo dice con el
 * nombre de la ruta y el ancho.
 *
 * Es el mismo contrato que el trinquete de lint y el de diseño: **los números
 * sólo pueden mejorar**. Si un cambio los empeora, se arregla el cambio.
 *
 * ── LO QUE ESTO NO CUBRE, DICHO PARA QUE NADIE LO SUPONGA ───────────────────
 *
 * · NO ve el aspecto. Una pantalla puede volverse fea, perder jerarquía o
 *   quedarse sin espaciado con todos estos números intactos.
 * · NO ve el movimiento ni el orden de tabulación.
 * · NO corre en CI: necesita emuladores sembrados y un build de producción, y
 *   los emuladores no viven en el runner. Es una compuerta LOCAL, como
 *   `verificar-invariantes-de-datos`. Que dependa de que alguien se acuerde
 *   está declarado, no disimulado.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   (emuladores en marcha + `node scripts/design/sembrar-emulador.mjs`)
 *   npm run build && npx next start -p 3300
 *   node scripts/carril-excelencia/trinquete-de-interfaz.mjs
 *   node scripts/carril-excelencia/trinquete-de-interfaz.mjs --actualizar
 *
 * El orden importa: `next build` bajo un `next start` en marcha deja la
 * pantalla en su límite de error y esto mediría una pantalla rota. Parar,
 * construir, arrancar, medir.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE || 'http://localhost:3300'
const TECHOS = 'docs/audit/carril-excelencia/techos-de-interfaz.json'
const ACTUALIZAR = process.argv.includes('--actualizar')

const RUTAS = ['/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas', '/operaciones']
const ANCHOS = [390, 768, 1440]
const ALTOS = { 390: 844, 768: 1024, 1440: 900 }

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const nav = await chromium.launch({ executablePath: CHROME })
const medido = {}

for (const w of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: ALTOS[w] } })
  const pag = await ctx.newPage()
  await pag.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(2500)
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForTimeout(8000)

  for (const ruta of RUTAS) {
    const errores = []
    pag.on('console', m => { if (m.type() === 'error') errores.push(m.text().slice(0, 120)) })
    await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
    await pag.waitForTimeout(5000)
    for (const t of [/^saltar$/i, /^entendido$/i]) {
      const b = pag.locator('button:visible').filter({ hasText: t }).first()
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(700) }
    }
    await pag.addScriptTag({ content: AXE })
    const axe = await pag.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      })
      return r.violations.reduce((s, v) => s + v.nodes.length, 0)
    })
    const dom = await pag.evaluate(() => ({
      ariaCurrent: document.querySelectorAll('[aria-current="page"]').length,
      desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }))
    medido[`${ruta}@${w}`] = { axe, ariaCurrent: dom.ariaCurrent, desborde: dom.desborde, erroresDeConsola: errores.length }
    pag.removeAllListeners('console')
  }
  await ctx.close()
}
await nav.close()

if (ACTUALIZAR) {
  writeFileSync(TECHOS, JSON.stringify({
    queEsEsto: 'Techos de interfaz del carril de excelencia. axe, errores de consola y desborde SÓLO PUEDEN BAJAR; ariaCurrent SÓLO PUEDE SUBIR. Si un cambio los empeora, se arregla el cambio — no se mueve el techo. Se actualiza con --actualizar y sólo cuando la mejora es real.',
    medidoEl: new Date().toISOString().slice(0, 10),
    techos: medido,
  }, null, 2) + '\n')
  console.log(`  Techos de interfaz actualizados en ${TECHOS}.`)
  process.exit(0)
}

const { techos } = JSON.parse(readFileSync(TECHOS, 'utf8'))
const peores = []
for (const [clave, ahora] of Object.entries(medido)) {
  const antes = techos[clave]
  if (!antes) { peores.push(`${clave}: sin techo declarado — añádelo con --actualizar`); continue }
  if (ahora.axe > antes.axe) peores.push(`${clave}: axe ${antes.axe} → ${ahora.axe}`)
  if (ahora.ariaCurrent < antes.ariaCurrent) peores.push(`${clave}: aria-current ${antes.ariaCurrent} → ${ahora.ariaCurrent} (la navegación dejó de decir dónde estás)`)
  if (ahora.desborde && !antes.desborde) peores.push(`${clave}: la página empezó a desbordarse a lo ancho`)
  if (ahora.erroresDeConsola > antes.erroresDeConsola) peores.push(`${clave}: errores de consola ${antes.erroresDeConsola} → ${ahora.erroresDeConsola}`)
}

console.log('\n  TRINQUETE DE INTERFAZ\n')
for (const [clave, m] of Object.entries(medido)) {
  const t = techos[clave]
  console.log(`  · ${clave.padEnd(24)} axe ${String(m.axe).padStart(2)}${t ? ` (techo ${t.axe})` : ''}   aria-current ${m.ariaCurrent}   desborde ${m.desborde}`)
}
if (peores.length) {
  console.log('\n  EMPEORÓ:')
  for (const p of peores) console.log(`     ${p}`)
  console.log('\n  Arréglalo. El techo sólo baja.\n')
  process.exit(1)
}
console.log('\n  Sin regresión de interfaz.\n')
