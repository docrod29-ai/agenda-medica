import { describe, it, expect } from 'vitest'
import { interpretarAntibiograma, perfilAEntrada, type EntradaAntibiograma, type FenotipoClave } from '@/lib/expediente/antibiograma'

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
    // Clasificación FORMAL de Magiorakos (por categorías) → confianza 'confirmado'.
    expect(r.fenotipos.find(f => f.clave === 'MDR')?.confianza).toBe('confirmado')
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

// ─── Paridad con StewardMX: EUCAST safety + epidemiología MX + CRE avanzada ───

describe('Fenotipos excepcionales (EUCAST T5-7)', () => {
  it('S. aureus linezolid R → alerta excepcional', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Linezolid', 'R']]))
    expect(r.alertas.some(a => /excepcional/i.test(a.mensaje))).toBe(true)
  })
  it('E. faecalis ampicilina R → sospechar E. faecium', () => {
    const r = interpretarAntibiograma(ab('Enterococcus faecalis', [['Ampicilina', 'R']]))
    expect(r.alertas.some(a => /faecium|identificaci/i.test(a.mensaje))).toBe(true)
  })
  it('P. aeruginosa colistina R → excepcional/emergente', () => {
    const r = interpretarAntibiograma(ab('Pseudomonas aeruginosa', [['Colistina', 'R']]))
    expect(r.alertas.some(a => /excepcional|emergente/i.test(a.mensaje))).toBe(true)
  })
})

describe('Cross-resistencia de fluoroquinolonas (EUCAST T13)', () => {
  it('GN cipro R + levo S → edición interpretativa levo S→R', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ciprofloxacino', 'R'], ['Levofloxacino', 'S']]))
    expect(r.edicionesInterpretativas.some(e => /levofloxacino/i.test(e.antibiotico) && e.a === 'R')).toBe(true)
  })
  it('Staph cipro R + levo/moxi S → aviso mutación de primer paso (sin editar)', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Ciprofloxacino', 'R'], ['Levofloxacino', 'S']]))
    expect(r.advertencias.join(' ')).toMatch(/primer paso/i)
  })
})

describe('Resistencia intrínseca Gram+ (EUCAST T4)', () => {
  it('Enterococo + aztreonam S → conflicto', () => {
    const r = interpretarAntibiograma(ab('Enterococcus faecium', [['Aztreonam', 'S']]))
    expect(r.resistenciaIntrinseca.some(n => n.tipo === 'conflicto' && /aztreonam/i.test(n.antibiotico))).toBe(true)
  })
  it('S. aureus + colistina S → conflicto (Gram+ R intrínseco a colistina)', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Colistina', 'S']]))
    expect(r.resistenciaIntrinseca.some(n => n.tipo === 'conflicto' && /colistina/i.test(n.mensaje))).toBe(true)
  })
})

describe('CRE — epidemiología mexicana y discriminador CAZ-AVI (INVIFAR)', () => {
  it('Klebsiella mero R sin CAZ-AVI → alerta de epidemiología local (NDM/MBL primero)', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftriaxona', 'R']]))
    expect(r.alertas.some(a => /INVIFAR|NDM|metalo|MBL/i.test(a.mensaje))).toBe(true)
  })
  it('CAZ-AVI R → MBL + aviso de acceso México (sin aztreonam/cefiderocol) + esquema local', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftazidima-avibactam', 'R']]))
    expect(r.alertas.some(a => /no hay aztreonam ni cefiderocol/i.test(a.mensaje))).toBe(true)
    expect(r.terapiaDirigida.some(t => /colistina|amikacina|fosfomicina/i.test(t.agente))).toBe(true)
  })
  it('aztreonam S conservado con carbapenémico R (sin CAZ-AVI) → firma de MBL', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Aztreonam', 'S']]))
    const carb = r.fenotipos.find(f => f.clave === 'carbapenemasa')
    expect(carb?.base).toMatch(/metalo|MBL|monobact/i)
  })
})

