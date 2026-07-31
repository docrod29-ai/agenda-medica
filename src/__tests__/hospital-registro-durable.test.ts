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
  /**
   * CAMBIO DELIBERADO (E0-09, REG-052). Este caso afirmaba que `administrar` e
   * `indicacion_agregar` devolvían `null`, y ése era exactamente el hueco: el MAR
   * y las órdenes NUNCA llegaban al libro append-only `registros`; vivían sólo en
   * el array `indicaciones[].administraciones[]` del doc, que escribe el Admin SDK
   * (las reglas de Firestore no pueden protegerlo) y que no tiene tope de tamaño.
   * No es un test aflojado: la aserción se INVIRTIÓ a propósito y su contraparte
   * completa está en `src/__tests__/hospital-eventos-append-only.test.ts`.
   */
  it('E0-09: el MAR y las órdenes SÍ producen registro durable', () => {
    expect(registroDurable('administrar', { indId: 'i', adm: { estado: 'administrado' } }, now, POR))
      .toMatchObject({ tipo: 'administracion', fecha: now, por: POR })
    expect(registroDurable('indicacion_agregar', { descripcion: 'Fármaco X' }, now, POR))
      .toMatchObject({ tipo: 'indicacion_alta', fecha: now, por: POR })
  })

  it('acciones sin registro durable devuelven null (no duplican)', () => {
    expect(registroDurable('crear', {}, now, POR)).toBeNull()
    expect(registroDurable('conciliar', {}, now, POR)).toBeNull()
    expect(registroDurable('interconsulta_agregar', {}, now, POR)).toBeNull()
  })
})
