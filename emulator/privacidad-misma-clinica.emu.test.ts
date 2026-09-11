/**
 * D-057: dos médicos del mismo consultorio. Reglas REALES y datos sintéticos.
 * Complementa la matriz cross-tenant sin declararla de nuevo implementada.
 * No demuestra APIs Admin SDK, URLs ya firmadas ni migración de producción.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { abrirEntorno } from './entorno'

let env: RulesTestEnvironment
const clinic = 'privacidad-clinica-x'
const root = `clinics/${clinic}/patients/paciente-b`
const db = (uid: string) => env.authenticatedContext(uid).firestore()

beforeAll(async () => {
  env = await abrirEntorno()
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const batch = ctx.firestore().batch()
    batch.set(ctx.firestore().doc(`clinics/${clinic}`), { ownerId: 'administrador', status: 'active', paseLibre: false })
    for (const [uid, role, clinicId] of [
      ['medico-a', 'medico', clinic], ['medico-b', 'medico', clinic],
      ['administrador', 'admin', clinic], ['recepcion-x', 'secretaria', clinic],
      ['medico-y', 'medico', 'privacidad-clinica-y'],
    ]) batch.set(ctx.firestore().doc(`clinic_members/${uid}`), { role, clinicId })
    batch.set(ctx.firestore().doc(root), { nombre: 'Paciente ficticio', medicoTitularUid: 'medico-b', compartidoCon: [], alergias: 'MARCADOR_CLINICO_B' })
    for (const sub of ['notas', 'laboratorios', 'clinico', 'paquetes_visita', 'preguntas_paciente', 'formularios_previos', 'estudios_aportados']) {
      batch.set(ctx.firestore().doc(`${root}/${sub}/recurso-b`), { estado: 'borrador', patientId: 'paciente-b', marcador: 'MARCADOR_CLINICO_B' })
    }
    batch.set(ctx.firestore().doc(`clinics/${clinic}/tareas_clinicas/tarea-b`), { patientId: 'paciente-b', area: 'clinica', estado: 'pendiente', titulo: 'Dato sintético B' })
    batch.set(ctx.firestore().doc(`clinics/${clinic}/audit_log/evento-b`), { patientId: 'paciente-b', evento: 'paciente_modificado', uid: 'medico-b' })
    await batch.commit()
  })
})
afterAll(async () => { if (env) await env.cleanup() })

describe('misma clínica no concede el expediente ajeno', () => {
  it.each(['notas', 'laboratorios', 'clinico', 'paquetes_visita', 'preguntas_paciente', 'formularios_previos', 'estudios_aportados'])('A no lee %s de B por ID conocido', async sub => {
    await assertFails(db('medico-a').doc(`${root}/${sub}/recurso-b`).get())
    await assertSucceeds(db('medico-b').doc(`${root}/${sub}/recurso-b`).get())
  })
  it('A no altera las alergias de B en el formato legado', async () => {
    await assertFails(db('medico-a').doc(root).update({ alergias: 'OTRO_MARCADOR' }))
  })
  it('A no obtiene la tarea clínica derivada de B', async () => {
    await assertFails(db('medico-a').doc(`clinics/${clinic}/tareas_clinicas/tarea-b`).get())
  })
  it('A no obtiene la bitácora clínica de B', async () => {
    await assertFails(db('medico-a').doc(`clinics/${clinic}/audit_log/evento-b`).get())
  })
  it.each(['recepcion-x', 'medico-y'])('%s no lee la nota privada', async uid => {
    await assertFails(db(uid).doc(`${root}/notas/recurso-b`).get())
  })
  it('una sesión ausente no lee recursos privados', async () => {
    await assertFails(env.unauthenticatedContext().firestore().doc(`${root}/notas/recurso-b`).get())
  })
  it('compartir permite y revocar vuelve a cerrar', async () => {
    // Siembra del estado autorizado; la transacción HTTP que lo produce se
    // comprueba aparte. Aquí se evalúa el acceso resultante en el motor real.
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().doc(root).update({ compartidoCon: ['medico-a'] }))
    await assertSucceeds(db('medico-a').doc(`${root}/notas/recurso-b`).get())
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().doc(root).update({ compartidoCon: [] }))
    await assertFails(db('medico-a').doc(`${root}/notas/recurso-b`).get())
  })
  it('el administrador mantiene su acceso explícito de producto', async () => {
    const snap = await assertSucceeds(db('administrador').doc(`${root}/notas/recurso-b`).get())
    expect(snap.exists).toBe(true)
  })
})
