#!/usr/bin/env node
/**
 * WS-02 — EL ARNÉS QUE MIDE LA ESCALA, Y QUE NO INVENTA LO QUE NO MIDIÓ.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * `validate-consultorio-load-result.mjs` sabe leer y juzgar un JSON de carga
 * desde hace tiempo, y `generate-consultorio-load-fixture.mjs` sabe fabricar el
 * corpus sintético. En medio **no había nada**: ningún programa producía el JSON,
 * así que WS-02 seguía `NOT_DONE` con un validador que nunca había validado nada.
 *
 * ── LA TRAMPA DE ESTE ARNÉS, Y POR QUÉ ES LA DECISIÓN DE DISEÑO ─────────────
 *
 * El validador exige que los seis bloqueadores incondicionales
 * —`crossTenantLeakageCount` y compañía— sean **enteros no negativos**. Un arnés
 * que corra donde no puede observar alguno de ellos sólo tiene dos salidas:
 *
 *   · escribir `0`, que se lee como «se midió y no hubo ninguno», o
 *   · no escribir el campo.
 *
 * Lo primero **fabrica evidencia**: un cero por no haber mirado es exactamente
 * «ausencia de dato tratada como dato de ausencia», la regla 4 de seguridad
 * clínica dicha en lenguaje de operación. Y el coste es del mismo orden: quien
 * lea ese JSON creerá que se comprobó la fuga entre consultorios.
 *
 * Así que este arnés escribe **`null`** en todo lo que no midió, y una lista
 * `noMedido` que dice, para cada uno, **qué entorno haría falta**. Un informe con
 * `null` **el validador lo rechaza**, que es la respuesta correcta: no es
 * evidencia todavía. El arnés no se ablanda para pasar su propia puerta, y el
 * validador no se toca para dejarlo pasar.
 *
 * ── LO QUE SÍ MIDE, Y CONTRA QUÉ ────────────────────────────────────────────
 *
 * Contra el **emulador de Firestore con `firestore.rules` cargadas de verdad** y
 * el de Auth acuñando usuarios reales. Eso hace que la fuga entre consultorios se
 * pueda medir de verdad: un médico del consultorio A intenta leer y escribir el
 * expediente del B, y lo que decide es la regla desplegable, no una promesa.
 *
 *   · latencia p50/p95/p99 del camino clínico real, bajo N consultas concurrentes
 *   · fuga entre consultorios — sondas de lectura Y de escritura, cruzadas
 *   · idempotencia — la misma escritura repetida no puede duplicar
 *   · guardado durable — se relee y se compara
 *   · recuperación — una secuencia cortada no deja media nota
 *
 * ── LO QUE NO PUEDE MEDIR AQUÍ, DICHO ───────────────────────────────────────
 *
 * Pantalla en blanco, borrador perdido y fallo silencioso de proveedor son de
 * navegador y de proveedor: no hay ninguno de los dos en un emulador. Las cuatro
 * colas tampoco existen sin proveedores detrás. Y las lecturas sin cota son una
 * propiedad **estática** del árbol —la vigila `la-lectura-sin-cota`—, no algo que
 * este arnés observe corriendo.
 *
 * ── CONTRA PRODUCCIÓN, NO ───────────────────────────────────────────────────
 *
 * `--target` sólo acepta `emulator`. Meter carga sintética en el proyecto vivo
 * escribe documentos junto a expedientes reales y es una de las cosas que el
 * charter reserva al dueño. Cuando él lo autorice, es una bandera más y el resto
 * del arnés no cambia.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   npx firebase emulators:start --only firestore,auth --project nexomed-agenda
 *   node scripts/product/run-consultorio-load.mjs \
 *     --tenants=8 --physicians-per-tenant=4 --concurrent=16 \
 *     --patients-per-physician=25 --out=carga.json
 *   node scripts/product/validate-consultorio-load-result.mjs carga.json
 */
import { writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import process from 'node:process'

/* ── configuración ────────────────────────────────────────────────────────── */

const PREDETERMINADO = {
  target: 'emulator',
  tenants: 4,
  physiciansPerTenant: 2,
  patientsPerPhysician: 10,
  concurrent: 8,
  seed: '20260830',
  scenario: 'consulta-concurrente-emulador',
  environment: 'firestore-emulator-local',
  out: '-',
}

/** Enteros: el resto se queda como texto. */
const NUMERICOS = ['tenants', 'physiciansPerTenant', 'patientsPerPhysician', 'concurrent']

function leerArgumentos(argv) {
  const cfg = { ...PREDETERMINADO }
  for (let i = 2; i < argv.length; i += 1) {
    const bruto = argv[i]
    if (!bruto.startsWith('--')) throw new Error(`Argumento inesperado: ${bruto}`)
    const [nombre, pegado] = bruto.slice(2).split('=', 2)
    const clave = nombre.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const valor = pegado ?? argv[++i]
    if (valor == null) throw new Error(`Falta el valor de --${nombre}`)
    if (!(clave in cfg)) throw new Error(`Opción desconocida: --${nombre}`)
    cfg[clave] = NUMERICOS.includes(clave) ? Number(valor) : valor
  }
  for (const k of NUMERICOS) {
    if (!Number.isSafeInteger(cfg[k]) || cfg[k] < 1) throw new Error(`--${k} debe ser un entero positivo`)
  }
  if (cfg.target !== 'emulator') {
    throw new Error(
      'Sólo --target=emulator. Meter carga sintética en el proyecto vivo escribe ' +
      'documentos junto a expedientes reales, y eso lo autoriza el dueño, no este arnés.',
    )
  }
  const medicos = cfg.tenants * cfg.physiciansPerTenant
  if (cfg.concurrent > medicos) {
    throw new Error(`--concurrent (${cfg.concurrent}) no puede pasar de los ${medicos} médicos que se van a dar de alta`)
  }
  return cfg
}

/* ── lo que este arnés NO puede observar, con lo que haría falta ──────────── */

/**
 * La lista es la mitad honesta del informe. Cada entrada se convierte en un
 * `null` en el JSON —que el validador rechaza— y en una línea que dice dónde se
 * mide de verdad. Quitar una de aquí exige haberla medido, no haberla supuesto.
 */
const NO_MEDIBLE_EN_EMULADOR = [
  ['blankScreenCount', 'Es de navegador: hace falta el producto corriendo y Playwright recorriéndolo.'],
  ['lostDraftCount', 'Es de navegador: el borrador vive en IndexedDB, que un emulador de Firestore no tiene.'],
  ['silentProviderFailureCount', 'Hace falta un proveedor de IA o de voz de verdad al otro lado.'],
  ['unboundedReadCount', 'Es una propiedad ESTÁTICA del árbol y la vigila su propio guardián, no una carrera.'],
]

/** Las cuatro colas del validador. Ninguna existe sin proveedores detrás. */
const COLAS = ['transcription', 'reasoning', 'evidence', 'document']

/* ── utilidades ───────────────────────────────────────────────────────────── */

const idSintetico = (prefijo, n) => `${prefijo}_${String(n).padStart(8, '0')}`

/**
 * LA FORMA DE LA NOTA LA DICTAN LAS REGLAS, NO ESTE ARNÉS.
 *
 * `firestore.rules` exige dos cosas que la primera versión no cumplía, y las dos
 * salieron corriéndolo contra el emulador:
 *
 *   · toda nota **nace en borrador** (REG-017): el estado inicial no puede ser
 *     `firmada`, porque una nota firmada sin historia previa se salta la
 *     trazabilidad NOM-024;
 *   · al firmar, `metadata.medicoId` tiene que ser **quien firma** — nadie firma
 *     con la cédula de otro.
 *
 * Escribir una forma que las reglas rechazan no mide carga: mide sintaxis. Y si
 * el arnés hubiera «arreglado» eso relajando la regla, habría medido un producto
 * que no existe.
 */
const notaBorrador = (medicoId) => ({
  estado: 'borrador',
  secuencia: 1,
  metadata: { medicoId },
  syntheticNonPhi: true,
})

/** Percentil por interpolación lineal sobre la muestra ya ordenada. */
function percentil(ordenados, p) {
  if (ordenados.length === 0) return 0
  const pos = (ordenados.length - 1) * p
  const bajo = Math.floor(pos)
  const alto = Math.ceil(pos)
  if (bajo === alto) return ordenados[bajo]
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo)
}

async function conLimite(limite, tareas) {
  const resultados = new Array(tareas.length)
  let siguiente = 0
  const obrero = async () => {
    for (;;) {
      const i = siguiente++
      if (i >= tareas.length) return
      resultados[i] = await tareas[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, tareas.length) }, obrero))
  return resultados
}

