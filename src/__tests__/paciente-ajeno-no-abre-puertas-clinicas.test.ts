/**
 * REG-671 · D-057 también rige en las puertas indirectas del expediente.
 * Al integrar el rediseño con v1196 encontramos tres rutas Admin SDK que
 * comprobaban el rol, pero no el titular: paquete, enlace clínico y sala.
 * Se ejecutan sus POST reales y la autorización canónica sobre una base
 * sintética. Un médico ajeno no obtiene URL ni llega a leer/escribir notas.
 * Los positivos impiden cerrar todas las rutas para conseguir un verde.
 * No mide reglas desplegadas, pacientes sin titular ni dispositivos físicos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const doble = vi.hoisted(() => ({
  documentos: new Map<string, Record<string, unknown>>(),
  lecturas: [] as string[],
  escrituras: [] as string[],
  uid: 'medico-ajeno',
  role: 'medico',
}))

vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: async (_req: unknown, clinicId: string) => ({
    ok: true, uid: doble.uid, role: doble.role, clinicId,
  }),
}))
vi.mock('@/lib/ops/lo-que-no-deberia-pasar', () => ({
  anotarDenegacion: () => {}, rutaSinParametros: (r: string) => r,
}))
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: async () => null }))
vi.mock('@/lib/firebase-admin', () => {
  function doc(path: string) {
    return {
      path,
      collection: (name: string) => collection(`${path}/${name}`),
      get: async () => {
        doble.lecturas.push(path)
        return { exists: doble.documentos.has(path), data: () => doble.documentos.get(path) }
      },
      set: async () => { doble.escrituras.push(path) },
      update: async () => { doble.escrituras.push(path) },
    }
  }
  function collection(path: string) { return { doc: (id: string) => doc(`${path}/${id}`) } }
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => 'hora-sintetica' } } },
    adminDb: { collection },
  }
})

import { POST as paquete } from '@/app/api/expediente/paquete-de-visita/route'
import { POST as enlace } from '@/app/api/portal/link/route'
import { POST as sala } from '@/app/api/telesalud/sala/route'

const paciente = 'clinics/clinica-ficticia/patients/paciente-ficticio'
const cuerpo = { clinicId: 'clinica-ficticia', patientId: 'paciente-ficticio', notaId: 'nota-ficticia' }
const request = (ruta: string, body: unknown) => new NextRequest(`https://ejemplo.test/api/${ruta}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

beforeEach(() => {
  doble.documentos.clear(); doble.lecturas.length = 0; doble.escrituras.length = 0
  doble.uid = 'medico-ajeno'; doble.role = 'medico'
  doble.documentos.set(paciente, { medicoTitularUid: 'medico-titular', compartidoCon: ['medico-compartido'] })
  doble.documentos.set('clinics/clinica-ficticia/config/main', { telefonoAdmin: '5555550000' })
  doble.documentos.set('clinics/clinica-ficticia/appointments/cita-ficticia', {
    pacienteId: 'paciente-ficticio', telesaludUrl: 'https://sala.example.test/sintetica',
    telesaludNombre: 'sintetica', telesaludExpiresAt: Date.now() / 1000 + 600,
  })
})

describe('médico ajeno del mismo consultorio', () => {
  it.each(['previsualizar', 'liberar', 'retirar'])('no puede %s el paquete', async (action) => {
    const r = await paquete(request('expediente/paquete-de-visita', { ...cuerpo, action }))
    expect(r.status).toBe(403)
    expect(doble.lecturas.some(p => p.includes('/notas/') || p.includes('/paquetes_visita/'))).toBe(false)
    expect(doble.escrituras).toEqual([])
  })

  it('no obtiene un enlace clínico de ese paciente', async () => {
    const r = await enlace(request('portal/link', { ...cuerpo, alcance: 'clinico' }))
    expect(r.status).toBe(403)
    expect(await r.json()).not.toHaveProperty('url')
  })

  it('no obtiene la sala existente ni confirmación de que existe', async () => {
    const r = await sala(request('telesalud/sala', { clinicId: cuerpo.clinicId, citaId: 'cita-ficticia' }))
    expect(r.status).toBe(404)
    expect(await r.json()).not.toHaveProperty('url')
    expect(doble.escrituras).toEqual([])
  })

  it.each(['medico-titular', 'medico-compartido', 'admin'])('conserva enlace y sala para %s', async (uid) => {
    doble.uid = uid; doble.role = uid === 'admin' ? 'admin' : 'medico'
    const link = await enlace(request('portal/link', { ...cuerpo, alcance: 'clinico' }))
    expect(link.status).toBe(200)
    expect(await link.json()).toMatchObject({ alcance: 'clinico', url: expect.any(String) })
    const room = await sala(request('telesalud/sala', { clinicId: cuerpo.clinicId, citaId: 'cita-ficticia' }))
    expect(room.status).toBe(200)
    expect(await room.json()).toHaveProperty('url', 'https://sala.example.test/sintetica')
  })

  it('recepción conserva el enlace administrativo y no obtiene el clínico', async () => {
    doble.role = 'secretaria'
    const administrativo = await enlace(request('portal/link', cuerpo))
    expect(administrativo.status).toBe(200)
    expect(await administrativo.json()).toHaveProperty('alcance', 'agenda')
    expect((await enlace(request('portal/link', { ...cuerpo, alcance: 'clinico' }))).status).toBe(403)
  })
})
