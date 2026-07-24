import { describe, it, expect } from 'vitest'
import { interpretarAntibiograma, interpretarCMI } from '@/lib/expediente/antibiograma'

/**
 * Correcciones clínicas indicadas por el médico (infectólogo) tras la auditoría,
 * y los dos puntos de corte que se verificaron contra la literatura.
 */

describe('MDR: la resistencia intrínseca NO cuenta (Magiorakos)', () => {
  it('REGRESIÓN: un Proteus mirabilis SENSIBLE no es MDR', () => {
    // Sus cuatro resistencias naturales se reportan en el panel; contarlas como
    // adquiridas lo marcaba MDR[confirmado] y disparaba aislamiento y escalada.
    const r = interpretarAntibiograma({
      organismo: 'Proteus mirabilis',
      resultados: [
        { antibiotico: 'Ampicilina', interpretacion: 'S' },
        { antibiotico: 'Ceftriaxona', interpretacion: 'S' },
        { antibiotico: 'Meropenem', interpretacion: 'S' },
        { antibiotico: 'Gentamicina', interpretacion: 'S' },
        { antibiotico: 'Ciprofloxacino', interpretacion: 'S' },
        { antibiotico: 'Trimetoprim-sulfametoxazol', interpretacion: 'S' },
        // Intrínsecas de Proteae:
        { antibiotico: 'Nitrofurantoina', interpretacion: 'R' },
        { antibiotico: 'Tetraciclina', interpretacion: 'R' },
        { antibiotico: 'Colistina', interpretacion: 'R' },
        { antibiotico: 'Tigeciclina', interpretacion: 'R' },
      ],
    })
    expect((r.fenotipos ?? []).some(f => f.clave === 'MDR')).toBe(false)
  })

  it('un Proteus que SÍ adquiere resistencia fuera de su patrón sigue siendo MDR', () => {
    // El arreglo no puede apagar la detección real.
    const r = interpretarAntibiograma({
      organismo: 'Proteus mirabilis',
      resultados: [
        { antibiotico: 'Ampicilina', interpretacion: 'R' },
        { antibiotico: 'Ceftriaxona', interpretacion: 'R' },
        { antibiotico: 'Gentamicina', interpretacion: 'R' },
        { antibiotico: 'Ciprofloxacino', interpretacion: 'R' },
        { antibiotico: 'Trimetoprim-sulfametoxazol', interpretacion: 'R' },
        { antibiotico: 'Meropenem', interpretacion: 'S' },
      ],
    })
    expect((r.fenotipos ?? []).some(f => f.clave === 'MDR')).toBe(true)
  })
})

describe('P. aeruginosa: carbapenémicos R con cefalosporinas conservadas', () => {
  it('REGRESIÓN: ya no pasa en silencio; se atribuye a porina + bomba, no a carbapenemasa', () => {
    const r = interpretarAntibiograma({
      organismo: 'Pseudomonas aeruginosa',
      resultados: [
        { antibiotico: 'Imipenem', interpretacion: 'R' },
        { antibiotico: 'Meropenem', interpretacion: 'R' },
        { antibiotico: 'Ceftazidima', interpretacion: 'S' },
        { antibiotico: 'Cefepime', interpretacion: 'S' },
        { antibiotico: 'Piperacilina-tazobactam', interpretacion: 'S' },
      ],
    })
    expect((r.fenotipos ?? []).length).toBeGreaterThan(0)
    const mecanismos = (r.mecanismos ?? []).map(m => m.nombre).join(' ').toLowerCase()
    expect(mecanismos).toMatch(/porina|expulsion|expulsión/)
    // NO debe declararse carbapenemasa: eso arrastraría también las cefalosporinas.
    expect((r.fenotipos ?? []).some(f => f.clave === 'carbapenemasa')).toBe(false)
  })
})

