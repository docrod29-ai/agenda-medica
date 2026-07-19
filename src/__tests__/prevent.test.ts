import { describe, it, expect } from 'vitest'
import { prevent, motivoSinPrevent, type EntradaPrevent } from '@/lib/expediente/prevent'

/**
 * Perfil del arnés de referencia publicado: 50 años, TAS 160 con
 * antihipertensivo, colesterol total 200, HDL 45, sin estatina, con diabetes,
 * no fumador, TFG 90.
 */
const REFERENCIA = (esMujer: boolean): EntradaPrevent => ({
  edad: 50, esMujer, tas: 160, colesterolTotal: 200, hdl: 45, tfg: 90,
  diabetes: true, fuma: false, tomaAntihipertensivo: true, tomaEstatina: false,
})

describe('Validación contra los valores publicados', () => {
  it('mujer: 9.2% a 10 años y 35.4% a 30 años', () => {
    const r = prevent(REFERENCIA(true))!
    expect(r.riesgo10).toBeCloseTo(9.2, 1)
    expect(r.riesgo30).toBeCloseTo(35.4, 1)
  })

  it('hombre: 10.2% a 10 años y 34.9% a 30 años', () => {
    const r = prevent(REFERENCIA(false))!
    expect(r.riesgo10).toBeCloseTo(10.2, 1)
    expect(r.riesgo30).toBeCloseTo(34.9, 1)
  })
})

describe('No calcula fuera de donde el modelo fue validado', () => {
  it('rechaza menores de 30 y mayores de 79 en vez de extrapolar', () => {
    expect(prevent({ ...REFERENCIA(true), edad: 29 })).toBeNull()
    expect(prevent({ ...REFERENCIA(true), edad: 80 })).toBeNull()
    expect(prevent({ ...REFERENCIA(true), edad: 30 })).not.toBeNull()
    expect(prevent({ ...REFERENCIA(true), edad: 79 })).not.toBeNull()
  })

  it('el horizonte de 30 años solo se reporta hasta los 59', () => {
    expect(prevent({ ...REFERENCIA(true), edad: 59 })!.riesgo30).not.toBeNull()
    expect(prevent({ ...REFERENCIA(true), edad: 60 })!.riesgo30).toBeNull()
  })

  it('sin los laboratorios necesarios devuelve null, no un número inventado', () => {
    expect(prevent({ ...REFERENCIA(true), colesterolTotal: 0 })).toBeNull()
    expect(prevent({ ...REFERENCIA(true), hdl: 0 })).toBeNull()
    expect(prevent({ ...REFERENCIA(true), tfg: 0 })).toBeNull()
    expect(prevent({ ...REFERENCIA(true), tas: 0 })).toBeNull()
  })
})

describe('Categorías y conducta de la guía 2026', () => {
  const conRiesgo = (p: Partial<EntradaPrevent>) => prevent({ ...REFERENCIA(false), ...p })!

  it('usa los cortes 3, 5 y 10 por ciento', () => {
    // Un perfil sano y joven cae en bajo; uno cargado, en alto.
    const sano = conRiesgo({ edad: 35, tas: 110, colesterolTotal: 160, hdl: 60, diabetes: false, tomaAntihipertensivo: false })
    expect(sano.categoria).toBe('bajo')
    const cargado = conRiesgo({ edad: 70, tas: 175, colesterolTotal: 260, hdl: 30, fuma: true, tfg: 45 })
    expect(cargado.categoria).toBe('alto')
    expect(cargado.riesgo10).toBeGreaterThan(sano.riesgo10)
  })

  it('el riesgo alto manda estatina de alta intensidad con meta de 70', () => {
    const r = conRiesgo({ edad: 70, tas: 175, colesterolTotal: 260, hdl: 30, fuma: true })
    expect(r.conducta).toMatch(/alta intensidad/i)
    expect(r.conducta).toMatch(/70 mg\/dL/)
  })

  it('el riesgo bajo no receta: aconseja hábitos', () => {
    const r = conRiesgo({ edad: 35, tas: 110, colesterolTotal: 160, hdl: 60, diabetes: false, tomaAntihipertensivo: false })
    expect(r.conducta).toMatch(/h[áa]bitos/i)
  })

  it('siempre cita la fuente', () => {
    expect(prevent(REFERENCIA(true))!.fuente).toMatch(/PREVENT/)
    expect(prevent(REFERENCIA(true))!.fuente).toMatch(/2024;149:430-449/)
  })
})

describe('Dirección de cada factor', () => {
  const base = REFERENCIA(false)
  const riesgo = (p: Partial<EntradaPrevent>) => prevent({ ...base, ...p })!.riesgo10

  it('fumar, la diabetes y la presión alta suben el riesgo', () => {
    expect(riesgo({ fuma: true })).toBeGreaterThan(riesgo({ fuma: false }))
    expect(riesgo({ diabetes: true })).toBeGreaterThan(riesgo({ diabetes: false }))
    expect(riesgo({ tas: 180 })).toBeGreaterThan(riesgo({ tas: 120 }))
  })

  it('más HDL y mejor función renal bajan el riesgo', () => {
    expect(riesgo({ hdl: 70 })).toBeLessThan(riesgo({ hdl: 30 }))
    expect(riesgo({ tfg: 90 })).toBeLessThan(riesgo({ tfg: 30 }))
  })

  it('a más edad, más riesgo', () => {
    expect(riesgo({ edad: 70 })).toBeGreaterThan(riesgo({ edad: 40 }))
  })

  it('el hombre tiene más riesgo que la mujer con el mismo perfil', () => {
    expect(prevent(REFERENCIA(false))!.riesgo10).toBeGreaterThan(prevent(REFERENCIA(true))!.riesgo10)
  })
})

describe('Qué falta para poder calcularlo', () => {
  it('nombra exactamente los datos que faltan', () => {
    expect(motivoSinPrevent({ edad: 50, tas: 130 })).toMatch(/colesterol total/)
    expect(motivoSinPrevent({ edad: 50, tas: 130, colesterolTotal: 200, hdl: 50 })).toMatch(/TFG/)
  })
  it('con todo capturado no pide nada', () => {
    expect(motivoSinPrevent(REFERENCIA(true))).toBeNull()
  })
  it('fuera del rango de edad no lo trata como dato faltante', () => {
    expect(motivoSinPrevent({ edad: 85 })).toBeNull()
  })
})
