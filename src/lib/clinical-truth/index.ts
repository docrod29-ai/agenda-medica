export const TRUTH_STATES = ['NEGADO','NO_INTERROGADO','NO_DOCUMENTADO','DESCONOCIDO','INFERIDO','INCIERTO','CONFLICTIVO'] as const
export type TruthState = (typeof TRUTH_STATES)[number]

export const PROVENANCE_SOURCES = ['dictation','typed_text','mixed_voice_text','imported_result','device_system','clinician_correction','other'] as const
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number]

export interface Provenance { source: ProvenanceSource; capturedAt: string; encounterId: string; sourceId?: string; actorId?: string; correctsFactId?: string }
export interface ClinicalFact<T = unknown> { id: string; concept: string; value?: T; truthState: TruthState; provenance: Provenance; confidence?: number; uncertaintyReason?: string; conflictsWith?: string[] }
export interface EncounterTruth { encounterId: string; patientId: string; facts: ClinicalFact[]; updatedAt: string }
export type DocumentStatus = 'draft' | 'signed' | 'amended'
export interface ClinicalDocumentVersion { version: number; status: DocumentStatus; content: string; createdAt: string; createdBy: string; sourceFactIds: string[]; supersedesVersion?: number; amendmentReason?: string }
export interface ClinicalDocument { id: string; encounterId: string; versions: ClinicalDocumentVersion[] }
export interface ClinicianPreferenceCorrection { clinicianId: string; preferenceKey: string; preferredValue: string; recordedAt: string; sourceDocumentId?: string }

