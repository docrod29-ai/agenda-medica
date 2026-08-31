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
import {
  executeTrustedReconciliation,
  safetyFindingFromTrustedExecution,
} from '@/lib/clinical-reasoning/trusted-execution'

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

/**
 * The consultation layer exposes deterministic reconciliation only through the
 * repository-owned trusted executor. Callers cannot provide an arbitrary
 * JavaScript function and have it certified as a clinical engine result.
 */
export function runTrustedConsultationReconciliation(
  input: Parameters<typeof executeTrustedReconciliation>[0],
) {
  return executeTrustedReconciliation(input)
}

/**
 * Converts a trusted execution into a safety finding without allowing the HTTP
 * caller/model to self-attest deterministic provenance.
 */
export function buildTrustedConsultationSafetyFinding(
  input: Parameters<typeof safetyFindingFromTrustedExecution>[0],
): SafetyFinding {
  return safetyFindingFromTrustedExecution(input)
}