describe('CRE — patrón ertapenem-aislado (porina/OXA-48) y Proteae', () => {
  it('E. coli ert R + imi S + mer S → porina-perdida, NO carbapenemasa de alto nivel', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ertapenem', 'R'], ['Imipenem', 'S'], ['Meropenem', 'S'], ['Ceftriaxona', 'R']]))
    expect(claves(r)).toContain('porina-perdida')
    expect(claves(r)).not.toContain('carbapenemasa')
    expect(r.advertencias.join(' ')).toMatch(/OXA-48|molecular/i)
  })
  it('Morganella imipenem R (intrínseco) con ert/mer S → NO se marca carbapenemasa', () => {
    const r = interpretarAntibiograma(ab('Morganella morganii', [['Imipenem', 'R'], ['Ertapenem', 'S'], ['Meropenem', 'S']]))
    expect(claves(r)).not.toContain('carbapenemasa')
  })
})

describe('AmpC — pip-tazo no fiable (Meini)', () => {
  it('Enterobacter + pip-tazo S → advertencia de pip-tazo no fiable', () => {
    const r = interpretarAntibiograma(ab('Enterobacter cloacae', [['Ceftriaxona', 'S'], ['Piperacilina/Tazobactam', 'S']]))
    expect(r.advertencias.join(' ')).toMatch(/piperacilina-tazobactam|efecto in[óo]culo/i)
  })
})

