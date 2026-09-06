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
import { tokenDelPortal, claveDeRuta } from './token-del-portal.mjs'

const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE || 'http://localhost:3300'
const TECHOS = 'docs/audit/carril-excelencia/techos-de-interfaz.json'
const ACTUALIZAR = process.argv.includes('--actualizar')

/**
 * La superficie de Consultorio que este carril mide.
 *
 * Empezó en seis (la familia de la agenda, que era la que estaba rota). Las
 * catorce de la segunda tanda se añadieron el 30-ago tras medirlas por primera
 * vez: entre ellas salieron cuatro violaciones CRÍTICAS de axe —dos `select`
 * sin nombre, un campo de fecha sin etiqueta y el botón de enviar del
 * consultor— y tres de contraste. Estaban ahí desde siempre; lo que faltaba
 * era mirar.
 *
 * No entran las de hospital ni UCI: son ALPHA y no se venden. Tampoco las
 * rutas con parámetro, que necesitan un id sembrado y aún no lo tienen.
 */
const RUTAS = [
  '/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas', '/operaciones',
  '/dashboard', '/pacientes', '/pendientes', '/configuracion', '/crm', '/reactivacion',
  '/resenas', '/membresias', '/farmacia', '/corte-caja', '/cumplimiento',
  '/cumplimiento/retencion', '/consultor', '/guia',
  /**
   * Las dos con parámetro, con el paciente sintético que siembra
   * `scripts/design/sembrar-emulador.mjs` (`pac-001`, estable entre siembras).
   *
   * `/consulta` es LA superficie del producto —donde el médico pasa la visita—
   * y estuvo sin medir hasta el 30-ago justamente porque hacía falta un id.
   * Que el arnés ya siembre uno fijo quita la excusa.
   */
  '/consulta/pac-001', '/expediente/pac-001',
]

/**
 * EL PORTAL DEL PACIENTE entra por su propia puerta: un token HMAC, no la
 * sesión del equipo. El acuñado vive en `token-del-portal.mjs` — UNA sola
 * copia, porque dos copias de un cálculo de firma divergen y la olvidada
 * acuñaría un token que el servidor rechaza: el arnés mediría la pantalla de
 * «enlace no válido» creyendo que mide el portal, y publicaría un cero.
 *
 * Se midió por primera vez el 30-ago y salió con una violación: el botón
 * flotante del tema tapaba el destino «Perfil» de la barra del paciente.
 */
const ANCHOS = [390, 768, 1440]
const ALTOS = { 390: 844, 768: 1024, 1440: 900 }

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const nav = await chromium.launch({ executablePath: CHROME })
const medido = {}

for (const w of ANCHOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: ALTOS[w] } })
  const pag = await ctx.newPage()
  await pag.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  /**
   * ENTRAR ES PARTE DE MEDIR.
   *
   * Si el campo de correo no aparece, la causa casi siempre es la misma y no es
   * la pantalla: un `npm run build` de las compuertas reconstruyó `.next` con
   * OTRA configuración —sin emuladores— mientras este servidor seguía en pie.
   * Ha pasado OCHO veces en este carril, y las dos primeras me costaron
   * conclusiones falsas sobre el producto.
   *
   * La comprobación de hoja de estilo de más abajo no lo caza: el CSS está
   * perfecto; lo que falla es que la aplicación apunta a Firebase de verdad y el
   * formulario no llega a montarse. Un `TimeoutError` de Playwright tampoco lo
   * dice. Esto sí.
   */
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
  await pag.waitForTimeout(8000)

  const tokenPortal = tokenDelPortal()
  const rutasDeEsteAncho = tokenPortal ? [...RUTAS, `/mi/${tokenPortal}`] : RUTAS
  if (!tokenPortal && w === ANCHOS[0]) {
    console.log('  · portal del paciente: SIN MEDIR (falta PORTAL_PACIENTE_SECRET)')
  }

  for (const ruta of rutasDeEsteAncho) {
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
      // ¿SE SALE ALGO A LO ANCHO? La pregunta hay que hacérsela al contenedor
      // que hace scroll, no sólo al documento.
      //
      // Durante meses esto sólo miró `documentElement`, y por eso dio verde en
      // /finanzas@390 mientras 295 px de la pantalla —la tarjeta de
      // Transferencia entera, con su importe— quedaban fuera de la vista. El
      // documento no se desbordaba porque `<main>` lleva `overflow-x: auto` y
      // se lo tragaba: el contenido no desaparece, se esconde detrás de un
      // arrastre lateral que en un teléfono nadie descubre.
      //
      // Un guardián que pregunta del lado equivocado de la frontera es un
      // guardián en verde sin nada vigilado. Ahora se pregunta también a cada
      // contenedor de scroll de dentro de `<main>`.
      desborde: (() => {
        const raiz = document.documentElement
        if (raiz.scrollWidth > raiz.clientWidth + 1) return true
        for (const e of document.querySelectorAll('main, main *')) {
          const cs = getComputedStyle(e)
          if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue
          if (e.scrollWidth > e.clientWidth + 1) return true
        }
        return false
      })(),
      // ¿EN QUÉ PÁGINA ESTAMOS DE VERDAD? Una ruta que redirige al login se
      // mediría como si fuera la ruta pedida, y el login saca cero en todo.
      aterrizo: location.pathname,
      // ¿Y LLEGÓ LA HOJA DE ESTILO? Un `next build` bajo un `next start` en
      // marcha deja el chunk del CSS en 500: la página se pinta sin estilo y
      // axe da números que no son de este producto. Pasó el 30-ago y costó
      // media hora de conclusiones falsas — entre ellas «esta regla de CSS
      // está muerta», que era el servidor y no el producto.
      hojas: [...document.styleSheets].filter(h => {
        try { return h.cssRules.length > 20 } catch { return false }
      }).length,
    }))
    if (dom.aterrizo !== ruta && !ruta.startsWith('/mi/')) {
      console.error(`\n  ${ruta}@${w}: la sonda aterrizó en ${dom.aterrizo}. No se mide lo que no se visita.\n`)
      process.exit(2)
    }
    if (dom.hojas === 0) {
      console.error(`\n  ${ruta}@${w}: la página cargó SIN hoja de estilo. Para el servidor, borra .next, construye, arranca y vuelve a medir.\n`)
      process.exit(2)
    }
    // El token cambia en cada corrida (lleva caducidad): la clave se guarda
    // sin él, o el trinquete no podría comparar dos días seguidos.
    const clave = claveDeRuta(ruta)
    medido[`${clave}@${w}`] = { axe, ariaCurrent: dom.ariaCurrent, desborde: dom.desborde, erroresDeConsola: errores.length }
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
