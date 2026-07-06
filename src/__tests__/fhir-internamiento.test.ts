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
})
