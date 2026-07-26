/**
 * nexusmed-icu-004 · CLINICAL_EXTRACTION
 * Normalización de unidades, sinónimos y manejo de ambigüedad (no asume).
 */
import { describe, it, expect } from 'vitest'
import { interpretarUnidad, canonizarFarmaco, parsearValorClinico } from '@/lib/uci/extraccion'

describe('interpretarUnidad', () => {
  it('reconoce unidades de UCI y sus variantes dictadas', () => {
    expect(interpretarUnidad('microgramos por kilo por minuto')).toBe('mcg/kg/min')
    expect(interpretarUnidad('gammas')).toBe('mcg/kg/min')
    expect(interpretarUnidad('cmH2O')).toBe('cmH2O')
    expect(interpretarUnidad('centímetros de agua')).toBe('cmH2O')
    expect(interpretarUnidad('mmHg')).toBe('mmHg')
    expect(interpretarUnidad('miliequivalentes por litro')).toBe('mEq/L')
  })
  it('null si no reconoce', () => {
    expect(interpretarUnidad('banana')).toBeNull()
  })
})

describe('canonizarFarmaco', () => {
  it('mapea sinónimos', () => {
    expect(canonizarFarmaco('norepi')).toBe('norepinefrina')
    expect(canonizarFarmaco('noradrenalina')).toBe('norepinefrina')
    expect(canonizarFarmaco('adrenalina')).toBe('epinefrina')
    expect(canonizarFarmaco('vaso')).toBe('vasopresina')
    expect(canonizarFarmaco('Propofol')).toBe('propofol')
  })
})

describe('parsearValorClinico', () => {
  it('extrae el número embebido tras la etiqueta', () => {
    expect(parsearValorClinico('PEEP ocho').valor).toBe(8)
    expect(parsearValorClinico('plateau veinticuatro').valor).toBe(24)
    expect(parsearValorClinico('PEEP 8').valor).toBe(8)
  })
  it('marca unidadPendiente cuando hay número pero no unidad (no asume)', () => {
    const r = parsearValorClinico('potasio cinco punto ocho')
    expect(r.valor).toBe(5.8)
    expect(r.unidad).toBeNull()
    expect(r.unidadPendiente).toBe(true)
  })
  it('captura la unidad cuando viene', () => {
    const r = parsearValorClinico('FiO2 cuarenta por ciento')
    expect(r.valor).toBe(40)
    expect(r.unidad).toBe('%')
    expect(r.unidadPendiente).toBe(false)
  })
  it('marca AMBIGUO cuando el número empieza por "punto" (0.1 vs 1)', () => {
    const r = parsearValorClinico('norepinefrina punto uno')
    expect(r.ambiguo).toBe(true)
  })
})
