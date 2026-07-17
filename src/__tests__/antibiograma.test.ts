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

describe('Vancomicina CMI >2 (validación del Dr.)', () => {
  it('S. aureus con vanco CMI >2 → alerta de eficacia reducida', () => {
    const r = interpretarAntibiograma({
      organismo: 'Staphylococcus aureus',
      resultados: [{ antibiotico: 'Oxacilina', interpretacion: 'R' }, { antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 4 }],
    })
    expect(r.alertas.some(a => /vancomicina cmi 4|eficacia reducida|VISA/i.test(a.mensaje))).toBe(true)
    expect(r.advertencias.some(a => /CMI >2/i.test(a))).toBe(true)
  })
  it('vanco CMI 1 (≤2) → sin alerta de CMI', () => {
    const r = interpretarAntibiograma({
      organismo: 'S. aureus',
      resultados: [{ antibiotico: 'Oxacilina', interpretacion: 'R' }, { antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 1 }],
    })
    expect(r.alertas.some(a => /CMI/.test(a.mensaje) && /vancomicina/i.test(a.mensaje))).toBe(false)
  })
})

describe('AmpC por cefoxitina R (plasmídico) — validación del Dr.', () => {
  it('E. coli + cefoxitina R + 3G R → AmpC (probable, plasmídica/desreprimida), NO BLEE', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Cefoxitina', 'R'], ['Ceftriaxona', 'R'], ['Meropenem', 'S']]))
    expect(claves(r)).toContain('AmpC')
    expect(r.fenotipos.find(f => f.clave === 'AmpC')?.confianza).toBe('probable')
    expect(claves(r)).not.toContain('BLEE')
  })
  it('AmpC con cefepime S → sugiere cefepime como opción', () => {
    const r = interpretarAntibiograma(ab('Enterobacter cloacae', [['Ceftriaxona', 'S'], ['Cefepime', 'S']]))
    expect(r.alertas.some(a => /cefepime/i.test(a.mensaje))).toBe(true)
  })
})

describe('BLEE distinguido de AmpC por cefoxitina — validación del Dr.', () => {
  it('E. coli + 3G R + aztreonam R + cefoxitina S + carbapenem S → BLEE (base menciona aztreonam)', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ceftriaxona', 'R'], ['Aztreonam', 'R'], ['Cefoxitina', 'S'], ['Meropenem', 'S']]))
    expect(claves(r)).toContain('BLEE')
    expect(r.fenotipos.find(f => f.clave === 'BLEE')?.base).toMatch(/aztreonam/i)
    expect(r.advertencias.join(' ')).toMatch(/cefepime/i)
  })
})

describe('Carbapenemasa — inferencia de clase por ceftazidima-avibactam (validación del Dr.)', () => {
  it('CZA S → clase serina (KPC/OXA-48), sugiere ceftazidima-avibactam', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftazidima-avibactam', 'S']]))
    const carb = r.fenotipos.find(f => f.clave === 'carbapenemasa')
    expect(carb?.base).toMatch(/serina|KPC|OXA-48/i)
    expect(r.alertas.some(a => /ceftazidima-avibactam|meropenem-vaborbactam/i.test(a.mensaje))).toBe(true)
  })
  it('CZA R → sospecha de metalo-β-lactamasa, sugiere cefiderocol/combinación', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftazidima-avibactam', 'R']]))
    const carb = r.fenotipos.find(f => f.clave === 'carbapenemasa')
    expect(carb?.base).toMatch(/metalo|NDM|VIM/i)
    expect(r.alertas.some(a => /cefiderocol|aztreonam/i.test(a.mensaje))).toBe(true)
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

// ─── Capacidades nuevas del motor de clase mundial ───────────────────────────

describe('Resistencia intrínseca — conflictos (error de lab)', () => {
  it('Klebsiella + ampicilina S → conflicto (β-lactamasa natural)', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Ampicilina', 'S'], ['Meropenem', 'S']]))
    const c = r.resistenciaIntrinseca.filter(n => n.tipo === 'conflicto')
    expect(c.some(n => /ampicilina/i.test(n.antibiotico))).toBe(true)
  })
  it('Proteus mirabilis + colistina S → conflicto (R intrínseco a colistina)', () => {
    const r = interpretarAntibiograma(ab('Proteus mirabilis', [['Colistina', 'S']]))
    expect(r.resistenciaIntrinseca.some(n => n.tipo === 'conflicto' && /colistina/i.test(n.mensaje))).toBe(true)
  })
  it('S. maltophilia + meropenem S → conflicto (R intrínseco por L1)', () => {
    const r = interpretarAntibiograma(ab('Stenotrophomonas maltophilia', [['Meropenem', 'S']]))
    expect(r.resistenciaIntrinseca.some(n => n.tipo === 'conflicto' && /carbapen/i.test(n.mensaje))).toBe(true)
  })
})

describe('Inferencia de mecanismo molecular', () => {
  it('MRSA → mecanismo PBP2a (mecA)', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Cefoxitina', 'R']]))
    expect(r.mecanismos.some(m => /PBP2a|mecA/i.test(m.nombre))).toBe(true)
  })
  it('carbapenemasa → mecanismo con clase Ambler', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftazidima-avibactam', 'R']]))
    const m = r.mecanismos.find(x => /metalo/i.test(x.nombre))
    expect(m?.ambler).toBe('B')
  })
  it('cada mecanismo trae referencia citada', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ceftriaxona', 'R'], ['Meropenem', 'S']]))
    expect(r.mecanismos.length).toBeGreaterThan(0)
    expect(r.mecanismos.every(m => m.referencia && m.referencia.length > 10)).toBe(true)
    expect(r.referencias.length).toBeGreaterThan(0)
  })
})

