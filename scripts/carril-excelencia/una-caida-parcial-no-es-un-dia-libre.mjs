/**
 * UNA CAÍDA PARCIAL NO ES UN DÍA LIBRE.
 *
 * El otro guion de errores —`una-caida-no-borra-el-consultorio`— corta TODO el
 * acceso a datos y comprueba que el producto lo diga. Ese caso está medido en
 * las 23 rutas y lo resuelve una sola pantalla global: «No pudimos cargar tu
 * consultorio».
 *
 * Éste mide **el escenario que aquel declara fuera de su alcance**: el
 * consultorio SÍ cargó, y lo que falla es una consulta concreta. No salta
 * ninguna pantalla global —el contexto ya está resuelto— y cada pantalla se
 * queda a solas con una lista vacía. Y una lista de citas vacía tiene dos causas
 * que se ven idénticas:
 *
 *   · ese día no hay pacientes;
 *   · ese día no se pudo preguntar.
 *
 * Sólo una de las dos significa que el médico tiene el día libre.
 *
 * POR QUÉ SE CORTA CON LAS REGLAS Y NO CON LA RED
 * ──────────────────────────────────────────────
 * La primera versión cortaba peticiones con el enrutador del navegador, como el
 * otro guion. **Interceptó cero** y lo informó como bueno: Firestore mantiene un
 * canal largo ya abierto y, ante un fallo de red, **sirve la caché en silencio**
 * — el callback de error de `onSnapshot` ni se entera. Es decir: por la vía de la
 * red este defecto NO se alcanza, y una versión que no contara las peticiones
 * cortadas habría publicado un verde vacío.
 *
 * Las causas que SÍ encienden `error` son las de servidor: permiso denegado
 * (un miembro dado de baja, un despliegue de reglas con un fallo, un token que
 * perdió su reclamación) y falta de índice. Se emula la primera cambiando las
 * reglas del emulador, y se devuelven al terminar pase lo que pase.
 *
 * QUÉ SE MIDIÓ EL 30-AGO-2026, ANTES DEL ARREGLO
 * ──────────────────────────────────────────────
 * `/calendario` pintaba la rejilla entera —«Lun 24 · Mar 25 · Mié 26…»— vacía y
 * **sin decir nada**: el aviso «Cargando la agenda…» se quita con `loading`, y al
 * fallar la consulta `loading` baja igual. Ni siquiera saltaba la frontera de
 * error genérica.
 *
 * Y el modal de agendar ofrecía como libres las horas ya tomadas. Medido en
 * frío sobre los motores: con una cita cargada, 9 huecos y conflicto a las 10:00
 * = `true`; con la lista vacía, **10 huecos y conflicto = `false`**.
 *
 * La cita NO llega a escribirse encima: `/api/appointments` re-chequea en
 * transacción y devuelve 409. El daño es de información, no de datos — pero para
 * cuando salta el 409 ya se le dijo la hora al paciente por teléfono.
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo permiso denegado.** La falta de índice enciende el mismo callback,
 *   pero no se emula aquí.
 * · No comprueba que el aviso se QUITE al volver el permiso.
 * · No cubre el fallo de red, y ya se ha dicho por qué: por esa vía Firestore
 *   sirve caché y no hay error que recoger.
 * · Las otras siete llamadas a `useAppointments` que no recogen `error`
 *   —`PanelPendientes`, `/asistente`, las notificaciones— quedan dichas en el
 *   guardián, no medidas aquí.
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const PROYECTO = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-nexusmed-v10'

const REGLAS = readFileSync('firestore.rules', 'utf8')
const CON_PERMISO = `      match /appointments/{docId} {
        allow read: if isMember(clinicId);`
const SIN_PERMISO = `      match /appointments/{docId} {
        allow read: if false;`
if (!REGLAS.includes(CON_PERMISO)) {
  console.error('\n  La regla de lectura de `appointments` cambió de forma; este guion ya no sabe negarla.\n')
  process.exit(2)
}

/** Publica reglas en el EMULADOR. Nunca toca el proyecto real. */
const publicarReglas = async (contenido) => {
  const r = await fetch(`http://${FIRESTORE}/emulator/v1/projects/${PROYECTO}:securityRules`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: contenido }] } }),
  })
  if (!r.ok) throw new Error(`No se pudieron publicar las reglas: ${r.status} ${await r.text()}`)
}
const negarCitas = () => publicarReglas(REGLAS.replace(CON_PERMISO, SIN_PERMISO))
const devolverReglas = () => publicarReglas(REGLAS)

const DICE_AGENDA = /no se pudo cargar tu agenda/i

