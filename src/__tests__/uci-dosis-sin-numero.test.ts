import { describe, it, expect } from 'vitest'
import { dosisSinNumero, AVISO_DOSIS_ROTA } from '@/lib/uci/dosis-sin-numero'

/**
 * El único error crítico que sobrevivió a todo en el corpus de 498.
 *
 * «Meropenem DOS gramos» → «Meropenem gramos», 6 de 6 veces, en las tres voces.
 * El prompt lo lleva palabra por palabra y aun así falla.
 */

describe('la dosis que perdió su número', () => {
  it('detecta el caso EXACTO medido en el corpus', () => {
    const r = dosisSinNumero('Meropenem gramos cada ocho horas en infusión extendida.')
    expect(r).toHaveLength(1)
    expect(r[0].antes).toBe('Meropenem')
    expect(r[0].unidad).toBe('gramos')
  })

  it('la dosis COMPLETA no dispara nada', () => {
    expect(dosisSinNumero('Meropenem dos gramos cada ocho horas.')).toEqual([])
    expect(dosisSinNumero('Linezolid 600 mg cada doce horas.')).toEqual([])
    expect(dosisSinNumero('Vancomicina un gramo.')).toEqual([])
  })

  it('«cada ocho horas» NO es una dosis rota', () => {
    // Ahí la unidad va después del número, no antes: es una pauta, no una dosis.
    expect(dosisSinNumero('cada ocho horas')).toEqual([])
  })

  it('los decimales y las fracciones cuentan como cantidad', () => {
    expect(dosisSinNumero('Ceftazidima avibactam 2.5 gramos.')).toEqual([])
    expect(dosisSinNumero('medio gramo de vancomicina')).toEqual([])
  })

  it('atrapa varias en la misma frase', () => {
    expect(dosisSinNumero('Meropenem gramos y linezolid miligramos.')).toHaveLength(2)
  })

  it('NO inventa la cantidad, y lo dice', () => {
    // Un meropenem puede ser de 500 mg, 1 g o 2 g según indicación y función
    // renal. El sistema sólo sabe que HABÍA una y se perdió.
    const r = dosisSinNumero('Meropenem gramos.')
    expect(r[0].mensaje).toMatch(/NO la completa/)
    expect(r[0].mensaje).toMatch(/una dosis inventada es peor que una dosis ausente/)
  })

  it('no existe ninguna función que rellene la dosis', async () => {
    const mod = await import('@/lib/uci/dosis-sin-numero')
    expect(Object.keys(mod).filter(k => /completar|rellenar|corregir|inferir/i.test(k))).toEqual([])
  })

  it('el aviso explica POR QUÉ pasa, para que se revise', () => {
    expect(AVISO_DOSIS_ROTA).toMatch(/meropenem dos gramos/)
    expect(AVISO_DOSIS_ROTA).toMatch(/Revise la cifra antes de firmar/)
  })

  it('texto sin dosis: nada', () => {
    expect(dosisSinNumero('El paciente amaneció estable.')).toEqual([])
    expect(dosisSinNumero('')).toEqual([])
  })
})
