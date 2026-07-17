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
