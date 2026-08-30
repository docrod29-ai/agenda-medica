/**
 * Exportación del expediente clínico de un paciente al formato HL7 FHIR R4.
 *
 * Cumple:
 *  - OMS Digital Health 2024 (interoperabilidad)
 *  - NOM-040-SSA3-2014 (información en salud)
 *  - Lineamientos del SISESP (SSA)
 *
 * Genera un Bundle FHIR con:
 *  - Patient
 *  - Practitioner (médico tratante)
 *  - Composition (por cada nota firmada)
 *  - Condition (diagnósticos)
 *  - MedicationRequest (recetas)
 *  - Observation (signos vitales)
 *  - AllergyIntolerance
 *
 * Spec: https://hl7.org/fhir/R4/
 */

import type { Patient as AmPatient, ClinicConfig } from '@/types'
import { verificationStatusDe, clinicalStatusDe } from '@/lib/fhir/la-certeza-que-sale-al-mundo'
import { alergiasDe } from '@/lib/seguridad/alergias'
import type { NotaMedica } from '@/types/expediente'
import { TIPO_EGRESO_LABEL, type Internamiento, type RegistroSignos } from '@/types/hospital'

/** Categoría FHIR de una alergia. Mismo mapa que usaba la otra implementación. */
const CATEGORIA_FHIR: Record<string, string> = {
  medicamento: 'medication', alimento: 'food', ambiental: 'environment', otro: 'biologic',
}

/** Tipos FHIR mínimos usados */
interface FhirReference { reference: string; display?: string }
interface FhirCoding { system?: string; code?: string; display?: string }
interface FhirCodeableConcept { coding?: FhirCoding[]; text?: string }
interface FhirIdentifier { system?: string; value: string }

interface FhirResource { resourceType: string; id: string; [k: string]: unknown }
interface FhirBundle {
  resourceType: 'Bundle'
  type: 'collection'
  timestamp: string
  entry: { fullUrl: string; resource: FhirResource }[]
}

const SYSTEM = {
  cie10: 'http://hl7.org/fhir/sid/icd-10',
  loinc: 'http://loinc.org',
  ucum: 'http://unitsofmeasure.org', // sistema de unidades UCUM (obligatorio en valueQuantity FHIR)
  curp: 'urn:oid:2.16.840.1.113883.4.629', // OID provisional para CURP MX
  cedula: 'urn:oid:2.16.840.1.113883.4.629.1', // OID provisional para cédula profesional
} as const

// Código UCUM por unidad "humana". FHIR exige `system` + `code` UCUM en valueQuantity;
// antes solo poníamos `unit` (display), que no es interoperable.
const UCUM: Record<string, string> = {
  'mmHg': 'mm[Hg]', '/min': '/min', 'Cel': 'Cel', '%': '%',
  'kg': 'kg', 'cm': 'cm', 'mg/dL': 'mg/dL',
}
function cantidad(value: number | undefined, unidad: string) {
  const q: Record<string, unknown> = { value, unit: unidad }
  if (UCUM[unidad]) { q.system = SYSTEM.ucum; q.code = UCUM[unidad] }
  return q
}

/** CIE-10 con punto tras el 3er carácter (J189 → J18.9) — formato canónico FHIR sid/icd-10. */
function normCie10(code?: string): string | undefined {
  if (!code) return code
  const c = code.trim().toUpperCase().replace(/\./g, '')
  return c.length > 3 ? `${c.slice(0, 3)}.${c.slice(3)}` : c
}

/** Parsea "120/80" (o "120 / 80") → {sis, dia}. null si no es un par válido. */
function parseTA(ta?: string): { sis: number; dia: number } | null {
  if (!ta) return null
  const m = ta.match(/(\d{2,3})\s*\/\s*(\d{2,3})/)
  return m ? { sis: Number(m[1]), dia: Number(m[2]) } : null
}

