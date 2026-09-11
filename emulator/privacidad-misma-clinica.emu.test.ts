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
    batch.set(ctx.firestore().doc(`clinics/${clinic}/patients/paciente-a`), { nombre: 'Paciente ficticio A', medicoTitularUid: 'medico-a', compartidoCon: [] })
    for (const sub of ['notas', 'laboratorios', 'clinico', 'paquetes_visita', 'preguntas_paciente', 'formularios_previos', 'estudios_aportados']) {
      batch.set(ctx.firestore().doc(`${root}/${sub}/recurso-b`), { estado: 'borrador', patientId: 'paciente-b', marcador: 'MARCADOR_CLINICO_B' })
    }
    batch.set(ctx.firestore().doc(`clinics/${clinic}/tareas_clinicas/tarea-b`), { patientId: 'paciente-b', area: 'clinica', estado: 'pendiente', titulo: 'Dato sintético B' })
    for (const id of ['cambiar-area', 'cambiar-paciente', 'alterar-titulo']) {
      batch.set(ctx.firestore().doc(`clinics/${clinic}/tareas_clinicas/${id}`), { patientId: 'paciente-b', area: 'clinica', estado: 'pendiente', titulo: 'Dato sintético B' })
    }
    batch.set(ctx.firestore().doc(`clinics/${clinic}/tareas_clinicas/tarea-recepcion`), { patientId: 'paciente-b', area: 'recepcion', estado: 'pendiente', titulo: 'Reprogramar cita sintética' })
    batch.set(ctx.firestore().doc(`clinics/${clinic}/audit_log/evento-b`), { patientId: 'paciente-b', evento: 'paciente_modificado', uid: 'medico-b' })
    await batch.commit()
  })
})
afterAll(async () => { if (env) await env.cleanup() })

describe('misma clínica no concede el expediente ajeno', () => {
  it.each(['medico-a', 'recepcion-x'])('%s no descarga campos clínicos antiguos de la ficha raíz', async uid => {
    await assertFails(db(uid).doc(root).get())
  })
  it('el titular sigue leyendo las alergias antiguas completas', async () => {
    const ficha = await assertSucceeds(db('medico-b').doc(root).get())
    expect(ficha.data()?.alergias).toBe('MARCADOR_CLINICO_B')
  })
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
  it.each([
    ['cambiar-area', { area: 'recepcion' }],
    ['cambiar-paciente', { patientId: 'paciente-a' }],
    ['alterar-titulo', { titulo: 'Alteración no autorizada' }],
  ] as const)('A no transforma la tarea ajena para obtener acceso: %s', async (id, cambio) => {
    await assertFails(db('medico-a').doc(`clinics/${clinic}/tareas_clinicas/${id}`).update(cambio))
  })
  it('A no crea una tarea clínica dentro del expediente ajeno', async () => {
    await assertFails(db('medico-a').doc(`clinics/${clinic}/tareas_clinicas/crear-ajena`).set({ patientId: 'paciente-b', area: 'clinica', estado: 'pendiente', titulo: 'Ficticio' }))
  })
  it('el titular conserva la creación y actualización de sus tareas', async () => {
    await assertSucceeds(db('medico-b').doc(`clinics/${clinic}/tareas_clinicas/crear-propia`).set({ patientId: 'paciente-b', area: 'clinica', estado: 'pendiente', titulo: 'Ficticio' }))
    await assertSucceeds(db('medico-b').doc(`clinics/${clinic}/tareas_clinicas/tarea-b`).update({ estado: 'en_proceso' }))
  })
  it('recepción actualiza su tarea sin cambiar paciente ni convertirla en clínica', async () => {
    const ref = db('recepcion-x').doc(`clinics/${clinic}/tareas_clinicas/tarea-recepcion`)
    await assertSucceeds(ref.update({ estado: 'en_proceso' }))
    await assertFails(ref.update({ patientId: 'paciente-a' }))
    await assertFails(ref.update({ area: 'clinica' }))
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


describe('REG-683 — sin asignación no hay apropiación del expediente', () => {
  it('ni ausencia de titular ni ficha inexistente conceden acceso clínico', async () => {
    const sin = `clinics/${clinic}/patients/sin-titular`
    await env.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc(sin).set({ nombre: 'Legado sintético', alergias: 'PRIVADO' })
      await ctx.firestore().doc(`${sin}/notas/n`).set({ estado: 'borrador' })
    })
    await assertFails(db('medico-a').doc(sin).get())
    await assertFails(db('medico-a').doc(sin).update({ medicoTitularUid: 'medico-a' }))
    await assertFails(db('medico-a').doc(`${sin}/notas/n`).get())
    await assertFails(db('medico-a').doc(`clinics/${clinic}/patients/ausente/notas/n`).set({ estado: 'borrador' }))
    await assertSucceeds(db('administrador').doc(sin).get())
  })
  it('pedir acceso no permite inyectar datos, cambiar autor ni elegir otro titular', async () => {
    const solicitud = { clinicId: clinic, patientId: 'paciente-b', patientNombre: 'Paciente ficticio', tipo: 'otra', area: 'medico', titulo: 'Solicitud de acceso al expediente', detalle: 'Compártelo desde el expediente si procede. Hasta entonces sólo ve la ficha.', prioridad: 'normal', pesoUrgencia: 1, estado: 'solicitada', creadaEn: '2026-09-11', origen: 'expediente:peticion-de-acceso', origenId: 'paciente-b__medico-a', ownerUid: 'medico-b' }
    const ref = db('medico-a').doc(`clinics/${clinic}/tareas_clinicas/solicitud-segura`)
    await assertSucceeds(ref.get())
    await assertSucceeds(ref.set(solicitud))
    await assertSucceeds(ref.get())
    for (const cambio of [{ secreto: 'dato' }, { origenId: 'paciente-b__medico-b' }, { ownerUid: 'medico-a' }, { detalle: 'Contenido clínico arbitrario' }]) {
      await assertFails(db('medico-a').doc(`clinics/${clinic}/tareas_clinicas/solicitud-invalida`).set({ ...solicitud, ...cambio }))
    }
  })
})
