export const TRUTH_STATES = [
  'NEGADO',
  'NO_INTERROGADO',
  'NO_DOCUMENTADO',
  'DESCONOCIDO',
  'INFERIDO',
  'INCIERTO',
  'CONFLICTIVO',
] as const

export type TruthState = (typeof TRUTH_STATES)[number]

export const PROVENANCE_SOURCES = [
  'dictation',
  'typed_text',
  'imported_result',
  'device_system',
  'clinician_correction',
  'other',
] as const

export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number]

export interface Provenance {
  source: ProvenanceSource
  capturedAt: string
  sourceId?: string
  actorId?: string
  encounterId?: string
}

export interface ClinicalFact<T = unknown> {
  id: string
  concept: string
  value?: T
  truthState: TruthState
  provenance: Provenance
  confidence?: number
  uncertaintyReason?: string
  conflictsWith?: string[]
}

export interface EncounterTruth {
  encounterId: string
  patientId: string
  facts: ClinicalFact[]
  updatedAt: string
}

export type DocumentStatus = 'draft' | 'signed' | 'amended'

export interface ClinicalDocumentVersion {
  version: number
  status: DocumentStatus
  content: string
  createdAt: string
  createdBy: string
  sourceFactIds: string[]
  supersedesVersion?: number
  amendmentReason?: string
}

export interface ClinicalDocument {
  id: string
  encounterId: string
  versions: ClinicalDocumentVersion[]
}

export interface ClinicianPreferenceCorrection {
  clinicianId: string
  preferenceKey: string
  preferredValue: string
  recordedAt: string
  sourceDocumentId?: string
}

