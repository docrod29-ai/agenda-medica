/**
 * CADA MÉDICO VE SUS PACIENTES; LA ASISTENTE, LA AGENDA Y LOS PENDIENTES DE
 * RECEPCIÓN; EL TITULAR AUTORIZA — D-057.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `patients` era `isMember` y todas sus subcolecciones clínicas `isMedico`:
 * cualquier médico del consultorio leía el expediente de cualquier paciente, y
 * las rutas del Admin SDK (FHIR, exportar) ni siquiera miraban al paciente. El
 * dueño decidió el 9/10-sep-2026: «cada médico ve sólo sus pacientes; la
 * asistente ve el equipo, la agenda y los pendientes que no sean de origen
 * privado, nunca el expediente; el médico titular autoriza».
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * 1. `puedeVerExpediente` es la ÚNICA fuente: titular, compartido o admin; un
 *    paciente SIN titular (anterior a la decisión) se ve como siempre.
 * 2. Las reglas transcriben eso en `esMedicoDelPaciente`, que es `isMedico` Y
 *    ADEMÁS el alcance — nunca más ancha que antes.
 * 3. Titular y compartidos sólo los escribe el titular (o admin); un paciente
 *    sin titular lo reclama cualquier médico.
 * 4. Recepción lee y mueve SÓLO tareas con `area == 'recepcion'`.
 * 5. Los pacientes de antes se asignan desde su última cita, sin adivinar.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con las reglas anteriores, «notas bajo esMedicoDelPaciente» y «tareas de
 * recepción legibles por isMember» están rojos; con el módulo puro devolviendo
 * `true` a secas, «otro médico no ve» está rojo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Las reglas contra el emulador: aquí se leen como texto. `firestore-rules-guard`
 *   y `matriz-acceso` cruzan función y matriz.
 * - La ficha (`patients/{id}`) sigue siendo `isMember`, con sus campos clínicos
 *   residuales (E0-06 fases B/C): recepción agenda con ella. Declarado en la matriz.
 * - No hay «acceso de emergencia»: el dueño no lo decidió y no se inventa.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  puedeVerExpediente, puedeAdministrarAcceso, porQueNoVe, conAcceso, sinAcceso, TEXTO_SIN_ACCESO,
} from '@/lib/authz/alcance-del-paciente'
import { MATRIZ_ACCESO } from '@/lib/authz/matriz-acceso'

const TITULAR = 'uid-titular', OTRO = 'uid-otro', COMPARTIDO = 'uid-compartido'

describe('el módulo puro', () => {
  it('EL CASO: otro médico NO ve el expediente de un paciente con titular; el titular, el compartido y el admin sí', () => {
    const ficha = { medicoTitularUid: TITULAR, compartidoCon: [COMPARTIDO] }
    expect(puedeVerExpediente(ficha, OTRO, 'medico')).toBe(false)
    expect(puedeVerExpediente(ficha, TITULAR, 'medico')).toBe(true)
    expect(puedeVerExpediente(ficha, COMPARTIDO, 'medico')).toBe(true)
    expect(puedeVerExpediente(ficha, OTRO, 'admin')).toBe(true)
    expect(porQueNoVe(ficha, OTRO, 'medico')).toBe('de_otro_medico')
  })
  it('recepción nunca ve el expediente, tenga titular o no', () => {
    expect(puedeVerExpediente({}, OTRO, 'secretaria')).toBe(false)
    expect(puedeVerExpediente({ medicoTitularUid: OTRO }, OTRO, 'secretaria')).toBe(false)
    expect(porQueNoVe({}, OTRO, 'recepcion')).toBe('no_es_clinico')
    expect(puedeVerExpediente({}, null, 'medico')).toBe(false)
  })
  it('sin titular sólo administra el expediente un administrador', () => {
    expect(puedeVerExpediente({}, OTRO, 'medico')).toBe(false)
    expect(puedeVerExpediente({}, OTRO, 'admin')).toBe(true)
    expect(puedeVerExpediente({ medicoTitularUid: null }, OTRO, 'medico')).toBe(false)
  })
  it('administra el acceso el titular o el admin; sin titular, sólo un administrador asigna', () => {
    expect(puedeAdministrarAcceso({ medicoTitularUid: TITULAR }, OTRO, 'medico')).toBe(false)
    expect(puedeAdministrarAcceso({ medicoTitularUid: TITULAR }, TITULAR, 'medico')).toBe(true)
    expect(puedeAdministrarAcceso({ medicoTitularUid: TITULAR }, OTRO, 'admin')).toBe(true)
    expect(puedeAdministrarAcceso({}, OTRO, 'medico')).toBe(false)
    expect(puedeAdministrarAcceso({}, OTRO, 'admin')).toBe(true)
    expect(puedeAdministrarAcceso({}, OTRO, 'secretaria')).toBe(false)
  })
  it('compartir no duplica, no mete al titular, y revocar quita sólo a ése', () => {
    const f = { medicoTitularUid: TITULAR, compartidoCon: [COMPARTIDO, TITULAR] }
    expect(conAcceso(f, OTRO)).toEqual([COMPARTIDO, OTRO])
    expect(conAcceso(f, COMPARTIDO)).toEqual([COMPARTIDO])
    expect(sinAcceso({ ...f, compartidoCon: [COMPARTIDO, OTRO] }, OTRO)).toEqual([COMPARTIDO])
    for (const t of Object.values(TEXTO_SIN_ACCESO)) expect(t).toMatch(/\S/)
  })
})

describe('las reglas transcriben el módulo', () => {
  const reglas = readFileSync('firestore.rules', 'utf8')
  const sin = reglas.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '')
  it('esMedicoDelPaciente es isMedico Y el alcance (admin, titular, compartido)', () => {
    const i = sin.indexOf('function esMedicoDelPaciente(clinicId, patientId)')
    expect(i).toBeGreaterThan(-1)
    const cuerpo = sin.slice(i, sin.indexOf('\n    }', i))
    expect(cuerpo).toMatch(/return isMedico\(clinicId\) && \(/)
    expect(cuerpo).toContain('isAdmin(clinicId)')
    expect(cuerpo).not.toContain("get('medicoTitularUid', null) == null")
    expect(cuerpo).toContain("exists(/databases/$(database)/documents/clinics/$(clinicId)/patients/$(patientId))")
    expect(cuerpo).toContain("get('medicoTitularUid', null) == request.auth.uid")
    expect(cuerpo).toContain("request.auth.uid in fichaDelPaciente(clinicId, patientId).get('compartidoCon', [])")
  })
  it('TODAS las subcolecciones del paciente van bajo esMedicoDelPaciente, y la ficha clínica comparte la misma guarda', () => {
    const a = sin.indexOf('match /patients/{docId} {')
    const b = sin.indexOf('match /waitlist/{docId} {')
    const bloque = sin.slice(a, b)
    const subs = bloque.slice(bloque.indexOf('match /notas/{notaId} {'))
    expect(subs).not.toMatch(/\bisMedico\(clinicId\)/)
    for (const sub of ['notas', 'versions', 'adendas', 'paquetes_visita', 'preguntas_paciente', 'formularios_previos', 'laboratorios', 'fotos', 'clinico']) {
      expect(subs, sub).toMatch(new RegExp(`match /${sub}/\\{\\w+\\}\\s*\\{[^}]*esMedicoDelPaciente\\(clinicId, docId\\)`))
    }
    expect(bloque).toMatch(/match \/patients\/\{docId\} \{\s*allow read: if esMedicoDelPaciente\(clinicId, docId\);/)
  })
  it('titular y compartidos: los cambia el titular o el admin; al nacer, sólo quien da de alta', () => {
    expect(sin).toContain("affectedKeys().hasAny(['medicoTitularUid', 'compartidoCon'])")
    expect(sin).toContain("resource.data.get('medicoTitularUid', null) == request.auth.uid")
    expect(sin).toContain("request.resource.data.get('medicoTitularUid', '') == request.auth.uid")
  })
  it('recepción lee y mueve SÓLO tareas de su área', () => {
    const i = sin.indexOf('match /tareas_clinicas/{tareaId} {')
    const bloque = sin.slice(i, sin.indexOf('\n      }', i))
    expect(bloque).toContain("isMember(clinicId) && resource.data.get('area', '') == 'recepcion'")
    expect(bloque).toContain('esMedicoDelPaciente(clinicId, resource.data.patientId)')
    expect(bloque).toContain("request.resource.data.get('area', '') == 'recepcion'")
    expect(bloque).toContain('esMedicoDelPaciente(clinicId, datos.patientId)')
    expect(bloque).toContain('puedeEscribirTarea(request.resource.data)')
  })
  it('la matriz declara la guarda nueva para cada subcolección clínica del paciente', () => {
    const clinicas = MATRIZ_ACCESO.filter(r => r.ruta.startsWith('clinics/{clinicId}/patients/{docId}/'))
    expect(clinicas.length).toBeGreaterThanOrEqual(9)
    for (const r of clinicas) expect(r.guardaLectura, r.ruta).toBe('esMedicoDelPaciente')
  })
  it('el índice del worklist de recepción está declarado en el orden de la consulta', async () => {
    const idx = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: { collectionGroup: string; fields: { fieldPath: string }[] }[] }
    const hay = idx.indexes.some(i => i.collectionGroup === 'tareas_clinicas' && i.fields.map(f => f.fieldPath).join(',') === 'area,estado,pesoUrgencia,creadaEn')
    expect(hay).toBe(true)
  })
})

/* ── El servidor también mira al paciente ─────────────────────────────────── */

