import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const estado = vi.hoisted(() => ({ role: 'medico', lecturas: [] as string[] }))
vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: async () => ({ ok: true, uid: 'medico-a', clinicId: 'clinica-x', role: estado.role }),
}))
vi.mock('@/lib/ops/lo-que-no-deberia-pasar', () => ({ anotarDenegacion: vi.fn(), rutaSinParametros: (s: string) => s }))
vi.mock('@/lib/firebase-admin', () => {
  const vacia = { docs: [], size: 0, empty: true }
  const consulta = (datos = vacia) => {
    const q = { orderBy: () => q, limit: () => q, startAfter: () => q, get: async () => datos }
    return q
  }
  const pacientes = ['medico-a', 'medico-b'].map(uid => ({
    id: `paciente-${uid}`, data: () => ({ medicoTitularUid: uid, nombre: `Ficticio ${uid}` }),
    ref: { collection: (sub: string) => {
      estado.lecturas.push(`${uid}/${sub}`)
      return consulta()
    } },
  }))
  return { adminDb: { collection: () => ({ doc: () => ({ collection: (nombre: string) => {
    if (nombre === 'patients') return consulta({ docs: pacientes, size: 2, empty: false } as never)
    if (nombre === 'audit_log') return { ...consulta(), add: async () => undefined }
    return consulta()
  } }) }) } }
})

beforeEach(() => { estado.role = 'medico'; estado.lecturas = [] })

describe('se ejecuta el handler real, no sólo un predicado de permisos', () => {
  it.each(['exportar-csv', 'exportar-excel'])('%s no consulta subcolecciones del médico B', async formato => {
    const { GET } = await import(`@/app/api/clinic/${formato}/route.ts`)
    const response = await GET(new NextRequest(`http://localhost/api/clinic/${formato}?clinicId=clinica-x&dominio=consultas`))
    expect(response.status).toBe(200)
    await response.arrayBuffer()
    expect(estado.lecturas.some(p => p.startsWith('medico-a/'))).toBe(true)
    expect(estado.lecturas.filter(p => p.startsWith('medico-b/'))).toEqual([])
  })
})
