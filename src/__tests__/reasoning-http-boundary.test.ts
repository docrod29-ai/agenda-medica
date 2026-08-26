import { describe, expect, it } from 'vitest'
import type { EncounterTruth } from '@/lib/clinical-truth'
import { assertReasoningHttpBoundary } from '@/lib/expediente/reasoning-http-boundary'

const encounter: EncounterTruth = {
  encounterId: 'enc-http-boundary',
  patientId: 'patient-a',
  updatedAt: '2026-08-23T18:00:00.000Z',
  facts: [{
    id: 'fact-1',
    concept: 'synthetic-problem',
    value: 'synthetic non-PHI fixture',
    truthState: 'INFERIDO',
    uncertaintyReason: 'test fixture',
    provenance: {
      source: 'typed_text',
      capturedAt: '2026-08-23T18:00:00.000Z',
      encounterId: 'enc-http-boundary',
    },
  }],
}

describe('consultation reasoning HTTP boundary', () => {
  it('binds the reasoning encounter to the patient in the consultation URL', () => {
    expect(() => assertReasoningHttpBoundary({
      pathPatientId: 'patient-b',
      encounter,
      body: { clinicId: 'clinic-1' },
    })).toThrow(/does not match the patient in the consultation URL/)
  })

  it.each(['canonicalEvidence', 'evidenceValidationToken', 'safetyFindings', 'engineExecution'])(
    'rejects caller-supplied privileged provenance: %s',
    (key) => {
      expect(() => assertReasoningHttpBoundary({
        pathPatientId: 'patient-a',
        encounter,
        body: { clinicId: 'clinic-1', [key]: [] },
      })).toThrow(/server-only/)
    },
  )

  it('allows the current patient-scoped non-privileged draft to cross the transport boundary', () => {
    expect(() => assertReasoningHttpBoundary({
      pathPatientId: 'patient-a',
      encounter,
      body: { clinicId: 'clinic-1', claims: [], evidenceReferences: [] },
    })).not.toThrow()
  })
})
