#!/usr/bin/env node
/**
 * EL RESPALDO NO SÓLO SE LEE: TIENE QUE LLEGAR A FIRESTORE.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * `npm run simulacro:respaldo` ensaya el ida y vuelta del NDJSON **en memoria**:
 * lee el archivo, lo reenraiza, cuenta y cronometra. Es la mitad que se puede
 * correr en cualquier parte, y está bien.
 *
 * Pero el `FINAL-READINESS` dice exactamente qué se queda fuera: «reglas,
 * índices, latencia y **el tope de 500 escrituras por transacción** no los da
 * ninguna tienda en memoria». Y esa es la mitad en la que un respaldo falla de
 * verdad — REG-160 fue justo eso: el importador validaba la colección declarada
 * y **escribía en la ruta**, que era otro campo. Las pruebas en memoria pasaban.
 *
 * Esto es la regla «el dato tiene que LLEGAR» aplicada al respaldo: se escribe
 * contra un Firestore de verdad y **se vuelve a leer del otro lado**.
 *
 * ── QUÉ MIDE ────────────────────────────────────────────────────────────────
 *
 *   · que cada documento del archivo aparece EN SU RUTA reenraizada, releído
 *   · el tiempo real de la restauración y su ritmo en documentos por segundo
 *
 * ── LO QUE SE INTENTÓ MEDIR Y NO SE PUDO: EL TOPE DEL LOTE ──────────────────
 *
 * El `FINAL-READINESS` cuenta «el tope de 500 escrituras por transacción» entre
 * lo que una tienda en memoria no da. Se probó: con `--lote-roto` este ensayo
 * escribe en lotes de **600** y el emulador **los acepta sin rechistar**.
 *
 * O sea que el emulador tampoco valida esa dimensión, y la bandera no es una
 * prueba al revés: es la demostración de que **aquí no se puede probar**. Se deja
 * porque decirlo vale más que quitarlo, y porque el día que se corra contra un
 * proyecto de verdad esa misma bandera da la respuesta.
 *
 * El `LOTE = 400` del importador sigue siendo lo correcto —es el número
 * documentado por Google y deja margen—, pero que aquí pase un 600 **no
 * demuestra** que un 600 pasaría en producción, ni al revés.
 *
 * ── CONTRA EL EMULADOR, Y NADA MÁS ──────────────────────────────────────────
 *
 * Sin `FIRESTORE_EMULATOR_HOST` no arranca: el SDK admin hablaría con el proyecto
 * VIVO y escribiría un consultorio sintético al lado de expedientes reales.
 *
 * ── LO QUE SIGUE SIN PROBAR ─────────────────────────────────────────────────
 *
 * **El RTO de verdad.** `gcloud firestore databases restore` y el PITR del
 * proyecto son configuración de la consola y siguen siendo del dueño. Este
 * número es el de restaurar un NDJSON en una base ya viva, no el de resucitar
 * una base perdida. Se dice aquí para que nadie lo presente como lo otro.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   npx firebase emulators:start --only firestore --project nexomed-agenda
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *     node scripts/simulacro-restauracion-firestore.mjs --docs=1200 --out=acta.json
 */
import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import process from 'node:process'

/**
 * El mismo tope que usa `/api/clinic/importar`. Firestore admite 500 por lote;
 * se deja margen. Si los dos números se separan, este ensayo dejaría de medir lo
 * que el producto hace — por eso su golden compara los dos.
 */
const LOTE = 400

/** El tope documentado de Firestore. El emulador NO lo hace cumplir (ver cabecera). */
const TOPE_DE_FIRESTORE = 500

function leerArgumentos(argv) {
  const cfg = { docs: 1200, out: '-', loteRoto: false, clinicDestino: 'destino_sintetico' }
  for (let i = 2; i < argv.length; i += 1) {
    const [nombre, pegado] = argv[i].replace(/^--/, '').split('=', 2)
    if (nombre === 'lote-roto') { cfg.loteRoto = true; continue }
    const valor = pegado ?? argv[++i]
    if (nombre === 'docs') cfg.docs = Number(valor)
    else if (nombre === 'out') cfg.out = valor
    else if (nombre === 'destino') cfg.clinicDestino = valor
    else throw new Error(`Opción desconocida: --${nombre}`)
  }
  if (!Number.isSafeInteger(cfg.docs) || cfg.docs < 1) throw new Error('--docs debe ser un entero positivo')
  return cfg
}

/**
 * Un consultorio sintético con la forma REAL del respaldo — cabecera, líneas de
 * documento con su ruta, y pie. Sin pie, el importador tiene que poder decir que
 * el archivo venía cortado.
 */
function respaldoSintetico(n, origen = 'origen_sintetico') {
  const lineas = [JSON.stringify({ _tipo: 'cabecera', version: 1, clinicId: origen, generado: '2026-01-01T00:00:00.000Z' })]
  const reparto = [
    ['patients', `clinics/${origen}/patients`],
    ['notas', `clinics/${origen}/patients/p0/notas`],
    ['appointments', `clinics/${origen}/appointments`],
    ['cobros', `clinics/${origen}/cobros`],
  ]
  for (let i = 0; i < n; i += 1) {
    const [coleccion, base] = reparto[i % reparto.length]
    /* La forma REAL que escribe el exportador: `_ruta`, `_coleccion` y los datos
       al mismo nivel. Inventarse otra aquí mediría un formato que no existe. */
    lineas.push(JSON.stringify({
      _ruta: `${base}/doc_${String(i).padStart(6, '0')}`,
      _coleccion: coleccion,
      orden: i, syntheticNonPhi: true, relleno: 'x'.repeat(64),
    }))
  }
  lineas.push(JSON.stringify({ _tipo: 'pie', documentos: n }))
  return lineas
}

