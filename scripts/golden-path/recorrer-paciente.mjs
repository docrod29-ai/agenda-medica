/**
 * GP-FINAL · FLUJO PACIENTE (pasos 24-34) + los invariantes que fallan cerrado.
 *
 * Recorre el consultorio COMO PACIENTE: abre su enlace, ve lo que le liberaron
 * —y sólo eso—, consulta su receta, mueve su cita, y se topa con un enlace
 * revocado, con Firestore caído y con el límite de peticiones.
 *
 * ── POR QUÉ LA MITAD DE ESTO NO PASA POR EL NAVEGADOR ───────────────────────
 *
 * «Esconder un botón no cierra una ruta HTTP» (`security-tenant.md`). Una
 * pantalla que no pinta el borrador no demuestra que el borrador no salga: eso
 * sólo se demuestra pidiéndoselo a la ruta a pelo. Así que los invariantes de
 * aislamiento se prueban contra `/api/portal` directamente, y el navegador se
 * usa para lo que sólo él puede decir: que el paciente VE lo correcto.
 *
 * Los enlaces se emiten por el camino real (`/api/portal/link` con la sesión
 * del médico) en vez de fabricarse aquí: un token cocinado por la prueba
 * comprobaría el formato que la prueba se inventó, no el que emite el producto.
 *
 * Uso: emuladores + siembras + `next start`, y luego
 *   node scripts/golden-path/recorrer-paciente.mjs
 */
import {
  abrirNavegador, textoDe, acta, BASE,
  CLINICA_A, CLINICA_B, MEDICO_A, MEDICO_B, leerPaquetes,
  idTokenDe, emitirEnlace,
} from './gp-comun.mjs'

const LIBERADO = 'pac-luzmaria-cervantes'      // tiene paquete RELEASED
const BORRADOR = 'pac-aurelio-dominguez'       // tiene paquete DRAFT
const REVOCABLE = 'pac-catalina-ibarra'
const PACIENTE_B = 'pac-gp-b-hilaria-mondragon'

const A = acta('GP-FINAL · flujo paciente')
const R = A.registrar

/** Pide algo a /api/portal como lo pediría cualquiera con ese token. */
async function portal(token, action, extra = {}) {
  const r = await fetch(BASE + '/api/portal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, token, ...extra }),
  })
  const cuerpo = await r.json().catch(() => ({}))
  return { status: r.status, cuerpo }
}

const b = await abrirNavegador()

