/**
 * REP-031 · ASC-002 (AS-cobros) — anular un cobro SIN cita (suelto, membresía)
 * lo niega la regla de Firestore: compara `citaId` y `patientId` por acceso
 * directo, y en ese documento esos campos no existen.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `firestore.rules:917-918`:
 *   `&& request.resource.data.citaId == resource.data.citaId`
 *   `&& request.resource.data.patientId == resource.data.patientId`
 * `registrarCobro` limpia los `undefined` antes de escribir (`cobros.ts:198`),
 * así que un cobro suelto NO lleva `citaId` ni `patientId`. En reglas, leer una
 * propiedad ausente aborta la evaluación → `permission-denied`. Cuatro líneas
 * más abajo (:936-939) medicoId/medicoNombre/referenciaExterna/folio SÍ usan
 * `.get(campo, '')`. Con ASC-001 (REP-030) hoy ningún cobro se puede anular.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-cobros, hallazgo ASC-002 (`crudos/AS-cobros.json`), reproducido en
 * vivo (consola: `RestConnection RPC 'Commit' … permission-denied`). El equipo
 * rojo (`crudos/R-AS-cobros.json`) lo PROBÓ CONTRA EL EMULADOR en un proyecto
 * aparte: «DENEGADO anular cobro SIN citaId/patientId» con el detalle
 * «Property citaId is undefined on object»; el mismo update sobre un cobro con
 * cita: PERMITIDO. `firestore-rules-guard.test.ts` sólo hace grep del texto.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La congelación de vínculos se escribió pensando en el cobro de consulta (que
 * siempre lleva cita y paciente) y no en el suelto, que el mismo archivo ya
 * contempla desde la auditoría 2026-07.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * security-tenant: la regla es el borde. el-dato-tiene-que-llegar: hay que
 * mirar del otro lado —aquí, el emulador ejecutando la regla real—.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * REGLAS EJECUTADAS contra el emulador de Firestore (127.0.0.1:8080) con
 * `@firebase/rules-unit-testing`, proyecto aparte `demo-rep-c` (prefijo
 * `demo-`: el SDK se niega a tocar un proyecto real). Se carga el
 * `firestore.rules` del repositorio tal cual; los datos son sintéticos y se
 * borran al terminar. Si el emulador no responde, la prueba FALLA con un
 * mensaje que lo dice — no se salta en silencio.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre el cobro del webhook de Stripe (`stripe_<session>` con `citaId:
 * undefined`, Admin SDK): cae en el mismo hueco pero no se reprodujo. No cubre
 * el orden de la transacción del cliente (REP-030). No despliega las reglas.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'

const raiz = path.resolve(__dirname, '../../../..')
const HOST = '127.0.0.1', PORT = 8080
const PROYECTO = 'demo-rep-c'
const ISO = '2026-09-06T15:00:00.000Z'

const cobroBase = {
  monto: 350, metodo: 'efectivo', concepto: 'consulta', fecha: ISO,
  dia: '2026-09-06', mes: '2026-09', creadoPor: 'u1', cancelado: false,
}
const anulacion = {
  cancelado: true, canceladoPor: 'u1', canceladoPorNombre: 'Ana Sintética',
  canceladoEn: ISO, motivoCancelacion: 'captura duplicada',
}

let env: RulesTestEnvironment

beforeAll(async () => {
  try { await fetch(`http://${HOST}:${PORT}/`) } catch {
    throw new Error(`REP-031 necesita el emulador de Firestore en ${HOST}:${PORT} (no responde).`)
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
    await setDoc(doc(db, 'clinics', 'C', 'cobros', 'suelto'), { ...cobroBase })
    await setDoc(doc(db, 'clinics', 'C', 'cobros', 'suelto2'), { ...cobroBase })
    await setDoc(doc(db, 'clinics', 'C', 'cobros', 'concita'), { ...cobroBase, monto: 1200, citaId: 'A1', patientId: 'P1' })
  })
})

afterAll(async () => {
  if (!env) return
  await env.clearFirestore()
  await env.cleanup()
})

describe('REP-031 · un miembro puede anular un cobro suelto (sin citaId ni patientId)', () => {
  it('control: anular un cobro CON cita y paciente está permitido (la regla sí sabe anular)', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertSucceeds(updateDoc(doc(db, 'clinics', 'C', 'cobros', 'concita'), anulacion))
  })

  it('HOY FALLA: anular un cobro SUELTO con autor, fecha y motivo debe estar permitido', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertSucceeds(updateDoc(doc(db, 'clinics', 'C', 'cobros', 'suelto'), anulacion))
  })

  it('probado al revés: la anulación de un cobro suelto que además cambia el monto se sigue negando', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(updateDoc(doc(db, 'clinics', 'C', 'cobros', 'suelto2'), { ...anulacion, monto: 1 }))
  })
})
