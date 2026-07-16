import { describe, it, expect } from 'vitest'
import { revisarDosis, buscarFarmaco, peorSeveridad, extraerMg, extraerTomasDia } from '@/lib/seguridad/dosis'

describe('Parsers de dosis y frecuencia', () => {
  it('extraerMg convierte unidades', () => {
    expect(extraerMg('500 mg')).toBe(500)
    expect(extraerMg('1 g')).toBe(1000)
    expect(extraerMg('250 mcg')).toBe(0.25)
    expect(extraerMg('0.5 g')).toBe(500)
    expect(extraerMg('sin numero')).toBe(null)
  })
  it('extraerTomasDia interpreta frecuencias', () => {
    expect(extraerTomasDia('cada 8 horas')).toBe(3)
    expect(extraerTomasDia('c/12h')).toBe(2)
    expect(extraerTomasDia('3 veces al día')).toBe(3)
    expect(extraerTomasDia('una vez al día')).toBe(1)
    expect(extraerTomasDia('lo que sea')).toBe(null)
  })
})

describe('Verificación de dosis — error de decimal (el caso que mata)', () => {
  it('detecta 50 mg → 500 mg como posible error de decimal (crítico)', () => {
    // Ketorolaco máx por toma 30 mg → 300 mg es 10×
    const a = revisarDosis({ farmaco: 'ketorolaco', dosisMg: 300 })
    expect(a.some(x => x.codigo === 'posible_error_decimal')).toBe(true)
    expect(peorSeveridad(a)).toBe('critica')
  })
  it('paracetamol 10000 mg (10×) marca error de decimal', () => {
    const a = revisarDosis({ farmaco: 'paracetamol', dosisMg: 10000 })
    expect(a.some(x => x.codigo === 'posible_error_decimal' || x.codigo === 'dosis_extrema')).toBe(true)
  })
})

describe('Verificación de dosis — techos adulto', () => {
  it('dosis normal no alerta', () => {
    expect(revisarDosis({ farmaco: 'paracetamol', dosisMg: 500, tomasDia: 3 })).toEqual([])
  })
  it('supera el máximo por toma', () => {
    const a = revisarDosis({ farmaco: 'losartan', dosisMg: 300 })
    expect(a.some(x => x.codigo === 'sobre_maximo_dosis' || x.codigo === 'posible_error_decimal')).toBe(true)
  })
  it('supera el máximo diario aunque la toma sea válida', () => {
    // Paracetamol 1000 mg × 5 = 5000 > 4000/día
    const a = revisarDosis({ farmaco: 'paracetamol', dosisMg: 1000, tomasDia: 5 })
    expect(a.some(x => x.codigo === 'sobre_maximo_diario')).toBe(true)
  })
})

describe('Verificación de dosis — pediátrico por peso', () => {
  it('ibuprofeno 300 mg en 10 kg = 30 mg/kg supera 10 mg/kg', () => {
    const a = revisarDosis({ farmaco: 'ibuprofeno', dosisMg: 300, pesoKg: 10 })
    expect(a.some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(true)
    expect(peorSeveridad(a)).toBe('critica')
  })
  it('dosis pediátrica correcta no alerta', () => {
    // ibuprofeno 100 mg en 15 kg = 6.6 mg/kg, dentro de rango
    expect(revisarDosis({ farmaco: 'ibuprofeno', dosisMg: 100, pesoKg: 15, tomasDia: 3 }).length).toBe(0)
  })
})

describe('Honestidad: sin referencia NO calla', () => {
  it('fármaco desconocido devuelve alerta informativa (ausencia ≠ seguro)', () => {
    const a = revisarDosis({ farmaco: 'medicamento-raro-xyz', dosisMg: 50 })
    expect(a.some(x => x.codigo === 'sin_referencia')).toBe(true)
  })
  it('dosis absurda absoluta alerta aunque no haya fármaco', () => {
    const a = revisarDosis({ farmaco: 'algo', dosisMg: 50000 })
    expect(a.some(x => x.codigo === 'dosis_extrema')).toBe(true)
  })
  it('buscarFarmaco resuelve alias', () => {
    expect(buscarFarmaco('advil')?.nombre).toBe('Ibuprofeno')
    expect(buscarFarmaco('tempra')?.nombre).toBe('Paracetamol')
    expect(buscarFarmaco('inexistente')).toBe(null)
  })
})
