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

describe('La coma decimal mexicana no se pierde', () => {
  it('«pH 7,35» es 7.35, no 7', () => {
    /**
     * A5 de la auditoría maestra. El patrón sólo aceptaba el punto, así que el
     * decimal se truncaba **en silencio** y el valor quedaba plausible — que es
     * lo peor que puede pasar: un pH de 7 en lugar de 7.35 es la diferencia
     * entre una acidosis grave y un paciente normal, y nada en la pantalla
     * decía que se había recortado.
     */
    expect(parsearValorClinico('pH 7,35').valor).toBe(7.35)
    expect(parsearValorClinico('PEEP 12,5').valor).toBe(12.5)
    expect(parsearValorClinico('peso 82,4 kg').valor).toBe(82.4)
  })

  it('pero «1,200» siguen siendo mil doscientos', () => {
    // Tres dígitos exactos detrás de la coma son MILES. Leerlo como 1.2
    // dispararía una alerta de hipoglucemia en plena hiperglucemia.
    expect(parsearValorClinico('glucosa 1,200').valor).toBe(1200)
    expect(parsearValorClinico('plaquetas 118,000').valor).toBe(118000)
  })

  it('y el punto sigue funcionando igual', () => {
    expect(parsearValorClinico('12.5').valor).toBe(12.5)
    expect(parsearValorClinico('FiO2 60').valor).toBe(60)
  })
})
