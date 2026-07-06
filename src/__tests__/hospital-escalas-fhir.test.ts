import { describe, it, expect } from 'vitest'
import { calcBraden, calcMorse } from '@/lib/hospital/escalas'
import { parsearLabsFhir } from '@/lib/hospital/fhir-import'

describe('Escalas de enfermería', () => {
  it('Braden bajo puntaje → riesgo alto', () => {
    const r = calcBraden({ percepcion: 1, humedad: 1, actividad: 1, movilidad: 1, nutricion: 1, friccion: 1 })
    expect(r.score).toBe(6)
    expect(['muy alto', 'alto']).toContain(r.riesgo)
  })
  it('Braden máximo → sin riesgo', () => {
    const r = calcBraden({ percepcion: 4, humedad: 4, actividad: 4, movilidad: 4, nutricion: 4, friccion: 3 })
    expect(r.score).toBe(23)
    expect(r.riesgo).toBe('sin riesgo')
  })
  it('Morse alto → riesgo alto de caídas', () => {
    const r = calcMorse({ caidasPrevias: 25, dxSecundario: 15, ayudaAmbulacion: 30, viaIV: 20, marcha: 20, estadoMental: 15 })
    expect(r.score).toBe(125)
    expect(r.riesgo).toBe('alto')
  })
  it('Morse cero → bajo', () => {
    expect(calcMorse({ caidasPrevias: 0, dxSecundario: 0, ayudaAmbulacion: 0, viaIV: 0, marcha: 0, estadoMental: 0 }).riesgo).toBe('bajo')
  })
})

describe('FHIR import — resultados de laboratorio', () => {
  const bundle = JSON.stringify({
    resourceType: 'Bundle',
    entry: [
      { resource: { resourceType: 'Observation', code: { text: 'Potasio' }, valueQuantity: { value: 6.8, unit: 'mmol/L' }, interpretation: [{ coding: [{ code: 'HH' }] }] } },
      { resource: { resourceType: 'Observation', code: { text: 'Hemoglobina' }, valueQuantity: { value: 13.5, unit: 'g/dL' } } },
      { resource: { resourceType: 'Patient', id: 'x' } },
    ],
  })
  it('extrae Observations con valor y unidad', () => {
    const r = parsearLabsFhir(bundle)
    expect(r.length).toBe(2)
    expect(r.find(x => x.estudio === 'Potasio')?.valor).toBe('6.8')
  })
  it('detecta valor crítico por interpretation HH', () => {
    const r = parsearLabsFhir(bundle)
    expect(r.find(x => x.estudio === 'Potasio')?.critico).toBe(true)
    expect(r.find(x => x.estudio === 'Hemoglobina')?.critico).toBeFalsy()
  })
  it('JSON inválido → vacío', () => {
    expect(parsearLabsFhir('no es json')).toHaveLength(0)
  })
})
