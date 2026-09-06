/**
 * EL HUECO DICE QUE ESTÁ CARGANDO — y la pantalla no pierde su nombre.
 *
 * Ralentiza a propósito todo lo que pide datos (1,6 s), entra en cada ruta,
 * espera al ARMAZÓN —no a los datos— y mira qué hay en ese instante: el momento
 * en que el médico ya ve la pantalla y lo que la llena viene de camino.
 *
 * Se comprueban dos cosas distintas:
 *
 *  1. **La pantalla conserva su identidad.** Si no hay título, el médico no sabe
 *     si llegó a donde quería.
 *  2. **El hueco se declara.** Una pantalla que dibuja su estructura vacía sin
 *     decir que está cargando es indistinguible de una que no tiene nada.
 *
 * QUÉ LO TRAJO
 * ────────────
 * Dos hallazgos, y el segundo es el grave.
 *
 * · `/configuracion` y `/membresias` sustituían **`<main>` entero** por un
 *   renglón: 23 y 20 caracteres en toda la página, sin título ni estructura. Se
 *   pulsaba «Configuración» y se veía un lienzo vacío con una línea en la
 *   esquina.
 *
 * · `/calendario` recibía `loading` en sus tres vistas y **ninguna lo usaba**:
 *   el prop estaba escrito, pasado y sin conectar. Con la red lenta se veía una
 *   **semana entera dibujada y completamente vacía**, idéntica a «no tienes
 *   ninguna cita». El médico podía mirar su semana y darla por libre mientras
 *   las citas venían de camino.
 *
 * Eso último es la regla 4 de seguridad clínica dicha en interfaz —**ausencia de
 * dato no es dato de ausencia**— y la familia que este repositorio ya tiene
 * nombrada: el hueco tratado como dato.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **No juzga si el aviso es bueno**, sólo que existe y que el título sigue.
 * · No mide el estado VACÍO de verdad (cuando los datos llegan y no hay
 *   ninguno): eso pide sembrar un consultorio sin citas, y no se hace aquí.
 * · No mide el estado de ERROR (la petición falla): pendiente, y es otra sonda.
 * · Sólo la primera pantalla de cada ruta, no lo que carga dentro de un panel o
 *   un diálogo.
 * · El retardo es sintético. Con la red rápida del arnés estos estados duran
 *   milisegundos y por eso nadie los había mirado.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const RETARDO = Number(process.env.RETARDO ?? 1600)

/** Rutas que traen datos. Las puramente estáticas no tienen carga que mirar. */
const RUTAS = (process.env.RUTAS ?? [
  '/citas', '/calendario', '/finanzas', '/dashboard', '/pacientes', '/pendientes',
  '/crm', '/reactivacion', '/farmacia', '/corte-caja', '/lista-espera',
  '/membresias', '/resenas', '/configuracion', '/expediente/pac-001',
].join(',')).split(',')

const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
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

// A partir de aquí, lo que pide datos tarda: así el estado de carga se puede MIRAR.
await ctx.route('**/*', async r => {
  if (/firestore|googleapis|\/api\//.test(r.request().url())) {
    await new Promise(s => setTimeout(s, RETARDO))
  }
  await r.continue().catch(() => {})
})

const sinTitulo = []
const sinDecirlo = []
let miradas = 0

for (const ruta of RUTAS) {
  await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await pag.locator('main').first().waitFor({ timeout: 15000 }).catch(() => {})
  await pag.waitForTimeout(150)

  const r = await pag.evaluate(() => {
    const m = document.querySelector('main')
    if (!m) return null
    const texto = (m.innerText || '').trim()
    const titulo = m.querySelector('h1, .nx-page-title, [class*=page-title]')
    // Afordancia de carga DE VERDAD, no cualquier cosa que se mueva: la
    // animación de cambio de página también anima, y contarla haría pasar a
    // cualquier pantalla.
    const girando = [...m.querySelectorAll('*')]
      .filter(e => /spin|pulse|shimmer|skeleton|cargando/i.test(getComputedStyle(e).animationName || '')).length
    const esqueleto = m.querySelectorAll('[class*=skeleton],[class*=esqueleto],[class*=shimmer],[data-cargando]').length
    const ocupado = m.querySelectorAll('[aria-busy="true"]').length
    const barra = m.querySelectorAll('[role=progressbar]').length
    const dice = /cargando|loading/i.test(texto)
    return {
      chars: texto.length,
      titulo: titulo ? titulo.textContent.trim().slice(0, 28) : null,
      señal: girando + esqueleto + ocupado + barra + (dice ? 1 : 0),
      // Con poco texto la pantalla está claramente esperando; con mucho, ya
      // hay contenido y la carga que quede es de una parte, no del todo.
      vacia: texto.length < 260,
    }
  }).catch(() => null)

  if (!r) {
    console.error(`  ROTA  ${ruta} — no montó <main>.`)
    await nav.close()
    process.exit(2)
  }
  miradas++

  const problemas = []
  if (!r.titulo) { sinTitulo.push(ruta); problemas.push('PIERDE SU TÍTULO') }
  if (r.vacia && !r.señal) { sinDecirlo.push(ruta); problemas.push('HUECO SIN DECLARAR') }
  console.log(
    `  ${(problemas.join(' · ') || 'ok').padEnd(34)} ${ruta.padEnd(22)} ` +
    `${String(r.chars).padStart(5)} car · título=${r.titulo ?? '—'} · señal ${r.señal}`,
  )
}

await nav.close()

if (miradas < RUTAS.length) {
  console.error(`\n  Sólo se miraron ${miradas} de ${RUTAS.length} rutas. No está midiendo.\n`)
  process.exit(2)
}

if (sinTitulo.length || sinDecirlo.length) {
  if (sinTitulo.length) {
    console.error('\n  Pantallas que pierden su nombre mientras cargan:\n' +
      sinTitulo.map(r => '   · ' + r).join('\n'))
  }
  if (sinDecirlo.length) {
    console.error('\n  Pantallas que dibujan su hueco SIN decir que están cargando —un hueco así\n' +
      '  no se distingue de «no hay nada», y eso es tratar el hueco como dato:\n' +
      sinDecirlo.map(r => '   · ' + r).join('\n'))
  }
  console.error('')
  process.exit(1)
}
console.log(`\n  ${miradas} rutas: todas conservan su nombre y declaran su hueco.\n`)
