import { describe, it, expect } from 'vitest'
import {
  DEMO_ESCENARIOS, DEMO_PASOS, siguientePaso, dictadoHasta, dictadoCompleto,
} from '@/lib/demo-sandbox'

describe('demo-sandbox (motor del sandbox interactivo)', () => {
  it('los escenarios son ficticios: solo iniciales, nunca nombre completo real', () => {
    for (const e of DEMO_ESCENARIOS) {
      // iniciales tipo "M. F." — máximo 2 letras con puntos, no un nombre real
      expect(e.cita.iniciales).toMatch(/^[A-Z]\.\s?[A-Z]\.$/)
      expect(e.folio).toMatch(/^RX-DEMO/)
    }
  })

  it('cada escenario tiene nota S/O/A/P completa y al menos un medicamento', () => {
    for (const e of DEMO_ESCENARIOS) {
      expect(e.nota.map(s => s.seccion)).toEqual(['Subjetivo', 'Objetivo', 'Análisis', 'Plan'])
      expect(e.medicamentos.length).toBeGreaterThan(0)
      expect(e.dictado.length).toBeGreaterThan(0)
    }
  })

  it('siguientePaso avanza y se detiene en el último', () => {
    expect(siguientePaso('agenda')).toBe('dictado')
    expect(siguientePaso('dictado')).toBe('nota')
    expect(siguientePaso('nota')).toBe('receta')
    expect(siguientePaso('receta')).toBe('modulos')
    expect(siguientePaso('modulos')).toBe('modulos') // no desborda
  })

  it('DEMO_PASOS mantiene el orden esperado', () => {
    expect(DEMO_PASOS).toEqual(['agenda', 'dictado', 'nota', 'receta', 'modulos'])
  })

  it('dictadoHasta revela incrementalmente y se satura en los límites', () => {
    const e = DEMO_ESCENARIOS[0]
    expect(dictadoHasta(e, 0)).toBe('')
    expect(dictadoHasta(e, 1)).toBe(e.dictado[0])
    expect(dictadoHasta(e, 999)).toBe(e.dictado.join(' '))
    expect(dictadoHasta(e, -5)).toBe('') // negativos no rompen
  })

  it('dictadoCompleto es verdadero solo al revelar todos los fragmentos', () => {
    const e = DEMO_ESCENARIOS[0]
    expect(dictadoCompleto(e, e.dictado.length - 1)).toBe(false)
    expect(dictadoCompleto(e, e.dictado.length)).toBe(true)
  })
})
