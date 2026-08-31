import type { EncounterTruth } from '@/lib/clinical-truth'

const PRIVILEGED_REASONING_KEYS = [
  'canonicalEvidence',
  'evidenceValidationToken',
  'safetyFindings',
  'engineExecution',
] as const

/**
 * HTTP is an untrusted transport, even when the authenticated physician owns the
 * browser. The browser may send the current non-privileged Clinical Truth draft
 * and model hypotheses, but it may never self-attest canonical evidence,
 * deterministic execution, or safety-engine findings.
 */
export function assertReasoningHttpBoundary(input: {
  pathPatientId: string
  encounter: EncounterTruth
  body: Record<string, unknown>
}): void {
  if (!input.pathPatientId.trim()) throw new Error('patientId route scope is required')
  if (input.encounter.patientId !== input.pathPatientId) {
    throw new Error('Reasoning encounter patient does not match the patient in the consultation URL')
  }

  for (const key of PRIVILEGED_REASONING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input.body, key)) {
      throw new Error(`${key} is server-only and cannot be supplied by the HTTP caller`)
    }
  }
}