describe('puntos de corte verificados contra la literatura', () => {
  it('oxacilina en coagulasa-negativo usa el corte bajo que detecta mecA', () => {
    // CLSI bajó el corte de ≥4 a ≥0.5 mg/L en CoNS precisamente porque el de
    // S. aureus no detectaba la resistencia por mecA. Con el corte viejo, una CMI
    // de 1 salía S en un S. epidermidis de hemocultivo.
    expect(interpretarCMI('Staphylococcus epidermidis', 'Oxacilina', 1)?.categoria).toBe('R')
    expect(interpretarCMI('Staphylococcus epidermidis', 'Oxacilina', 0.25)?.categoria).toBe('S')
  })

  it('S. aureus y S. lugdunensis conservan su propio corte de oxacilina', () => {
    expect(interpretarCMI('Staphylococcus aureus', 'Oxacilina', 1)?.categoria).toBe('S')
    expect(interpretarCMI('Staphylococcus lugdunensis', 'Oxacilina', 1)?.categoria).toBe('S')
    expect(interpretarCMI('Staphylococcus aureus', 'Oxacilina', 4)?.categoria).toBe('R')
  })

  it('daptomicina en E. faecium se informa como SDD, nunca como S', () => {
    // CLSI no define categoría S para esta combinación: solo SDD ≤4 (8-12 mg/kg/día)
    // y R ≥8. Informarla como S ocultaría que hay que subir la dosis a propósito.
    expect(interpretarCMI('Enterococcus faecium', 'Daptomicina', 2)?.categoria).toBe('SDD')
    expect(interpretarCMI('Enterococcus faecium', 'Daptomicina', 4)?.categoria).toBe('SDD')
    expect(interpretarCMI('Enterococcus faecium', 'Daptomicina', 8)?.categoria).toBe('R')
  })

  it('el resto de enterococos conserva su corte propio', () => {
    expect(interpretarCMI('Enterococcus faecalis', 'Daptomicina', 2)?.categoria).toBe('S')
    expect(interpretarCMI('Enterococcus faecalis', 'Daptomicina', 8)?.categoria).toBe('R')
  })

  it('un E. faecium con daptomicina CMI 2 ya NO se descarta como resistente', () => {
    // Antes se aplicaba el umbral de estafilococo (>1) y el motor emitía
    // "no usar daptomicina" en un VRE, donde es una de dos opciones reales.
    const r = interpretarAntibiograma({
      organismo: 'Enterococcus faecium',
      resultados: [
        { antibiotico: 'Vancomicina', interpretacion: 'R' },
        { antibiotico: 'Daptomicina', interpretacion: 'S', cmi: 2 },
      ],
    })
    expect((r.fenotipos ?? []).some(f => f.clave === 'daptomicina-R')).toBe(false)
  })

  it('pip-tazo en Pseudomonas: R a partir de 64 (CLSI 2023), no antes', () => {
    expect(interpretarCMI('Pseudomonas aeruginosa', 'Piperacilina-tazobactam', 16)?.categoria).toBe('S')
    expect(interpretarCMI('Pseudomonas aeruginosa', 'Piperacilina-tazobactam', 64)?.categoria).toBe('R')
  })

  it('minociclina en Acinetobacter: corte estrecho de la revisión CLSI 2025', () => {
    expect(interpretarCMI('Acinetobacter baumannii', 'Minociclina', 1)?.categoria).toBe('S')
    expect(interpretarCMI('Acinetobacter baumannii', 'Minociclina', 4)?.categoria).toBe('R')
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P0): ertapenem R (intrínseco en no-fermentadores)
 * disparaba falsa carbapenemasa + falsa notificación NOM-045 en Pseudomonas/Acinetobacter.
 */
describe('Ertapenem intrínseco no dispara falsa carbapenemasa (no-fermentadores)', () => {
  it('Pseudomonas con SOLO ertapenem R (mero/imi S) NO se marca carbapenemasa', () => {
    const res = interpretarAntibiograma({ organismo: 'Pseudomonas aeruginosa', resultados: [
      { antibiotico: 'Ertapenem', interpretacion: 'R' },
      { antibiotico: 'Meropenem', interpretacion: 'S' },
      { antibiotico: 'Imipenem', interpretacion: 'S' },
    ] })
    // No hay fenotipo de carbapenemasa ni notificación (el texto didáctico puede
    // mencionar la palabra al explicar por qué NO la hay; se revisan los campos).
    expect(res.fenotipos.some(f => /carbapenemasa/i.test(f.nombre))).toBe(false)
    expect(res.notificacionObligatoria).toBeFalsy()
  })
  it('Pseudomonas con meropenem R SÍ dispara el fenotipo', () => {
    const res = interpretarAntibiograma({ organismo: 'Pseudomonas aeruginosa', resultados: [
      { antibiotico: 'Meropenem', interpretacion: 'R' },
    ] })
    expect(res.fenotipos.some(f => /carbapen/i.test(f.nombre))).toBe(true)
  })
})

/** REGRESIÓN (P1): daptomicina CMI 1 en S. aureus es SENSIBLE, no debe marcarse no-S. */
describe('Daptomicina CMI 1 en S. aureus = sensible', () => {
  const fen = (cmi: number) => interpretarAntibiograma({ organismo: 'Staphylococcus aureus', resultados: [
    { antibiotico: 'Daptomicina', interpretacion: 'S', cmi },
  ] }).fenotipos.some(f => /daptomicina/i.test(f.nombre))
  it('CMI 1 (S) NO se marca no-S (era el bug: descartaba 1ª línea)', () => {
    expect(fen(1)).toBe(false)
  })
  it('CMI 2 sí es no-S', () => {
    expect(fen(2)).toBe(true)
  })
})
