import { describe, it, expect } from 'vitest'
import { modulosDe, tieneModulo, MODULOS_BASE } from '@/lib/modulos'

describe('Hospitalización es OPT-IN (solo con plan/módulo Hospital explícito)', () => {
  it('SÍ aparece por pase libre del dueño (el dueño ve su app completa)', () => {
    expect(tieneModulo({ paseLibre: true } as never, 'hospitalizacion')).toBe(true)
  })

  it('NO aparece para una clínica sin plan ni módulos definidos', () => {
    expect(tieneModulo({} as never, 'hospitalizacion')).toBe(false)
  })

  it('NO aparece en prueba (trial) ni cortesía', () => {
    expect(tieneModulo({ plan: 'trial' } as never, 'hospitalizacion')).toBe(false)
    expect(tieneModulo({ plan: 'cortesia' } as never, 'hospitalizacion')).toBe(false)
  })

  it('NO aparece en los planes de consultorio (clínica, pro)', () => {
    expect(tieneModulo({ plan: 'clinica' } as never, 'hospitalizacion')).toBe(false)
    expect(tieneModulo({ plan: 'premium' } as never, 'hospitalizacion')).toBe(false)
  })

  it('SÍ aparece con el plan Hospital', () => {
    expect(tieneModulo({ plan: 'hospital' } as never, 'hospitalizacion')).toBe(true)
  })

  it('SÍ aparece si el módulo está explícito en la clínica', () => {
    expect(tieneModulo({ modulos: ['agenda', 'hospitalizacion'] } as never, 'hospitalizacion')).toBe(true)
  })

  it('el consultorio base sigue teniendo sus módulos normales', () => {
    for (const k of ['agenda', 'expediente', 'finanzas', 'farmacia']) {
      expect(MODULOS_BASE).toContain(k)
      expect(modulosDe({ paseLibre: true } as never)).toContain(k)
    }
  })
})
