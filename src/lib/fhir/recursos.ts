/**
 * Mapeo del modelo de NexusMED a recursos FHIR R4 (interoperabilidad).
 *
 * Convierte Paciente + Notas en recursos FHIR estándar (Patient, AllergyIntolerance,
 * Condition, MedicationRequest, Observation) y arma un Bundle. Es la base de una API
 * FHIR REST viva — el paso que saca a NexusMED de ser "una isla".
 *
 * PURO (sin red/DB) → testeable. No inventa datos: solo mapea lo que existe.
 */

import type { Patient } from '@/types'
import type { NotaMedica, Medicamento, Diagnostico, SignosVitales } from '@/types/expediente'

type Recurso = Record<string, unknown>

const GENDER: Record<string, string> = { Masculino: 'male', Femenino: 'female', Otro: 'other' }

/** Patient FHIR. */
export function pacienteAFHIR(p: Patient): Recurso {
  const identifier: Recurso[] = []
  if (p.curp) identifier.push({ system: 'urn:oid:2.16.840.1.113883.4.629', value: p.curp }) // CURP (MX)
  const telecom: Recurso[] = []
  if (p.telefono) telecom.push({ system: 'phone', value: p.telefono })
  if (p.email) telecom.push({ system: 'email', value: p.email })
  return {
    resourceType: 'Patient',
    id: p.id,
    ...(identifier.length ? { identifier } : {}),
    name: [{ text: p.nombre }],
    ...(p.sexo ? { gender: GENDER[p.sexo] ?? 'unknown' } : {}),
    ...(p.fechaNacimiento ? { birthDate: p.fechaNacimiento.slice(0, 10) } : {}),
    ...(telecom.length ? { telecom } : {}),
  }
}

/** AllergyIntolerance[] a partir del texto libre de alergias (coma/;). */
export function alergiasAFHIR(patientId: string, alergias?: string): Recurso[] {
  if (!alergias?.trim()) return []
  return alergias.split(/[,;]+/).map(a => a.trim()).filter(Boolean).map((alergeno, i) => ({
    resourceType: 'AllergyIntolerance',
    id: `${patientId}-alg-${i}`,
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
    patient: { reference: `Patient/${patientId}` },
    code: { text: alergeno },
  }))
}

/** Condition (diagnóstico) FHIR. */
export function diagnosticoAFHIR(patientId: string, notaId: string, d: Diagnostico, i: number): Recurso {
  return {
    resourceType: 'Condition',
    id: `${notaId}-cond-${i}`,
    subject: { reference: `Patient/${patientId}` },
    code: {
      text: d.descripcion,
      ...(d.codigoCIE10 ? { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: d.codigoCIE10, display: d.descripcion }] } : {}),
    },
  }
}

/** MedicationRequest FHIR. */
export function medicamentoAFHIR(patientId: string, notaId: string, m: Medicamento, i: number): Recurso {
  const dosage: Recurso = { text: [m.dosis, m.via, m.frecuencia, m.duracion].filter(Boolean).join(' · ') }
  return {
    resourceType: 'MedicationRequest',
    id: `${notaId}-med-${i}`,
    status: 'active',
    intent: 'order',
    subject: { reference: `Patient/${patientId}` },
    medicationCodeableConcept: { text: m.nombreComercial ? `${m.nombre} (${m.nombreComercial})` : m.nombre },
    dosageInstruction: [dosage],
  }
}

// Mapa de signos vitales → LOINC
const LOINC_VITALES: { campo: keyof SignosVitales; code: string; display: string; unit: string }[] = [
  { campo: 'fc', code: '8867-4', display: 'Frecuencia cardiaca', unit: '/min' },
  { campo: 'fr', code: '9279-1', display: 'Frecuencia respiratoria', unit: '/min' },
  { campo: 'temperatura', code: '8310-5', display: 'Temperatura corporal', unit: 'Cel' },
  { campo: 'spo2', code: '2708-6', display: 'Saturación de oxígeno', unit: '%' },
  { campo: 'peso', code: '29463-7', display: 'Peso corporal', unit: 'kg' },
  { campo: 'talla', code: '8302-2', display: 'Estatura', unit: 'cm' },
  { campo: 'imc', code: '39156-5', display: 'Índice de masa corporal', unit: 'kg/m2' },
  { campo: 'glucometria', code: '2339-0', display: 'Glucosa', unit: 'mg/dL' },
]

/** Observation[] de signos vitales (numéricos + TA como componentes). */
export function signosAFHIR(patientId: string, notaId: string, s: SignosVitales | undefined, fecha: string): Recurso[] {
  if (!s) return []
  const out: Recurso[] = []
  for (const v of LOINC_VITALES) {
    const valor = s[v.campo]
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      out.push({
        resourceType: 'Observation', id: `${notaId}-obs-${v.code}`, status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: v.code, display: v.display }] },
        subject: { reference: `Patient/${patientId}` }, effectiveDateTime: fecha,
        valueQuantity: { value: valor, unit: v.unit, system: 'http://unitsofmeasure.org' },
      })
    }
  }
  // Tensión arterial "120/80" → componentes sistólica/diastólica
  const m = (s.ta ?? '').match(/(\d+)\s*\/\s*(\d+)/)
  if (m) {
    out.push({
      resourceType: 'Observation', id: `${notaId}-obs-bp`, status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
      code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Presión arterial' }] },
      subject: { reference: `Patient/${patientId}` }, effectiveDateTime: fecha,
      component: [
        { code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Sistólica' }] }, valueQuantity: { value: Number(m[1]), unit: 'mm[Hg]' } },
        { code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastólica' }] }, valueQuantity: { value: Number(m[2]), unit: 'mm[Hg]' } },
      ],
    })
  }
  return out
}

/** Todos los recursos derivados de una nota. */
export function notaAFHIR(patientId: string, nota: NotaMedica): Recurso[] {
  const notaId = nota.id ?? 'nota'
  const fecha = nota.fechaConsulta || nota.createdAt || ''
  return [
    ...(nota.diagnosticos ?? []).map((d, i) => diagnosticoAFHIR(patientId, notaId, d, i)),
    ...(nota.medicamentos ?? []).map((m, i) => medicamentoAFHIR(patientId, notaId, m, i)),
    ...signosAFHIR(patientId, notaId, nota.signosVitales, fecha),
  ]
}

/** Bundle FHIR (collection) con el paciente y todo su expediente mapeado. */
export function bundlePaciente(p: Patient, notas: NotaMedica[]): Recurso {
  const recursos: Recurso[] = [
    pacienteAFHIR(p),
    ...alergiasAFHIR(p.id, p.alergias),
    ...notas.flatMap(n => notaAFHIR(p.id, n)),
  ]
  return {
    resourceType: 'Bundle',
    type: 'collection',
    total: recursos.length,
    entry: recursos.map(r => ({ resource: r })),
  }
}