const fichas = new Map<string, Record<string, unknown>>()
const citas: Record<string, unknown>[] = []
const escrituras: Record<string, unknown>[] = []
let miembro: { uid: string; role: string } = { uid: OTRO, role: 'medico' }

vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: async () => ({ ok: true, uid: miembro.uid, role: miembro.role, clinicId: 'cli' }),
  verificarModuloIA: async () => ({ ok: true, uid: miembro.uid, role: miembro.role, clinicId: 'cli' }),
}))
vi.mock('@/lib/ops/lo-que-no-deberia-pasar', () => ({ anotarDenegacion: () => {}, rutaSinParametros: (r: string) => r }))
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (top: string) => {
      if (top !== 'clinics') throw new Error('colección inesperada ' + top)
      return {
        doc: () => ({
          collection: (sub: string) => {
            if (sub === 'patients') {
              return {
                doc: (id: string) => ({
                  get: async () => ({ exists: fichas.has(id), id, data: () => fichas.get(id), ref: { set: async (d: Record<string, unknown>) => { escrituras.push({ id, ...d }); fichas.set(id, { ...fichas.get(id), ...d }) } } }),
                }),
                orderBy: () => {
                  let cursor = '', limite = Infinity
                  const q = {
                    startAfter: (id: string) => { cursor = id; return q },
                    limit: (n: number) => { limite = n; return q },
                    get: async () => {
                      const docs = [...fichas.entries()].sort(([a], [b]) => a.localeCompare(b)).filter(([id]) => id > cursor).slice(0, limite).map(([id, d]) => ({ id, data: () => d, ref: { set: async (x: Record<string, unknown>) => { escrituras.push({ id, ...x }); fichas.set(id, { ...d, ...x }) } } }))
                      return { size: docs.length, docs }
                    },
                  }
                  return q
                },
              }
            }
            if (sub === 'doctors') return { get: async () => ({ forEach: (f: (d: { id: string; data: () => Record<string, unknown> }) => void) => { f({ id: 'doc-1', data: () => ({ uid: TITULAR }) }); f({ id: 'doc-sin-uid', data: () => ({}) }) } }) }
            if (sub === 'appointments') return { where: (_f: string, _o: string, pid: string) => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: citas.filter(c => c.pacienteId === pid).map(c => ({ data: () => c })) }) }) }) }) }
            if (sub === 'audit_log') return { add: async () => ({}) }
            throw new Error('subcolección inesperada ' + sub)
          },
        }),
      }
    },
  },
}))

