import { describe, it, expect } from 'vitest'
import {
  topeDiario, superaTope, conteoDeHoy, siguienteConteo, TOPE_DIARIO_DEFAULT,
} from '@/lib/whatsapp/frecuencia'

describe('Tope diario efectivo (Iter. 9)', () => {
  it('default 3 sin config o config inválida', () => {
    expect(topeDiario(undefined)).toBe(TOPE_DIARIO_DEFAULT)
    expect(topeDiario({})).toBe(3)
    expect(topeDiario({ topeDiarioProactivo: NaN })).toBe(3)
  })
  it('respeta y acota el valor de la clínica a [1,20]', () => {
    expect(topeDiario({ topeDiarioProactivo: 5 })).toBe(5)
    expect(topeDiario({ topeDiarioProactivo: 0 })).toBe(1)
    expect(topeDiario({ topeDiarioProactivo: 100 })).toBe(20)
    expect(topeDiario({ topeDiarioProactivo: 2.9 })).toBe(2) // floor
  })
})

describe('superaTope', () => {
  it('bloquea al alcanzar el tope', () => {
    expect(superaTope(2, 3)).toBe(false)
    expect(superaTope(3, 3)).toBe(true)
    expect(superaTope(4, 3)).toBe(true)
  })
})

describe('Conteo diario por contacto', () => {
  it('cuenta 0 si no hay registro o si es de otro día', () => {
    expect(conteoDeHoy(undefined, '2026-07-14')).toBe(0)
    expect(conteoDeHoy({ fecha: '2026-07-13', conteo: 5 }, '2026-07-14')).toBe(0)
    expect(conteoDeHoy({ fecha: '2026-07-14', conteo: 2 }, '2026-07-14')).toBe(2)
  })
  it('siguienteConteo reinicia en día nuevo y suma en el mismo', () => {
    expect(siguienteConteo({ fecha: '2026-07-13', conteo: 9 }, '2026-07-14')).toEqual({ fecha: '2026-07-14', conteo: 1 })
    expect(siguienteConteo({ fecha: '2026-07-14', conteo: 2 }, '2026-07-14')).toEqual({ fecha: '2026-07-14', conteo: 3 })
    expect(siguienteConteo(undefined, '2026-07-14')).toEqual({ fecha: '2026-07-14', conteo: 1 })
  })
})
