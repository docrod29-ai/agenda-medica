import { describe, it, expect } from 'vitest'
import { exportarInternamientoAFhir } from '@/lib/fhir-export'
import type { Patient } from '@/types'
import type { Internamiento } from '@/types/hospital'

const paciente = { id: 'p1', nombre: 'Juan Pérez', sexo: 'Masculino' } as unknown as Patient
const internamiento: Internamiento = {
  id: 'int1', clinicId: 'c1', pacienteId: 'p1', pacienteNombre: 'Juan Pérez',
  servicio: 'Medicina Interna', cama: '302-A', medicoTratanteId: 'm1', medicoTratanteNombre: 'Dra. X',
  diagnosticoIngreso: 'Neumonía', cie10: 'J18', motivoIngreso: 'Fiebre y disnea',
  estado: 'activo', fechaIngreso: '2026-07-01T10:00:00.000Z',
  indicaciones: [{ id: 'i1', tipo: 'medicamento', descripcion: 'Ceftriaxona 1 g IV', frecuencia: 'cada 24 h', activa: true, fecha: '2026-07-01T11:00:00.000Z', verificadaFarmacia: true, administraciones: [{ fecha: '2026-07-01T12:00:00.000Z', por: 'Enf. Y', estado: 'administrado', cincoCorrectos: true }] }],
  createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z', creadoPor: 'm1',
}
const signos = [{ id: 's1', fecha: '2026-07-01T12:00:00.000Z', ta: '120/80', fc: 88, temp: 38.2 }]

describe('FHIR — export del internamiento (interoperabilidad)', () => {
  const bundle = exportarInternamientoAFhir({ paciente, internamiento, notas: [], signos, config: null })
  const tipos = bundle.entry.map(e => e.resource.resourceType)

  it('produce un Bundle con Encounter inpatient', () => {
    const enc = bundle.entry.find(e => e.resource.resourceType === 'Encounter')
    expect(enc).toBeTruthy()
    expect((enc!.resource as { class?: { code?: string } }).class?.code).toBe('IMP')
  })
  it('incluye MedicationRequest y MedicationAdministration (ciclo cerrado)', () => {
    expect(tipos).toContain('MedicationRequest')
    expect(tipos).toContain('MedicationAdministration')
  })
  it('incluye Observation de signos vitales seriados', () => {
    expect(tipos.filter(t => t === 'Observation').length).toBeGreaterThanOrEqual(2)  // TA + FC + T°
  })
  it('el Patient va incluido', () => {
    expect(tipos).toContain('Patient')
  })

  it('la Tensión arterial se exporta como PANEL con componentes sistólica/diastólica (LOINC 8480-6 / 8462-4)', () => {
    const ta = bundle.entry.find(e => e.fullUrl.endsWith('-ta'))!.resource as {
      component?: { code: { coding: { code: string }[] }; valueQuantity: { value: number; code: string } }[]
      valueString?: string
    }
    expect(ta.component).toHaveLength(2)
    const sis = ta.component!.find(c => c.code.coding[0].code === '8480-6')!
    const dia = ta.component!.find(c => c.code.coding[0].code === '8462-4')!
    expect(sis.valueQuantity.value).toBe(120)
    expect(dia.valueQuantity.value).toBe(80)
    expect(sis.valueQuantity.code).toBe('mm[Hg]')  // UCUM
    expect(ta.valueString).toBeUndefined()          // ya NO se pierde la diastólica como texto plano
  })

  it('el CIE-10 se normaliza con punto (J18 → J18; J189 → J18.9)', () => {
    const enc = bundle.entry.find(e => e.resource.resourceType === 'Encounter')!.resource as unknown as {
      reasonCode: { coding?: { code?: string }[] }[]
    }
    expect(enc.reasonCode[0].coding?.[0].code).toBe('J18')
    const b2 = exportarInternamientoAFhir({ paciente, internamiento: { ...internamiento, cie10: 'J189' }, notas: [], signos, config: null })
    const enc2 = b2.entry.find(e => e.resource.resourceType === 'Encounter')!.resource as unknown as { reasonCode: { coding?: { code?: string }[] }[] }
    expect(enc2.reasonCode[0].coding?.[0].code).toBe('J18.9')
  })

  it('las Observation numéricas llevan UCUM (system + code)', () => {
    const fc = bundle.entry.find(e => e.fullUrl.endsWith('-fc'))!.resource as unknown as { valueQuantity: { system?: string; code?: string } }
    expect(fc.valueQuantity.system).toBe('http://unitsofmeasure.org')
    expect(fc.valueQuantity.code).toBe('/min')
  })
})
