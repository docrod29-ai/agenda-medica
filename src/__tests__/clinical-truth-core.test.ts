import { describe, expect, it } from 'vitest'
import {
  amendSignedDocument,
  appendClinicalFact,
  assertSourceFacts,
  createDraftDocument,
  recordClinicianPreference,
  signDocument,
  validateClinicalFact,
  type ClinicalFact,
  type EncounterTruth,
} from '@/lib/clinical-truth'

const timestamp = '2026-08-17T15:00:00.000Z'

function fact(overrides: Partial<ClinicalFact> = {}): ClinicalFact {
  return {
    id: 'fact-1', concept: 'allergy.penicillin', value: true, truthState: 'NEGADO',
    provenance: { source: 'dictation', capturedAt: timestamp, encounterId: 'enc-1' },
    ...overrides,
  }
}

function encounter(facts: ClinicalFact[] = []): EncounterTruth {
  return { encounterId: 'enc-1', patientId: 'patient-1', facts, updatedAt: timestamp }
}

describe('Clinical Truth core', () => {
  it('requires provenance so generated truth cannot become anonymous', () => {
    expect(() => validateClinicalFact({ ...fact(), provenance: undefined as never })).toThrow(/provenance.source/)
  })

  it('requires explicit uncertainty for inferred and uncertain facts', () => {
    expect(() => validateClinicalFact(fact({ truthState: 'INFERIDO' }))).toThrow(/uncertaintyReason/)
    expect(() => validateClinicalFact(fact({ truthState: 'INCIERTO' }))).toThrow(/uncertaintyReason/)
    expect(validateClinicalFact(fact({ truthState: 'INFERIDO', uncertaintyReason: 'Contextual inference from dictation' }))).toBeTruthy()
  })

  it('preserves conflicting facts instead of silently overwriting clinical truth', () => {
    const first = fact({ id: 'fact-a', value: 'amoxicillin', truthState: 'NEGADO' })
    const second = fact({ id: 'fact-b', value: 'penicillin', truthState: 'INCIERTO', uncertaintyReason: 'Audio ambiguity' })
    const next = appendClinicalFact(encounter([first]), second)
    expect(next.facts).toHaveLength(2)
    expect(next.facts[0]).toMatchObject({ id: 'fact-a', truthState: 'CONFLICTIVO', conflictsWith: ['fact-b'] })
    expect(next.facts[1]).toMatchObject({ id: 'fact-b', truthState: 'CONFLICTIVO', conflictsWith: ['fact-a'] })
  })

  it('rejects unsupported renderer fact IDs (NO INVENTAR boundary)', () => {
    expect(() => assertSourceFacts(encounter([fact()]), ['fact-1', 'invented-fact'])).toThrow(/Unsupported source facts: invented-fact/)
  })

  it('keeps signed content immutable and creates an auditable amendment version', () => {
    const truth = encounter([fact()])
    const draft = createDraftDocument({ id: 'doc-1', encounter: truth, content: 'Original', sourceFactIds: ['fact-1'], createdAt: timestamp, createdBy: 'clinician-1' })
    const signed = signDocument(draft, '2026-08-17T15:01:00.000Z', 'clinician-1')
    const amended = amendSignedDocument({ document: signed, encounter: truth, content: 'Corrected', sourceFactIds: ['fact-1'], reason: 'Clinician correction', createdAt: '2026-08-17T15:02:00.000Z', createdBy: 'clinician-1' })
    expect(signed.versions).toHaveLength(1)
    expect(signed.versions[0]).toMatchObject({ status: 'signed', content: 'Original' })
    expect(amended.versions).toHaveLength(2)
    expect(amended.versions[0].content).toBe('Original')
    expect(amended.versions[1]).toMatchObject({ version: 2, status: 'amended', content: 'Corrected', supersedesVersion: 1, amendmentReason: 'Clinician correction' })
  })

  it('keeps clinician preference learning separate from clinical truth', () => {
    const truth = encounter([fact()])
    const snapshot = JSON.stringify(truth)
    const preference = recordClinicianPreference({ clinicianId: 'clinician-1', preferenceKey: 'document.style.assessment', preferredValue: 'concise', recordedAt: timestamp, sourceDocumentId: 'doc-1' })
    expect(preference.preferredValue).toBe('concise')
    expect(JSON.stringify(truth)).toBe(snapshot)
  })
})
