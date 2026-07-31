import { describe, it, expect } from 'vitest'
import { calcularComisiones, clampPct, CONFIG_COMISIONES_DEFAULT } from '@/lib/comisiones'
import type { Cobro } from '@/lib/cobros'

const cobro = (o: Partial<Cobro>): Cobro => ({
  fecha: '2026-07-10T18:00:00.000Z', dia: '2026-07-10', mes: '2026-07',
  monto: 500, metodo: 'efectivo', concepto: 'consulta', ...o,
} as Cobro)

describe('Comisiones por médico', () => {
  it('reparte por la tasa configurada de cada médico', () => {
    const r = calcularComisiones(
      [
        cobro({ medicoId: 'a', medicoNombre: 'Dra. Ruiz', monto: 1000 }),
        cobro({ medicoId: 'a', medicoNombre: 'Dra. Ruiz', monto: 500 }),
        cobro({ medicoId: 'b', medicoNombre: 'Dr. Lara', monto: 800 }),
      ],
      { porMedico: { a: 40, b: 20 }, porDefecto: 0, conceptosExcluidos: [] },
    )
    const a = r.filas.find(f => f.medicoId === 'a')!
    expect(a.baseComisionable).toBe(1500)
    expect(a.comision).toBe(600)          // 40% de 1500
    expect(a.netoConsultorio).toBe(900)
    const b = r.filas.find(f => f.medicoId === 'b')!
    expect(b.comision).toBe(160)          // 20% de 800
    expect(r.totalComision).toBe(760)
    expect(r.totalBase).toBe(2300)
  })

  it('sin configuración, comisión 0 pero muestra la base (no inventa tasa)', () => {
    const r = calcularComisiones([cobro({ medicoId: 'a', medicoNombre: 'Dra', monto: 900 })], CONFIG_COMISIONES_DEFAULT)
    expect(r.filas[0].baseComisionable).toBe(900)
    expect(r.filas[0].porcentaje).toBe(0)
    expect(r.totalComision).toBe(0)
  })

  it('los reembolsos (negativos) restan de la base', () => {
    const r = calcularComisiones(
      [
        cobro({ medicoId: 'a', medicoNombre: 'Dra', monto: 1000 }),
        cobro({ medicoId: 'a', medicoNombre: 'Dra', monto: -200, concepto: 'reembolso' }),
      ],
      { porMedico: { a: 50 }, porDefecto: 0, conceptosExcluidos: [] },
    )
    expect(r.filas[0].baseComisionable).toBe(800)
    expect(r.filas[0].comision).toBe(400)
  })

  it('excluye conceptos marcados (medicamento/material = costo)', () => {
    const r = calcularComisiones(
      [
        cobro({ medicoId: 'a', medicoNombre: 'Dra', monto: 500, concepto: 'consulta' }),
        cobro({ medicoId: 'a', medicoNombre: 'Dra', monto: 300, concepto: 'medicamento' }),
      ],
      { porMedico: { a: 10 }, porDefecto: 0, conceptosExcluidos: ['medicamento'] },
    )
    expect(r.filas[0].baseComisionable).toBe(500)   // no cuenta el medicamento
    expect(r.filas[0].nCobros).toBe(1)
  })

  it('cobros sin médico van a "sin atribuir", no a comisión', () => {
    const r = calcularComisiones(
      [cobro({ monto: 400 }), cobro({ medicoId: 'a', medicoNombre: 'Dra', monto: 600 })],
      { porMedico: { a: 25 }, porDefecto: 0, conceptosExcluidos: [] },
    )
    expect(r.sinAtribuir).toEqual({ monto: 400, n: 1 })
    expect(r.filas).toHaveLength(1)
  })

  it('clampPct acota a [0,100] y sanea basura', () => {
    expect(clampPct(150)).toBe(100)
    expect(clampPct(-5)).toBe(0)
    expect(clampPct(NaN)).toBe(0)
    expect(clampPct(37.5)).toBe(37.5)
  })
})