async function main() {
  const cfg = leerArgumentos(process.argv)

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      'Falta FIRESTORE_EMULATOR_HOST. Sin ella el SDK admin hablaría con el proyecto ' +
      'VIVO y escribiría un consultorio sintético al lado de expedientes reales.\n' +
      '  npx firebase emulators:start --only firestore --project nexomed-agenda\n' +
      '  export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080',
    )
  }

  const { leerLinea, reenraizar } = await import('../src/lib/clinica/restaurar.ts')
  const { initializeApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')

  const db = getFirestore(initializeApp(
    { projectId: process.env.GCLOUD_PROJECT || 'nexomed-agenda' },
    `simulacro-${Date.now()}`,
  ))

  const marca = `s${Date.now().toString(36)}`
  const destino = `${cfg.clinicDestino}_${marca}`     // cada ensayo, su consultorio
  const lineas = respaldoSintetico(cfg.docs)

  /* ── parsear y reenraizar con el código DEL PRODUCTO, no con uno de aquí ── */

  const aEscribir = []
  let rechazadas = 0
  let pie = false
  for (const cruda of lineas) {
    const l = leerLinea(cruda)
    if (!l) { rechazadas += 1; continue }
    if (l.clase === 'rechazada') { rechazadas += 1; continue }
    if (l.clase === 'pie') { pie = true; continue }
    if (l.clase !== 'documento') continue
    aEscribir.push({ ruta: reenraizar(l.ruta, destino), datos: l.datos })
  }

  /* ── escribir de verdad, en lotes ───────────────────────────────────────── */

  const tope = cfg.loteRoto ? TOPE_DE_FIRESTORE + 100 : LOTE
  const t0 = performance.now()
  let escritos = 0
  let errorDeLote = null
  try {
    for (let i = 0; i < aEscribir.length; i += tope) {
      const lote = db.batch()
      for (const d of aEscribir.slice(i, i + tope)) lote.set(db.doc(d.ruta), d.datos, { merge: true })
      await lote.commit()
      escritos += Math.min(tope, aEscribir.length - i)
    }
  } catch (e) {
    errorDeLote = e.message
  }
  const msEscritura = performance.now() - t0

  /* ── Y AHORA LA MITAD QUE IMPORTA: releer del otro lado ─────────────────── */

  const t1 = performance.now()
  let releidos = 0
  const faltantes = []
  for (let i = 0; i < aEscribir.length; i += 300) {
    const trozo = aEscribir.slice(i, i + 300)
    const snaps = await db.getAll(...trozo.map(d => db.doc(d.ruta)))
    snaps.forEach((s, k) => {
      if (s.exists && s.data().orden === trozo[k].datos.orden) releidos += 1
      else if (faltantes.length < 20) faltantes.push(trozo[k].ruta)
    })
  }
  const msLectura = performance.now() - t1

  const acta = {
    syntheticNonPhi: true,
    entorno: `firestore-emulator (${process.env.FIRESTORE_EMULATOR_HOST})`,
    destino,
    documentosEnElArchivo: cfg.docs,
    lineasRechazadas: rechazadas,
    archivoCompleto: pie,
    lote: tope,
    topeDeFirestore: TOPE_DE_FIRESTORE,
    /* Se declara para que nadie lea un verde de este ensayo como «el tope está
       comprobado». Con `--lote-roto` el emulador acepta 600 sin error. */
    topeDelLoteComprobado: false,
    escritos,
    releidos,
    faltantes,
    errorDeLote,
    msEscritura: Math.round(msEscritura),
    msLectura: Math.round(msLectura),
    docsPorSegundo: Math.round((escritos / msEscritura) * 1000),
    /* La mitad honesta, otra vez. */
    loQueEsteNumeroNoEs:
      'No es el RTO. Es restaurar un NDJSON en una base ya viva; resucitar una base ' +
      'perdida es `gcloud firestore databases restore` + PITR, que son de la consola. ' +
      'Y el tope de escrituras por lote NO queda comprobado: el emulador acepta 600.',
  }

  const json = `${JSON.stringify(acta, null, 2)}\n`
  if (cfg.out === '-') process.stdout.write(json)
  else await writeFile(cfg.out, json, 'utf8')

  process.stderr.write(
    `\n  ${cfg.docs} documentos · lote de ${tope} · destino ${destino}\n` +
    (errorDeLote
      ? `  EL LOTE FALLÓ: ${errorDeLote}\n`
      : `  escritos ${escritos} · releídos ${releidos} · faltantes ${faltantes.length}\n`) +
    `  ${acta.msEscritura} ms de escritura (${acta.docsPorSegundo} doc/s) · ${acta.msLectura} ms de relectura\n` +
    `\n  ${acta.loQueEsteNumeroNoEs}\n`,
  )

  /**
   * Un ensayo que pierde documentos no es un ensayo con éxito — y uno que no
   * escribió NADA, tampoco.
   *
   * La primera versión sólo comparaba `releidos === aEscribir.length`, y con el
   * formato del archivo mal construido las dos cifras valían cero: el ensayo
   * salía en verde habiendo restaurado un consultorio vacío. Un cero contra un
   * cero no demuestra nada.
   */
  if (!cfg.loteRoto) {
    if (aEscribir.length === 0) {
      process.stderr.write('  NADA QUE ESCRIBIR: el archivo se rechazó entero. Un ensayo vacío no es un ensayo.\n')
      process.exit(1)
    }
    if (errorDeLote || releidos !== aEscribir.length) process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { process.stderr.write(`SIMULACRO: ${e.message}\n`); process.exit(1) })