let nav
const fallos = []
try {
  await devolverReglas()   // se parte de un estado conocido
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

  /* ── 1 · EL CALENDARIO ──────────────────────────────────────────────────── */
  // Con permiso, para saber que la pantalla funciona y que hay algo que perder.
  await pag.goto(`${BASE}/calendario`, { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(9000)
  const conPermiso = await pag.evaluate(() => document.body.innerText || '')
  if (DICE_AGENDA.test(conPermiso)) {
    console.error('\n  Con permiso el calendario YA se queja. Lo que midamos sin permiso no diría nada.\n')
    process.exit(2)
  }
  console.log('  con permiso  · el calendario carga y no se queja — ok')

  await negarCitas()
  await pag.reload({ waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(13000)
  const sinPermiso = await pag.evaluate(() => document.body.innerText || '')
  const rejilla = /\bLun\b|\bMar\b|\bMié\b/.test(sinPermiso)
  const loDice = DICE_AGENDA.test(sinPermiso)
  console.log(`  sin permiso  · rejilla pintada: ${rejilla} · lo dice: ${loDice}`)
  if (!rejilla) {
    console.error('\n  Sin permiso no se pintó la rejilla; el guion no midió lo que dice medir.\n')
    process.exit(2)
  }
  if (!loDice) fallos.push('/calendario pinta la semana vacía y no dice que falló')

  /* ── 2 · EL MODAL DE AGENDAR ────────────────────────────────────────────── */
  /* Aquí el orden importa: con el permiso ya negado NO hay ninguna cita que
     abrir, así que el modal sería inalcanzable. Se abre CON permiso y se niega
     después, que además es la secuencia realista: el mostrador ya tiene el modal
     delante y cambia la fecha a otro día. */
  await devolverReglas()
  await pag.goto(`${BASE}/citas`, { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(9000)
  /* La bienvenida de primera vez se come los clics: es un diálogo modal de
     verdad, y sin quitarlo lo que falla es el guion, no el producto. */
  for (const t of [/^saltar$/i, /^entendido$/i, /^empezar/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pag.waitForTimeout(900) }
  }
  // «Editar cita» vive tras los tres puntos de cada fila.
  let abierto = false
  const menu = pag.locator('button:visible[aria-label^="Más acciones"]').first()
  if (await menu.count().catch(() => 0)) {
    await menu.click().catch(() => {})
    await pag.waitForTimeout(1200)
    const ed = pag.locator('button:visible, [role=menuitem]:visible').filter({ hasText: /Editar cita/i }).first()
    if (await ed.count().catch(() => 0)) { await ed.click().catch(() => {}); abierto = true }
  }
  await pag.waitForTimeout(3000)
  if (!abierto || !(await pag.locator('input[type=date]:visible').count().catch(() => 0))) {
    console.error('\n  No se pudo abrir el modal de agendar desde /citas; el guion no midió lo que dice medir.\n')
    process.exit(2)
  }
  console.log('  modal        · abierto con permiso — ok')

  /*
   * SE CIERRA Y SE VUELVE A ABRIR, y no es un rodeo: es la única forma de que la
   * consulta del modal se rehaga.
   *
   * La primera versión negaba el permiso con el modal delante y cambiaba la
   * fecha a un día POSTERIOR, esperando que se re-suscribiera. No se
   * re-suscribe, y con razón: `useAppointments` sólo amplía la ventana hacia
   * atrás —«la ventana solo crece, nunca se encoge»— para no rehacer la
   * suscripción cada vez que alguien pasea por los meses. Con una fecha futura
   * `desde` no cambia, no hay consulta nueva, y `error` se queda en `null`
   * correctamente. El guion medía el producto y el que fallaba era el guion.
   *
   * Al cerrar y reabrir, el modal se monta de cero y crea su propia suscripción
   * —cada llamada al hook tiene estado propio—, que es la que se topa con el
   * permiso negado. Y es una secuencia realista: el mostrador abre una cita,
   * la cierra y abre otra.
   */
  /*
   * Y AQUÍ EL MODAL SE QUEDA SIN MEDIR, dicho con todas las letras.
   *
   * Con el permiso de lectura negado, TODOS los caminos que abren este modal
   * pasan antes por una lista que también falla: `/citas` cambia la lista por su
   * estado de error —bien hecho— y el calendario se queda sin bloques que
   * pulsar. No se puede editar una cita que no se puede ver. Así que la única
   * causa de error que este arnés sabe provocar es justamente la que hace el
   * modal inalcanzable.
   *
   * Se intentaron dos rodeos y ninguno mide lo que dice:
   *   · negar con el modal delante y mover la fecha a un día POSTERIOR — no
   *     re-suscribe, porque la ventana de `useAppointments` sólo crece hacia
   *     atrás, a propósito;
   *   · cerrar y reabrir — para entonces la fila ya no está.
   *
   * Lo que SÍ queda probado y basta para justificar el aviso:
   *   · que `error` se enciende de verdad en un permiso denegado — medido arriba,
   *     en el calendario, en este mismo navegador;
   *   · que la consecuencia es real — medido en frío sobre los motores: con la
   *     lista vacía `getAvailableSlots` da 10 huecos donde había 9 y
   *     `hasConflict` dice `false` donde decía `true`.
   *
   * Lo que falta es ver el aviso pintado. La causa que lo alcanzaría en
   * producción es la que este emulador no sabe fabricar: un índice que falta
   * para la ventana ANCHA del modal —que arranca 120 días atrás— mientras la
   * consulta estrecha de la pantalla sí responde. Queda **NOT_PROVEN en
   * navegador**, y así está escrito en la matriz.
   */
  console.log('  modal        · NOT_PROVEN en navegador — inalcanzable con el permiso negado (ver cabecera)')
} finally {
  await devolverReglas().catch(e => console.error('  AVISO: no se pudieron devolver las reglas:', String(e).slice(0, 120)))
  if (nav) await nav.close().catch(() => {})
}

if (fallos.length) {
  console.error('\n  UNA CAÍDA PARCIAL SE ESTÁ HACIENDO PASAR POR UN DÍA LIBRE:\n'
    + fallos.map(f => '   · ' + f).join('\n') + '\n')
  process.exit(1)
}
console.log('\n  Una caída parcial se dice: la agenda vacía no se hace pasar por un día libre.\n')
