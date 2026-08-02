/**
 * GOLDEN — la tasa de bajas.
 *
 * El MRR dice cuánto entra este mes; esto dice si se sostiene. Un producto con
 * MRR creciente y 15 % de bajas mensuales reemplaza clientes tan rápido como
 * los pierde, y eso no se ve en ninguna suma.
 *
 * Lo que se protege aquí es el DENOMINADOR: se mide contra quienes podían irse.
 */
import { describe, it, expect } from 'vitest'
import { churnDelMes, tasaLegible } from '@/lib/finanzas/churn'

const activo = (mrr = 1000) => ({ status: 'active', mrr })
const bajaEn = (fecha: string, mrr = 1000) => ({ status: 'cancelled', canceladaEn: fecha, mrr })

describe('churnDelMes', () => {
  it('mide contra los que PODÍAN irse, no contra los que quedan', () => {
    // 8 activos hoy + 2 que se fueron en el mes = 10 podían irse → 20 %.
    // Dividir entre los 8 que quedan daría 25 %: inflado justo cuando peor va.
    const r = churnDelMes([
      ...Array.from({ length: 8 }, () => activo()),
      bajaEn('2026-07-10'), bajaEn('2026-07-28'),
    ], '2026-07')
    expect(r.bajasDelMes).toBe(2)
    expect(r.base).toBe(10)
    expect(r.tasa).toBeCloseTo(0.2)
  })

  it('las bajas de OTRO mes no cuentan como de éste', () => {
    const r = churnDelMes([activo(), bajaEn('2026-06-15')], '2026-07')
    expect(r.bajasDelMes).toBe(0)
    expect(r.tasa).toBe(0)
  })

  it('suma el MRR que se fue con ellos', () => {
    const r = churnDelMes([activo(2000), bajaEn('2026-07-01', 899), bajaEn('2026-07-20', 1499)], '2026-07')
    expect(r.mrrPerdido).toBe(2398)
  })

  it('sin base NO dice 0 %: dice que no se sabe', () => {
    // Dividir entre cero no es cero. Un tablero nuevo con cero clientes que
    // muestra «0 % de bajas» está afirmando algo que no midió.
    const r = churnDelMes([], '2026-07')
    expect(r.tasa).toBeNull()
    expect(tasaLegible(r.tasa)).toBe('sin base')
  })

  it('las bajas SIN fecha se declaran aparte, no se reparten', () => {
    // Son las anteriores a que se empezara a registrar `canceladaEn`. Meterlas
    // en un mes cualquiera convertiría un acumulado en una tasa falsa.
    const r = churnDelMes([
      activo(),
      { status: 'cancelled', mrr: 500 },        // sin fecha
      bajaEn('2026-07-05'),
    ], '2026-07')
    expect(r.bajasDelMes).toBe(1)
    expect(r.bajasSinFecha).toBe(1)
    expect(r.mrrPerdido).toBe(1000)             // el de la baja sin fecha NO entra
  })

  it('la tasa se lee con un decimal', () => {
    expect(tasaLegible(0.1234)).toBe('12.3 %')
  })
})
