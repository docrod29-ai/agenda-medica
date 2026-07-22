import { describe, it, expect } from 'vitest'
import { porCobrar, diasEntreISO, sumarMesesISO, PERIODICIDAD_MESES, type Membresia } from '@/lib/membresias'

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

  it('sumarMesesISO avanza por mes de calendario (no 30 días) y conserva el día', () => {
    expect(sumarMesesISO('2026-01-01', 1)).toBe('2026-02-01')   // no 2026-01-31
    expect(sumarMesesISO('2026-01-15', 3)).toBe('2026-04-15')   // trimestral
    expect(sumarMesesISO('2026-03-10', 12)).toBe('2027-03-10')  // anual, respeta bisiesto
  })

  it('sumarMesesISO cae al último día si el destino no tiene ese día (31 ene + 1 mes)', () => {
    expect(sumarMesesISO('2026-01-31', 1)).toBe('2026-02-28')   // 2026 no bisiesto
    expect(sumarMesesISO('2024-01-31', 1)).toBe('2024-02-29')   // 2024 bisiesto
    expect(sumarMesesISO('2026-01-31', 3)).toBe('2026-04-30')   // abril tiene 30
  })

  it('12 cobros mensuales = exactamente 1 año (sin deriva ni sobrefacturación)', () => {
    let f = '2026-01-01'
    for (let i = 0; i < 12; i++) f = sumarMesesISO(f, PERIODICIDAD_MESES.mensual)
    expect(f).toBe('2027-01-01')
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