describe('Puntos de corte CLSI M100 (CMI → S/I/R)', () => {
  it('meropenem CMI 0.5 en Enterobacterales → S (≤1)', () => {
    const r = interpretarAntibiograma({ organismo: 'Klebsiella pneumoniae', resultados: [{ antibiotico: 'Meropenem', interpretacion: 'S', cmi: 0.5 }] })
    const c = r.categoriasCMI.find(x => /meropenem/i.test(x.antibiotico))
    expect(c?.categoriaCLSI).toBe('S')
    expect(c?.concuerda).toBe(true)
  })
  it('meropenem CMI 4 → R (≥4) y discrepa si reportaron S', () => {
    const r = interpretarAntibiograma({ organismo: 'Escherichia coli', resultados: [{ antibiotico: 'Meropenem', interpretacion: 'S', cmi: 4 }] })
    const c = r.categoriasCMI.find(x => /meropenem/i.test(x.antibiotico))
    expect(c?.categoriaCLSI).toBe('R')
    expect(c?.concuerda).toBe(false)
  })
  it('ceftriaxona CMI 2 → I (entre ≤1 y ≥4)', () => {
    const r = interpretarAntibiograma({ organismo: 'Escherichia coli', resultados: [{ antibiotico: 'Ceftriaxona', interpretacion: 'I', cmi: 2 }] })
    expect(r.categoriasCMI.find(x => /ceftriaxona/i.test(x.antibiotico))?.categoriaCLSI).toBe('I')
  })
  it('colistina CMI 2 → I (sin categoría S); CMI 4 → R', () => {
    const r2 = interpretarAntibiograma({ organismo: 'Klebsiella pneumoniae', resultados: [{ antibiotico: 'Colistina', interpretacion: 'I', cmi: 2 }] })
    expect(r2.categoriasCMI.find(x => /colistina/i.test(x.antibiotico))?.categoriaCLSI).toBe('I')
    const r4 = interpretarAntibiograma({ organismo: 'Klebsiella pneumoniae', resultados: [{ antibiotico: 'Colistina', interpretacion: 'R', cmi: 4 }] })
    expect(r4.categoriasCMI.find(x => /colistina/i.test(x.antibiotico))?.categoriaCLSI).toBe('R')
  })
  it('fosfomicina marca soloUTI', () => {
    const r = interpretarAntibiograma({ organismo: 'Escherichia coli', resultados: [{ antibiotico: 'Fosfomicina', interpretacion: 'S', cmi: 32 }] })
    expect(r.categoriasCMI.find(x => /fosfomicina/i.test(x.antibiotico))?.soloUTI).toBe(true)
  })
  it('Pseudomonas meropenem CMI 8 → R (≥8); Enterobacterales sería R desde ≥4', () => {
    const pae = interpretarAntibiograma({ organismo: 'Pseudomonas aeruginosa', resultados: [{ antibiotico: 'Meropenem', interpretacion: 'R', cmi: 8 }] })
    expect(pae.categoriasCMI.find(x => /meropenem/i.test(x.antibiotico))?.categoriaCLSI).toBe('R')
    const pae4 = interpretarAntibiograma({ organismo: 'Pseudomonas aeruginosa', resultados: [{ antibiotico: 'Meropenem', interpretacion: 'I', cmi: 4 }] })
    expect(pae4.categoriasCMI.find(x => /meropenem/i.test(x.antibiotico))?.categoriaCLSI).toBe('I') // ≤2 S, 4 I, ≥8 R en Pseudomonas
  })
  it('Acinetobacter ampicilina-sulbactam CMI 8 → S (≤8/4)', () => {
    const r = interpretarAntibiograma({ organismo: 'Acinetobacter baumannii', resultados: [{ antibiotico: 'Ampicilina-sulbactam', interpretacion: 'S', cmi: 8 }] })
    expect(r.categoriasCMI.find(x => /sulbactam/i.test(x.antibiotico))?.categoriaCLSI).toBe('S')
  })
  it('Staph oxacilina CMI 4 → R (≥4); vancomicina CMI 2 → S', () => {
    const r = interpretarAntibiograma({ organismo: 'Staphylococcus aureus', resultados: [{ antibiotico: 'Oxacilina', interpretacion: 'R', cmi: 4 }, { antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 2 }] })
    expect(r.categoriasCMI.find(x => /oxacilina/i.test(x.antibiotico))?.categoriaCLSI).toBe('R')
    expect(r.categoriasCMI.find(x => /vancomicina/i.test(x.antibiotico))?.categoriaCLSI).toBe('S')
  })
  it('Enterococo ampicilina CMI 8 → S (≤8, distinto de enterobacterias); vancomicina CMI 32 → R', () => {
    const r = interpretarAntibiograma({ organismo: 'Enterococcus faecium', resultados: [{ antibiotico: 'Ampicilina', interpretacion: 'S', cmi: 8 }, { antibiotico: 'Vancomicina', interpretacion: 'R', cmi: 32 }] })
    expect(r.categoriasCMI.find(x => /ampicilina/i.test(x.antibiotico))?.categoriaCLSI).toBe('S')
    expect(r.categoriasCMI.find(x => /vancomicina/i.test(x.antibiotico))?.categoriaCLSI).toBe('R')
  })
  it('Neumococo penicilina CMI 1: S no-meníngeo (≤2) pero R meníngeo (≥0.12)', () => {
    const noMen = interpretarAntibiograma({ organismo: 'Streptococcus pneumoniae', sitio: 'respiratorio', resultados: [{ antibiotico: 'Penicilina', interpretacion: 'S', cmi: 1 }] })
    expect(noMen.categoriasCMI.find(x => /penicilina/i.test(x.antibiotico))?.categoriaCLSI).toBe('S')
    const men = interpretarAntibiograma({ organismo: 'Streptococcus pneumoniae', sitio: 'snc', resultados: [{ antibiotico: 'Penicilina', interpretacion: 'R', cmi: 1 }] })
    expect(men.categoriasCMI.find(x => /penicilina/i.test(x.antibiotico))?.categoriaCLSI).toBe('R')
  })
  it('Neumococo ceftriaxona CMI 1: S no-meníngeo, I meníngeo', () => {
    const men = interpretarAntibiograma({ organismo: 'Streptococcus pneumoniae', sitio: 'snc', resultados: [{ antibiotico: 'Ceftriaxona', interpretacion: 'I', cmi: 1 }] })
    expect(men.categoriasCMI.find(x => /ceftriaxona/i.test(x.antibiotico))?.categoriaCLSI).toBe('I') // meníngeo: ≤0.5 S, 1 I, ≥2 R
  })
  it('Klebsiella pneumoniae NO se confunde con neumococo (usa breakpoints de enterobacterias)', () => {
    const r = interpretarAntibiograma({ organismo: 'Klebsiella pneumoniae', resultados: [{ antibiotico: 'Ceftriaxona', interpretacion: 'S', cmi: 1 }] })
    // en enterobacterales ceftriaxona ≤1 = S; el punto clave es que NO aplicó la tabla de neumococo
    expect(r.categoriasCMI.find(x => /ceftriaxona/i.test(x.antibiotico))?.referencia).toMatch(/Enterobacterales/)
  })
})