import { verificarCapacidadSobrePaciente } from '@/lib/authz/verificar-paciente'
import { POST as asignar } from '@/app/api/pacientes/asignar-titulares/route'

const req = (pathname = '/api/x', body: unknown = {}) => ({
  nextUrl: { pathname }, headers: new Headers({ authorization: 'Bearer x' }), json: async () => body,
}) as unknown as Parameters<typeof verificarCapacidadSobrePaciente>[0]

beforeEach(() => { fichas.clear(); citas.length = 0; escrituras.length = 0; miembro = { uid: OTRO, role: 'medico' } })

describe('verificarCapacidadSobrePaciente · las rutas del Admin SDK miran al paciente', () => {
  it('EL CASO: otro médico → 403 con el texto del módulo; el titular → ok; paciente inexistente → 404', async () => {
    fichas.set('p1', { medicoTitularUid: TITULAR })
    const r = await verificarCapacidadSobrePaciente(req(), 'cli', 'p1', 'clinico.escribir')
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.response.status).toBe(403); expect((await r.response.json()).error).toBe(TEXTO_SIN_ACCESO.de_otro_medico) }
    miembro = { uid: TITULAR, role: 'medico' }
    expect((await verificarCapacidadSobrePaciente(req(), 'cli', 'p1', 'clinico.escribir')).ok).toBe(true)
    const nf = await verificarCapacidadSobrePaciente(req(), 'cli', 'no-existe', 'clinico.escribir')
    expect(nf.ok).toBe(false); if (!nf.ok) expect(nf.response.status).toBe(404)
  })
  it('recepción sigue cayendo antes, en la capacidad', async () => {
    fichas.set('p1', {})
    miembro = { uid: OTRO, role: 'secretaria' }
    const r = await verificarCapacidadSobrePaciente(req(), 'cli', 'p1', 'clinico.escribir')
    expect(r.ok).toBe(false)
  })
})

