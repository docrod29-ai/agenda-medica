import { describe, it, expect } from 'vitest'
import { copiloto } from '@/lib/expediente/copiloto'
import { extraerMg, extraerTomasDia } from '@/lib/seguridad/dosis'

/**
 * Regresiones de la red de seguridad clínica (auditoría integral):
 *  - Una negación referida a OTRAS alergias ya NO apaga el chequeo de la alergia real.
 *  - La dosis en mL ya no se malinterpreta como mg; frecuencias en palabra se parsean.
 */
describe('Copiloto — alergia vs receta con negación parcial', () => {
  it('"Sulfas; no refiere otras" + sulfa SÍ dispara la alerta crítica', () => {
    const sug = copiloto({
      alergias: 'Sulfas; no refiere otras',
      medicamentos: [{ nombre: 'Trimetoprim-sulfametoxazol', dosis: '160/800 mg' }],
    })
    expect(sug.some(s => s.id.startsWith('alergia:') && s.nivel === 'critico')).toBe(true)
  })

  it('"Penicilina. No refiere alimentarias" + amoxicilina SÍ dispara', () => {
    const sug = copiloto({
      alergias: 'Penicilina. No refiere alimentarias',
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
    })
    expect(sug.some(s => s.id.startsWith('alergia:'))).toBe(true)
  })

  it('negación PURA ("niega alergias") no genera alerta', () => {
    const sug = copiloto({
      alergias: 'Niega alergias',
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
    })
    expect(sug.some(s => s.id.startsWith('alergia:'))).toBe(false)
  })
})

describe('extraerMg — no confundir volumen con masa', () => {
  it('"5 mL" NO se lee como 5 mg (devuelve null)', () => {
    expect(extraerMg('5 mL')).toBeNull()
    expect(extraerMg('7.5 ml')).toBeNull()
  })
  it('unidad de masa explícita se respeta', () => {
    expect(extraerMg('500 mg')).toBe(500)
    expect(extraerMg('1 g')).toBe(1000)
    expect(extraerMg('160 mcg')).toBeCloseTo(0.16)
  })
  it('con concentración "500 mg/5 mL" toma la masa', () => {
    expect(extraerMg('500 mg/5 mL')).toBe(500)
  })
  it('número pelón se asume mg', () => {
    expect(extraerMg('500')).toBe(500)
  })
})

describe('extraerTomasDia — frecuencias en palabra', () => {
  it('"tres veces al día" = 3 tomas', () => {
    expect(extraerTomasDia('tres veces al día')).toBe(3)
  })
  it('"cada ocho horas" = 3 tomas', () => {
    expect(extraerTomasDia('cada ocho horas')).toBe(3)
  })
  it('"cada doce horas" = 2 tomas', () => {
    expect(extraerTomasDia('cada doce horas')).toBe(2)
  })
  it('sigue parseando dígitos', () => {
    expect(extraerTomasDia('cada 8 horas')).toBe(3)
    expect(extraerTomasDia('3 veces al día')).toBe(3)
  })
})
