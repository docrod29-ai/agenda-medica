import { describe, it, expect } from 'vitest'
import { registroDurable } from '@/lib/hospital/registro-durable'

/** El registro durable es la fuente de verdad legal (append-only, sin truncar)
 *  de balance/escala/SBAR. Estas pruebas fijan su forma para que nunca vuelva
 *  a perderse un registro clínico por el .slice() del array-caché (NOM-004). */
describe('registroDurable', () => {
  const now = '2026-07-16T10:00:00Z'

  it('balance → registro con ingresos/egresos', () => {
    const r = registroDurable('balance', { ingresos: 1200, egresos: 800, por: 'Enf. A' }, now)
    expect(r).toEqual({ tipo: 'balance', fecha: now, ingresos: 1200, egresos: 800, por: 'Enf. A' })
  })

  it('escala → registro con score y riesgo', () => {
    const r = registroDurable('escala', { tipo: 'NEWS2', score: 7, riesgo: 'alto', por: 'Enf. B' }, now)
    expect(r).toMatchObject({ tipo: 'escala', escala: 'NEWS2', score: 7, riesgo: 'alto' })
  })

  it('sbar → registro con texto', () => {
    const r = registroDurable('sbar', { texto: 'Paciente estable', por: 'Dr. C' }, now)
    expect(r).toMatchObject({ tipo: 'sbar', texto: 'Paciente estable' })
  })

  it('acciones sin registro durable devuelven null (no duplican)', () => {
    expect(registroDurable('administrar', {}, now)).toBeNull()
    expect(registroDurable('crear', {}, now)).toBeNull()
    expect(registroDurable('indicacion_agregar', {}, now)).toBeNull()
  })
})
