import { describe, it, expect } from 'vitest'
import { revisarDosis, buscarFarmaco, peorSeveridad, extraerMg, extraerTomasDia, esDosisPorKg } from '@/lib/seguridad/dosis'

// E0-05: `revisarDosis` recibe la dosis CON su unidad (mg absolutos o mg/kg/dosis)
// y el peso como masa. Migración MECÁNICA: ni un solo valor esperado cambió.
import { cantidad, kg as kgMasa } from '@/types/clinical-quantity'
const mgAbs = (v: number) => cantidad(v, 'mg', 'masa')
const mgKgDosis = (v: number) => cantidad(v, 'mg/kg/dosis', 'dosis_por_peso')


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
    const a = revisarDosis({ farmaco: 'ketorolaco', dosis: mgAbs(300)})
    expect(a.some(x => x.codigo === 'posible_error_decimal')).toBe(true)
    expect(peorSeveridad(a)).toBe('critica')
  })
  it('paracetamol 10000 mg (10×) marca error de decimal', () => {
    const a = revisarDosis({ farmaco: 'paracetamol', dosis: mgAbs(10000)})
    expect(a.some(x => x.codigo === 'posible_error_decimal' || x.codigo === 'dosis_extrema')).toBe(true)
  })
})

describe('Verificación de dosis — techos adulto', () => {
  it('dosis normal no alerta', () => {
    expect(revisarDosis({ farmaco: 'paracetamol', dosis: mgAbs(500), tomasDia: 3 })).toEqual([])
  })
  it('supera el máximo por toma', () => {
    const a = revisarDosis({ farmaco: 'losartan', dosis: mgAbs(300)})
    expect(a.some(x => x.codigo === 'sobre_maximo_dosis' || x.codigo === 'posible_error_decimal')).toBe(true)
  })
  it('supera el máximo diario aunque la toma sea válida', () => {
    // Paracetamol 1000 mg × 5 = 5000 > 4000/día
    const a = revisarDosis({ farmaco: 'paracetamol', dosis: mgAbs(1000), tomasDia: 5 })
    expect(a.some(x => x.codigo === 'sobre_maximo_diario')).toBe(true)
  })
})

