import { describe, it, expect } from 'vitest'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma'
import { coincideAntibiotico } from '@/lib/expediente/antibiograma/util'

/**
 * Regresiones del emparejamiento de nombres de antibiótico.
 *
 * El motor buscaba los sinónimos con `includes`, y los β-lactámicos nuevos son
 * COMBINACIONES cuyo nombre contiene el del agente suelto. Eso rompía cuatro
 * cosas distintas a la vez, todas con consecuencia clínica.
 */
describe('coincideAntibiotico — un agente suelto no es su combinación', () => {
  it('meropenem NO casa meropenem-vaborbactam', () => {
    expect(coincideAntibiotico('Meropenem-vaborbactam', 'meropenem')).toBe(false)
    expect(coincideAntibiotico('Meropenem', 'meropenem')).toBe(true)
  })

  it('amoxicilina NO casa amoxicilina-clavulanato', () => {
    expect(coincideAntibiotico('Amoxicilina-clavulanato', 'amoxicilina')).toBe(false)
    expect(coincideAntibiotico('Ampicilina-sulbactam', 'ampicilina')).toBe(false)
    expect(coincideAntibiotico('Ampicilina', 'ampicilina')).toBe(true)
  })

  it('la combinación buscada SÍ casa su propio nombre', () => {
    expect(coincideAntibiotico('Piperacilina-tazobactam', 'piperacilina-tazobactam')).toBe(true)
    expect(coincideAntibiotico('Aztreonam-avibactam', 'avibactam')).toBe(true)
  })

  it('frontera de token: ofloxacino no está dentro de levofloxacino', () => {
    expect(coincideAntibiotico('Levofloxacino', 'ofloxacino')).toBe(false)
    expect(coincideAntibiotico('Ofloxacino', 'ofloxacino')).toBe(true)
  })

  it('tolera separadores y acentos del reporte de laboratorio', () => {
    expect(coincideAntibiotico('CEFTRIAXONA', 'ceftriaxona')).toBe(true)
    expect(coincideAntibiotico('Trimetoprim/Sulfametoxazol', 'trimetoprim')).toBe(true)
  })
})

describe('consecuencias clínicas que esto ocultaba', () => {
  it('REGRESIÓN: un vaborbactam en el panel apagaba la detección de CARBAPENEMASA', () => {
    // Con meropenem R al lado. Se perdía la alerta crítica, la notificación
    // obligatoria y el aislamiento de contacto: el motor concluía "BLEE".
    const r = interpretarAntibiograma({
      organismo: 'Klebsiella pneumoniae',
      resultados: [
        { antibiotico: 'Meropenem-vaborbactam', interpretacion: 'S' },
        { antibiotico: 'Meropenem', interpretacion: 'R' },
        { antibiotico: 'Ceftriaxona', interpretacion: 'R' },
      ],
    })
    const nombres = (r.fenotipos ?? []).map(f => f.nombre).join(' | ').toLowerCase()
    expect(nombres).toContain('carbapenemasa')
  })

  it('REGRESIÓN: Klebsiella sensible a amox-clav NO es un conflicto intrínseco', () => {
    // Es lo NORMAL. Disparaba una alarma de alta visibilidad pidiéndole al
    // laboratorio reconfirmar la especie, en el escenario más frecuente.
    const r = interpretarAntibiograma({
      organismo: 'Klebsiella pneumoniae',
      resultados: [
        { antibiotico: 'Amoxicilina-clavulanato', interpretacion: 'S' },
        { antibiotico: 'Meropenem', interpretacion: 'S' },
      ],
    })
    expect((r.resistenciaIntrinseca ?? []).filter(n => n.tipo === 'conflicto')).toHaveLength(0)
  })

  it('la ampicilina sola en Klebsiella SÍ sigue siendo conflicto intrínseco', () => {
    // El arreglo no puede apagar la detección real: Klebsiella es intrínsecamente
    // resistente a ampicilina, así que un "S" ahí sí indica error de identificación.
    const r = interpretarAntibiograma({
      organismo: 'Klebsiella pneumoniae',
      resultados: [{ antibiotico: 'Ampicilina', interpretacion: 'S' }],
    })
    expect(((r.resistenciaIntrinseca ?? []).filter(n => n.tipo === 'conflicto')).length).toBeGreaterThan(0)
  })

  it('REGRESIÓN: el resultado no depende del ORDEN de las filas del panel', () => {
    const filas = [
      { antibiotico: 'Levofloxacino', interpretacion: 'S' as const },
      { antibiotico: 'Ciprofloxacino', interpretacion: 'R' as const },
    ]
    const a = interpretarAntibiograma({ organismo: 'Escherichia coli', resultados: filas })
    const b = interpretarAntibiograma({ organismo: 'Escherichia coli', resultados: [...filas].reverse() })
    expect(JSON.stringify(a.edicionesInterpretativas ?? [])).toBe(JSON.stringify(b.edicionesInterpretativas ?? []))
    expect(JSON.stringify((a.fenotipos ?? []).map(f => f.nombre)))
      .toBe(JSON.stringify((b.fenotipos ?? []).map(f => f.nombre)))
  })
})

describe('el panel completo, no solo la primera fila', () => {
  it('REGRESIÓN: un carbapenémico S detrás de otro R sí es conflicto en S. maltophilia', () => {
    // Stenotrophomonas es intrínsecamente resistente a carbapenémicos (L1). Con
    // "Meropenem R" primero, la fila imposible ni se miraba.
    const r = interpretarAntibiograma({
      organismo: 'Stenotrophomonas maltophilia',
      resultados: [
        { antibiotico: 'Meropenem', interpretacion: 'R' },
        { antibiotico: 'Imipenem', interpretacion: 'S' },
      ],
    })
    const conflictos = (r.resistenciaIntrinseca ?? []).filter(n => n.tipo === 'conflicto')
    expect(conflictos.length).toBeGreaterThan(0)
    expect(conflictos.some(c => /imipenem/i.test(c.antibiotico))).toBe(true)
  })

  it('REGRESIÓN: una cefalosporina S detrás de otra R sí es conflicto en E. faecium', () => {
    const r = interpretarAntibiograma({
      organismo: 'Enterococcus faecium',
      resultados: [
        { antibiotico: 'Ceftriaxona', interpretacion: 'R' },
        { antibiotico: 'Ceftazidima', interpretacion: 'S' },
      ],
    })
    expect((r.resistenciaIntrinseca ?? []).filter(n => n.tipo === 'conflicto').length).toBeGreaterThan(0)
  })
})

describe('lo confirmado por el laboratorio gana a lo inferido', () => {
  it('REGRESIÓN: una KPC confirmada por PCR no queda como "clase no determinada"', () => {
    // La inferencia por patrón se fusiona antes que las pruebas confirmatorias, y
    // el dedup conservaba la primera: el dato del laboratorio perdía siempre.
    const r = interpretarAntibiograma({
      organismo: 'Klebsiella pneumoniae',
      resultados: [
        { antibiotico: 'Meropenem', interpretacion: 'R' },
        { antibiotico: 'Ertapenem', interpretacion: 'R' },
      ],
      pruebas: { carbapenemasa: 'pos', claseCarbapenemasa: 'KPC' },
    })
    const carba = (r.fenotipos ?? []).filter(f => /carbapenemasa/i.test(f.nombre))
    expect(carba.length).toBeGreaterThan(0)
    // Con PCR positiva la confianza tiene que ser la máxima, no "probable".
    expect(carba.some(f => f.confianza === 'confirmado')).toBe(true)
  })
})