describe('asignar-titulares · desde la última cita, sin adivinar', () => {
  it('EL CASO: asigna al médico de la última cita; sin cita o médico sin uid se cuentan y se dejan', async () => {
    miembro = { uid: 'admin-1', role: 'admin' }
    fichas.set('con-cita', {}); fichas.set('sin-cita', {}); fichas.set('ya', { medicoTitularUid: OTRO }); fichas.set('medico-sin-uid', {})
    citas.push({ pacienteId: 'con-cita', fechaHora: '2026-09-01 10:00', medicoId: 'doc-1' })
    citas.push({ pacienteId: 'medico-sin-uid', fechaHora: '2026-09-01 11:00', medicoId: 'doc-sin-uid' })
    const sim = await (await asignar(req('/api/pacientes/asignar-titulares', { clinicId: 'cli', simular: true }))).json()
    expect(sim).toMatchObject({ ok: true, simulado: true, revisados: 4, yaTenian: 1, asignados: 1, sinCita: 1, medicoSinUid: 1 })
    expect(escrituras).toHaveLength(0)
    const real = await (await asignar(req('/api/pacientes/asignar-titulares', { clinicId: 'cli' }))).json()
    expect(real).toMatchObject({ ok: true, simulado: false, asignados: 1 })
    expect(escrituras).toEqual([expect.objectContaining({ id: 'con-cita', medicoTitularUid: TITULAR })])
    expect(fichas.get('ya')?.medicoTitularUid).toBe(OTRO)
  })
  it('no es de recepción: exige administrar', async () => {
    miembro = { uid: OTRO, role: 'secretaria' }
    const res = await asignar(req('/api/pacientes/asignar-titulares', { clinicId: 'cli' }))
    expect(res.status).toBe(403)
  })
})