describe('Terapia dirigida por clase de enzima', () => {
  it('KPC-like (CZA S) → ceftazidima-avibactam como dirigida', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftazidima-avibactam', 'S']]))
    expect(r.terapiaDirigida.some(t => t.linea === 'dirigida' && /avibactam/i.test(t.agente))).toBe(true)
  })
  it('MBL (CZA R) → aztreonam-avibactam/cefiderocol y evitar avibactam sola', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftazidima-avibactam', 'R']]))
    expect(r.terapiaDirigida.some(t => /aztreonam-avibactam|cefiderocol/i.test(t.agente))).toBe(true)
    expect(r.terapiaDirigida.some(t => t.linea === 'evitar')).toBe(true)
  })
})

describe('Pseudomonas — OprD vs carbapenemasa', () => {
  it('imipenem R aislado + meropenem S → pérdida de OprD, NO carbapenemasa', () => {
    const r = interpretarAntibiograma(ab('Pseudomonas aeruginosa', [['Imipenem', 'R'], ['Meropenem', 'S'], ['Ceftazidima', 'S']]))
    expect(claves(r)).toContain('porina-perdida')
    expect(claves(r)).not.toContain('carbapenemasa')
    expect(r.advertencias.join(' ')).toMatch(/OprD|carbapenemasa/i)
  })
  it('carbapenémicos R + otros β-lactámicos R → carbapenemasa/mecanismos combinados', () => {
    const r = interpretarAntibiograma(ab('Pseudomonas aeruginosa', [['Meropenem', 'R'], ['Imipenem', 'R'], ['Ceftazidima', 'R']]))
    expect(claves(r)).toContain('carbapenemasa')
    expect(r.notificacionObligatoria).toBe(true)
  })
})

describe('S. maltophilia — intrínseca + cotrimoxazol', () => {
  it('siempre marca R intrínseca a carbapenémicos y propone cotrimoxazol', () => {
    const r = interpretarAntibiograma(ab('Stenotrophomonas maltophilia', [['Trimetoprim/Sulfametoxazol', 'S']]))
    expect(claves(r)).toContain('S-maltophilia-intrinseca')
    expect(r.terapiaDirigida.some(t => /cotrimoxazol|sulfametoxazol/i.test(t.agente))).toBe(true)
  })
})

describe('A. baumannii carbapenem-R → OXA + sulbactam', () => {
  it('meropenem R → carbapenemasa OXA (clase D) y sugiere ampicilina-sulbactam/cefiderocol', () => {
    const r = interpretarAntibiograma(ab('Acinetobacter baumannii', [['Meropenem', 'R']]))
    expect(claves(r)).toContain('carbapenemasa')
    expect(r.mecanismos.some(m => m.ambler === 'D')).toBe(true)
    expect(r.terapiaDirigida.some(t => /sulbactam|cefiderocol/i.test(t.agente))).toBe(true)
  })
})

describe('Staph MLSb inducible (D-test)', () => {
  it('ERY R + CLI S → MLSb inducible + advertencia D-test', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Eritromicina', 'R'], ['Clindamicina', 'S']]))
    expect(claves(r)).toContain('MLSb-inducible')
    expect(r.advertencias.join(' ')).toMatch(/D-test|clindamicina/i)
  })
  it('ERY R + CLI R → MLSb constitutivo', () => {
    const r = interpretarAntibiograma(ab('S. aureus', [['Eritromicina', 'R'], ['Clindamicina', 'R']]))
    expect(claves(r)).toContain('MLSb-constitutivo')
  })
})

describe('Penicilinasa estafilocócica', () => {
  it('PEN R + OXA S → penicilinasa, terapia con oxacilina/cefazolina', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Penicilina', 'R'], ['Oxacilina', 'S']]))
    expect(claves(r)).toContain('penicilinasa-estafilococica')
    expect(r.terapiaDirigida.some(t => /oxacilina|cefazolina/i.test(t.agente))).toBe(true)
  })
})

describe('Enterococo HLAR', () => {
  it('gentamicina CMI >500 → HLAR + advertencia de pérdida de sinergia', () => {
    const r = interpretarAntibiograma({
      organismo: 'Enterococcus faecalis',
      resultados: [{ antibiotico: 'Gentamicina', interpretacion: 'R', cmi: 1024 }],
    })
    expect(claves(r)).toContain('HLAR')
    expect(r.advertencias.join(' ')).toMatch(/sinergia/i)
  })
})

describe('Neumococo — penicilina por sitio', () => {
  it('CMI 1 no meníngea → tratable con penicilina (sin fenotipo PNS)', () => {
    const r = interpretarAntibiograma({
      organismo: 'Streptococcus pneumoniae', sitio: 'respiratorio',
      resultados: [{ antibiotico: 'Penicilina', interpretacion: 'S', cmi: 1 }],
    })
    expect(claves(r)).not.toContain('neumococo-PNS')
    expect(r.didactica.some(d => /no meníngeo/i.test(d.titulo))).toBe(true)
  })
  it('CMI 1 meníngea → no sensible por criterio meníngeo (PNS)', () => {
    const r = interpretarAntibiograma({
      organismo: 'Streptococcus pneumoniae', sitio: 'snc',
      resultados: [{ antibiotico: 'Penicilina', interpretacion: 'S', cmi: 1 }],
    })
    expect(claves(r)).toContain('neumococo-PNS')
  })
})
