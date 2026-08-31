/**
 * ¿SE VE DÓNDE ESTÁ EL FOCO? — barrido sobre el producto vivo.
 *
 * Enfoca cada campo visible de cada ruta y compara la foto de sus propiedades
 * de foco ANTES y DESPUÉS: `outlineWidth · outlineStyle · boxShadow ·
 * borderColor · backgroundColor`. Si la foto es idéntica, el campo está MUDO:
 * el cursor llegó y la pantalla no lo dijo.
 *
 * POR QUÉ HACE FALTA MEDIRLO Y NO BASTA CON LEERLO
 * ────────────────────────────────────────────────
 * **axe no tiene regla de foco visible.** Catorce pantallas de este producto
 * pasaron la auditoría con 0 violaciones llevando dentro 15 campos mudos en la
 * pantalla donde el médico escribe la nota. El criterio 2.4.7 de WCAG 2.2 (AA)
 * es de los que sólo se comprueban ejecutando.
 *
 * Y tampoco basta con leer el CSS: el defecto que encontró esta sonda venía de
 * un `style={{ outline: 'none' }}` en línea que **le ganaba por especificidad**
 * al `:focus-visible` global. En la hoja de estilo todo estaba bien.
 *
 * QUÉ NO MIDE
 * ───────────
 * · El **contraste** del anillo contra el fondo del campo (1.4.11 / 2.4.13).
 * · Si el anillo se **recorta** por un `overflow: hidden` del contenedor.
 * · Campos que sólo existen dentro de un diálogo o un panel sin abrir: sólo ve
 *   lo que está visible al aterrizar en la ruta.
 * · Controles que no son campos (botones, enlaces): el defecto que lo trajo era
 *   de campos, y ampliarlo sin haberlo mirado sería inventarse el alcance.
 *
 * El guardián de tabla es `el-campo-que-se-queda-sin-anillo-de-foco.test.ts`,
 * que vigila la CAUSA (el apagado en línea) y corre en CI sin navegador. Este
 * guion comprueba el EFECTO sobre el producto vivo, que es lo que ve el médico.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
/**
 * Las mismas 23 rutas del trinquete de interfaz, y por una razón: la primera
 * versión de este guion las escribí de memoria e incluí `/inventario`,
 * `/recetas`, `/laboratorio`, `/tareas` y `/mensajes`, que **no existen**. Todas
 * dieron 404 y el barrido las contó como «0 de 0 · ok». Cinco aprobados sobre
 * pantallas que no estaban ahí.
 */
const RUTAS = (process.env.RUTAS ?? [
  '/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas',
  '/operaciones', '/dashboard', '/pacientes', '/pendientes', '/configuracion',
  '/crm', '/reactivacion', '/resenas', '/membresias', '/farmacia',
  '/corte-caja', '/cumplimiento', '/cumplimiento/retencion', '/consultor',
  '/guia', '/consulta/pac-001', '/expediente/pac-001',
].join(',')).split(',')

/** Las cinco propiedades por las que un campo puede decir «estoy enfocado». */
const FOTO = (e) => {
  const c = getComputedStyle(e)
  return [c.outlineWidth, c.outlineStyle, c.boxShadow, c.borderColor, c.backgroundColor].join('|')
}

const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
const pag = await ctx.newPage()

await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
try {
  await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
} catch {
  // La misma guarda que el resto del arnés, por novena vez.
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

let mudosTotal = 0
let camposTotal = 0
let rutasConCampos = 0

for (const ruta of RUTAS) {
  await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await pag.waitForTimeout(5000)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) {
      await b.click().catch(() => {})
      await pag.waitForTimeout(500)
    }
  }

  // Una ruta que no montó no tiene campos, y «0 de 0» se lee como aprobado si
  // nadie lo mira. Que la ruta exista y que la pantalla monte son dos fallos distintos, y
  // decir el segundo por el primero manda a reconstruir el arnés por nada. Lo
  // aprendí escribiendo este guion: mi lista llevaba cinco rutas inventadas.
  const estado = await pag.evaluate(() => ({
    main: !!document.querySelector('main'),
    texto: (document.body.innerText || '').slice(0, 120),
  })).catch(() => ({ main: false, texto: '' }))
  if (!estado.main) {
    const esCuatroCientoCuatro = /404|no encontrada/i.test(estado.texto)
    console.error(
      esCuatroCientoCuatro
        ? `  ROTA  ${ruta} — 404: esta ruta NO EXISTE. Corrige la lista, no el build.`
        : `  ROTA  ${ruta} — no montó <main> y no es un 404; casi seguro el servidor sirve un build viejo.`,
    )
    await nav.close()
    process.exit(2)
  }

  const campos = await pag.evaluate(() => {
    const raiz = document.querySelector('main') || document.body
    const out = []
    const sel = 'textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select'
    raiz.querySelectorAll(sel).forEach((e, i) => {
      if (!e.getBoundingClientRect().width || e.offsetParent === null) return
      e.dataset.sondaFoco = 'f' + i
      out.push({
        sel: 'f' + i,
        rotulo: (e.getAttribute('placeholder') || e.getAttribute('aria-label') || e.name || e.tagName).slice(0, 40),
      })
    })
    return out
  }).catch(() => [])

  const mudos = []
  for (const c of campos) {
    try {
      const antes = await pag.$eval(`[data-sonda-foco="${c.sel}"]`, FOTO)
      await pag.$eval(`[data-sonda-foco="${c.sel}"]`, e => e.focus())
      await pag.waitForTimeout(120)
      const despues = await pag.$eval(`[data-sonda-foco="${c.sel}"]`, FOTO)
      if (antes === despues) mudos.push(c.rotulo)
      await pag.$eval(`[data-sonda-foco="${c.sel}"]`, e => e.blur())
    } catch { /* el campo se fue del árbol; no se cuenta */ }
  }

  mudosTotal += mudos.length
  camposTotal += campos.length
  if (campos.length) rutasConCampos++
  console.log(`  ${mudos.length ? 'MUDOS' : '  ok '} ${ruta.padEnd(22)} ${mudos.length}/${campos.length}`)
  mudos.forEach(m => console.log(`          · ${m}`))
}

await nav.close()

// Un barrido que no encuentra campos no es un aprobado: es un barrido roto.
if (rutasConCampos < 3) {
  console.error(`\n  El barrido sólo encontró campos en ${rutasConCampos} rutas. No está midiendo.\n`)
  process.exit(2)
}

console.log(`\n  ${camposTotal} campos en ${RUTAS.length} rutas · sin señal de foco: ${mudosTotal}`)
if (mudosTotal) {
  console.error('\n  Hay campos que no acusan el foco (WCAG 2.2 AA · 2.4.7).\n')
  process.exit(1)
}
console.log('  Todos los campos enseñan el foco.\n')
