import { describe, it, expect } from 'vitest'
import { normalizarCama, mismaCama } from '@/lib/hospital/cama'

describe('cruce de camas censo ↔ inventario', () => {
  it('tolera las variaciones reales al teclear', () => {
    for (const v of ['302-A', '302 A', '302a', '302_A', 'Cama 302-A', 'cama302a', ' 302-a ']) {
      expect(mismaCama(v, '302-A')).toBe(true)
    }
  })

  it('NO confunde camas distintas — nada de parecido difuso', () => {
    expect(mismaCama('302', '320')).toBe(false)
    expect(mismaCama('302-A', '302-B')).toBe(false)
    expect(mismaCama('302', '3020')).toBe(false)
  })

  it('una cama sin etiqueta no ocupa nada', () => {
    expect(mismaCama('', '')).toBe(false)
    expect(mismaCama(undefined, '302')).toBe(false)
    expect(mismaCama('302', null)).toBe(false)
  })

  it('normaliza acentos y prefijos', () => {
    expect(normalizarCama('Habitación 12')).toBe('12')
    expect(normalizarCama('CAMA #7')).toBe('7')
  })
})