/** Observation de Tensión arterial como PANEL con componentes sistólica/diastólica (FHIR/LOINC 85354-9). */
function observacionTA(id: string, patientId: string, ta: string, fecha: string, encId?: string): FhirResource | null {
  const p = parseTA(ta)
  const base: FhirResource = {
    resourceType: 'Observation', id, status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] } as FhirCodeableConcept],
    code: { coding: [{ system: SYSTEM.loinc, code: '85354-9', display: 'Tensión arterial' }], text: 'Tensión arterial' } as FhirCodeableConcept,
    subject: { reference: patientId } as FhirReference,
    effectiveDateTime: fecha,
  }
  if (encId) base.encounter = { reference: encId } as FhirReference
  if (p) {
    base.component = [
      { code: { coding: [{ system: SYSTEM.loinc, code: '8480-6', display: 'Presión sistólica' }] } as FhirCodeableConcept, valueQuantity: cantidad(p.sis, 'mmHg') },
      { code: { coding: [{ system: SYSTEM.loinc, code: '8462-4', display: 'Presión diastólica' }] } as FhirCodeableConcept, valueQuantity: cantidad(p.dia, 'mmHg') },
    ]
  } else {
    base.valueString = ta // no parseable: se conserva el texto original
  }
  return base
}

/**
 * Construye un Bundle FHIR con el expediente del paciente.
 */
