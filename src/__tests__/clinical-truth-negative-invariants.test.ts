import { describe, expect, it } from 'vitest'
import { appendClinicalFact, validateClinicalFact, type ClinicalFact, type EncounterTruth } from '@/lib/clinical-truth'

const capturedAt = '2026-08-17T17:30:00.000Z'

function fact(overrides: Partial<ClinicalFact> = {}): ClinicalFact {
  return {
    id: 'fact-1',
    concept: 'symptom.fever',
    truthState: 'NEGADO',
    provenance: { source: 'typed_text', capturedAt, encounterId: 'enc-1' },
    ...overrides,
  }
}

const encounter: EncounterTruth = {
  encounterId: 'enc-1',
  patientId: 'patient-1',
  facts: [],
  updatedAt: capturedAt,
}

describe('Clinical Truth negative invariants', () => {
  it.each(['NO_INTERROGADO', 'NO_DOCUMENTADO', 'DESCONOCIDO'] as const)(
    'does not allow %s to carry an asserted value',
    (truthState) => {
      expect(() => validateClinicalFact(fact({ truthState, value: 'present' }))).toThrow(/cannot assert a value/)
    },
  )

  it('requires encounter context in provenance', () => {
    expect(() => validateClinicalFact(fact({ provenance: { source: 'typed_text', capturedAt, encounterId: '' } }))).toThrow(/encounterId is required/)
  })

  it('rejects provenance from another encounter instead of silently attaching it', () => {
    expect(() => appendClinicalFact(encounter, fact({ provenance: { source: 'typed_text', capturedAt, encounterId: 'enc-other' } }))).toThrow(/does not match EncounterTruth/)
  })
})