describe('Verificación de dosis — pediátrico por peso', () => {
  it('ibuprofeno 300 mg en 10 kg = 30 mg/kg supera 10 mg/kg', () => {
    const a = revisarDosis({ farmaco: 'ibuprofeno', dosis: mgAbs(300), peso: kgMasa(10)})
    expect(a.some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(true)
    expect(peorSeveridad(a)).toBe('critica')
  })
  it('dosis pediátrica correcta no alerta', () => {
    // ibuprofeno 100 mg en 15 kg = 6.6 mg/kg, dentro de rango
    expect(revisarDosis({ farmaco: 'ibuprofeno', dosis: mgAbs(100), peso: kgMasa(15), tomasDia: 3 }).length).toBe(0)
  })
})

describe('Honestidad: sin referencia NO calla', () => {
  it('fármaco desconocido devuelve alerta informativa (ausencia ≠ seguro)', () => {
    const a = revisarDosis({ farmaco: 'medicamento-raro-xyz', dosis: mgAbs(50)})
    expect(a.some(x => x.codigo === 'sin_referencia')).toBe(true)
  })
  it('dosis absurda absoluta alerta aunque no haya fármaco', () => {
    const a = revisarDosis({ farmaco: 'algo', dosis: mgAbs(50000)})
    expect(a.some(x => x.codigo === 'dosis_extrema')).toBe(true)
  })
  it('buscarFarmaco resuelve alias', () => {
    expect(buscarFarmaco('advil')?.nombre).toBe('Ibuprofeno')
    expect(buscarFarmaco('tempra')?.nombre).toBe('Paracetamol')
    expect(buscarFarmaco('inexistente')).toBe(null)
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P0): la red de seguridad pediátrica estaba MUERTA
 * cuando la dosis se escribe POR KILO, que es como se prescribe en pediatría.
 * `extraerMg("50 mg/kg")` daba 50, y revisarDosis lo dividía OTRA VEZ entre el peso
 * (50/20 = 2.5 mg/kg) → jamás superaba el techo → jamás alertaba.
 */
describe('Dosis escrita POR KILO', () => {
  it('esDosisPorKg reconoce las formas reales del dictado y la receta', () => {
    expect(esDosisPorKg('50 mg/kg')).toBe(true)
    expect(esDosisPorKg('10 mg/kg/día')).toBe(true)
    expect(esDosisPorKg('15 mg por kilo')).toBe(true)
    expect(esDosisPorKg('500 mg')).toBe(false)
    expect(esDosisPorKg('1 g')).toBe(false)
  })

  it('paracetamol 50 mg/kg por toma SÍ alerta (techo 15 mg/kg)', () => {
    const a = revisarDosis({ farmaco: 'Paracetamol', dosis: mgKgDosis(50), peso: kgMasa(20)})
    expect(a.some(x => x.codigo === 'pediatrico_sobre_mgkg' && x.severidad === 'critica')).toBe(true)
  })

  it('EL BUG: sin marcar por-kg, ese mismo 50 mg/kg NO alertaba', () => {
    const a = revisarDosis({ farmaco: 'Paracetamol', dosis: mgAbs(50), peso: kgMasa(20)})  // 50/20 = 2.5 mg/kg
    expect(a.some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(false)
  })

  it('funciona aunque NO se haya capturado el peso (la dosis ya es por kilo)', () => {
    const a = revisarDosis({ farmaco: 'Ibuprofeno', dosis: mgKgDosis(30)})
    expect(a.some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(true)
  })

  it('amoxicilina 30 mg/kg × 3 = 90 mg/kg/día está en el límite, 40 × 3 lo supera', () => {
    expect(revisarDosis({ farmaco: 'Amoxicilina', dosis: mgKgDosis(30), tomasDia: 3 })
      .some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(false)
    expect(revisarDosis({ farmaco: 'Amoxicilina', dosis: mgKgDosis(40), tomasDia: 3 })
      .some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(true)
  })

  it('una dosis normal por kilo NO alerta (sin falsos positivos)', () => {
    expect(revisarDosis({ farmaco: 'Paracetamol', dosis: mgKgDosis(12), tomasDia: 4 })
      .some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(false)
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P2): frecuencias en RANGO apagaban el techo diario.
 * «cada 4 a 6 horas» no casaba ningún patrón → null → el llamador asumía 1 toma/día.
 */
describe('Frecuencias en rango', () => {
  it('«cada 4 a 6 horas» = 6 tomas (intervalo más corto = peor caso)', () => {
    expect(extraerTomasDia('cada 4 a 6 horas')).toBe(6)
  })
  it('acepta guion y otras uniones', () => {
    expect(extraerTomasDia('cada 6-8 h')).toBe(4)
    expect(extraerTomasDia('cada 6 u 8 horas')).toBe(4)
  })
  it('el techo diario YA dispara con rango (paracetamol 1000 mg c/4-6h)', () => {
    const tomas = extraerTomasDia('cada 4 a 6 horas')!
    const a = revisarDosis({ farmaco: 'Paracetamol', dosis: mgAbs(1000), tomasDia: tomas })
    expect(a.some(x => x.codigo === 'sobre_maximo_diario')).toBe(true)
  })
  it('las frecuencias simples siguen igual', () => {
    expect(extraerTomasDia('cada 8 horas')).toBe(3)
    expect(extraerTomasDia('tres veces al día')).toBe(3)
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (validado por el Dr): el verificador ignoraba la vía.
 * Ketorolaco oral tiene tope 40 mg/día y no se aprueba VO en <17 años.
 */
describe('Ketorolaco por vía oral', () => {
  it('30 mg VO × 3 (90 mg/día) SÍ supera el tope oral de 40 mg', () => {
    const a = revisarDosis({ farmaco: 'Ketorolaco', dosis: mgAbs(30), tomasDia: 3, via: 'oral' })
    expect(a.some(x => x.codigo === 'sobre_maximo_diario' && /ORAL/.test(x.mensaje))).toBe(true)
  })
  it('la misma dosis parenteral (IM) no dispara el tope oral', () => {
    const a = revisarDosis({ farmaco: 'Ketorolaco', dosis: mgAbs(30), tomasDia: 3, via: 'im' })
    expect(a.some(x => x.codigo === 'sobre_maximo_diario')).toBe(false)
  })
  it('VO en menor de 17 años → alerta crítica', () => {
    const a = revisarDosis({ farmaco: 'Ketorolaco', dosis: mgAbs(10), via: 'oral', edadAnios: 10 })
    expect(a.some(x => x.codigo === 'via_edad_no_aprobada' && x.severidad === 'critica')).toBe(true)
  })
  it('VO en adulto no dispara la restricción de edad', () => {
    const a = revisarDosis({ farmaco: 'Ketorolaco', dosis: mgAbs(10), via: 'oral', edadAnios: 40 })
    expect(a.some(x => x.codigo === 'via_edad_no_aprobada')).toBe(false)
  })
})