export function exportarPacienteAFhir({
  paciente, notas, config,
}: {
  paciente: AmPatient
  notas: NotaMedica[]
  config: ClinicConfig | null
}): FhirBundle {
  const patientId = `Patient/${paciente.id}`
  const practitionerId = `Practitioner/${config?.cedulaProfesional || 'unknown'}`
  const now = new Date().toISOString()

  const entries: { fullUrl: string; resource: FhirResource }[] = []

  // === Patient ===
  const patientResource: FhirResource = {
    resourceType: 'Patient',
    id: paciente.id,
    identifier: paciente.curp ? [{ system: SYSTEM.curp, value: paciente.curp } as FhirIdentifier] : [],
    active: true,
    name: [{ use: 'official', text: paciente.nombre }],
    telecom: [
      paciente.telefono ? { system: 'phone', value: paciente.telefono, use: 'mobile' } : null,
      paciente.whatsapp ? { system: 'phone', value: paciente.whatsapp, use: 'mobile' } : null,
      paciente.email ? { system: 'email', value: paciente.email } : null,
    ].filter(Boolean),
    gender: paciente.sexo === 'Masculino' ? 'male' : paciente.sexo === 'Femenino' ? 'female' : 'other',
    birthDate: paciente.fechaNacimiento || undefined,
    extension: [
      paciente.avisoPrivacidad?.aceptado
        ? {
            url: 'https://agenda-medica/ext/aviso-privacidad',
            valueString: `${paciente.avisoPrivacidad.versionAviso} aceptado en ${paciente.avisoPrivacidad.fechaAceptacion} via ${paciente.avisoPrivacidad.medioAceptacion}`,
          }
        : null,
    ].filter(Boolean),
  }
  entries.push({ fullUrl: patientId, resource: patientResource })

  // === Practitioner (médico tratante) ===
  if (config) {
    entries.push({
      fullUrl: practitionerId,
      resource: {
        resourceType: 'Practitioner',
        id: config.cedulaProfesional || 'unknown',
        identifier: [{ system: SYSTEM.cedula, value: config.cedulaProfesional || 'sin-cedula' }],
        active: true,
        name: [{ use: 'official', text: config.nombreMedico || 'Médico' }],
        qualification: config.especialidad
          ? [{
              code: { text: config.especialidad } as FhirCodeableConcept,
              issuer: { display: 'DGP/SEP — Dirección General de Profesiones' },
            }]
          : [],
      },
    })
  }

  /**
   * ── ALERGIAS: UNA POR ALÉRGENO, NO UNA CADENA ────────────────────────────
   *
   * Aquí iba **un solo** `AllergyIntolerance` con todo el texto libre dentro
   * («penicilina, mariscos, yodo»). Un sistema receptor que quiera cruzar una
   * receta contra las alergias no puede hacer nada con eso: le llega un
   * párrafo donde esperaba una lista.
   *
   * La otra implementación FHIR del repositorio —la que usaba la ruta HTTP—
   * sí las emitía una a una, con categoría y criticidad. Al unificar en una
   * sola implementación, lo bueno de cada una se queda.
   *
   * `alergiasDe` prefiere las estructuradas y, si no hay, deriva del texto
   * libre: no se pierde nada de lo que ya estaba escrito.
   */
  const alergiasEstr = alergiasDe(paciente)
  for (const [i, a] of alergiasEstr.entries()) {
    entries.push({
      fullUrl: `AllergyIntolerance/${paciente.id}-alg-${i}`,
      resource: {
        resourceType: 'AllergyIntolerance',
        id: `${paciente.id}-alg-${i}`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] } as FhirCodeableConcept,
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] } as FhirCodeableConcept,
        ...(a.tipo ? { category: [CATEGORIA_FHIR[a.tipo] ?? 'biologic'] } : {}),
        // Sólo se declara criticidad cuando el expediente la trae: «alta» por
        // defecto llenaría de alarmas al receptor, y «baja» las apagaría.
        ...(a.severidad === 'grave' ? { criticality: 'high' } : a.severidad === 'moderada' ? { criticality: 'low' } : {}),
        patient: { reference: patientId, display: paciente.nombre } as FhirReference,
        code: { text: a.alergeno } as FhirCodeableConcept,
        ...(a.reaccion ? { reaction: [{ manifestation: [{ text: a.reaccion }] }] } : {}),
        recordedDate: paciente.updatedAt,
      } as FhirResource,
    })
  }

  // El texto libre entero, además, cuando no se pudo descomponer en alérgenos:
  // perder lo que el médico escribió sería peor que repetirlo.
  if (alergiasEstr.length === 0 && paciente.alergias && paciente.alergias.trim()) {
    entries.push({
      fullUrl: `AllergyIntolerance/${paciente.id}-alergias`,
      resource: {
        resourceType: 'AllergyIntolerance',
        id: `${paciente.id}-alergias`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] } as FhirCodeableConcept,
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] } as FhirCodeableConcept,
        patient: { reference: patientId, display: paciente.nombre } as FhirReference,
        code: { text: paciente.alergias } as FhirCodeableConcept,
        recordedDate: paciente.updatedAt,
      },
    })
  }

  // === Por cada nota firmada: Composition + Conditions + MedicationRequests + Observations ===
  for (const nota of notas.filter(n => n.estado === 'firmada')) {
    const fechaNota = nota.fechaConsulta || nota.metadata.fechaCreacion

    // Composition (la nota como documento clínico estructurado)
    const compositionId = `note-${nota.id}`
    const compositionEntries: { reference: string }[] = []

    // Condiciones (diagnósticos)
    nota.diagnosticos?.forEach((dx, i) => {
      const condId = `Condition/${nota.id}-dx-${i}`
      const condResource: FhirResource = {
        resourceType: 'Condition',
        id: `${nota.id}-dx-${i}`,
        /**
         * Los dos ternarios que había aquí aplanaban tres distinciones y
         * afirmaban tres cosas falsas (REG-372): un `definitivo` del MODELO
         * salía como `confirmed`, un `descartado` salía como `provisional`, y
         * una enfermedad `cronico` salía como **`resolved`**. El criterio vive
         * en un módulo puro con sus casos.
         */
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: clinicalStatusDe(dx) }] } as FhirCodeableConcept,
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: verificationStatusDe(dx) }] } as FhirCodeableConcept,
        code: dx.codigoCIE10
          ? { coding: [{ system: SYSTEM.cie10, code: normCie10(dx.codigoCIE10), display: dx.descripcion }], text: dx.descripcion } as FhirCodeableConcept
          : { text: dx.descripcion } as FhirCodeableConcept,
        subject: { reference: patientId, display: paciente.nombre } as FhirReference,
        recordedDate: fechaNota,
      }
      entries.push({ fullUrl: condId, resource: condResource })
      compositionEntries.push({ reference: condId })
    })

    // Medicamentos prescritos
    nota.medicamentos?.forEach((med, i) => {
      const medId = `MedicationRequest/${nota.id}-med-${i}`
      const medResource: FhirResource = {
        resourceType: 'MedicationRequest',
        id: `${nota.id}-med-${i}`,
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: { text: `${med.nombre} ${med.dosis}`.trim() } as FhirCodeableConcept,
        subject: { reference: patientId } as FhirReference,
        authoredOn: fechaNota,
        requester: { reference: practitionerId } as FhirReference,
        dosageInstruction: [{
          text: `${med.frecuencia}${med.duracion ? ` por ${med.duracion}` : ''}${med.indicacion ? ` — ${med.indicacion}` : ''}`,
          route: { text: med.via } as FhirCodeableConcept,
        }],
      }
      entries.push({ fullUrl: medId, resource: medResource })
      compositionEntries.push({ reference: medId })
    })

    // Signos vitales (Observations)
    const sv = nota.signosVitales
    if (sv) {
      // Tensión arterial como PANEL con componentes sistólica/diastólica
      // (antes: parseFloat("120/80") = 120 → se PERDÍA la diastólica).
      if (sv.ta) {
        const taObs = observacionTA(`${nota.id}-obs-ta`, patientId, sv.ta, fechaNota)
        if (taObs) { entries.push({ fullUrl: `Observation/${nota.id}-obs-ta`, resource: taObs }); compositionEntries.push({ reference: `Observation/${nota.id}-obs-ta` }) }
      }
      const obs: Array<{ codigo: string; display: string; valor: number; unidad: string }> = []
      if (sv.fc) obs.push({ codigo: '8867-4', display: 'Frecuencia cardiaca', valor: sv.fc, unidad: '/min' })
      if (sv.fr) obs.push({ codigo: '9279-1', display: 'Frecuencia respiratoria', valor: sv.fr, unidad: '/min' })
      if (sv.temperatura) obs.push({ codigo: '8310-5', display: 'Temperatura corporal', valor: sv.temperatura, unidad: 'Cel' })
      // SpO2 unificado con la API FHIR (fhir/recursos.ts): LOINC 2708-6 canónico
      // de signos vitales (antes 59408-5 aquí → conflicto de código entre mappers).
      if (sv.spo2) obs.push({ codigo: '2708-6', display: 'Saturación de oxígeno', valor: sv.spo2, unidad: '%' })
      if (sv.peso) obs.push({ codigo: '29463-7', display: 'Peso', valor: sv.peso, unidad: 'kg' })
      if (sv.talla) obs.push({ codigo: '8302-2', display: 'Talla', valor: sv.talla, unidad: 'cm' })
      // Dolor/EVA 0-10 (LOINC 72514-3) — L6: no perder el dato capturado en la nota.
      if (sv.escalaDolor != null) obs.push({ codigo: '72514-3', display: 'Dolor — escala numérica verbal 0-10', valor: sv.escalaDolor, unidad: '{score}' })

      obs.forEach((o, i) => {
        const obsId = `Observation/${nota.id}-obs-${i}`
        entries.push({
          fullUrl: obsId,
          resource: {
            resourceType: 'Observation',
            id: `${nota.id}-obs-${i}`,
            status: 'final',
            category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] } as FhirCodeableConcept],
            code: { coding: [{ system: SYSTEM.loinc, code: o.codigo, display: o.display }] } as FhirCodeableConcept,
            subject: { reference: patientId } as FhirReference,
            effectiveDateTime: fechaNota,
            valueQuantity: cantidad(o.valor, o.unidad),
          },
        })
        compositionEntries.push({ reference: obsId })
      })
    }

    // Composition (documento clínico)
    const seccionesNarrativa = nota.secciones?.map(s => `<h3>${s.label}</h3><p>${escapeXml(s.value)}</p>`).join('\n') ?? ''
    entries.push({
      fullUrl: `Composition/${compositionId}`,
      resource: {
        resourceType: 'Composition',
        id: compositionId,
        status: 'final',
        type: { text: 'Nota clínica' } as FhirCodeableConcept,
        subject: { reference: patientId } as FhirReference,
        date: fechaNota,
        author: [{ reference: practitionerId } as FhirReference],
        title: nota.tipo || 'Nota clínica',
        attester: nota.firma
          ? [{
              mode: 'professional',
              time: nota.firma.timestamp,
              party: { reference: practitionerId } as FhirReference,
            }]
          : [],
        section: compositionEntries.length > 0 ? [{
          title: 'Datos clínicos relacionados',
          entry: compositionEntries,
        }] : [],
        text: {
          status: 'generated',
          div: `<div xmlns="http://www.w3.org/1999/xhtml">${seccionesNarrativa}</div>`,
        },
      },
    })
  }

  /**
   * ── LOS BORRADORES YA NO SE CAEN EN SILENCIO ─────────────────────────────
   *
   * El bucle de arriba filtra `estado === 'firmada'`. Todo lo demás
   * desaparecía **sin decirlo**: el titular que ejercía su derecho de
   * portabilidad recibía un archivo llamado «expediente» con huecos que nadie
   * le señalaba. Y no es un caso raro: una consulta interrumpida, una nota que
   * se está redactando, o el propio pase de UCI antes de firmarse.
   *
   * Se exportan con `status: 'preliminary'`, que es la palabra que **FHIR ya
   * tiene** para esto (`preliminary | final | amended | entered-in-error`). No
   * hace falta inventar nada: el estándar distingue el borrador del documento.
   *
   * ── LO QUE NO SE EXPORTA DE UN BORRADOR ──────────────────────────────────
   *
   * Sólo el documento, nunca sus `Condition` ni sus `MedicationRequest`. Un
   * diagnóstico sacado de una nota sin firmar entraría al sistema receptor
   * como un diagnóstico confirmado, con el mismo peso que uno firmado — que es
   * exactamente lo que la firma existe para impedir. El texto viaja; la
   * afirmación clínica estructurada, no.
   */
  for (const nota of notas.filter(n => n.estado !== 'firmada')) {
    const seccionesNarrativa = nota.secciones?.map(s => `<h3>${s.label}</h3><p>${escapeXml(s.value)}</p>`).join('\n') ?? ''
    entries.push({
      fullUrl: `Composition/note-${nota.id}`,
      resource: {
        resourceType: 'Composition',
        id: `note-${nota.id}`,
        status: 'preliminary',
        type: { text: 'Nota clínica (borrador, sin firmar)' } as FhirCodeableConcept,
        subject: { reference: patientId } as FhirReference,
        date: nota.fechaConsulta || nota.metadata.fechaCreacion,
        author: [{ reference: practitionerId } as FhirReference],
        title: nota.tipo || 'Nota clínica',
        // Sin firma no hay atestación: dejarla vacía es la verdad.
        attester: [],
        section: [],
        text: {
          status: 'generated',
          div: `<div xmlns="http://www.w3.org/1999/xhtml">${seccionesNarrativa}</div>`,
        },
      },
    })
  }

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: now,
    entry: entries,
  }
}