export const DOCUMENT_TYPES = ['nota_primera_vez','nota_evolucion','historia_clinica','nota_interconsulta','nota_hospitalaria','nota_uci','nota_egreso','resumen_medico','resumen_cronologico','informe_aseguradora','justificacion_medica','referencia','contrarreferencia','instrucciones_paciente','resumen_especialista'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const INPUT_MODALITIES = ['dictation','free_text','mixed_voice_text'] as const
export type InputModality = (typeof INPUT_MODALITIES)[number]
export interface ClinicalInput { modality: InputModality; raw: string; language?: 'es'|'en'|'spanglish'; capturedAt: string; actorId?: string; encounterId: string }
export interface NormalizedClinicalInput extends ClinicalInput { normalizedText: string; requiresClinicalInterpretation: true }

const NON_ASSERTING_STATES: readonly TruthState[] = ['NEGADO','NO_INTERROGADO','NO_DOCUMENTADO','DESCONOCIDO']
const ABSENCE_STATES: readonly TruthState[] = ['NO_INTERROGADO','NO_DOCUMENTADO','DESCONOCIDO']

function assertIsoDate(value: string, field: string): void { if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid timestamp`) }
export function validateClinicalFact(fact: ClinicalFact): ClinicalFact {
  if (!fact.id.trim()) throw new Error('ClinicalFact.id is required')
  if (!fact.concept.trim()) throw new Error('ClinicalFact.concept is required')
  if (!TRUTH_STATES.includes(fact.truthState)) throw new Error('ClinicalFact.truthState is invalid')
  if (!fact.provenance?.source || !PROVENANCE_SOURCES.includes(fact.provenance.source)) throw new Error('ClinicalFact.provenance.source is required')
  assertIsoDate(fact.provenance.capturedAt, 'ClinicalFact.provenance.capturedAt')
  if (!fact.provenance.encounterId?.trim()) throw new Error('ClinicalFact.provenance.encounterId is required')
  if (fact.confidence !== undefined && (fact.confidence < 0 || fact.confidence > 1)) throw new Error('ClinicalFact.confidence must be between 0 and 1')
  if (NON_ASSERTING_STATES.includes(fact.truthState) && fact.value !== undefined) throw new Error(`${fact.truthState} facts cannot assert a value`)
  if ((fact.truthState === 'INFERIDO' || fact.truthState === 'INCIERTO') && !fact.uncertaintyReason?.trim()) throw new Error(`${fact.truthState} facts require uncertaintyReason`)
  if (fact.truthState === 'CONFLICTIVO' && !fact.conflictsWith?.length) throw new Error('CONFLICTIVO facts require conflictsWith')
  if (fact.provenance.source === 'clinician_correction' && !fact.provenance.correctsFactId) throw new Error('Clinician corrections require correctsFactId provenance')
  return fact
}

export function appendClinicalFact(encounter: EncounterTruth, incoming: ClinicalFact): EncounterTruth {
  validateClinicalFact(incoming)
  if (incoming.provenance.encounterId !== encounter.encounterId) throw new Error('Fact provenance encounterId does not match EncounterTruth')
  if (encounter.facts.some((fact) => fact.id === incoming.id)) throw new Error(`ClinicalFact.id already exists: ${incoming.id}`)
  const candidates = encounter.facts.filter((fact) => fact.concept === incoming.concept && !ABSENCE_STATES.includes(fact.truthState))
  const conflicting = candidates.filter((fact) => JSON.stringify(fact.value) !== JSON.stringify(incoming.value) || fact.truthState !== incoming.truthState)
  let nextIncoming = incoming; let nextFacts = encounter.facts
  if (conflicting.length) {
    const conflictIds = conflicting.map((fact) => fact.id)
    nextIncoming = { ...incoming, truthState: 'CONFLICTIVO', conflictsWith: [...new Set([...(incoming.conflictsWith ?? []), ...conflictIds])] }
    nextFacts = encounter.facts.map((fact) => conflictIds.includes(fact.id) ? { ...fact, truthState: 'CONFLICTIVO' as const, conflictsWith: [...new Set([...(fact.conflictsWith ?? []), incoming.id])] } : fact)
  }
  return { ...encounter, facts: [...nextFacts, nextIncoming], updatedAt: incoming.provenance.capturedAt }
}

export function assertSourceFacts(encounter: EncounterTruth, sourceFactIds: string[]): void {
  const known = new Set(encounter.facts.map((fact) => fact.id)); const unsupported = sourceFactIds.filter((id) => !known.has(id))
  if (unsupported.length) throw new Error(`Unsupported source facts: ${unsupported.join(', ')}`)
}

/** Mechanical normalization only. It never turns language into clinical facts; semantic extraction belongs behind the Clinical Truth boundary. */
export function normalizeClinicalInput(input: ClinicalInput): NormalizedClinicalInput {
  assertIsoDate(input.capturedAt, 'ClinicalInput.capturedAt')
  if (!input.encounterId.trim()) throw new Error('ClinicalInput.encounterId is required')
  if (!input.raw.trim()) throw new Error('ClinicalInput.raw is required')
  const normalizedText = input.raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
  return { ...input, normalizedText, requiresClinicalInterpretation: true }
}

function factLine(fact: ClinicalFact): string {
  const value = fact.value === undefined ? '' : `: ${String(fact.value)}`
  return `${fact.concept}${value} [${fact.truthState}]`
}
export interface RenderedClinicalDocument { documentType: DocumentType; content: string; sourceFactIds: string[] }
export function renderClinicalDocument(documentType: DocumentType, encounter: EncounterTruth): RenderedClinicalDocument {
  if (!DOCUMENT_TYPES.includes(documentType)) throw new Error('Unsupported document type')
  const snapshot = encounter.facts.map((fact) => ({ ...fact, provenance: { ...fact.provenance }, conflictsWith: fact.conflictsWith ? [...fact.conflictsWith] : undefined }))
  snapshot.forEach(validateClinicalFact)
  const sourceFactIds = snapshot.map((fact) => fact.id)
  assertSourceFacts(encounter, sourceFactIds)
  const title = documentType.replaceAll('_', ' ').toUpperCase()
  return { documentType, content: `${title}\n${snapshot.map(factLine).join('\n')}`, sourceFactIds }
}

export function createDraftDocument(input: { id: string; encounter: EncounterTruth; content: string; sourceFactIds: string[]; createdAt: string; createdBy: string }): ClinicalDocument {
  assertIsoDate(input.createdAt, 'createdAt'); assertSourceFacts(input.encounter, input.sourceFactIds)
  return { id: input.id, encounterId: input.encounter.encounterId, versions: [{ version: 1, status: 'draft', content: input.content, createdAt: input.createdAt, createdBy: input.createdBy, sourceFactIds: [...input.sourceFactIds] }] }
}
export function signDocument(document: ClinicalDocument, signedAt: string, signedBy: string): ClinicalDocument {
  assertIsoDate(signedAt, 'signedAt'); const current = document.versions.at(-1); if (!current) throw new Error('Document has no versions'); if (current.status !== 'draft') throw new Error('Only a draft document can be signed')
  return { ...document, versions: [...document.versions.slice(0,-1), { ...current, status: 'signed', createdAt: signedAt, createdBy: signedBy }] }
}
export function amendSignedDocument(input: { document: ClinicalDocument; encounter: EncounterTruth; content: string; sourceFactIds: string[]; reason: string; createdAt: string; createdBy: string }): ClinicalDocument {
  assertIsoDate(input.createdAt, 'createdAt'); assertSourceFacts(input.encounter, input.sourceFactIds); const current = input.document.versions.at(-1)
  if (!current) throw new Error('Document has no versions'); if (current.status !== 'signed' && current.status !== 'amended') throw new Error('Only signed/amended documents can be amended'); if (!input.reason.trim()) throw new Error('Amendment reason is required')
  const next: ClinicalDocumentVersion = { version: current.version + 1, status: 'amended', content: input.content, createdAt: input.createdAt, createdBy: input.createdBy, sourceFactIds: [...input.sourceFactIds], supersedesVersion: current.version, amendmentReason: input.reason }
  return { ...input.document, versions: [...input.document.versions, next] }
}
export function recordClinicianPreference(correction: ClinicianPreferenceCorrection): ClinicianPreferenceCorrection {
  assertIsoDate(correction.recordedAt, 'recordedAt'); if (!correction.clinicianId.trim() || !correction.preferenceKey.trim()) throw new Error('Clinician preference identity and key are required'); return Object.freeze({ ...correction })
}
