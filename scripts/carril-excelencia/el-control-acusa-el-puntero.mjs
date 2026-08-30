/**
 * ¿ACUSA EL CONTROL QUE ESTÁ VIVO? — trinquete de estaticidad.
 *
 * Pasa el puntero por encima de cada control **habilitado y visible** de cada
 * ruta y compara su `backgroundColor` y su `color` antes y después. Si no
 * cambia nada, el control está MUDO: se ve igual apuntado que sin apuntar, y
 * entonces se lee como texto, no como algo a lo que se puede ir.
 *
 * POR QUÉ ESTO ES UNA MEDIDA Y NO UNA OPINIÓN
 * ───────────────────────────────────────────
 * El encargo pide que el producto «no se sienta estático, plano ni genérico».
 * Eso suena a gusto personal hasta que se cuenta: en `/consulta/pac-001` —donde
 * el médico escribe la nota— los **16 botones** no respondían al puntero. Ni
 * «Grabar la consulta», que es la acción primera del producto, ni «Firmar y
 * cerrar nota», que es la última. En `/operaciones`, **22 de 22**.
 *
 * Contar controles mudos convierte «se siente muerto» en un número que sólo
 * puede bajar.
 *
 * UN CONTROL APAGADO NO CUENTA
 * ────────────────────────────
 * Un `<button disabled>` que no responde al puntero está **bien**: decir «aquí
 * puedes pulsar» cuando no se puede es peor que callarse. Sólo se cuentan los
 * habilitados.
 *
 * QUÉ NO MIDE
 * ───────────
 * · **Si el acuse es el correcto.** Mide que algo cambie, no que el cambio sea
 *   el del sistema de diseño. Un botón que se pusiera fucsia al pasar contaría
 *   como vivo; para eso están el trinquete de diseño y mirar la pantalla.
 * · El pulsado (`:active`) y el foco: el foco lo cubre `arnes:foco-visible`.
 * · Lo que sólo existe dentro de un diálogo o un panel sin abrir.
 * · El teléfono: sin puntero no hay `:hover`. Esto es la comprobación de
 *   escritorio; en móvil el acuse es el `:active` y no se mide aquí.
 *
 * CÓMO SE USA
 * ───────────
 *   node scripts/carril-excelencia/el-control-acusa-el-puntero.mjs
 *   node scripts/carril-excelencia/el-control-acusa-el-puntero.mjs --actualizar
 *
 * El techo SÓLO PUEDE BAJAR. Si un cambio deja más controles mudos, se arregla
 * el cambio — no se mueve el techo.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const TECHOS = 'docs/audit/carril-excelencia/techos-de-estaticidad.json'
const ACTUALIZAR = process.argv.includes('--actualizar')

/** Las mismas rutas del trinquete de interfaz. Ver `el-foco-se-ve.mjs`: la lista
 *  escrita de memoria incluía cinco pantallas que no existen. */
const RUTAS = (process.env.RUTAS ?? [
  '/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas',
  '/operaciones', '/dashboard', '/pacientes', '/pendientes', '/configuracion',
  '/crm', '/reactivacion', '/resenas', '/membresias', '/farmacia',
  '/corte-caja', '/cumplimiento', '/cumplimiento/retencion', '/consultor',
  '/guia', '/consulta/pac-001', '/expediente/pac-001',
].join(',')).split(',')

const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
const pag = await ctx.newPage()

await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
try {
  await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
} catch {
  console.error(`\n  No apareció el formulario de acceso en ${BASE}/login.`)
  console.error('  Casi seguro: el servidor sirve un build hecho SIN la configuración del')
  console.error('  arnés. Para el servidor, borra .next, construye con las variables del')
  console.error('  arnés (NEXT_PUBLIC_FIREBASE_EMULATORS=1 …) y arranca otra vez.\n')
  await nav.close()
  process.exit(2)
}
await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
await pag.locator('input[type=password]').first().fill('demo1234')
await pag.locator('button[type=submit]').first().click()
await pag.waitForTimeout(9000)

/** Fondo y color de texto: las dos formas honestas de acusar sin adornar. */
const FOTO = (e) => {
  const c = getComputedStyle(e)
  return c.backgroundColor + '|' + c.color
}

const medido = {}
const detalle = {}