describe('16S rRNA metiltransferasa y AME', () => {
  it('genta+tobra+amika TODAS R → 16S-RMTasa + alerta de buscar NDM', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Gentamicina', 'R'], ['Tobramicina', 'R'], ['Amikacina', 'R']]))
    expect(claves(r)).toContain('16S-RMTasa')
    expect(r.alertas.some(a => /NDM|metalo|carbapenemasa/i.test(a.mensaje))).toBe(true)
  })
  it('tobra+amika R con genta S → AME AAC(6′) (gentamicina útil)', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Gentamicina', 'S'], ['Tobramicina', 'R'], ['Amikacina', 'R']]))
    expect(claves(r)).toContain('AME')
    expect(r.advertencias.join(' ')).toMatch(/gentamicina.*útil|respetada/i)
  })
  it('genta+tobra R con amika S → AME (amikacina útil)', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Gentamicina', 'R'], ['Tobramicina', 'R'], ['Amikacina', 'S']]))
    expect(claves(r)).toContain('AME')
    expect(r.advertencias.join(' ')).toMatch(/amikacina.*útil/i)
  })
})

describe('DTR y MDR/XDR/PDR formal (Magiorakos)', () => {
  it('P. aeruginosa no-S a todos los de 1ª línea → DTR', () => {
    const r = interpretarAntibiograma(ab('Pseudomonas aeruginosa', [
      ['Piperacilina/Tazobactam', 'R'], ['Ceftazidima', 'R'], ['Cefepime', 'R'], ['Aztreonam', 'R'],
      ['Meropenem', 'R'], ['Imipenem', 'R'], ['Ciprofloxacino', 'R'], ['Levofloxacino', 'R'],
    ]))
    expect(claves(r)).toContain('DTR')
    expect(r.terapiaDirigida.some(t => /ceftolozano|cefiderocol|avibactam|relebactam/i.test(t.agente))).toBe(true)
  })
  it('E. coli no-S en ≥3 categorías → MDR formal', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [
      ['Ampicilina', 'R'], ['Ceftriaxona', 'R'], ['Ciprofloxacino', 'R'], ['Meropenem', 'S'], ['Amikacina', 'S'],
    ]))
    const mdr = r.fenotipos.find(f => f.clave === 'MDR')
    expect(mdr).toBeDefined()
    expect(mdr?.nombre).toMatch(/categorías/i)
  })
  it('sensible (todo S) → no MDR', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ceftriaxona', 'S'], ['Meropenem', 'S'], ['Ciprofloxacino', 'S']]))
    expect(claves(r)).not.toContain('MDR')
  })
})

describe('Familia de β-lactamasa por fenotipo', () => {
  it('BLEE con cefotaxima R + ceftazidima S → probable CTX-M', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Cefotaxima', 'R'], ['Ceftazidima', 'S'], ['Meropenem', 'S']]))
    expect(r.mecanismos.some(m => /CTX-M/i.test(m.nombre))).toBe(true)
  })
  it('AmpC plasmídica → menciona CMY-2', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Cefoxitina', 'R'], ['Ceftriaxona', 'R'], ['Meropenem', 'S']]))
    expect(r.mecanismos.some(m => /CMY-2/i.test(m.nombre + m.explicacion))).toBe(true)
  })
})

