import type { ClinicalDocument, ClinicalFact, EncounterTruth, TruthState } from '../clinical-truth'
import { assertSourceFacts } from '../clinical-truth'

export const REASONING_CLAIM_KINDS = ['deterministic','model_hypothesis'] as const
export type ReasoningClaimKind = (typeof REASONING_CLAIM_KINDS)[number]
export type EvidenceSupport = 'supported'|'unsupported'|'lookup_failed'|'not_requested'
export type ClinicianDisposition = 'pending'|'accepted'|'rejected'|'corrected'
export type SafetySeverity = 'P0'|'P1'|'P2'|'P3'

export interface EvidenceReference {
  id: string
  source: string
  supportsClaimId: string
  retrievedAt?: string
  versionDate?: string
}

export interface ReasoningClaim {
  id: string
  kind: ReasoningClaimKind
  text: string
  sourceFactIds: string[]
  evidenceSupport: EvidenceSupport
  evidenceReferenceIds?: string[]
  uncertainty?: string
}

export interface SafetyFinding {
  id: string
  severity: SafetySeverity
  trigger: string
  sourceFactIds: string[]
  requiresClinicianReview: boolean
}

export interface ClinicianDispositionEvent {
  disposition: ClinicianDisposition
  recordedAt: string
  clinicianId: string
  correction?: string
}

export interface ClinicalReasoningEnvelope {
  id: string
  patientId: string
  encounterId: string
  sourceFactIds: string[]
  question: string
  claims: ReasoningClaim[]
  evidenceReferences: EvidenceReference[]
  safetyFindings: SafetyFinding[]
  unresolved: { factId: string; state: Extract<TruthState,'INFERIDO'|'INCIERTO'|'CONFLICTIVO'|'NO_DOCUMENTADO'|'NO_INTERROGADO'|'DESCONOCIDO'>; reason?: string }[]
  limitedMode?: 'model_unavailable'|'evidence_unavailable'|'insufficient_patient_data'
  dispositionHistory: ClinicianDispositionEvent[]
}

function cloneFact<T>(fact: ClinicalFact<T>): ClinicalFact<T> {
  return { ...fact, provenance: { ...fact.provenance }, conflictsWith: fact.conflictsWith ? [...fact.conflictsWith] : undefined }
}

export function createReasoningEnvelope(input: {
  id: string
  encounter: EncounterTruth
  question: string
  sourceFactIds: string[]
  claims?: ReasoningClaim[]
  evidenceReferences?: EvidenceReference[]
  safetyFindings?: SafetyFinding[]
  limitedMode?: ClinicalReasoningEnvelope['limitedMode']
}): ClinicalReasoningEnvelope {
  if (!input.id.trim() || !input.question.trim()) throw new Error('Reasoning id and question are required')
  assertSourceFacts(input.encounter, input.sourceFactIds)
  const sourceSet = new Set(input.sourceFactIds)
  const claims = (input.claims ?? []).map((claim) => ({ ...claim, sourceFactIds: [...claim.sourceFactIds], evidenceReferenceIds: claim.evidenceReferenceIds ? [...claim.evidenceReferenceIds] : undefined }))
  const refs = (input.evidenceReferences ?? []).map((ref) => ({ ...ref }))
  const refMap = new Map(refs.map((ref) => [ref.id, ref]))

  for (const claim of claims) {
    if (!claim.id.trim() || !claim.text.trim()) throw new Error('Reasoning claims require id and text')
    if (!claim.sourceFactIds.length) throw new Error(`Reasoning claim ${claim.id} requires sourceFactIds`)
    for (const factId of claim.sourceFactIds) if (!sourceSet.has(factId)) throw new Error(`Reasoning claim ${claim.id} references a fact outside the envelope: ${factId}`)
    if (claim.evidenceSupport === 'supported') {
      if (!claim.evidenceReferenceIds?.length) throw new Error(`Supported claim ${claim.id} requires evidence references`)
      for (const refId of claim.evidenceReferenceIds) {
        const ref = refMap.get(refId)
        if (!ref || ref.supportsClaimId !== claim.id) throw new Error(`Unsupported citation ${refId} for claim ${claim.id}`)
      }
    }
    if (claim.evidenceSupport === 'lookup_failed' && claim.evidenceReferenceIds?.length) throw new Error('Evidence lookup failure cannot carry supporting citations')
  }

  const safetyFindings = (input.safetyFindings ?? []).map((finding) => ({ ...finding, sourceFactIds: [...finding.sourceFactIds] }))
  for (const finding of safetyFindings) {
    for (const factId of finding.sourceFactIds) if (!sourceSet.has(factId)) throw new Error(`Safety finding ${finding.id} references a fact outside the envelope: ${factId}`)
    if ((finding.severity === 'P0' || finding.severity === 'P1') && !finding.requiresClinicianReview) throw new Error(`${finding.severity} safety findings require clinician review`)
  }

  const unresolved = input.encounter.facts
    .filter((fact) => sourceSet.has(fact.id) && ['INFERIDO','INCIERTO','CONFLICTIVO','NO_DOCUMENTADO','NO_INTERROGADO','DESCONOCIDO'].includes(fact.truthState))
    .map((fact) => ({ factId: fact.id, state: fact.truthState as ClinicalReasoningEnvelope['unresolved'][number]['state'], reason: fact.uncertaintyReason }))

  const limitedMode = input.limitedMode ?? (input.sourceFactIds.length === 0 ? 'insufficient_patient_data' : undefined)

  return {
    id: input.id,
    patientId: input.encounter.patientId,
    encounterId: input.encounter.encounterId,
    sourceFactIds: [...input.sourceFactIds],
    question: input.question,
    claims,
    evidenceReferences: refs,
    safetyFindings,
    unresolved,
    limitedMode,
    dispositionHistory: [],
  }
}

export function recordClinicianDisposition(envelope: ClinicalReasoningEnvelope, event: ClinicianDispositionEvent): ClinicalReasoningEnvelope {
  if (!event.clinicianId.trim() || Number.isNaN(Date.parse(event.recordedAt))) throw new Error('Valid clinician disposition metadata is required')
  if (event.disposition === 'corrected' && !event.correction?.trim()) throw new Error('Corrected disposition requires correction text')
  return { ...envelope, dispositionHistory: [...envelope.dispositionHistory, { ...event }] }
}

/** Reasoning is read-only with respect to canonical truth and signed documents. */
export function snapshotReasoningInputs(encounter: EncounterTruth, document?: ClinicalDocument): { encounter: EncounterTruth; document?: ClinicalDocument } {
  return {
    encounter: { ...encounter, facts: encounter.facts.map(cloneFact) },
    document: document ? { ...document, versions: document.versions.map((v) => ({ ...v, sourceFactIds: [...v.sourceFactIds] })) } : undefined,
  }
}