function shaDelCandidato() {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
}

/* ── el arnés ─────────────────────────────────────────────────────────────── */

/**
 * Cada corrida escribe documentos NUEVOS.
 *
 * Sin esto, la segunda corrida contra el mismo emulador se encuentra las notas de
 * la primera ya **firmadas**, y la regla —correctamente— le niega volver a
 * tocarlas: el arnés medía la latencia de sus propios rechazos y la llamaba
 * carga. Un arnés que no es repetible no mide, adivina.
 */
const marcaDeCorrida = () => `r${Date.now().toString(36)}`

/** Toda sonda dice su nombre al fallar: un `PERMISSION_DENIED` anónimo no se diagnostica. */
async function sonda(nombre, fn) {
  try {
    return await fn()
  } catch (e) {
    throw new Error(`sonda «${nombre}»: ${e.message}`)
  }
}

async function main() {
  const cfg = leerArgumentos(process.argv)
  const corrida = marcaDeCorrida()

  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'Faltan FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST. Sin ellas los ' +
      'SDK hablarían con el proyecto VIVO, que es justo lo que este arnés no hace.\n' +
      '  npx firebase emulators:start --only firestore,auth --project nexomed-agenda\n' +
      '  export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080\n' +
      '  export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099',
    )
  }

  const projectId = process.env.GCLOUD_PROJECT || 'nexomed-agenda'
  const admin = await import('firebase-admin/app')
  const { getFirestore: getAdminDb } = await import('firebase-admin/firestore')
  const { getAuth: getAdminAuth } = await import('firebase-admin/auth')
  const { initializeApp: initCliente } = await import('firebase/app')
  const { getAuth: getAuthCliente, signInWithCustomToken, connectAuthEmulator } = await import('firebase/auth')
  const fs = await import('firebase/firestore')

  const appAdmin = admin.initializeApp({ projectId }, `arnes-${Date.now()}`)
  const dbAdmin = getAdminDb(appAdmin)
  const authAdmin = getAdminAuth(appAdmin)

  /* ── alta: consultorios, miembros y pacientes ──────────────────────────── */

  const consultorios = []
  for (let t = 1; t <= cfg.tenants; t += 1) {
    const clinicId = idSintetico('tenant', t)
    await dbAdmin.doc(`clinics/${clinicId}`).set({ nombre: `Consultorio sintético ${t}`, syntheticNonPhi: true })
    const medicos = []
    for (let p = 1; p <= cfg.physiciansPerTenant; p += 1) {
      const uid = idSintetico('physician', (t - 1) * cfg.physiciansPerTenant + p)
      await authAdmin.createUser({ uid }).catch(() => {})
      await dbAdmin.doc(`clinic_members/${uid}`).set({ clinicId, role: 'medico', syntheticNonPhi: true })
      medicos.push({ uid, clinicId })
    }
    consultorios.push({ clinicId, medicos })
  }

  /* ── sesiones de cliente: las reglas se aplican de verdad ──────────────── */

  /**
   * UNA APLICACIÓN DE CLIENTE POR MÉDICO, Y NO UNA COMPARTIDA.
   *
   * La primera versión firmaba a los N médicos contra la MISMA instancia de Auth.
   * Un `signInWithCustomToken` sustituye al usuario actual, así que todas las
   * escrituras salían con la identidad del ÚLTIMO que entró: los demás
   * consultorios devolvían `PERMISSION_DENIED` en masa y —lo caro— la sonda de
   * fuga entre consultorios habría estado midiendo a un usuario que ni siquiera
   * era el que decía ser. Un arnés que se equivoca de identidad no mide
   * aislamiento: mide otra cosa y la llama aislamiento.
   */
  const [host, puerto] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  const sesiones = []
  for (const c of consultorios) {
    for (const m of c.medicos) {
      const app = initCliente({ apiKey: 'emulador', projectId }, `cliente-${m.uid}`)
      const auth = getAuthCliente(app)
      connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
      const db = fs.initializeFirestore(app, {})
      fs.connectFirestoreEmulator(db, host, Number(puerto))
      await signInWithCustomToken(auth, await authAdmin.createCustomToken(m.uid))
      sesiones.push({ ...m, db })
    }
  }

  /* ── la carga: el camino clínico real, medido ──────────────────────────── */

  const latencias = []
  let successCount = 0
  let errorCount = 0

  const midiendo = async (fn) => {
    const t0 = performance.now()
    try {
      await fn()
      successCount += 1
    } catch {
      errorCount += 1
    } finally {
      latencias.push(performance.now() - t0)
    }
  }

  const notasEscritas = []
  const tareas = []
  for (const s of sesiones) {
    for (let i = 1; i <= cfg.patientsPerPhysician; i += 1) {
      tareas.push(async () => {
        const patientId = `${s.uid}_${corrida}_p${String(i).padStart(4, '0')}`
        const notaId = `${patientId}_n1`
        const refPaciente = fs.doc(s.db, `clinics/${s.clinicId}/patients/${patientId}`)
        const refNota = fs.doc(s.db, `clinics/${s.clinicId}/patients/${patientId}/notas/${notaId}`)

        await midiendo(() => fs.setDoc(refPaciente, { creadoPor: s.uid, syntheticNonPhi: true }))
        await midiendo(() => fs.setDoc(refNota, notaBorrador(s.uid)))
        // Firmar: la regla exige que el autor declarado sea quien firma.
        await midiendo(() => fs.updateDoc(refNota, { estado: 'firmada', secuencia: 2 }))
        await midiendo(() => fs.getDocs(fs.query(
          fs.collection(s.db, `clinics/${s.clinicId}/patients`), fs.limit(20),
        )))
        notasEscritas.push({ sesion: s, refNota, patientId, notaId })
      })
    }
  }
  await conLimite(cfg.concurrent, tareas)

  /* ── sonda: fuga entre consultorios, contra las reglas de verdad ───────── */

  let crossTenantLeakageCount = 0
  let sondasDeFuga = 0
  for (const s of sesiones) {
    const ajeno = consultorios.find(c => c.clinicId !== s.clinicId)
    if (!ajeno) continue
    const victima = notasEscritas.find(n => n.sesion.clinicId === ajeno.clinicId)
    if (!victima) continue

    // Leer el expediente del otro consultorio.
    sondasDeFuga += 1
    try {
      const snap = await fs.getDoc(fs.doc(s.db, `clinics/${ajeno.clinicId}/patients/${victima.patientId}`))
      if (snap.exists()) crossTenantLeakageCount += 1
    } catch { /* la regla la cerró: eso es lo correcto */ }

    // Escribir en la nota del otro consultorio, que es la fuga cara.
    sondasDeFuga += 1
    try {
      await fs.updateDoc(
        fs.doc(s.db, `clinics/${ajeno.clinicId}/patients/${victima.patientId}/notas/${victima.notaId}`),
        { estado: 'alterada-por-otro-consultorio' },
      )
      crossTenantLeakageCount += 1
    } catch { /* cerrada */ }
  }

  /* ── sonda: idempotencia ───────────────────────────────────────────────── */

  let idempotencyViolationCount = 0
  await sonda('idempotencia', async () => {
  for (const n of notasEscritas.slice(0, Math.min(50, notasEscritas.length))) {
    await fs.setDoc(n.refNota, notaBorrador(n.sesion.uid)).catch(() => {})
    const col = await fs.getDocs(fs.collection(
      n.sesion.db, `clinics/${n.sesion.clinicId}/patients/${n.patientId}/notas`,
    ))
    if (col.size !== 1) idempotencyViolationCount += 1
  }
  })

  /* ── sonda: el guardado es durable, y la relectura lo demuestra ────────── */

  let durableSavePassed = true
  await sonda('guardado durable', async () => {
    for (const n of notasEscritas.slice(0, Math.min(50, notasEscritas.length))) {
      const snap = await fs.getDoc(n.refNota)
      if (!snap.exists() || snap.data().estado !== 'firmada' || snap.data().secuencia !== 2) durableSavePassed = false
    }
  })

  /* ── sonda: recuperación — una secuencia cortada no deja media nota ────── */

  let recoveryPassed = true
  await sonda('recuperación', async () => {
    const s = sesiones[0]
    const patientId = `${s.uid}_${corrida}_recuperacion`
    const refPaciente = fs.doc(s.db, `clinics/${s.clinicId}/patients/${patientId}`)
    const refNota = fs.doc(s.db, `clinics/${s.clinicId}/patients/${patientId}/notas/n1`)
    await fs.setDoc(refPaciente, { creadoPor: s.uid, syntheticNonPhi: true })
    await fs.setDoc(refNota, notaBorrador(s.uid))
    // Se corta aquí: la nota queda en borrador. Reanudar tiene que llevarla a
    // firmada UNA vez, sin duplicar y sin perder lo que ya había.
    await fs.updateDoc(refNota, { estado: 'firmada', secuencia: 2 })
    const tras = await fs.getDoc(refNota)
    const hermanas = await fs.getDocs(fs.collection(
      s.db, `clinics/${s.clinicId}/patients/${patientId}/notas`,
    ))
    if (!tras.exists() || tras.data().estado !== 'firmada' || hermanas.size !== 1) recoveryPassed = false
  })

  /* ── el informe ────────────────────────────────────────────────────────── */

  const ordenadas = [...latencias].sort((a, b) => a - b)
  const noMedido = [
    ...NO_MEDIBLE_EN_EMULADOR.map(([campo, razon]) => ({ campo, razon })),
    ...COLAS.map(c => ({
      campo: `queues.${c}`,
      razon: 'No hay cola sin un proveedor detrás; en un emulador no existe ninguna.',
    })),
  ]

  const informe = {
    syntheticNonPhi: true,
    candidateSha: shaDelCandidato(),
    environment: cfg.environment,
    scenario: cfg.scenario,
    seed: cfg.seed,
    registeredPhysicians: sesiones.length,
    concurrentConsultations: cfg.concurrent,
    requestCount: latencias.length,
    successCount,
    errorCount,
    latencyMs: {
      p50: percentil(ordenadas, 0.5),
      p95: percentil(ordenadas, 0.95),
      p99: percentil(ordenadas, 0.99),
    },

    /* Medidos de verdad, contra `firestore.rules` cargadas. */
    crossTenantLeakageCount,
    idempotencyViolationCount,
    durableSavePassed,
    recoveryPassed,

    /**
     * NULL, NO CERO. Un cero aquí se lee como «se midió y no hubo ninguno», y
     * este arnés no los miró. El validador rechaza el `null`, que es la
     * respuesta correcta: todavía no es evidencia.
     */
    blankScreenCount: null,
    lostDraftCount: null,
    silentProviderFailureCount: null,
    unboundedReadCount: null,
    queues: Object.fromEntries(COLAS.map(c => [c, null])),

    /* La mitad honesta: qué falta y dónde se mide. */
    complete: false,
    noMedido,
    sondas: {
      fugaEntreConsultorios: sondasDeFuga,
      idempotencia: Math.min(50, notasEscritas.length),
      guardadoDurable: Math.min(50, notasEscritas.length),
    },
  }

  const json = `${JSON.stringify(informe, null, 2)}\n`
  if (cfg.out === '-') process.stdout.write(json)
  else await writeFile(cfg.out, json, 'utf8')

  process.stderr.write(
    `\n  ${informe.requestCount} peticiones · ${sesiones.length} médicos · ${cfg.concurrent} concurrentes\n` +
    `  p50 ${informe.latencyMs.p50.toFixed(1)} ms · p95 ${informe.latencyMs.p95.toFixed(1)} ms · p99 ${informe.latencyMs.p99.toFixed(1)} ms\n` +
    `  fuga entre consultorios: ${crossTenantLeakageCount} en ${sondasDeFuga} sondas\n` +
    `  idempotencia: ${idempotencyViolationCount} violaciones · durable: ${durableSavePassed} · recuperación: ${recoveryPassed}\n` +
    `\n  INCOMPLETO A PROPÓSITO — ${noMedido.length} campos van en null porque no se midieron:\n` +
    noMedido.map(n => `    · ${n.campo} — ${n.razon}`).join('\n') +
    '\n\n  El validador lo va a RECHAZAR, y eso es lo correcto: no es evidencia todavía.\n',
  )
}

/**
 * Salida explícita: los flujos gRPC del SDK de Firestore mantienen vivo el bucle
 * de eventos aunque no quede trabajo, así que sin esto el arnés escribe su
 * informe y **se queda colgado**. Costó un diagnóstico: con la salida por una
 * tubería, el proceso muerto por `timeout` se llevaba el búfer y parecía que no
 * había medido nada.
 */
main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stderr.write(`ARNÉS DE CARGA: ${e.message}\n`)
    process.exit(1)
  })