describe('Glucopéptidos en S. aureus: VRSA / VISA / hVISA', () => {
  it('vanco R → VRSA confirmado + mecanismo vanA + crítica + notificación', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Vancomicina', 'R']]))
    expect(claves(r)).toContain('VRSA')
    expect(r.mecanismos.some(m => /vanA/i.test(m.nombre))).toBe(true)
    expect(r.notificacionObligatoria).toBe(true)
    expect(r.alertas.some(a => a.nivel === 'critica' && /VRSA/i.test(a.mensaje))).toBe(true)
  })
  it('vanco CMI 16 → VRSA (aunque el reporte no diga R)', () => {
    const r = interpretarAntibiograma({ organismo: 'S. aureus', resultados: [{ antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 16 }] })
    expect(claves(r)).toContain('VRSA')
  })
  it('vanco CMI 6 → VISA con mecanismo de engrosamiento de pared', () => {
    const r = interpretarAntibiograma({ organismo: 'S. aureus', resultados: [{ antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 6 }] })
    expect(claves(r)).toContain('VISA')
    expect(r.mecanismos.some(m => /pared/i.test(m.nombre))).toBe(true)
  })
  it('MRSA con vanco CMI 2 → sospecha de hVISA', () => {
    const r = interpretarAntibiograma({ organismo: 'S. aureus', resultados: [{ antibiotico: 'Cefoxitina', interpretacion: 'R' }, { antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 2 }] })
    expect(claves(r)).toContain('hVISA')
  })
})

describe('Mecanismos completos (colistina, FQ)', () => {
  it('colistina R → mecanismo de modificación del lípido A (mcr/mgrB)', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Colistina', 'R']]))
    expect(r.mecanismos.some(m => /lípido A|mcr|pmr/i.test(m.nombre + m.explicacion))).toBe(true)
  })
  it('FQ R → mecanismo gyrA/parC', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ciprofloxacino', 'R']]))
    expect(r.mecanismos.some(m => /gyrA|parC|topoisomerasa/i.test(m.nombre))).toBe(true)
  })
})

describe('Métodos de laboratorio validados sugeridos', () => {
  it('AmpC → sugiere confirmación de AmpC + doble productor', () => {
    const r = interpretarAntibiograma(ab('Enterobacter cloacae', [['Ceftriaxona', 'S'], ['Cefepime', 'S']]))
    const ids = r.pruebasSugeridas.map(p => p.id)
    expect(ids).toContain('AMPC_CONFIRM')
    expect(ids).toContain('DOBLE_PRODUCTOR')
  })
  it('carbapenemasa → sinergia por inhibidores (borónico/EDTA) + inmunocromatografía', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftriaxona', 'R']]))
    const ids = r.pruebasSugeridas.map(p => p.id)
    expect(ids).toContain('SINERGIA_CARBAPENEMASA')
    expect(ids).toContain('INMUNOCROMATOGRAFIA')
  })
  it('BLEE → sugiere sinergia de doble disco (DDST)', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ceftriaxona', 'R'], ['Meropenem', 'S']]))
    expect(r.pruebasSugeridas.some(p => p.id === 'SINERGIA_ESBL_DDST')).toBe(true)
  })
  it('colistina válida menciona CBDE/BMD (no disco)', () => {
    const r = interpretarAntibiograma(ab('Acinetobacter baumannii', [['Meropenem', 'R'], ['Colistina', 'R']]))
    const col = r.pruebasSugeridas.find(p => p.id === 'COLISTINA')
    expect(col?.metodo).toMatch(/CBDE|BMD|microdiluci/i)
  })
})

