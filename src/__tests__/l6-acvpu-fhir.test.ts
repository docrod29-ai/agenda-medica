/**
 * L6 (decisión del Dr): ACVPU completo + FHIR no pierde datos capturados.
 */
import { describe, it, expect } from 'vitest'
import { calcularNews2 } from '@/lib/hospital/news2'

describe('L6 · NEWS2 deriva de ACVPU completo (A=0, resto=3)', () => {
  it("'A' y 'alerta' → 0 puntos de conciencia", () => {
    expect(calcularNews2({ fc: 70, conciencia: 'A' })!.detalle.find(d => d.param === 'Conciencia')).toBeUndefined()
    expect(calcularNews2({ fc: 70, conciencia: 'alerta' })!.detalle.find(d => d.param === 'Conciencia')).toBeUndefined()
  })
  it.each(['C', 'V', 'P', 'U', 'alterada'] as const)("'%s' → 3 puntos de conciencia", (c) => {
    const d = calcularNews2({ fc: 70, conciencia: c })!.detalle.find(x => x.param === 'Conciencia')
    expect(d?.puntos).toBe(3)
  })
})
