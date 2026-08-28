#!/usr/bin/env node
/**
 * MIGRACIÓN DE PHI CLÍNICO — alergias y antecedentes fuera del documento que lee
 * recepción (unidad Nexus OS E0-06).
 *
 *   npx tsx scripts/migrar-phi-clinico.mjs --clinic=<id>              # ENSAYO (por defecto)
 *   npx tsx scripts/migrar-phi-clinico.mjs --clinic=<id> --ejecutar   # backfill de verdad
 *   npx tsx scripts/migrar-phi-clinico.mjs --clinic=<id> --verificar  # equivalencia
 *   npx tsx scripts/migrar-phi-clinico.mjs --clinic=<id> --rollback --ejecutar
 *
 * ── LA SECUENCIA QUE FIJÓ EL DUEÑO ──────────────────────────────────────────
 *
 *     add → backfill → verify → switch reads → verify → remove legacy
 *
 * Este script hace `backfill`, `verify` y el `rollback` que los precede a los dos.
 * **NO hace `remove legacy`, y no puede:** no existe ninguna ruta de código aquí
 * que escriba en `patients/{id}` ni que borre un campo. Retirar los campos legados
 * es el último paso, exige equivalencia demostrada (`--verificar` en 0 fallos) y
 * está SIN AUTORIZAR — cuando llegue, será otro script y otra decisión.
 *
 * ── POR QUÉ EL ENSAYO ES EL MODO POR DEFECTO ────────────────────────────────
 *
 * Porque el modo por defecto es el que se ejecuta por accidente. Sin `--ejecutar`
 * esto lee, calcula el plan entero, lo enseña y no escribe nada. `--clinic` es
 * obligatorio: no hay «todas las clínicas», que es la forma que tiene un script de
 * mantenimiento de convertirse en un incidente.
 *
 * ── PHI ─────────────────────────────────────────────────────────────────────
 *
 * No imprime NUNCA contenido clínico: ni un alérgeno, ni una reacción, ni una
 * nota. Sólo recuentos, y los ids de los pacientes que fallaron —porque un fallo
 * que no se puede nombrar no se puede arreglar—. Por eso esto no vive en CI: corre
 * sobre datos reales, en la máquina del dueño.
 */
import process from 'node:process'

const {
  equivalenciaClinica,
  operacionEsSegura,
  planDeBackfill,
  planDeRollback,
} = await import('../src/lib/migracion/phi-clinico.ts')

/* ── Argumentos ─────────────────────────────────────────────────────────── */

const args = process.argv.slice(2)
const bandera = n => args.includes(`--${n}`)
const valor = n => {
  const a = args.find(x => x.startsWith(`--${n}=`))
  return a ? a.slice(n.length + 3) : undefined
}

const clinicId = valor('clinic')
const ejecutar = bandera('ejecutar')
const soloVerificar = bandera('verificar')
const rollback = bandera('rollback')
const limite = Number(valor('limite') ?? '0') || Infinity
const LOTE = 200

if (!clinicId) {
  console.error('Falta --clinic=<id>. No hay modo «todas las clínicas» a propósito.')
  process.exit(2)
}
if (rollback && soloVerificar) {
  console.error('--rollback y --verificar son dos cosas distintas: elige una.')
  process.exit(2)
}

/* ── Firestore (Admin SDK) ──────────────────────────────────────────────── */

const { adminDb } = await import('../src/lib/firebase-admin.ts')
const admin = (await import('firebase-admin')).default

const proyecto = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '(sin declarar)'
const UID = `migracion-e0-06:${process.env.USER ?? 'desconocido'}`

console.log(`\nMIGRACIÓN PHI CLÍNICO · E0-06`)
console.log(`  proyecto : ${proyecto}`)
console.log(`  clínica  : ${clinicId}`)
console.log(`  modo     : ${soloVerificar ? 'VERIFICAR' : rollback ? 'ROLLBACK' : 'BACKFILL'}`
  + `${ejecutar ? ' · ESCRIBE' : ' · ensayo (no escribe nada)'}\n`)

const pacientesRef = adminDb.collection('clinics').doc(clinicId).collection('patients')
const resumenDe = id => pacientesRef.doc(id).collection('clinico').doc('resumen')

/**
 * Guardián en tiempo de ejecución. Una operación cuya ruta no termina en
 * `/clinico/resumen` ABORTA la corrida entera — no se salta y sigue. Si el plan
 * está mal formado, lo que viene detrás tampoco es de fiar.
 */
function exigirSegura(op) {
  if (operacionEsSegura(op)) return
  console.error(`\n✖ ABORTADO: operación insegura sobre «${op.ruta}». No se escribió nada más.`)
  process.exit(1)
}

/* ── Recorrido ──────────────────────────────────────────────────────────── */

