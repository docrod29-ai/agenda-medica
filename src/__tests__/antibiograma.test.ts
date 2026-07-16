import { describe, it, expect } from 'vitest'
import { interpretarAntibiograma, type EntradaAntibiograma, type FenotipoClave } from '@/lib/expediente/antibiograma'

const claves = (r: ReturnType<typeof interpretarAntibiograma>): FenotipoClave[] => r.fenotipos.map(f => f.clave)

function ab(organismo: string, pares: [string, 'S' | 'I' | 'R'][]): EntradaAntibiograma {
  return { organismo, resultados: pares.map(([antibiotico, interpretacion]) => ({ antibiotico, interpretacion })) }
}

describe('MRSA / MSSA', () => {
  it('S. aureus + oxacilina R → MRSA, notificación, aislamiento, advertencia', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Oxacilina', 'R'], ['Vancomicina', 'S']]))
    expect(claves(r)).toContain('MRSA')
    expect(r.notificacionObligatoria).toBe(true)
    expect(r.aislamiento).toMatch(/contacto/i)
    expect(r.advertencias.join(' ')).toMatch(/mecA|β-lactámico/i)
  })

  it('cefoxitina R también define MRSA', () => {
    const r = interpretarAntibiograma(ab('S. aureus', [['Cefoxitina', 'R']]))
    expect(claves(r)).toContain('MRSA')
  })

  it('S. aureus + oxacilina S → NO MRSA', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Oxacilina', 'S']]))
    expect(claves(r)).not.toContain('MRSA')
    expect(r.notificacionObligatoria).toBe(false)
  })
})

describe('VRE', () => {
  it('E. faecium + vancomicina R → VRE + notificación', () => {
    const r = interpretarAntibiograma(ab('Enterococcus faecium', [['Vancomicina', 'R'], ['Linezolid', 'S']]))
    expect(claves(r)).toContain('VRE')
    expect(r.notificacionObligatoria).toBe(true)
  })
  it('Enterococo vancomicina S → no VRE', () => {
    const r = interpretarAntibiograma(ab('Enterococcus faecalis', [['Vancomicina', 'S']]))
    expect(claves(r)).not.toContain('VRE')
  })
})

describe('Carbapenemasa', () => {
  it('Klebsiella + meropenem R → carbapenemasa probable, crítica, notificación, aislamiento', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftriaxona', 'R']]))
    expect(claves(r)).toContain('carbapenemasa')
    expect(r.fenotipos.find(f => f.clave === 'carbapenemasa')?.confianza).toBe('probable')
    expect(r.notificacionObligatoria).toBe(true)
    expect(r.alertas.some(a => a.nivel === 'critica')).toBe(true)
  })

  it('con carbapenem R NO clasifica como BLEE (BLEE exige carbapenem S)', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ceftriaxona', 'R'], ['Meropenem', 'R']]))
    expect(claves(r)).toContain('carbapenemasa')
    expect(claves(r)).not.toContain('BLEE')
  })
})

describe('AmpC (grupo ESCPM)', () => {
  it('Enterobacter + ceftriaxona S → AmpC + advertencia de NO usar 3G aunque reporte S', () => {
    const r = interpretarAntibiograma(ab('Enterobacter cloacae', [['Ceftriaxona', 'S'], ['Cefepime', 'S']]))
    expect(claves(r)).toContain('AmpC')
    expect(r.advertencias.join(' ')).toMatch(/3ª generación|3G|desrepresión/i)
    expect(r.alertas.some(a => /cefepime|carbapen/i.test(a.mensaje))).toBe(true)
  })

  it('grupo AmpC NO se marca como BLEE aunque 3G esté R', () => {
    const r = interpretarAntibiograma(ab('Serratia marcescens', [['Ceftriaxona', 'R'], ['Meropenem', 'S']]))
    expect(claves(r)).toContain('AmpC')
    expect(claves(r)).not.toContain('BLEE')
  })
})

describe('BLEE', () => {
  it('E. coli + 3G R + carbapenem S → BLEE probable + advertencia', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ceftriaxona', 'R'], ['Meropenem', 'S']]))
    expect(claves(r)).toContain('BLEE')
    expect(r.fenotipos.find(f => f.clave === 'BLEE')?.confianza).toBe('probable')
    expect(r.advertencias.join(' ')).toMatch(/aztreonam|cefalosporina/i)
  })
})

describe('Colistina-R y FQ-R', () => {
  it('colistina R → fenotipo colistin-R + alerta crítica', () => {
    const r = interpretarAntibiograma(ab('Acinetobacter baumannii', [['Colistina', 'R']]))
    expect(claves(r)).toContain('colistin-R')
    expect(r.alertas.some(a => a.nivel === 'critica')).toBe(true)
  })
  it('ciprofloxacino R → FQ-R', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ciprofloxacino', 'R']]))
    expect(claves(r)).toContain('FQ-R')
  })
})

describe('MDR (aproximado) y PK/PD', () => {
  it('≥3 clases no-sensibles → MDR (sospecha)', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [
      ['Ceftriaxona', 'R'], ['Ciprofloxacino', 'R'], ['Trimetoprim/Sulfametoxazol', 'R'], ['Meropenem', 'S'],
    ]))
    expect(claves(r)).toContain('MDR')
    expect(r.fenotipos.find(f => f.clave === 'MDR')?.confianza).toBe('sospecha')
  })

  it('β-lactámico S → sugerencia de infusión extendida', () => {
    const r = interpretarAntibiograma(ab('Pseudomonas aeruginosa', [['Piperacilina/Tazobactam', 'S']]))
    expect(r.optimizacionPKPD.join(' ')).toMatch(/infusión extendida|fT>CMI/i)
  })

  it('MRSA → sugerencia de vancomicina por AUC/MIC', () => {
    const r = interpretarAntibiograma(ab('S. aureus', [['Oxacilina', 'R'], ['Vancomicina', 'S']]))
    expect(r.optimizacionPKPD.join(' ')).toMatch(/AUC\/MIC 400-600/i)
  })
})

describe('robustez', () => {
  it('sin resultados → sin fenotipos, sin notificación', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', []))
    expect(r.fenotipos).toEqual([])
    expect(r.notificacionObligatoria).toBe(false)
    expect(r.aislamiento).toBeNull()
  })
  it('insensible a acentos y mayúsculas en organismo y antibiótico', () => {
    const r = interpretarAntibiograma(ab('ESCHERICHIA COLI', [['CEFTRIAXONA', 'R'], ['MEROPENEM', 'S']]))
    expect(claves(r)).toContain('BLEE')
  })
})
