/**
 * LAS LISTAS LARGAS — la otra mitad de «contenido largo».
 *
 * El arnés de siempre siembra cinco pacientes y ocho citas. Con eso no se puede
 * saber qué pasa el día que un consultorio lleva **doscientos cincuenta
 * pacientes y noventa citas**, que es un martes cualquiera de una consulta con
 * años de rodaje.
 *
 * Así que este guion **se hace su propio consultorio**: crea un médico en el
 * emulador de auth, lo pasa por el alta y le escribe las listas largas
 * directamente. No toca la cuenta sembrada, y por eso no mueve ningún techo de
 * los otros trinquetes.
 *
 * QUÉ SE PREGUNTA
 * ───────────────
 *  1. **¿Se sale algo de lado?** Con nombres largos y listas hondas.
 *  2. **¿Están TODAS?** Una lista que enseña 50 de 250 sin decirlo es peor que
 *     una lenta: el médico busca a alguien que sí está y no lo encuentra.
 *  3. **¿Cuánto árbol deja?** Se informa el número de nodos, que es lo que
 *     dice si hay virtualización o no.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **NO MIDE TIEMPO, y es a propósito.** Se intentó dos veces. Cronometrando
 *   desde la navegación, el número incluía mis propias esperas fijas e informaba
 *   «12 000 ms» de una lista que tardaba segundo y medio. Arrancando el reloj
 *   tras la última interacción, informaba «14 ms» — porque para entonces la
 *   lista ya estaba pintada. Ninguno de los dos medía lo que decía medir, así
 *   que se quitó en vez de publicarlo. El rendimiento percibido de las listas
 *   largas queda NOT_PROVEN.
 * · No mide desplazamiento con el dedo ni memoria.
 * · Sólo `/pacientes` y `/citas`. Otras listas —cobros, pendientes— no se miran.
 * · Deja el médico y su consultorio en el emulador. Es un emulador.
 */
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const AUTH = process.env.AUTH_EMULADOR ?? 'http://127.0.0.1:9099'
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const PROYECTO = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-nexusmed-v10'
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'arnes-visual-v10'

const CUANTOS_PACIENTES = Number(process.env.PACIENTES ?? 250)
const CUANTAS_CITAS = Number(process.env.CITAS ?? 90)

const ADMIN = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }

/** Codificador mínimo de campos para el REST de Firestore. */
const campos = (o) => {
  const f = {}
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'number') f[k] = { integerValue: String(v) }
    else if (typeof v === 'boolean') f[k] = { booleanValue: v }
    else f[k] = { stringValue: String(v) }
  }
  return f
}
const escribir = async (ruta, datos) => {
  const partes = ruta.split('/')
  const docId = partes.pop()
  const url = `http://${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/${partes.join('/')}?documentId=${encodeURIComponent(docId)}`
  const r = await fetch(url, { method: 'POST', headers: ADMIN, body: JSON.stringify({ fields: campos(datos) }) })
  if (!r.ok && r.status !== 409) throw new Error(`POST ${ruta}: ${r.status} ${await r.text()}`)
}

/* Nombres compuestos a la mexicana, para que el ancho de columna sufra de
   verdad y no con «Paciente 1». */
const NOMBRES = ['María Guadalupe', 'José Antonio', 'Ana Sofía', 'Luis Fernando', 'Rosa Elena', 'Juan Carlos', 'Dolores Concepción', 'Miguel Ángel']
const APELLIDOS = ['Villaseñor Etchegaray', 'Mendieta Cuevas', 'Barquín Salcedo', 'Iparraguirre Nolasco', 'de la Concepción Rivas', 'Ferreiro Ocampo', 'Alcántara Robledo', 'Quintanilla Zubieta']

const correo = `arnes-listas-${Date.now()}@nexusmed.test`
const alta = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: correo, password: 'demo1234', returnSecureToken: true }),
}).then(r => r.json()).catch(e => ({ error: String(e) }))
if (!alta.localId) {
  console.error(`\n  No se pudo crear el médico de prueba (${AUTH}): ${JSON.stringify(alta).slice(0, 160)}\n`)
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
  await nav.close(); process.exit(2)
}
await pag.locator('input[type=email]').first().fill(correo)
await pag.locator('input[type=password]').first().fill('demo1234')
await pag.locator('button[type=submit]').first().click()
await pag.waitForTimeout(11000)

const campo = pag.locator('input:visible')
await campo.nth(0).fill('Dr. Consulta Con Rodaje')
await campo.nth(1).fill('Consultorio de Muchos Pacientes')
if (await campo.count() > 2) await campo.nth(2).fill('Medicina Interna')
await pag.locator('button').filter({ hasText: /crear mi consultorio|crear|empezar/i }).first().click()
await pag.waitForTimeout(12000)