/**
 * Cuántas notas van firmadas y cuántas como borrador.
 *
 * Se calcula aparte para que la pantalla pueda **decirlo antes de descargar**:
 * un archivo llamado «expediente» que lleva borradores dentro tiene que
 * anunciarlo, y uno que los dejaba fuera tenía que anunciarlo todavía más.
 */
export function resumenNotasExportadas(notas: readonly { estado?: string }[]): { firmadas: number; borradores: number } {
  return {
    firmadas: notas.filter(n => n.estado === 'firmada').length,
    borradores: notas.filter(n => n.estado !== 'firmada').length,
  }
}

export const POR_QUE_EL_BORRADOR_NO_LLEVA_DIAGNOSTICOS =
  'Un diagnóstico sacado de una nota sin firmar entraría al sistema receptor ' +
  'como un diagnóstico confirmado, con el mismo peso que uno firmado — que es ' +
  'exactamente lo que la firma existe para impedir. El texto viaja; la ' +
  'afirmación clínica estructurada, no.'

/**
 * Bundle FHIR de un EPISODIO de internamiento: Patient + notas (reutiliza lo anterior)
 * + Encounter (inpatient) + MedicationRequest (indicaciones) + MedicationAdministration
 * (MAR, ciclo cerrado) + Observation (signos vitales seriados).
 */
