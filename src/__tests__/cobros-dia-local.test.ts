import { describe, it, expect } from 'vitest'
import { agregarResumen } from '@/lib/cobros'
import { fechaISOLocal } from '@/lib/timezone'
import type { Cobro } from '@/lib/cobros'

/**
 * El corte de caja se cierra POR LA NOCHE. Con el día UTC, un cobro de las 19:00
 * de un lunes en México quedaba etiquetado como martes: el dinero estaba en el
 * cajón pero no en el corte, y la consulta salía como "atendida y no cobrada".
 *
 * Estas pruebas fijan la frontera de las 18:00 hora de México (UTC-6), que es
 * exactamente donde fallaba.
 */
function cobro(fechaISO: string, dia: string, monto = 100): Cobro {
  return {
    id: 'x', fecha: fechaISO, dia, mes: dia.slice(0, 7), monto,
    metodo: 'efectivo', concepto: 'consulta', folio: 'CB-1',
    createdAt: fechaISO, cancelado: false,
  } as Cobro
}

describe('el día de un cobro es el del consultorio, no el UTC', () => {
  it('las 19:00 del 20 de julio en México son del 20, no del 21', () => {
    expect(fechaISOLocal(new Date('2026-07-21T01:00:00.000Z'))).toBe('2026-07-20')
  })

  it('las 23:00 UTC siguen siendo del mismo día en México', () => {
    expect(fechaISOLocal(new Date('2026-07-20T23:00:00.000Z'))).toBe('2026-07-20')
  })

  it('agrupa por el instante y no por la etiqueta heredada en UTC', () => {
    const r = agregarResumen([
      cobro('2026-07-20T20:00:00.000Z', '2026-07-20', 500), // 14:00 MX
      cobro('2026-07-21T01:00:00.000Z', '2026-07-21', 300), // 19:00 MX, etiqueta vieja
    ])
    expect(r.porDia).toHaveLength(1)
    expect(r.porDia[0]).toEqual({ dia: '2026-07-20', monto: 800, n: 2 })
  })
})
