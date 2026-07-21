import { describe, it, expect } from 'vitest'
import { porCobrar, diasEntreISO, type Membresia } from '@/lib/membresias'

const m = (o: Partial<Membresia>): Membresia => ({
  pacienteId: 'p', pacienteNombre: 'X', planId: 'pl', planNombre: 'Plan', precio: 500,
  periodicidad: 'mensual', inicio: '2026-07-01', proximoCobro: '2026-08-01', estado: 'activa', creadoPor: 'u',
  ...o,
} as Membresia)

describe('membresías — worklist de cobro', () => {
  it('diasEntreISO cuenta bien', () => {
    expect(diasEntreISO('2026-07-01', '2026-07-11')).toBe(10)
    expect(diasEntreISO('2026-07-11', '2026-07-01')).toBe(-10)
  })

  it('vencidas primero, y solo activas', () => {
    const lista = [
      m({ id: 'a', proximoCobro: '2026-07-25' }),                 // vencida (hoy 2026-07-30)
      m({ id: 'b', proximoCobro: '2026-08-10' }),                 // al día
      m({ id: 'c', proximoCobro: '2026-07-20', estado: 'pausada' }), // pausada → excluida
    ]
    const r = porCobrar(lista, '2026-07-30')
    expect(r.map(x => x.membresia.id)).toEqual(['a', 'b'])  // pausada fuera
    expect(r[0].vencida).toBe(true)
    expect(r[1].vencida).toBe(false)
  })
})