export function exportarInternamientoAFhir({
  paciente, internamiento, notas, signos, config,
}: {
  paciente: AmPatient
  internamiento: Internamiento
  notas: NotaMedica[]
  signos: RegistroSignos[]
  config: ClinicConfig | null
}): FhirBundle {
  const base = exportarPacienteAFhir({ paciente, notas, config })
  const entries = [...base.entry]
  const patientId = `Patient/${paciente.id}`
  const encId = `Encounter/${internamiento.id}`

  // === Encounter (internamiento) ===
  entries.push({
    fullUrl: encId,
    resource: {
      resourceType: 'Encounter',
      id: internamiento.id,
      status: internamiento.estado === 'egresado' ? 'finished' : 'in-progress',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' } as FhirCoding,
      subject: { reference: patientId, display: paciente.nombre } as FhirReference,
      period: { start: internamiento.fechaIngreso, end: internamiento.fechaEgreso },
      reasonCode: [internamiento.cie10
        ? { coding: [{ system: SYSTEM.cie10, code: normCie10(internamiento.cie10), display: internamiento.diagnosticoIngreso }], text: internamiento.diagnosticoIngreso } as FhirCodeableConcept
        : { text: internamiento.diagnosticoIngreso } as FhirCodeableConcept],
      serviceType: { text: internamiento.servicio } as FhirCodeableConcept,
      location: internamiento.cama ? [{ location: { display: `Cama ${internamiento.cama}` } as FhirReference }] : [],
      hospitalization: internamiento.tipoEgreso ? { dischargeDisposition: { text: TIPO_EGRESO_LABEL[internamiento.tipoEgreso] } as FhirCodeableConcept } : undefined,
    },
  })

  // === MedicationRequest (indicaciones) + MedicationAdministration (MAR) ===
  ;(internamiento.indicaciones ?? []).filter(i => i.tipo === 'medicamento').forEach((ind, idx) => {
    const mrId = `MedicationRequest/${internamiento.id}-ind-${idx}`
    entries.push({
      fullUrl: mrId,
      resource: {
        resourceType: 'MedicationRequest',
        id: `${internamiento.id}-ind-${idx}`,
        status: ind.activa ? 'active' : 'stopped',
        intent: 'order',
        medicationCodeableConcept: { text: ind.descripcion } as FhirCodeableConcept,
        subject: { reference: patientId } as FhirReference,
        encounter: { reference: encId } as FhirReference,
        authoredOn: ind.fecha,
        dosageInstruction: ind.frecuencia ? [{ text: ind.frecuencia }] : [],
        // Verificación farmacéutica (ciclo cerrado)
        extension: ind.verificadaFarmacia ? [{ url: 'https://agenda-medica/ext/verificacion-farmacia', valueString: `verificada por ${ind.verificadaPor ?? ''} el ${ind.fechaVerificacion ?? ''}` }] : [],
      },
    })
    ind.administraciones.forEach((a, ai) => {
      entries.push({
        fullUrl: `MedicationAdministration/${internamiento.id}-ind-${idx}-adm-${ai}`,
        resource: {
          resourceType: 'MedicationAdministration',
          id: `${internamiento.id}-ind-${idx}-adm-${ai}`,
          status: a.estado === 'administrado' ? 'completed' : 'not-done',
          medicationCodeableConcept: { text: ind.descripcion } as FhirCodeableConcept,
          subject: { reference: patientId } as FhirReference,
          context: { reference: encId } as FhirReference,
          effectiveDateTime: a.fecha,
          request: { reference: mrId } as FhirReference,
          performer: a.por ? [{ actor: { display: a.por } as FhirReference }] : [],
        },
      })
    })
  })

  // === Observation (signos vitales seriados) ===
  const SV_LOINC: Record<string, { codigo: string; display: string; unidad: string }> = {
    fc: { codigo: '8867-4', display: 'Frecuencia cardiaca', unidad: '/min' },
    fr: { codigo: '9279-1', display: 'Frecuencia respiratoria', unidad: '/min' },
    temp: { codigo: '8310-5', display: 'Temperatura corporal', unidad: 'Cel' },
    spo2: { codigo: '2708-6', display: 'Saturación de oxígeno', unidad: '%' },
    glucosa: { codigo: '2339-0', display: 'Glucosa', unidad: 'mg/dL' },
  }
  ;(signos ?? []).forEach((s, si) => {
    if (s.ta) {
      const taObs = observacionTA(`${internamiento.id}-sv-${si}-ta`, patientId, s.ta, s.fecha, encId)
      if (taObs) entries.push({ fullUrl: `Observation/${internamiento.id}-sv-${si}-ta`, resource: taObs })
    }
    for (const k of ['fc', 'fr', 'temp', 'spo2', 'glucosa'] as const) {
      const val = s[k]
      if (val == null) continue
      const m = SV_LOINC[k]
      entries.push({
        fullUrl: `Observation/${internamiento.id}-sv-${si}-${k}`,
        resource: {
          resourceType: 'Observation', id: `${internamiento.id}-sv-${si}-${k}`, status: 'final',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] } as FhirCodeableConcept],
          code: { coding: [{ system: SYSTEM.loinc, code: m.codigo, display: m.display }] } as FhirCodeableConcept,
          subject: { reference: patientId } as FhirReference, encounter: { reference: encId } as FhirReference,
          effectiveDateTime: s.fecha, valueQuantity: cantidad(val, m.unidad),
        },
      })
    }
    // L6 (decisión del Dr): NO perder datos clínicos capturados en el round-trip FHIR.
    // Cada uno como su propia Observation con su LOINC.
    const vsCat = [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] } as FhirCodeableConcept]
    const obsBase = (suf: string, code: string, display: string) => ({
      resourceType: 'Observation' as const, id: `${internamiento.id}-sv-${si}-${suf}`, status: 'final' as const,
      category: vsCat, code: { coding: [{ system: SYSTEM.loinc, code, display }] } as FhirCodeableConcept,
      subject: { reference: patientId } as FhirReference, encounter: { reference: encId } as FhirReference,
      effectiveDateTime: s.fecha,
    })
    // Dolor / EVA 0-10 (LOINC 72514-3)
    if (s.dolor != null) entries.push({ fullUrl: `Observation/${internamiento.id}-sv-${si}-dolor`,
      resource: { ...obsBase('dolor', '72514-3', 'Dolor — escala numérica verbal 0-10'), valueQuantity: cantidad(s.dolor, '{score}') } })
    // Conciencia ACVPU (LOINC 80288-4) — se conserva la letra/valor REAL (no A=0/resto=3)
    if (s.conciencia != null) entries.push({ fullUrl: `Observation/${internamiento.id}-sv-${si}-acvpu`,
      resource: { ...obsBase('acvpu', '80288-4', 'Nivel de conciencia (ACVPU)'), valueString: String(s.conciencia) } })
    // O2 suplementario: sí/no siempre; flujo (3151-8) y FiO2 (3150-0) si se conocen
    if (s.oxigeno != null) entries.push({ fullUrl: `Observation/${internamiento.id}-sv-${si}-o2`,
      resource: { ...obsBase('o2', '3150-1', 'Oxígeno suplementario'), valueBoolean: s.oxigeno } })
    if (s.oxigenoFlujoLpm != null) entries.push({ fullUrl: `Observation/${internamiento.id}-sv-${si}-o2flujo`,
      resource: { ...obsBase('o2flujo', '3151-8', 'Flujo de O₂ inhalado'), valueQuantity: cantidad(s.oxigenoFlujoLpm, 'L/min') } })
    if (s.oxigenoFiO2 != null) entries.push({ fullUrl: `Observation/${internamiento.id}-sv-${si}-fio2`,
      resource: { ...obsBase('fio2', '3150-0', 'Concentración inspirada de O₂ (FiO₂)'), valueQuantity: cantidad(s.oxigenoFiO2, '%') } })
  })

  return { resourceType: 'Bundle', type: 'collection', timestamp: base.timestamp, entry: entries }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