// De qué consultorio quedó dueño: hace falta para escribirle las listas.
const membresia = await fetch(
  `http://${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/clinic_members/${alta.localId}`,
  { headers: ADMIN },
).then(r => r.json()).catch(() => null)
const clinicId = membresia?.fields?.clinicId?.stringValue
if (!clinicId) {
  console.error(`\n  No se pudo leer el consultorio del médico recién creado. El alta no cuajó.\n`)
  await nav.close(); process.exit(2)
}

const hoy = new Date().toISOString().slice(0, 10)
process.stdout.write(`  sembrando ${CUANTOS_PACIENTES} pacientes y ${CUANTAS_CITAS} citas…`)
const pacientes = []
for (let i = 0; i < CUANTOS_PACIENTES; i++) {
  const id = `pac-largo-${String(i).padStart(4, '0')}`
  const nombre = `${NOMBRES[i % NOMBRES.length]} ${APELLIDOS[(i * 3) % APELLIDOS.length]}`
  pacientes.push({ id, nombre })
  await escribir(`clinics/${clinicId}/patients/${id}`, {
    nombre, telefono: `55550${String(10000 + i).slice(-5)}`,
    fechaNacimiento: '1970-01-01', sexo: i % 2 ? 'Masculino' : 'Femenino',
    alergias: '', seguroMedico: '', notas: '',
    noShowCount: 0, cancelacionCount: 0,
    createdAt: `${hoy}T08:00:00.000Z`, updatedAt: `${hoy}T08:00:00.000Z`,
  })
}
for (let i = 0; i < CUANTAS_CITAS; i++) {
  const p = pacientes[i % pacientes.length]
  const h = String(7 + Math.floor(i / 6)).padStart(2, '0')
  const m = String((i % 6) * 10).padStart(2, '0')
  await escribir(`clinics/${clinicId}/appointments/cita-larga-${String(i).padStart(4, '0')}`, {
    pacienteId: p.id, pacienteNombre: p.nombre, pacienteTelefono: '5555000000',
    fechaHora: `${hoy} ${h}:${m}`, duracion: 10, tipo: 'Seguimiento',
    motivo: 'Control', estado: i % 3 ? 'confirmada' : 'pendiente-confirmar',
    confirmada: i % 3 !== 0, createdAt: `${hoy}T08:00:00.000Z`,
  })
}
console.log(' listo')

const problemas = []
for (const [ruta, esperados] of [['/pacientes', CUANTOS_PACIENTES], ['/citas', CUANTAS_CITAS]]) {
  await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await pag.locator('main').first().waitFor({ timeout: 30000 }).catch(() => {})
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(600) }
  }
  /* En `/pacientes` la pestaña por defecto es «Recientes», que enseña los
     últimos quince a propósito. La lista larga vive en «Todos A-Z», y medir la
     otra sería medir una lista corta y llamarla larga. */
  const todos = pag.locator('button').filter({ hasText: /^Todos A-Z/ }).first()
  if (await todos.count().catch(() => 0)) await todos.click().catch(() => {})
  await pag.waitForTimeout(4000)
  const r = await pag.evaluate(() => {
    const m = document.querySelector('main')
    if (!m) return null
    const anchos = []
    for (const e of m.querySelectorAll('*')) {
      if (e.getBoundingClientRect().width > innerWidth + 2) anchos.push(e.tagName)
    }
    return {
      nodos: m.querySelectorAll('*').length,
      desborde: document.documentElement.scrollWidth > innerWidth + 1 || anchos.length > 0,
      // Las filas de verdad, contadas por lo que las identifica: el paciente
      // sembrado por este guion. Contar caracteres decía poco.
      filas: m.querySelectorAll('[href*="pac-largo-"], [data-paciente^="pac-largo-"]').length
        || (m.innerText.match(/Villaseñor Etchegaray|Mendieta Cuevas|Barquín Salcedo|Iparraguirre Nolasco|de la Concepción Rivas|Ferreiro Ocampo|Alcántara Robledo|Quintanilla Zubieta/g) || []).length,
    }
  })
  if (!r) { console.error(`  ROTA ${ruta}`); await nav.close(); process.exit(2) }

  if (r.desborde) problemas.push(`${ruta}: se sale de lado con la lista larga`)
  if (r.filas < esperados) problemas.push(`${ruta}: se pintaron ${r.filas} de ${esperados} filas`)
  console.log(`  ${(r.desborde || r.filas < esperados ? 'MAL' : 'ok').padEnd(5)} ${ruta.padEnd(14)} ${r.filas} de ${esperados} filas pintadas · ${r.nodos} nodos en <main> · desborde ${r.desborde}`)
}

await nav.close()
if (problemas.length) {
  console.error('\n  Las listas largas rompen la pantalla:\n' + problemas.map(p => '   · ' + p).join('\n') + '\n')
  process.exit(1)
}
console.log('\n  Las listas largas caben: nada se sale de lado.\n')
