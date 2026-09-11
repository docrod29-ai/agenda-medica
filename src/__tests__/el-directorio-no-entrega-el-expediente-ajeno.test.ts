/** REG-682/683/684: handler y guardián reales, datos sólo sintéticos.
 * Prueba la respuesta HTTP; las reglas reales se comprueban en el emulador.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const h = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), contador: { lecturas: 0, getDocs: 0, getDoc: 0 }, fallos: { collectionGroup: false }, uid: 'a', role: 'medico' }))
vi.mock('@/lib/firebase-admin', async () => {
  const { lecturasAdminSobreCliente } = await import('./_harness/firestore-cliente-en-memoria')
  const a = lecturasAdminSobreCliente(h)
  return { adminDb: { ...a, collection: (n: string) => {
    const c = a.collection(n)
    return { ...c, doc: (id: string) => ({ ...c.doc(id), delete: async () => { h.docs.delete(`${n}/${id}`) } }) }
  } } }
})
vi.mock('firebase-admin/firestore', () => ({ FieldPath: { documentId: () => '__name__' } }))
vi.mock('@/lib/auth-server', () => ({ verificarMiembro: async (_r: unknown, clinicId: string) => h.uid && clinicId === 'clinica-a'
  ? { ok: true, uid: h.uid, role: h.role, clinicId }
  : { ok: false, response: Response.json({ error: 'Sin acceso' }, { status: h.uid ? 403 : 401 }) } }))
vi.mock('@/lib/ops/lo-que-no-deberia-pasar', () => ({ anotarDenegacion: () => {}, rutaSinParametros: (r: string) => r }))
import { POST } from '@/app/api/pacientes/directorio/route'
import { GET, DELETE } from '@/app/api/clinic/invitaciones/route'
const pedir = (extra: Record<string, unknown> = {}) => POST(new NextRequest('https://sintetico.test/api/pacientes/directorio', { method: 'POST', body: JSON.stringify({ clinicId: 'clinica-a', modo: 'uno', patientId: 'b', ...extra }) }))
beforeEach(() => {
  h.uid = 'a'; h.role = 'medico'; h.docs.clear(); h.contador.lecturas = 0
  h.docs.set('clinics/clinica-a/patients/b', { nombre: 'Paciente sintético B', telefono: '0000000000', medicoTitularUid: 'b', compartidoCon: [], alergias: 'MARCADOR_PRIVADO', campoClinicoFuturo: 'MARCADOR_PRIVADO', responsable: { nombre: 'Tutor sintético', parentesco: 'tutor', secretoFuturo: 'MARCADOR_PRIVADO' } })
})
describe('la proyección se decide antes de responder', () => {
  it.each(['medico', 'secretaria'])('%s sólo recibe el directorio del paciente ajeno', async role => {
    h.role = role
    for (const modo of ['uno', 'pagina', 'prefijo']) {
      const r = await pedir({ modo, campo: 'nombre', valor: 'Paciente' })
      expect(r.status).toBe(200)
      expect(r.headers.get('cache-control')).toBe('no-store')
      const body = await r.text()
      expect(body).toContain('Paciente sintético B')
      expect(body).not.toContain('MARCADOR_PRIVADO')
    }
  })
  it.each(['titular', 'compartido', 'admin'])('%s conserva acceso al expediente completo', async modo => {
    if (modo === 'titular') h.uid = 'b'
    if (modo === 'admin') h.role = 'admin'
    if (modo === 'compartido') h.docs.get('clinics/clinica-a/patients/b')!.compartidoCon = ['a']
    expect(await (await pedir()).text()).toContain('MARCADOR_PRIVADO')
  })
  it('sin titular no abre los datos clínicos y no permite sondear sus notas', async () => {
    delete h.docs.get('clinics/clinica-a/patients/b')!.medicoTitularUid
    expect(await (await pedir()).text()).not.toContain('MARCADOR_PRIVADO')
    expect(await (await pedir({ modo: 'sondeo' })).json()).toEqual({ pacientes: [], hayMas: false })
  })
  it('el rescate entrega sólo IDs autorizados y conserva el recorte', async () => {
    h.docs.set('clinics/clinica-a/patients/a', { nombre: 'A', medicoTitularUid: 'a' })
    expect(await (await pedir({ modo: 'sondeo', limite: 1 })).json()).toEqual({ pacientes: [{ id: 'a' }], hayMas: true })
    expect(h.contador.lecturas).toBe(2)
  })
  it.each(['sin-sesion', 'otro-consultorio', 'rol-invalido'])('%s se rechaza antes de leer pacientes', async caso => {
    if (caso === 'sin-sesion') h.uid = ''
    if (caso === 'rol-invalido') h.role = 'desconocido'
    const r = await pedir(caso === 'otro-consultorio' ? { clinicId: 'clinica-b' } : {})
    expect(r.status).toBe(caso === 'sin-sesion' ? 401 : 403)
    expect(h.contador.lecturas).toBe(0)
  })
})

describe('REG-683 — una invitación administrativa no escala el rol del médico', () => {
  function invitaciones() {
    for (const [code, creadoPor, role] of [['propia', 'a', 'medico'], ['ajena', 'b', 'medico'], ['admin', 'b', 'admin']]) {
      h.docs.set(`clinic_invitations/${code}`, { clinicId: 'clinica-a', creadoPor, role, createdAt: '2026-09-11' })
    }
  }
  it('el médico sólo recibe sus invitaciones de roles permitidos', async () => {
    invitaciones()
    const r = await GET(new NextRequest('https://sintetico.test/api/clinic/invitaciones?clinicId=clinica-a'))
    expect((await r.json()).invitaciones.map((i: { code: string }) => i.code)).toEqual(['propia'])
  })
  it.each(['ajena', 'admin'])('el médico no revoca la credencial %s', async code => {
    invitaciones()
    const r = await DELETE(new NextRequest(`https://sintetico.test/api/clinic/invitaciones?clinicId=clinica-a&code=${code}`, { method: 'DELETE' }))
    expect(r.status).toBe(403)
    expect(h.docs.has(`clinic_invitations/${code}`)).toBe(true)
  })
  it('el administrador conserva la gestión del equipo', async () => {
    invitaciones(); h.role = 'admin'
    const r = await GET(new NextRequest('https://sintetico.test/api/clinic/invitaciones?clinicId=clinica-a'))
    expect((await r.json()).invitaciones).toHaveLength(3)
    expect((await DELETE(new NextRequest('https://sintetico.test/api/clinic/invitaciones?clinicId=clinica-a&code=admin', { method: 'DELETE' }))).status).toBe(200)
    expect(h.docs.has('clinic_invitations/admin')).toBe(false)
  })
})
