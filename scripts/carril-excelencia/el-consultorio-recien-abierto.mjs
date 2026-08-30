/**
 * EL CONSULTORIO RECIÉN ABIERTO — el estado VACÍO, con un consultorio de verdad.
 *
 * Crea un médico nuevo en el emulador de auth, lo pasa por el alta, y recorre
 * las pantallas de un consultorio **sin una sola cita, ni paciente, ni cobro**.
 * Es el estado que ningún dato sembrado enseña y que todo médico ve el primer
 * día.
 *
 * De cada pantalla se pide una cosa: que **diga que está vacía**. Una zona en
 * blanco no es un estado vacío: es una pantalla que no terminó de escribirse.
 *
 * POR QUÉ SE CREA UN MÉDICO EN VEZ DE REUSAR UNO
 * ──────────────────────────────────────────────
 * Para que el guion sea repetible sin depender de que alguien haya sembrado —o
 * ensuciado— una cuenta concreta. Cada corrida se hace la suya, con correo
 * único, y no toca la del arnés.
 *
 * LO QUE SE MIDIÓ EL 30-AGO-2026
 * ──────────────────────────────
 * **Las 14 pantallas dicen su vacío**, y varias muy bien: «Hoy no hay citas. La
 * agenda está libre. + Agendar cita»; «Nada abierto — cuando firmes una consulta
 * con estudios o receta, sus pendientes aparecen aquí con fecha y dueño».
 *
 * Y esta sonda **se equivocó dos veces antes de acertar**: dio por callada a
 * `/lista-espera`, que dice «La lista de espera está vacía», y a `/pendientes`,
 * que dice «Nada abierto». El patrón no las reconocía. Un guion que acusa al
 * producto de lo que no hace es peor que no tenerlo, así que la lista de frases
 * de vacío está abajo, entera y a la vista, para que se vea qué reconoce.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **No juzga si el vacío está bien contado.** Comprueba que la pantalla lo
 *   diga, no que lo diga bien ni que ofrezca la acción siguiente.
 * · `/calendario` sale de la lista a propósito: una rejilla de semana vacía **es**
 *   la representación honesta de una semana sin citas, y ahí no hay frase que
 *   pedir. Lo que sí se le exige —que diga cuándo está CARGANDO en vez de
 *   parecer vacía— lo cubre `arnes:estado-de-carga`.
 * · No mide el vacío PARCIAL: un consultorio con pacientes pero sin cobros.
 * · Deja el médico creado en el emulador. Es un emulador; se tira al reiniciarlo.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const AUTH = process.env.AUTH_EMULADOR ?? 'http://127.0.0.1:9099'
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'arnes-visual-v10'

const RUTAS = (process.env.RUTAS ?? [
  '/dashboard', '/citas', '/pacientes', '/pendientes', '/finanzas', '/corte-caja',
  '/crm', '/reactivacion', '/farmacia', '/lista-espera', '/membresias', '/resenas',
  '/cumplimiento/retencion',
].join(',')).split(',')

/**
 * Las formas en que este producto dice «aquí no hay nada». Están todas escritas
 * porque las dos que faltaban hicieron que el guion acusara a dos pantallas que
 * sí lo decían.
 */
const DICE_QUE_ESTA_VACIO = new RegExp([
  'no hay', 'todav[íi]a no', 'a[úu]n no', 'ninguna', 'ning[úu]n', 'nadie',
  'nada abierto', 'est[áa] vac[íi][ao]', 'vac[íi][ao]', 'sin resultados',
  'sin .{0,20}(citas|pacientes|cobros|registros|movimientos|pendientes)',
  'empieza', 'primer[ao]?',
].join('|'), 'i')

const correo = `arnes-vacio-${Date.now()}@nexusmed.test`
const clave = 'demo1234'

const alta = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: correo, password: clave, returnSecureToken: true }),
}).then(r => r.json()).catch(e => ({ error: String(e) }))
if (!alta.localId) {
  console.error(`\n  No se pudo crear el médico de prueba en el emulador de auth (${AUTH}).`)
  console.error(`  Respuesta: ${JSON.stringify(alta).slice(0, 180)}\n`)
  process.exit(2)
}

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
await pag.locator('input[type=email]').first().fill(correo)
await pag.locator('input[type=password]').first().fill(clave)
await pag.locator('button[type=submit]').first().click()
await pag.waitForTimeout(11000)

if (!pag.url().includes('/setup')) {
  console.error(`\n  Un médico recién creado NO acabó en el alta, sino en ${pag.url()}.`)
  console.error('  O el alta cambió de sitio, o algo le está dando un consultorio que no tiene.\n')
  await nav.close()
  process.exit(2)
}

// El alta: nombre, consultorio, especialidad. Lo demás es opcional.
const campos = pag.locator('input:visible')
await campos.nth(0).fill('Dra. Prueba Vacía')
await campos.nth(1).fill('Consultorio Recién Abierto')
if (await campos.count() > 2) await campos.nth(2).fill('Medicina Interna')
/* El botón del alta NO es `type=submit` —se llama «Crear mi consultorio»— y
   buscarlo por el tipo agotaba el tiempo sin decir por qué. */
const crear = pag.locator('button').filter({ hasText: /crear mi consultorio|crear|empezar/i }).first()
await crear.waitFor({ timeout: 15000 }).catch(() => {})
if (!(await crear.count().catch(() => 0))) {
  console.error('\n  No se encontró el botón para crear el consultorio en el alta.\n')
  await nav.close()
  process.exit(2)
}
await crear.click()
await pag.waitForTimeout(12000)

if (!pag.url().includes('/dashboard')) {
  console.error(`\n  El alta no llevó al dashboard, sino a ${pag.url()}. Sin consultorio no hay vacío que medir.\n`)
  await nav.close()
  process.exit(2)
}

const calladas = []
for (const ruta of RUTAS) {
  await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await pag.locator('main').first().waitFor({ timeout: 15000 }).catch(() => {})
  await pag.waitForTimeout(5000)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) {
      await b.click().catch(() => {})
      await pag.waitForTimeout(600)
    }
  }
  const texto = await pag.evaluate(() => {
    const m = document.querySelector('main')
    return m ? (m.innerText || '').trim() : ''
  }).catch(() => '')

  const dice = DICE_QUE_ESTA_VACIO.test(texto)
  if (!dice) calladas.push(ruta)
  console.log(
    `  ${(dice ? 'dice su vacío' : 'CALLADA').padEnd(16)} ${ruta.padEnd(26)} ` +
    `${String(texto.length).padStart(5)} car · «${texto.replace(/\n+/g, ' | ').slice(0, 64)}»`,
  )
}

await nav.close()

if (calladas.length) {
  console.error(
    '\n  Pantallas de un consultorio recién abierto que NO dicen que están vacías.\n' +
    '  Una zona en blanco no es un estado vacío: es una pantalla sin terminar:\n' +
    calladas.map(r => '   · ' + r).join('\n') + '\n',
  )
  process.exit(1)
}
console.log(`\n  ${RUTAS.length} pantallas de un consultorio sin nada: todas lo dicen.\n`)
