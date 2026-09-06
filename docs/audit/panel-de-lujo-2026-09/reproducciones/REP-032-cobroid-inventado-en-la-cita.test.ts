/**
 * REP-032 · ASC-003 (AS-cobros) — escribir `cobroId` a mano en la cita la saca
 * del corte, de «por cobrar» y del botón Cobrar sin cobro real ni rastro: la
 * regla de `appointments` sólo vigila la cortesía, no el «ya está pagada».
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `firestore.rules:151-158`: el `allow update` de appointments sólo condiciona el
 * paso `cobroExento` false→true; `cobroId` y `cobradoEn` no aparecen en ninguna
 * guarda. Del otro lado toda la app confía en ese campo: `corte-caja.ts:85-87`
 * `estaSaldada` = `conCobro.has(cita.id) || !!cita.cobroId`; `citas/page.tsx`
 * :215, :261, :1102 (`!appt.cobroId`). Con la sesión de cualquier miembro
 * —también la asistente— `updateDoc(appointments/ID, { cobroId: 'x' })` hace
 * desaparecer la deuda sin que exista ningún documento en `cobros`. Y el camino
 * inverso (`cobroId: ''` sobre una cita ya cobrada, para cobrarla otra vez)
 * también está abierto.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-cobros, hallazgo ASC-003 (`crudos/AS-cobros.json`). El equipo rojo
 * (`crudos/R-AS-cobros.json`) lo PROBÓ CONTRA EL EMULADOR con rol `secretaria`:
 * «PERMITIDO secretaria escribe cobroId:'x' inventado en la cita» y «PERMITIDO
 * secretaria borra cobroId de una cita ya cobrada». No hay capa que cruce contra
 * `cobros`: `updateAppointment` (`firestore.ts:89-91`) es un `updateDoc` sin
 * lista blanca.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * REG-003 cerró la puerta de la cortesía (`cobroExento`) y dejó abierta la
 * puerta gemela: el campo que dice «ya se cobró». Ambos ocultan una deuda.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * security-tenant: autorización en el servidor, lista blanca de campos. La
 * pantalla del corte existe para detectar la sustracción de efectivo; un campo
 * que cualquiera puede escribir la vuelve ciega.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * REGLAS EJECUTADAS contra el emulador (127.0.0.1:8080) con
 * `@firebase/rules-unit-testing`, proyecto aparte `demo-rep-c2` (distinto de
 * REP-031 para que los dos archivos puedan correr a la vez). `firestore.rules`
 * del repositorio tal cual, datos sintéticos, borrados al terminar. El control
 * final ESPEJA `registrarCobro` (`cobros.ts:323-340`): crear el cobro y reservar
 * `cobroId` en la MISMA escritura atómica debe seguir permitido (con
 * `existsAfter`/`getAfter` en la regla); si la reparación mueve ese camino al
 * servidor, ese control se reescribe — no la prueba entera.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No exige que el corte trate un `cobroId` huérfano como «inconsistente»: con
 * la regla cerrada, confiar en el campo vuelve a ser legítimo. No cubre
 * `cobradoEn` por separado. No despliega las reglas.
 */
import { describe, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

const raiz = path.resolve(__dirname, '../../../..')
const HOST = '127.0.0.1', PORT = 8080
const PROYECTO = 'demo-rep-c2'
const ISO = '2026-09-06T15:00:00.000Z'

const citaAtendida = {
  estado: 'atendida', pacienteNombre: 'Paciente Sintético', pacienteId: 'P1',
  fechaHora: '2026-09-06T10:00', tipo: 'seguimiento', cobroExento: false,
}
const cobroBase = {
  monto: 800, metodo: 'efectivo', concepto: 'consulta', fecha: ISO,
  dia: '2026-09-06', mes: '2026-09', creadoPor: 'u1', cancelado: false, patientId: 'P1',
}

let env: RulesTestEnvironment

beforeAll(async () => {
  try { await fetch(`http://${HOST}:${PORT}/`) } catch {
    throw new Error(`REP-032 necesita el emulador de Firestore en ${HOST}:${PORT} (no responde).`)
  }
  env = await initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: { host: HOST, port: PORT, rules: readFileSync(path.join(raiz, 'firestore.rules'), 'utf8') },
  })
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'clinic_members', 'u1'), { clinicId: 'C', role: 'secretaria' })
    await setDoc(doc(db, 'clinics', 'C'), { status: 'active' })
    await setDoc(doc(db, 'clinics', 'C', 'appointments', 'A1'), { ...citaAtendida })
    await setDoc(doc(db, 'clinics', 'C', 'appointments', 'A2'), { ...citaAtendida, cobroId: 'cb1', cobradoEn: ISO })
    await setDoc(doc(db, 'clinics', 'C', 'appointments', 'A3'), { ...citaAtendida })
    await setDoc(doc(db, 'clinics', 'C', 'appointments', 'A4'), { ...citaAtendida })
    await setDoc(doc(db, 'clinics', 'C', 'cobros', 'cb1'), { ...cobroBase, citaId: 'A2' })
  })
})

afterAll(async () => {
  if (!env) return
  await env.clearFirestore()
  await env.cleanup()
})

describe('REP-032 · `cobroId` en la cita no lo puede inventar (ni borrar) un update suelto', () => {
  it('control: reagendar (tocar fechaHora) sigue permitido a cualquier miembro', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertSucceeds(updateDoc(doc(db, 'clinics', 'C', 'appointments', 'A3'), { fechaHora: '2026-09-08T11:00' }))
  })

  it('HOY FALLA: `cobroId` inventado, sin documento en cobros, debe NEGARSE', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(updateDoc(doc(db, 'clinics', 'C', 'appointments', 'A1'), { cobroId: 'x', cobradoEn: ISO }))
  })

  it('HOY FALLA: borrar `cobroId` de una cita ya cobrada (para cobrarla otra vez) debe NEGARSE', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(updateDoc(doc(db, 'clinics', 'C', 'appointments', 'A2'), { cobroId: '', cobradoEn: '' }))
  })

  it('control (espejo de registrarCobro): crear el cobro y reservar cobroId en la misma escritura atómica sigue permitido', async () => {
    const db = env.authenticatedContext('u1').firestore()
    const b = writeBatch(db)
    b.set(doc(db, 'clinics', 'C', 'cobros', 'cb9'), { ...cobroBase, citaId: 'A4' })
    b.update(doc(db, 'clinics', 'C', 'appointments', 'A4'), { cobroId: 'cb9', cobradoEn: ISO })
    await assertSucceeds(b.commit())
  })
})