for (const ruta of RUTAS) {
  await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await pag.waitForTimeout(5000)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) {
      await b.click().catch(() => {})
      await pag.waitForTimeout(600)
    }
  }

  const estado = await pag.evaluate(() => ({
    main: !!document.querySelector('main'),
    texto: (document.body.innerText || '').slice(0, 120),
  })).catch(() => ({ main: false, texto: '' }))
  if (!estado.main) {
    console.error(
      /404|no encontrada/i.test(estado.texto)
        ? `  ROTA  ${ruta} — 404: esta ruta NO EXISTE. Corrige la lista, no el build.`
        : `  ROTA  ${ruta} — no montó <main> y no es un 404; casi seguro el servidor sirve un build viejo.`,
    )
    await nav.close()
    process.exit(2)
  }

  const cuantos = await pag.evaluate(() => {
    let i = 0
    document.querySelector('main').querySelectorAll('a,button,[role=button]').forEach(e => {
      const b = e.getBoundingClientRect()
      if (!b.width || e.offsetParent === null) return
      if (e.disabled === true || e.getAttribute('aria-disabled') === 'true') return
      e.dataset.acusePuntero = 'p' + (i++)
    })
    return i
  })

  const mudos = []
  for (let i = 0; i < cuantos; i++) {
    const el = pag.locator(`[data-acuse-puntero="p${i}"]`)
    try {
      const antes = await el.evaluate(FOTO)
      await el.hover({ force: true, timeout: 4000 })
      await pag.waitForTimeout(300)
      const despues = await el.evaluate(FOTO)
      if (antes === despues) {
        const rot = await el.evaluate(e => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 34))
        mudos.push(rot.replace(/\s+/g, ' '))
      }
      await pag.mouse.move(4, 4)
    } catch { /* el control se fue del árbol al mover el puntero; no se cuenta */ }
  }

  medido[ruta] = mudos.length
  detalle[ruta] = { total: cuantos, mudos }
  console.log(`  ${String(mudos.length).padStart(3)} mudos de ${String(cuantos).padEnd(4)} ${ruta}`)
  if (mudos.length) mudos.slice(0, 6).forEach(m => console.log(`        · ${m}`))
}

await nav.close()

// Un barrido que no encuentra controles no es un aprobado: es un barrido roto.
const totalControles = Object.values(detalle).reduce((a, d) => a + d.total, 0)
if (totalControles < 100) {
  console.error(`\n  Sólo se encontraron ${totalControles} controles en ${RUTAS.length} rutas. No está midiendo.\n`)
  process.exit(2)
}

if (ACTUALIZAR) {
  writeFileSync(TECHOS, JSON.stringify({
    queEsEsto:
      'Controles habilitados que NO acusan el puntero, por ruta. SÓLO PUEDEN BAJAR. ' +
      'Si un cambio deja más controles mudos, se arregla el cambio — no se mueve el techo. ' +
      'Se actualiza con --actualizar y sólo cuando la mejora es real.',
    medidoEl: new Date().toISOString().slice(0, 10),
    techos: medido,
  }, null, 2) + '\n')
  console.log(`\n  Techos de estaticidad actualizados en ${TECHOS}.`)
  process.exit(0)
}

const { techos } = JSON.parse(readFileSync(TECHOS, 'utf8'))
const peores = []
const mejores = []
for (const ruta of RUTAS) {
  const antes = techos[ruta]
  if (antes === undefined) { peores.push(`${ruta}: sin techo declarado — añádelo con --actualizar`); continue }
  if (medido[ruta] > antes) peores.push(`${ruta}: ${medido[ruta]} mudos, el techo era ${antes}`)
  if (medido[ruta] < antes) mejores.push(`${ruta}: ${medido[ruta]} mudos, el techo decía ${antes}`)
}

if (peores.length) {
  console.error('\n  MÁS CONTROLES MUDOS QUE ANTES:\n' + peores.map(p => '   · ' + p).join('\n') + '\n')
  process.exit(1)
}
if (mejores.length) {
  console.error(
    '\n  Hay holgura escondida: el producto está MEJOR que su techo.\n' +
    mejores.map(m => '   · ' + m).join('\n') +
    '\n\n  Baja los techos con --actualizar; si no, la mejora se puede perder sin que nadie se entere.\n',
  )
  process.exit(1)
}
console.log('\n  Sin estaticidad nueva.\n')
