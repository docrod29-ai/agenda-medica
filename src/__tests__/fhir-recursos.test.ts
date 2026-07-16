import { describe, it, expect } from 'vitest'
import { pacienteAFHIR, alergiasAFHIR, medicamentoAFHIR, signosAFHIR, bundlePaciente } from '@/lib/fhir/recursos'
import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'

const paciente = {
  id: 'p1', nombre: 'Juan Pérez', telefono: '5551234567', email: 'j@x.com',
  sexo: 'Masculino', fechaNacimiento: '1980-05-10', curp: 'PEXJ800510HXXXXX01',
  alergias: 'Penicilina, Sulfas', noShowCount: 0, cancelacionCount: 0,
} as Patient

describe('Mapeo FHIR R4', () => {
  it('Patient con gender, birthDate, identifier y telecom', () => {
    const r = pacienteAFHIR(paciente)
    expect(r.resourceType).toBe('Patient')
    expect(r.gender).toBe('male')
    expect(r.birthDate).toBe('1980-05-10')
    expect((r.identifier as { value: string }[])[0].value).toContain('PEXJ')
    expect((r.telecom as { system: string }[]).some(t => t.system === 'phone')).toBe(true)
  })

  it('alergias estructuradas → AllergyIntolerance[] (con categoría/criticidad)', () => {
    const a = alergiasAFHIR('p1', [{ alergeno: 'Penicilina', tipo: 'medicamento', severidad: 'grave', reaccion: 'anafilaxia' }, { alergeno: 'Sulfas' }])
    expect(a).toHaveLength(2)
    expect(a[0].resourceType).toBe('AllergyIntolerance')
    expect((a[0].code as { text: string }).text).toBe('Penicilina')
    expect((a[0].category as string[])[0]).toBe('medication')
    expect(a[0].criticality).toBe('high')
    expect((a[1].patient as { reference: string }).reference).toBe('Patient/p1')
    expect(alergiasAFHIR('p1', [])).toEqual([])
  })

  it('Medicamento → MedicationRequest con dosis', () => {
    const r = medicamentoAFHIR('p1', 'n1', { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' }, 0)
    expect(r.resourceType).toBe('MedicationRequest')
    expect((r.dosageInstruction as { text: string }[])[0].text).toContain('500 mg')
  })

  it('Signos → Observation con LOINC y TA como componentes', () => {
    const obs = signosAFHIR('p1', 'n1', { fc: 80, ta: '120/80', spo2: 98 }, '2026-07-15')
    const fc = obs.find(o => (o.code as { coding: { code: string }[] }).coding[0].code === '8867-4')
    expect(fc).toBeTruthy()
    const bp = obs.find(o => (o.code as { coding: { code: string }[] }).coding[0].code === '85354-9')
    expect((bp!.component as unknown[]).length).toBe(2)
  })

  it('bundlePaciente arma un Bundle collection con todo', () => {
    const notas: NotaMedica[] = [{
      id: 'n1', diagnosticos: [{ descripcion: 'Bronquitis', codigoCIE10: 'J20' }],
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'c/8h', duracion: '7d' }],
      signosVitales: { fc: 80 }, fechaConsulta: '2026-07-15',
    } as unknown as NotaMedica]
    const b = bundlePaciente(paciente, notas)
    expect(b.resourceType).toBe('Bundle')
    expect(b.type).toBe('collection')
    const tipos = (b.entry as { resource: { resourceType: string } }[]).map(e => e.resource.resourceType)
    expect(tipos).toContain('Patient')
    expect(tipos).toContain('AllergyIntolerance')
    expect(tipos).toContain('Condition')
    expect(tipos).toContain('MedicationRequest')
    expect(tipos).toContain('Observation')
  })
})
