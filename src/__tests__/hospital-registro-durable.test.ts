import { describe, it, expect } from 'vitest'
import { registroDurable } from '@/lib/hospital/registro-durable'

/** El registro durable es la fuente de verdad legal (append-only, sin truncar)
 *  de balance/escala/SBAR. El autor `por` lo SELLA el servidor (4º arg), NO el
 *  cliente (auditoría P1: `p.por` era spoofeable → atribuir a otro médico). */
describe('registroDurable', () => {
  const now = '2026-07-16T10:00:00Z'
  const POR = 'Enf. Real (sesión)'

  it('balance → usa el autor sellado, NO p.por del cliente', () => {
    const r = registroDurable('balance', { ingresos: 1200, egresos: 800, por: 'FALSO' }, now, POR)
    expect(r).toEqual({ tipo: 'balance', fecha: now, ingresos: 1200, egresos: 800, por: POR })
  })
  it('escala → registro con score y riesgo + autor sellado', () => {
    const r = registroDurable('escala', { tipo: 'NEWS2', score: 7, riesgo: 'alto', por: 'FALSO' }, now, POR)
    expect(r).toMatchObject({ tipo: 'escala', escala: 'NEWS2', score: 7, riesgo: 'alto', por: POR })
  })
  it('sbar → registro con texto + autor sellado', () => {
    const r = registroDurable('sbar', { texto: 'Paciente estable', por: 'FALSO' }, now, POR)
    expect(r).toMatchObject({ tipo: 'sbar', texto: 'Paciente estable', por: POR })
  })
  it('acciones sin registro durable devuelven null (no duplican)', () => {
    expect(registroDurable('administrar', {}, now, POR)).toBeNull()
    expect(registroDurable('crear', {}, now, POR)).toBeNull()
    expect(registroDurable('indicacion_agregar', {}, now, POR)).toBeNull()
  })
})