const cuenta = {
  pacientes: 0, migrados: 0, yaMigrados: 0, sinContenidoClinico: 0,
  sellosQuitados: 0, equivalentes: 0, fallos: 0,
}
const idsConFallo = []

let cursor = null
let vistos = 0

while (vistos < limite) {
  let q = pacientesRef.orderBy(admin.firestore.FieldPath.documentId()).limit(Math.min(LOTE, limite - vistos))
  if (cursor) q = q.startAfter(cursor)
  const snap = await q.get()
  if (snap.empty) break
  cursor = snap.docs[snap.docs.length - 1]
  vistos += snap.docs.length

  for (const docPaciente of snap.docs) {
    cuenta.pacientes++
    const legado = docPaciente.data()
    const ref = resumenDe(docPaciente.id)
    const snapResumen = await ref.get()
    const resumenActual = snapResumen.exists ? snapResumen.data() : null

    /* ── VERIFICAR: ¿llegó el dato, y llegó entero? ── */
    if (soloVerificar) {
      if (!resumenActual?.migradoEn) {
        cuenta.fallos++; idsConFallo.push(`${docPaciente.id} (sin migrar)`)
        continue
      }
      const eq = equivalenciaClinica(legado, resumenActual)
      if (eq.equivalente) cuenta.equivalentes++
      else {
        cuenta.fallos++
        idsConFallo.push(`${docPaciente.id} (faltan: ${[
          ...eq.camposFaltantes, ...eq.camposDistintos.map(c => `${c}≠`),
          ...eq.alergenosPerdidos.map(() => 'alérgeno'), ...eq.detallesPerdidos.map(() => 'detalle'),
        ].join(', ')})`)
      }
      continue
    }

    /* ── ROLLBACK: quitar el sello. El campo legado nunca se tocó, así que el
          paciente vuelve exactamente al estado anterior. ── */
    if (rollback) {
      if (!resumenActual?.migradoEn) continue
      const [op] = planDeRollback(clinicId, docPaciente.id).operaciones
      exigirSegura(op)
      if (ejecutar) await ref.update({ migradoEn: admin.firestore.FieldValue.delete() })
      cuenta.sellosQuitados++
      continue
    }

    /* ── BACKFILL ── */
    const plan = planDeBackfill({
      clinicId, patientId: docPaciente.id, legado, resumenActual,
      ahora: new Date().toISOString(), uid: UID,
    })

    if (plan.motivo === 'ya_migrado') { cuenta.yaMigrados++; continue }
    if (plan.motivo === 'sin_contenido_clinico') cuenta.sinContenidoClinico++

    for (const op of plan.operaciones) exigirSegura(op)
    if (!ejecutar) { cuenta.migrados++; continue }

    for (const op of plan.operaciones) await ref.set(op.datos, { merge: true })

    /**
     * EL DATO TIENE QUE LLEGAR. Se relee del OTRO lado de la frontera y se
     * compara con el origen. Si no es equivalente, se quita el sello: el paciente
     * queda «no migrado» y su campo legado —que nunca se tocó— sigue siendo la
     * fuente. Un backfill que se da por bueno sin mirar el destino es exactamente
     * la familia de defecto que esta regla del repo vino a cerrar.
     */
    const verificacion = equivalenciaClinica(legado, (await ref.get()).data())
    if (verificacion.equivalente) { cuenta.migrados++; continue }
    await ref.update({ migradoEn: admin.firestore.FieldValue.delete() })
    cuenta.fallos++
    idsConFallo.push(`${docPaciente.id} (no equivalente tras escribir; sello retirado)`)
  }

  if (snap.docs.length < LOTE) break
}

/* ── Acta ───────────────────────────────────────────────────────────────── */

console.log('RECUENTOS (nunca contenido):')
for (const [k, v] of Object.entries(cuenta)) console.log(`  ${k.padEnd(22)} ${v}`)

if (idsConFallo.length) {
  console.log('\nPACIENTES CON FALLO (id, sin contenido clínico):')
  for (const l of idsConFallo.slice(0, 50)) console.log(`  ${l}`)
  if (idsConFallo.length > 50) console.log(`  … y ${idsConFallo.length - 50} más`)
}

if (!ejecutar) console.log('\nENSAYO: no se escribió nada. Añade --ejecutar cuando el dueño lo autorice.')

if (soloVerificar) {
  console.log(cuenta.fallos === 0
    ? '\n✔ EQUIVALENCIA DEMOSTRADA: 0 pacientes con pérdida. Condición del punto 8 cumplida.'
    : `\n✖ ${cuenta.fallos} paciente(s) sin equivalencia. NO se retira ningún campo legado.`)
}

console.log('\nRecuerda: este script NO retira campos legados. Ese paso es otro, y está sin autorizar.\n')
process.exit(soloVerificar && cuenta.fallos > 0 ? 1 : 0)
