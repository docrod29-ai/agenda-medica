import { describe, it, expect } from 'vitest'
import { sujetosDelBundle, verificaSujeto } from '@/lib/hospital/fhir-import'

const bundle = (subjectRef: string, patientName?: string) => JSON.stringify({
  resourceType: 'Bundle',
  entry: [
    ...(patientName ? [{ resource: { resourceType: 'Patient', id: subjectRef.replace('Patient/', ''), name: [{ text: patientName }] } }] : []),
    { resource: { resourceType: 'Observation', subject: { reference: subjectRef }, code: { text: 'Potasio' }, valueQuantity: { value: 7.2, unit: 'mEq/L' } } },
  ],
})

const PACIENTE = { id: 'abc123', nombre: 'Juan Pérez López' }

describe('los resultados FHIR no se archivan en el paciente equivocado', () => {
  it('bloquea un Bundle de OTRO paciente', () => {
    const v = verificaSujeto(sujetosDelBundle(bundle('Patient/otro999', 'María Gómez')), PACIENTE)
    expect(v.veredicto).toBe('no-coincide')
    expect(v.detalle).toContain('María Gómez')
  })

  it('acepta el Bundle del paciente correcto por id', () => {
    expect(verificaSujeto(sujetosDelBundle(bundle('Patient/abc123')), PACIENTE).veredicto).toBe('coincide')
  })

  it('acepta por nombre cuando el LIS no usa nuestros ids', () => {
    const b = bundle('Patient/LIS-55', 'Juan Pérez López')
    expect(verificaSujeto(sujetosDelBundle(b), PACIENTE).veredicto).toBe('coincide')
  })

  it('un Bundle sin subject queda "sin identificar", que NO es coincidir', () => {
    const b = JSON.stringify({ resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Observation', code: { text: 'Sodio' }, valueQuantity: { value: 130 } } }] })
    expect(verificaSujeto(sujetosDelBundle(b), PACIENTE).veredicto).toBe('sin-identificar')
  })

  it('un Bundle con VARIOS pacientes se bloquea aunque uno sea el correcto', () => {
    const b = JSON.stringify({
      resourceType: 'Bundle',
      entry: [
        { resource: { resourceType: 'Observation', subject: { reference: 'Patient/abc123' }, code: { text: 'Sodio' }, valueQuantity: { value: 140 } } },
        { resource: { resourceType: 'Observation', subject: { reference: 'Patient/otro999' }, code: { text: 'Potasio' }, valueQuantity: { value: 7.2 } } },
      ],
    })
    expect(verificaSujeto(sujetosDelBundle(b), PACIENTE).veredicto).toBe('no-coincide')
  })
})
