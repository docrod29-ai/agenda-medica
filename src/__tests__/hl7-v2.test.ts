import { describe, it, expect } from 'vitest'
import { parsearHL7, parsearORU, parsearADT, oruAFHIR, construirACK } from '@/lib/hl7/v2'

const ORU = [
  'MSH|^~\\&|LIS|LAB|NEXUSMED|CLINICA|20260715||ORU^R01|MSG00001|P|2.5',
  'PID|1||PAC123^^^HOSP^MR||Perez^Juan||19800510|M',
  'OBR|1||ORD9|CBC^Biometria hematica',
  'OBX|1|NM|718-7^Hemoglobina^LN||9.2|g/dL|13-17|L|||F',
  'OBX|2|NM|6690-2^Leucocitos^LN||11.5|10*3/uL|4.5-11|H|||F',
].join('\r')

describe('HL7 v2 — parseo', () => {
  it('divide en segmentos y campos', () => {
    const segs = parsearHL7(ORU)
    expect(segs[0].tipo).toBe('MSH')
    expect(segs.filter(s => s.tipo === 'OBX')).toHaveLength(2)
  })

  it('parsearORU: paciente + resultados con código, valor, unidad y flag', () => {
    const oru = parsearORU(ORU)
    expect(oru.paciente.nombre).toBe('Juan Perez')
    expect(oru.paciente.id).toBe('PAC123')
    expect(oru.resultados).toHaveLength(2)
    expect(oru.resultados[0]).toMatchObject({ codigo: '718-7', nombre: 'Hemoglobina', valor: '9.2', unidad: 'g/dL', flag: 'L' })
    expect(oru.mensajeControlId).toBe('MSG00001')
  })

  it('oruAFHIR: Observation laboratory con LOINC y valueQuantity', () => {
    const obs = oruAFHIR(parsearORU(ORU), 'Patient/p1')
    expect(obs[0].resourceType).toBe('Observation')
    const coding = (obs[0].code as { coding: { system: string; code: string }[] }).coding
    expect(coding[0].system).toBe('http://loinc.org')
    expect((obs[0].valueQuantity as { value: number }).value).toBe(9.2)
    expect((obs[0].interpretation as { text: string }[])[0].text).toBe('L')
  })

  it('parsearADT: evento + paciente', () => {
    const ADT = ['MSH|^~\\&|HIS|H|NEXUSMED|C|20260715||ADT^A01|M1|P|2.5', 'PID|1||P9||Lopez^Ana||19900101|F', 'PV1|1|I|3A^301^1'].join('\r')
    const adt = parsearADT(ADT)
    expect(adt.tipoEvento).toBe('A01')
    expect(adt.paciente.nombre).toBe('Ana Lopez')
    expect(adt.ubicacion).toContain('3A')
  })

  it('construirACK genera un MSA de aceptación', () => {
    const ack = construirACK('MSG00001')
    expect(ack).toContain('MSA|AA|MSG00001')
  })
})
