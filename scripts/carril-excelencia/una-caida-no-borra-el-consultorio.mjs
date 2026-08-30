/**
 * UNA CAÍDA NO BORRA EL CONSULTORIO — el estado de ERROR, sobre el producto vivo.
 *
 * Entra con una sesión buena, y a partir de ahí hace **fallar con 500 todo lo
 * que pide datos** —el emulador de Firestore incluido—. Después recorre rutas y
 * comprueba dos cosas:
 *
 *  1. **Que el producto lo DIGA.** Una pantalla que se cae en silencio deja al
 *     médico creyendo lo que ve.
 *  2. **Que NO le ofrezca crear un consultorio.** Es el defecto que trajo este
 *     guion: con el acceso a datos cortado, las cuatro rutas probadas acababan
 *     en «Configura tu consultorio · ¡Bienvenido!». A un médico con su
 *     consultorio, sus pacientes y su historia, la aplicación le decía que no
 *     tenía consultorio y lo invitaba a crear uno.
 *
 * La causa estaba en `ClinicContext`: un snapshot vacío **de cache** —el que
 * llega cuando el servidor no contesta— se trataba igual que uno confirmado por
 * el servidor. Ausencia de dato tomada por dato de ausencia, en la puerta de
 * entrada. Y la pantalla correcta ya existía a dos líneas: «No pudimos cargar tu
 * consultorio · Tus datos están a salvo en el servidor».
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo la caída TOTAL de datos.** Un fallo parcial —una colección que
 *   responde y otra no— es otro escenario y no se simula aquí.
 * · No mide cuánto tarda en rendirse (son 8 s de red de seguridad en el
 *   contexto); mide dónde acaba.
 * · No comprueba que el botón de Reintentar reintente de verdad.
 * · No cubre la caída de **auth**: la sesión se establece antes de cortar.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const RUTAS = (process.env.RUTAS ?? '/dashboard,/citas,/calendario,/finanzas,/expediente/pac-001').split(',')

/** Lo que NUNCA puede salir por una caída de red. */
const ALTA_DE_CONSULTORIO = /configura tu consultorio|¡bienvenido!/i
/** Lo que sí tiene que salir: el producto diciendo lo que pasa. */
const LO_DICE = /no pudimos|no se pudo|no cargó|conexión|reintent|tardó demasiado/i

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

// Comprobación de que la sesión SÍ funcionaba antes de cortar: si no, lo que
// midamos después no dice nada.
const antes = await pag.evaluate(() => (document.body.innerText || '').slice(0, 200))
if (ALTA_DE_CONSULTORIO.test(antes)) {
  console.error('\n  La sesión de prueba ya estaba sin consultorio ANTES de cortar la red.')
  console.error('  Siembra el emulador (npm run arnes:sembrar) y vuelve a intentarlo.\n')
  await nav.close()
  process.exit(2)
}

let cortadas = 0
await ctx.route('**/*', async r => {
  const u = r.request().url()
  if (/firestore|:8080|googleapis|\/api\//.test(u)) {
    cortadas++
    await r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"caida simulada"}' }).catch(() => {})
    return
  }
  await r.continue().catch(() => {})
})

const ofreceAlta = []
const calladas = []

for (const ruta of RUTAS) {
  cortadas = 0
  await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await pag.waitForTimeout(11000)   // 8 s de red de seguridad del contexto + margen
  const texto = await pag.evaluate(() => (document.body.innerText || '').trim()).catch(() => '')

  const ofrece = ALTA_DE_CONSULTORIO.test(texto)
  const dice = LO_DICE.test(texto)
  if (ofrece) ofreceAlta.push(ruta)
  else if (!dice) calladas.push(ruta)

  console.log(
    `  ${(ofrece ? 'OFRECE CREAR CONSULTORIO' : dice ? 'lo dice' : 'CALLADA').padEnd(26)}` +
    `${ruta.padEnd(22)} ${String(cortadas).padStart(3)} peticiones cortadas · «${texto.replace(/\n+/g, ' | ').slice(0, 68)}»`,
  )
}

await nav.close()

if (!ofreceAlta.length && !calladas.length) {
  console.log(`\n  ${RUTAS.length} rutas: la caída se dice, y ninguna ofrece crear un consultorio.\n`)
  process.exit(0)
}
if (ofreceAlta.length) {
  console.error(
    '\n  UNA CAÍDA DE RED ESTÁ BORRANDO EL CONSULTORIO. Estas rutas ofrecen darlo de alta\n' +
    '  a un médico que YA lo tiene — ausencia de dato tomada por dato de ausencia:\n' +
    ofreceAlta.map(r => '   · ' + r).join('\n'),
  )
}
if (calladas.length) {
  console.error(
    '\n  Estas rutas se caen en silencio: ni dicen que falló ni ofrecen reintentar:\n' +
    calladas.map(r => '   · ' + r).join('\n'),
  )
}
console.error('')
process.exit(1)