describe('Pruebas microbiológicas CLSI sugeridas', () => {
  it('BLEE → sugiere prueba confirmatoria de ESBL (Tabla 3A)', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ceftriaxona', 'R'], ['Meropenem', 'S']]))
    expect(r.pruebasSugeridas.some(p => /ESBL|BLEE/i.test(p.nombre) && /3A/.test(p.referencia))).toBe(true)
  })
  it('carbapenemasa → sugiere Carba NP + mCIM/eCIM + molecular', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftriaxona', 'R']]))
    const ids = r.pruebasSugeridas.map(p => p.id)
    expect(ids).toContain('CARBA_NP')
    expect(ids).toContain('mCIM_eCIM')
    expect(ids).toContain('MOLECULAR')
  })
  it('MRSA → sugiere tamiz de cefoxitina', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Cefoxitina', 'R']]))
    expect(r.pruebasSugeridas.some(p => p.id === 'CEFOXITINA_MRSA')).toBe(true)
  })
  it('MLSb inducible → sugiere D-zone test', () => {
    const r = interpretarAntibiograma(ab('Staphylococcus aureus', [['Eritromicina', 'R'], ['Clindamicina', 'S']]))
    expect(r.pruebasSugeridas.some(p => p.id === 'D_ZONE')).toBe(true)
  })
  it('aislamiento sensible → sin pruebas confirmatorias', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ceftriaxona', 'S'], ['Meropenem', 'S']]))
    expect(r.pruebasSugeridas).toHaveLength(0)
  })
})

describe('Glucopéptidos en S. aureus: VRSA / VISA / hVISA + mecanismos', () => {
  it('vanco R → VRSA + mecanismo vanA + crítica + notificación', () => {
    const r = interpretarAntibiograma({ organismo: 'Staphylococcus aureus', resultados: [{ antibiotico: 'Vancomicina', interpretacion: 'R', cmi: 32 }] })
    expect(claves(r)).toContain('VRSA')
    expect(r.mecanismos.some(m => /vanA|D-Lac/i.test(m.nombre))).toBe(true)
    expect(r.alertas.some(a => a.nivel === 'critica' && /VRSA/i.test(a.mensaje))).toBe(true)
    expect(r.notificacionObligatoria).toBe(true)
  })
  it('vanco CMI 6 → VISA + mecanismo de engrosamiento de pared', () => {
    const r = interpretarAntibiograma({ organismo: 'Staphylococcus aureus', resultados: [{ antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 6 }] })
    expect(claves(r)).toContain('VISA')
    expect(claves(r)).not.toContain('VRSA')
    expect(r.mecanismos.some(m => /engrosamiento|pared/i.test(m.nombre))).toBe(true)
  })
  it('MRSA + vanco CMI 2 → sospecha hVISA', () => {
    const r = interpretarAntibiograma({ organismo: 'Staphylococcus aureus', resultados: [{ antibiotico: 'Cefoxitina', interpretacion: 'R' }, { antibiotico: 'Vancomicina', interpretacion: 'S', cmi: 2 }] })
    expect(claves(r)).toContain('hVISA')
  })
})

describe('Mecanismos moleculares en fenotipos transversales', () => {
  it('colistina R → mecanismo mcr/lípido A', () => {
    const r = interpretarAntibiograma(ab('Klebsiella pneumoniae', [['Colistina', 'R']]))
    expect(r.mecanismos.some(m => /mcr|lípido A|lipido A/i.test(m.nombre))).toBe(true)
  })
  it('ciprofloxacino R → mecanismo gyrA/parC', () => {
    const r = interpretarAntibiograma(ab('Escherichia coli', [['Ciprofloxacino', 'R']]))
    expect(r.mecanismos.some(m => /gyrA|parC|topoisomerasa/i.test(m.nombre))).toBe(true)
  })
})

