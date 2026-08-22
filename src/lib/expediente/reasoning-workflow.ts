import type { EncounterTruth } from '@/lib/clinical-truth'
import {
  createReasoningEnvelope,
  type CanonicalEvidenceBundle,
  type ClinicalReasoningEnvelope,
  type EvidenceReference,
  type ReasoningClaim,
  type SafetyFinding,
  type ScopedClinicalDocument,
} from '@/lib/clinical-reasoning'

/**
 * Production-facing consultation bridge for the canonical reasoning envelope.
 *
 * It deliberately owns ZERO clinical policy: no parser, truth model, evidence
 * validator or safety engine is reimplemented here. The consultation workflow
 * passes the already-canonical primitives into the single reasoning boundary.
 */
export interface ConsultationReasoningInput {
  id: string
  clinicId: string
  encounter: EncounterTruth
  question: string
  sourceFactIds: string[]
  claims?: ReasoningClaim[]
  evidenceReferences?: EvidenceReference[]
  canonicalEvidence?: CanonicalEvidenceBundle
  safetyFindings?: SafetyFinding[]
  documents?: ScopedClinicalDocument[]
  limitedMode?: ClinicalReasoningEnvelope['limitedMode']
}

export function buildConsultationReasoningEnvelope(input: ConsultationReasoningInput): ClinicalReasoningEnvelope {
  return createReasoningEnvelope(input)
}