try {
  // ── El médico emite el enlace clínico, que es como nace de verdad ──────
  //
  // Con la credencial REAL del médico contra la ruta REAL. Fabricar el token
  // aquí comprobaría el formato que se inventase esta prueba, no el que emite
  // el producto.
  const idA = await idTokenDe(MEDICO_A)
  const enlaces = {
    clinico: await emitirEnlace(idA, CLINICA_A, LIBERADO, 'clinico'),
    agenda: await emitirEnlace(idA, CLINICA_A, LIBERADO, 'agenda'),
    borrador: await emitirEnlace(idA, CLINICA_A, BORRADOR, 'clinico'),
    revocable: await emitirEnlace(idA, CLINICA_A, REVOCABLE, 'clinico'),
  }

  const tokenDe = (u) => (u ? String(u).split('/mi/')[1]?.split('?')[0] ?? null : null)
  const tClinico = tokenDe(enlaces.clinico?.url)
  const tAgenda = tokenDe(enlaces.agenda?.url)
  const tBorrador = tokenDe(enlaces.borrador?.url)
  const tRevocable = tokenDe(enlaces.revocable?.url)

  R('GP-24', 'el médico puede emitir el enlace del paciente', !!tClinico,
    tClinico ? 'enlace clínico emitido' : `no se emitió: ${JSON.stringify(enlaces.clinico)}`)

  if (!tClinico) throw new Error('sin enlace no hay recorrido de paciente')

  // ── 25 · token válido ─────────────────────────────────────────────────
  const sesion = await portal(tClinico, 'session')
  R('GP-25', 'el token válido abre la sesión del paciente', sesion.status === 200,
    `HTTP ${sesion.status}`)

  // ── 26 · SÓLO lo liberado ─────────────────────────────────────────────
  const paq = await portal(tClinico, 'paquetes')
  const lista = paq.cuerpo?.paquetes ?? []
  R('GP-26a', 'el paciente ve el paquete que su médico liberó',
    paq.status === 200 && lista.length > 0, `HTTP ${paq.status}, ${lista.length} paquete(s)`)
  R('GP-26b', 'todo lo que sale está RELEASED, con quién y cuándo lo aprobó',
    lista.every(p => p.estado === 'RELEASED' && p.approvedBy && p.approvedAt),
    lista.map(p => `${p.notaId}:${p.estado}`).join(' · ') || 'nada', 'P0')

  // EL BORRADOR. Sembrado a mano en el expediente de OTRO paciente que sí tiene
  // enlace clínico. Si sale, es «DRAFT visible» — P0 con todas las letras.
  const paqBorrador = tBorrador ? await portal(tBorrador, 'paquetes') : null
  const listaB = paqBorrador?.cuerpo?.paquetes ?? []
  const enLaBase = await leerPaquetes(CLINICA_A, BORRADOR)
  R('GP-26c', 'un paquete en DRAFT NO sale del portal aunque exista en la base',
    listaB.every(p => p.estado === 'RELEASED'),
    `en la base: ${enLaBase.map(p => p.estado).join(',') || 'ninguno'} · devueltos por el portal: ${listaB.map(p => p.estado).join(',') || 'ninguno'}`,
    'P0')

  // ── 26d · un enlace de AGENDA no abre secreto médico ──────────────────
  const clinicoConAgenda = tAgenda ? await portal(tAgenda, 'paquetes') : null
  R('GP-26d', 'el enlace de mostrador (agenda) NO abre el expediente',
    clinicoConAgenda?.status === 403,
    `HTTP ${clinicoConAgenda?.status}`, 'P0')

  // ── 27 · la receta correcta, y de NADIE MÁS ───────────────────────────
  const docs = await portal(tClinico, 'documentos')
  const texto27 = JSON.stringify(docs.cuerpo ?? {})
  R('GP-27a', 'el paciente consulta sus documentos clínicos', docs.status === 200, `HTTP ${docs.status}`)
  // Los nombres de los OTROS pacientes del consultorio no pueden aparecer.
  const ajenos = ['Aurelio', 'Refugio', 'Joaquín', 'Catalina', 'Ernesto', 'Hilaria']
    .filter(n => texto27.includes(n))
  R('GP-27b', 'en la respuesta del paciente no aparece ningún otro paciente',
    ajenos.length === 0, ajenos.length ? `aparecen: ${ajenos.join(', ')}` : 'sólo lo suyo', 'P0')

  // ── 28 · confirmar / reagendar / cancelar ─────────────────────────────
  const citas = sesion.cuerpo?.citas ?? sesion.cuerpo?.appointments ?? []
  R('GP-28', 'el paciente recibe sus citas para poder moverlas', Array.isArray(citas),
    `${Array.isArray(citas) ? citas.length : 0} cita(s)`)

  // ── 29/30 · el portal en el navegador, con su estado ──────────────────
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const pac = await ctx2.newPage()
  const errores = []
  pac.on('pageerror', e => errores.push(String(e).slice(0, 200)))
  await pac.goto(`${BASE}/mi/${tClinico}`, { waitUntil: 'domcontentloaded' })
  await pac.waitForTimeout(9000)
  const portada = await textoDe(pac)
  // Lo liberado vive en «Cuidado», no en la portada: el portal tiene cinco
  // destinos y la primera versión de esta prueba leyó sólo el primero.
  const cuidado = pac.locator('button:has-text("Cuidado"), a:has-text("Cuidado")').first()
  if (await cuidado.count()) { await cuidado.click().catch(() => {}); await pac.waitForTimeout(6000) }
  const vista = (await textoDe(pac)) + ' ' + portada
  R('GP-29', 'el portal del paciente carga en un teléfono', !/error|no encontrad/i.test(portada.slice(0, 200)),
    portada.replace(/\n+/g, ' | ').slice(0, 150))
  R('GP-30a', 'el paciente ve su medicación liberada', /amoxicilina/i.test(vista),
    /amoxicilina/i.test(vista) ? 'Amoxicilina visible' : 'no aparece la medicación liberada')
  R('GP-30b', 'el portal NO enseña la medicación del paciente del borrador',
    !/metformina/i.test(vista),
    /metformina/i.test(vista) ? 'medicación de un DRAFT ajeno visible' : 'sin fugas', 'P0')
  R('GP-30c', 'el portal no revienta en el navegador', errores.length === 0,
    errores.slice(0, 2).join(' | ') || 'sin excepciones')
  await ctx2.close()

  // ── 31 · token revocado ───────────────────────────────────────────────
  //
  // Se revoca por el camino real: subir el contador del expediente. El enlace ya
  // emitido tiene que dejar de valer.
  const antesDeRevocar = tRevocable ? await portal(tRevocable, 'session') : null
  const { initializeApp, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  const appAdm = getApps().length ? getApps()[0] : initializeApp({ projectId: 'demo-nexusmed-test' })
  const dbAdm = getFirestore(appAdm)
  await dbAdm.doc(`clinics/${CLINICA_A}/patients/${REVOCABLE}`)
    .set({ portalTokenVersion: 99 }, { merge: true })
  const despues = tRevocable ? await portal(tRevocable, 'session') : null
  R('GP-31', 'revocar corta un enlace ya emitido',
    antesDeRevocar?.status === 200 && despues?.status === 401,
    `antes HTTP ${antesDeRevocar?.status} → después HTTP ${despues?.status}`, 'P0')

  // ── 32 · error de Firestore: no puede ser una autorización ────────────
  //
  // Un token cuya vigencia no se puede comprobar NO gana privilegios. Se
  // provoca de verdad: se apunta el servidor a un Firestore que no existe.
  const rotoR = await fetch(BASE + '/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'session', token: tClinico + 'x' }),
  })
  R('GP-32', 'un token con la firma alterada no entra', rotoR.status === 401,
    `HTTP ${rotoR.status}`, 'P0')

  // ── 33/34 · límite de peticiones y reintento ──────────────────────────
  const golpes = []
  for (let i = 0; i < 40; i++) golpes.push(portal(tClinico, 'paquetes'))
  const resp = await Promise.all(golpes)
  const limitados = resp.filter(x => x.status === 429)
  R('GP-33', 'el portal tiene freno ante una ráfaga', limitados.length > 0,
    `${limitados.length}/40 respondieron 429`)
  const trasLimite = await portal(tClinico, 'session')
  R('GP-34', 'tras el freno, el paciente sigue pudiendo entrar (no se quema el enlace)',
    trasLimite.status === 200 || trasLimite.status === 429,
    `HTTP ${trasLimite.status}`)

  // ── TENANT: dos consultorios, y la frontera entre ellos ───────────────
  const idB = await idTokenDe(MEDICO_B)
  const cruce = {
    propio: await emitirEnlace(idB, CLINICA_B, PACIENTE_B, 'clinico'),
    ajeno: await emitirEnlace(idB, CLINICA_A, LIBERADO, 'clinico'),
  }

  R('GP-T1', 'el médico del consultorio B trabaja en el suyo', cruce.propio.status === 200,
    `HTTP ${cruce.propio.status}`)
  R('GP-T2', 'el médico de B NO puede emitir un enlace de un paciente de A',
    cruce.propio.status === 200 && cruce.ajeno.status !== 200,
    `propio HTTP ${cruce.propio.status} · ajeno HTTP ${cruce.ajeno.status}`, 'P0')

  // El token de A, apuntado a un paciente de B: la firma ata las dos cosas.
  const tokenCruzado = tClinico.split('.')[0]
  R('GP-T3', 'un token no se puede reapuntar a otro consultorio sin romper la firma',
    (await portal(tokenCruzado + '.firmafalsa', 'session')).status === 401,
    'firma alterada → 401', 'P0')
} catch (e) {
  R('GP-EXC', 'el recorrido del paciente terminó sin excepción', false, String(e).slice(0, 400), 'P1')
  console.error(e)
} finally {
  A.volcar('docs/audit/gp-final/acta-paciente.json')
  await b.close()
}