function assertIsoDate(value: string, field: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid timestamp`)
}

export function validateClinicalFact(fact: ClinicalFact): ClinicalFact {
  if (!fact.id.trim()) throw new Error('ClinicalFact.id is required')
  if (!fact.concept.trim()) throw new Error('ClinicalFact.concept is required')
  if (!TRUTH_STATES.includes(fact.truthState)) throw new Error('ClinicalFact.truthState is invalid')
  if (!fact.provenance?.source || !PROVENANCE_SOURCES.includes(fact.provenance.source)) {
    throw new Error('ClinicalFact.provenance.source is required')
  }
  assertIsoDate(fact.provenance.capturedAt, 'ClinicalFact.provenance.capturedAt')

  if (fact.confidence !== undefined && (fact.confidence < 0 || fact.confidence > 1)) {
    throw new Error('ClinicalFact.confidence must be between 0 and 1')
  }

  if (fact.truthState === 'INFERIDO' || fact.truthState === 'INCIERTO') {
    if (!fact.uncertaintyReason?.trim()) {
      throw new Error(`${fact.truthState} facts require uncertaintyReason`)
    }
  }

  if (fact.truthState === 'CONFLICTIVO' && !fact.conflictsWith?.length) {
    throw new Error('CONFLICTIVO facts require conflictsWith')
  }

  return fact
}

/**
 * Adds a fact without silently replacing prior clinical truth.
 * Same-concept, different-value established facts are preserved and marked as conflicting.
 */
export function appendClinicalFact(encounter: EncounterTruth, incoming: ClinicalFact): EncounterTruth {
  validateClinicalFact(incoming)
  if (incoming.provenance.encounterId && incoming.provenance.encounterId !== encounter.encounterId) {
    throw new Error('Fact provenance encounterId does not match EncounterTruth')
  }

  const duplicateId = encounter.facts.some((fact) => fact.id === incoming.id)
  if (duplicateId) throw new Error(`ClinicalFact.id already exists: ${incoming.id}`)

  const candidates = encounter.facts.filter((fact) =>
    fact.concept === incoming.concept &&
    fact.truthState !== 'NO_INTERROGADO' &&
    fact.truthState !== 'NO_DOCUMENTADO' &&
    fact.truthState !== 'DESCONOCIDO'
  )

  const conflicting = candidates.filter((fact) => JSON.stringify(fact.value) !== JSON.stringify(incoming.value))
  let nextIncoming = incoming
  let nextFacts = encounter.facts

  if (conflicting.length > 0) {
    const conflictIds = conflicting.map((fact) => fact.id)
    nextIncoming = {
      ...incoming,
      truthState: 'CONFLICTIVO',
      conflictsWith: [...new Set([...(incoming.conflictsWith ?? []), ...conflictIds])],
    }
    nextFacts = encounter.facts.map((fact) =>
      conflictIds.includes(fact.id)
        ? {
            ...fact,
            truthState: 'CONFLICTIVO' as const,
            conflictsWith: [...new Set([...(fact.conflictsWith ?? []), incoming.id])],
          }
        : fact,
    )
  }

  return {
    ...encounter,
    facts: [...nextFacts, nextIncoming],
    updatedAt: incoming.provenance.capturedAt,
  }
}

/**
 * Prevents generated documentation from asserting a clinical fact that is not in the encounter truth.
 * Renderers must provide the exact source fact IDs used to support their output.
 */
export function assertSourceFacts(encounter: EncounterTruth, sourceFactIds: string[]): void {
  const known = new Set(encounter.facts.map((fact) => fact.id))
  const unsupported = sourceFactIds.filter((id) => !known.has(id))
  if (unsupported.length) throw new Error(`Unsupported source facts: ${unsupported.join(', ')}`)
}

export function createDraftDocument(input: {
  id: string
  encounter: EncounterTruth
  content: string
  sourceFactIds: string[]
  createdAt: string
  createdBy: string
}): ClinicalDocument {
  assertIsoDate(input.createdAt, 'createdAt')
  assertSourceFacts(input.encounter, input.sourceFactIds)
  return {
    id: input.id,
    encounterId: input.encounter.encounterId,
    versions: [{
      version: 1,
      status: 'draft',
      content: input.content,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      sourceFactIds: [...input.sourceFactIds],
    }],
  }
}

export function signDocument(document: ClinicalDocument, signedAt: string, signedBy: string): ClinicalDocument {
  assertIsoDate(signedAt, 'signedAt')
  const current = document.versions.at(-1)
  if (!current) throw new Error('Document has no versions')
  if (current.status !== 'draft') throw new Error('Only a draft document can be signed')

  return {
    ...document,
    versions: [
      ...document.versions.slice(0, -1),
      { ...current, status: 'signed', createdAt: signedAt, createdBy: signedBy },
    ],
  }
}

export function amendSignedDocument(input: {
  document: ClinicalDocument
  encounter: EncounterTruth
  content: string
  sourceFactIds: string[]
  reason: string
  createdAt: string
  createdBy: string
}): ClinicalDocument {
  assertIsoDate(input.createdAt, 'createdAt')
  assertSourceFacts(input.encounter, input.sourceFactIds)
  const current = input.document.versions.at(-1)
  if (!current) throw new Error('Document has no versions')
  if (current.status !== 'signed' && current.status !== 'amended') {
    throw new Error('Only signed/amended documents can be amended')
  }
  if (!input.reason.trim()) throw new Error('Amendment reason is required')

  const next: ClinicalDocumentVersion = {
    version: current.version + 1,
    status: 'amended',
    content: input.content,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    sourceFactIds: [...input.sourceFactIds],
    supersedesVersion: current.version,
    amendmentReason: input.reason,
  }

  return { ...input.document, versions: [...input.document.versions, next] }
}

/**
 * Preference learning is intentionally a side-channel: this function returns a preference record only
 * and has no capability to mutate EncounterTruth.
 */
export function recordClinicianPreference(correction: ClinicianPreferenceCorrection): ClinicianPreferenceCorrection {
  assertIsoDate(correction.recordedAt, 'recordedAt')
  if (!correction.clinicianId.trim() || !correction.preferenceKey.trim()) {
    throw new Error('Clinician preference identity and key are required')
  }
  return Object.freeze({ ...correction })
}
