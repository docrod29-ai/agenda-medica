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
    // SpO2 debe usar LOINC 2708-6 (canónico de signos vitales), consistente con
    // el mapper de export — no 59408-5 (evita el conflicto entre los dos mappers).
    const spo2 = obs.find(o => (o.code as { coding: { code: string }[] }).coding[0].code === '2708-6')
    expect(spo2).toBeTruthy()
  })

  /**
   * `bundlePaciente` DELEGA en la implementación buena desde la v1010: había
   * dos mapeos del mismo modelo y la ruta HTTP —la que consume un tercero—
   * usaba el pobre, que exportaba los diagnósticos de un BORRADOR como
   * `Condition` confirmadas.
   *
   * Por eso la nota de esta prueba lleva ahora `estado: 'firmada'`: sin estado
   * es un borrador, y un borrador no afirma nada clínico.
   */
  const notaFirmada = (extra: Record<string, unknown> = {}): NotaMedica => ({
    id: 'n1', estado: 'firmada',
    metadata: { id: 'n1', fechaCreacion: '2026-07-15T10:00:00.000Z', medicoId: 'm1' },
    diagnosticos: [{ descripcion: 'Bronquitis', codigoCIE10: 'J20' }],
    medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'c/8h', duracion: '7d' }],
    signosVitales: { fc: 80 }, fechaConsulta: '2026-07-15',
    ...extra,
  } as unknown as NotaMedica)

  it('bundlePaciente arma un Bundle collection con todo', () => {
    const b = bundlePaciente(paciente, [notaFirmada()])
    expect(b.resourceType).toBe('Bundle')
    expect(b.type).toBe('collection')
    const tipos = (b.entry as { resource: { resourceType: string } }[]).map(e => e.resource.resourceType)
    expect(tipos).toContain('Patient')
    expect(tipos).toContain('AllergyIntolerance')
    expect(tipos).toContain('Condition')
    expect(tipos).toContain('MedicationRequest')
    expect(tipos).toContain('Observation')
    // Y lo que el mapeo pobre NO emitía: el documento clínico.
    expect(tipos).toContain('Composition')
  })

  it('y un BORRADOR no afirma nada clínico — el defecto que tenía la ruta viva', () => {
    /**
     * Un diagnóstico de una nota sin firmar entraba al sistema receptor como
     * confirmado. El texto sí viaja: es contenido del expediente.
     */
    const b = bundlePaciente(paciente, [notaFirmada({ estado: 'borrador' })])
    const recursos = (b.entry as { resource: { resourceType: string; status?: string } }[]).map(e => e.resource)
    expect(recursos.some(r => r.resourceType === 'Condition')).toBe(false)
    expect(recursos.some(r => r.resourceType === 'MedicationRequest')).toBe(false)
    expect(recursos.find(r => r.resourceType === 'Composition')?.status).toBe('preliminary')
  })

  it('las alergias salen UNA POR ALÉRGENO, no como una cadena', () => {
    /**
     * Lo bueno del mapeo pobre, que se conservó al unificar: un receptor que
     * quiera cruzar una receta contra las alergias no puede hacer nada con un
     * párrafo donde esperaba una lista.
     */
    const b = bundlePaciente(paciente, [])
    const algs = (b.entry as { resource: { resourceType: string; code?: { text?: string } } }[])
      .filter(e => e.resource.resourceType === 'AllergyIntolerance')
    expect(algs.length).toBeGreaterThan(0)
    for (const a of algs) expect(a.resource.code?.text).not.toContain(',')
  })
})