describe('Pruebas confirmatorias del reporte (input)', () => {
  it('D-test POS → clindamicina R confirmada aunque el disco no esté', () => {
    const r = interpretarAntibiograma({ organismo: 'Staphylococcus aureus', resultados: [{ antibiotico: 'Eritromicina', interpretacion: 'R' }], pruebas: { dTest: 'pos' } })
    expect(r.fenotipos.some(f => f.clave === 'MLSb-inducible' && f.confianza === 'confirmado')).toBe(true)
    expect(r.advertencias.join(' ')).toMatch(/clindamicina resistente/i)
  })
  it('tamiz cefoxitina POS → MRSA confirmado + notificación', () => {
    const r = interpretarAntibiograma({ organismo: 'Staphylococcus aureus', resultados: [], pruebas: { cefoxitinaScreen: 'pos' } })
    expect(r.fenotipos.some(f => f.clave === 'MRSA' && f.confianza === 'confirmado')).toBe(true)
    expect(r.notificacionObligatoria).toBe(true)
  })
  it('BLEE POS → BLEE confirmada + carbapenémico dirigido', () => {
    const r = interpretarAntibiograma({ organismo: 'Escherichia coli', resultados: [], pruebas: { esbl: 'pos' } })
    expect(r.fenotipos.some(f => f.clave === 'BLEE' && f.confianza === 'confirmado')).toBe(true)
    expect(r.terapiaDirigida.some(t => /carbapen/i.test(t.agente))).toBe(true)
  })
  it('carbapenemasa POS con clase NDM → MBL confirmada + aviso acceso MX', () => {
    const r = interpretarAntibiograma({ organismo: 'Klebsiella pneumoniae', resultados: [], pruebas: { carbapenemasa: 'pos', claseCarbapenemasa: 'NDM' } })
    const c = r.fenotipos.find(f => f.clave === 'carbapenemasa')
    expect(c?.confianza).toBe('confirmado')
    expect(r.mecanismos.some(m => m.ambler === 'B')).toBe(true)
    expect(r.alertas.some(a => /no hay aztreonam ni cefiderocol/i.test(a.mensaje))).toBe(true)
  })
  it('nitrocefina POS en S. aureus → penicilinasa confirmada (penicilina R)', () => {
    const r = interpretarAntibiograma({ organismo: 'Staphylococcus aureus', resultados: [], pruebas: { betaLactamasa: 'pos' } })
    expect(r.fenotipos.some(f => f.clave === 'penicilinasa-estafilococica')).toBe(true)
  })
  it('sin pruebas → no cambia el comportamiento base', () => {
    const r = interpretarAntibiograma({ organismo: 'Escherichia coli', resultados: [['Ceftriaxona', 'S'] as [string, 'S']].map(([a, i]) => ({ antibiotico: a, interpretacion: i as 'S' })) })
    expect(r.fenotipos).toHaveLength(0)
  })
})

describe('Visión → motor (perfilAEntrada)', () => {
  it('convierte el perfil extraído en entrada del motor y filtra celdas sin S/I/R', () => {
    const perfil = {
      organismo: 'Klebsiella pneumoniae',
      resultados: [
        { antibiotico: 'Meropenem', interpretacion: 'R' as const, cmi: 16 },
        { antibiotico: 'Ceftriaxona', interpretacion: 'R' as const },
        { antibiotico: 'Colistina', interpretacion: null, cmi: null }, // sin categoría → se descarta
      ],
    }
    const entrada = perfilAEntrada(perfil, 'sangre')
    expect(entrada.organismo).toBe('Klebsiella pneumoniae')
    expect(entrada.sitio).toBe('sangre')
    expect(entrada.resultados).toHaveLength(2)
    expect(entrada.resultados.find(r => /meropenem/i.test(r.antibiotico))?.cmi).toBe(16)
    // y el motor razona sobre el perfil extraído (extremo a extremo)
    const r = interpretarAntibiograma(entrada)
    expect(r.fenotipos.some(f => f.clave === 'carbapenemasa')).toBe(true)
  })
})
