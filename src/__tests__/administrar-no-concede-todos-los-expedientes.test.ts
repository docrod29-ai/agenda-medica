import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ collection: vi.fn(() => { throw new Error('LECTURA_GLOBAL_NO_AUTORIZADA') }) }))
vi.mock('@/lib/firebase-admin', () => ({ adminDb: { collection: mocks.collection }, default: {} }))
vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: async () => ({ ok: true, uid: 'medico-a', clinicId: 'clinica-x', role: 'medico' }),
}))
vi.mock('@/lib/ops/lo-que-no-deberia-pasar', () => ({ anotarDenegacion: vi.fn(), rutaSinParametros: (s: string) => s }))
beforeEach(() => { mocks.collection.mockClear() })

it.each([
  { ruta: 'clinic/exportar', metodo: 'GET', cargar: () => import('@/app/api/clinic/exportar/route').then(m => m.GET) },
  { ruta: 'clinic/importar', metodo: 'POST', cargar: () => import('@/app/api/clinic/importar/route').then(m => m.POST) },
  { ruta: 'cumplimiento/bitacora', metodo: 'GET', cargar: () => import('@/app/api/cumplimiento/bitacora/route').then(m => m.GET) },
  { ruta: 'pacientes/fundir', metodo: 'POST', cargar: () => import('@/app/api/pacientes/fundir/route').then(m => m.POST) },
  { ruta: 'pacientes/asignar-titulares', metodo: 'POST', cargar: () => import('@/app/api/pacientes/asignar-titulares/route').then(m => m.POST) },
  { ruta: 'arco/acceso', metodo: 'POST', cargar: () => import('@/app/api/arco/acceso/route').then(m => m.POST) },
  { ruta: 'arco/cancelar', metodo: 'POST', cargar: () => import('@/app/api/arco/cancelar/route').then(m => m.POST) },
  { ruta: 'arco/oponerse', metodo: 'POST', cargar: () => import('@/app/api/arco/oponerse/route').then(m => m.POST) },
  { ruta: 'arco/ligar', metodo: 'POST', cargar: () => import('@/app/api/arco/ligar/route').then(m => m.POST) },
])('$ruta rechaza al médico antes de leer datos globales', async ({ ruta, metodo, cargar }) => {
  const handler = await cargar()
  const req = new NextRequest(`http://localhost/api/${ruta}?clinicId=clinica-x&desde=2026-09-01&hasta=2026-09-11`, {
    method: metodo,
    ...(metodo === 'POST' ? { body: JSON.stringify({
      clinicId: 'clinica-x', patientId: 'paciente-b', solicitudId: 'solicitud-b',
      aId: 'paciente-b', bId: 'paciente-c', simular: true, identidadVerificada: true,
    }), headers: { 'content-type': 'application/json' } } : {}),
  })
  const response = await handler(req)
  expect(response.status).toBe(403)
  expect(mocks.collection).not.toHaveBeenCalled()
})
