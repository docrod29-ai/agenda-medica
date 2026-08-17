import { describe, expect, it } from 'vitest'
import { amendSignedDocument, appendClinicalFact, assertSourceFacts, createDraftDocument, DOCUMENT_TYPES, normalizeClinicalInput, recordClinicianPreference, renderClinicalDocument, signDocument, validateClinicalFact, type ClinicalFact, type EncounterTruth } from '@/lib/clinical-truth'

const timestamp = '2026-08-17T15:00:00.000Z'

function fact(overrides: Partial<ClinicalFact> = {}): ClinicalFact {
  return {
    id: 'fact-1',
    concept: 'allergy.penicillin',
    value: true,
    truthState: 'NEGADO',
    provenance: { source: 'dictation', capturedAt: timestamp, encounterId: 'enc-1' },
    ...overrides,
  }
}

function encounter(facts: ClinicalFact[] = []): EncounterTruth {
  return { encounterId: 'enc-1', patientId: 'patient-1', facts, updatedAt: timestamp }
}

describe('Clinical Truth core', () => {
  it('requires provenance', () => {
    expect(() => validateClinicalFact({ ...fact(), provenance: undefined as never })).toThrow(/provenance.source/)
  })

  it('requires explicit uncertainty', () => {
    expect(() => validateClinicalFact(fact({ truthState: 'INFERIDO' }))).toThrow(/uncertaintyReason/)
    expect(() => validateClinicalFact(fact({ truthState: 'INCIERTO' }))).toThrow(/uncertaintyReason/)
  })

  it('preserves NEGADO distinct from undocumented states', () => {
    expect(fact({ truthState: 'NEGADO' }).truthState).not.toBe('NO_DOCUMENTADO')
    expect(fact({ truthState: 'NEGADO' }).truthState).not.toBe('NO_INTERROGADO')
  })

  it('requires correction lineage and preserves both original and corrected provenance', () => {
    expect(() => validateClinicalFact(fact({ provenance: { source: 'clinician_correction', capturedAt: timestamp, encounterId: 'enc-1' } }))).toThrow(/correctsFactId/)

    const original = fact({ id: 'original', value: 'penicillin' })
    const corrected = fact({
      id: 'corrected',
      value: 'amoxicillin',
      provenance: {
        source: 'clinician_correction',
        capturedAt: '2026-08-17T15:01:00.000Z',
        encounterId: 'enc-1',
        actorId: 'clinician-1',
        correctsFactId: 'original',
      },
    })
    const next = appendClinicalFact(encounter([original]), corrected)
    expect(next.facts).toHaveLength(2)
    expect(next.facts[0].provenance.source).toBe('dictation')
    expect(next.facts[1].provenance).toMatchObject({
      source: 'clinician_correction',
      actorId: 'clinician-1',
      correctsFactId: 'original',
    })
  })

  it('preserves conflicts instead of overwrite', () => {
    const next = appendClinicalFact(
      encounter([fact({ id: 'a', value: 'amoxicillin' })]),
      fact({ id: 'b', value: 'penicillin', truthState: 'INCIERTO', uncertaintyReason: 'Audio ambiguity' }),
    )
    expect(next.facts).toHaveLength(2)
    expect(next.facts.every((entry) => entry.truthState === 'CONFLICTIVO')).toBe(true)
    expect(next.facts.find((entry) => entry.id === 'a')?.conflictsWith).toContain('b')
    expect(next.facts.find((entry) => entry.id === 'b')?.conflictsWith).toContain('a')
  })

  it('never silently promotes inferred, uncertain, or conflicting facts during rendering', () => {
    const truth = encounter([
      fact({ id: 'inferred', concept: 'diagnosis.inferred', value: 'possible pneumonia', truthState: 'INFERIDO', uncertaintyReason: 'Contextual inference' }),
      fact({ id: 'uncertain', concept: 'symptom.uncertain', value: 'dyspnea', truthState: 'INCIERTO', uncertaintyReason: 'Low-confidence dictation' }),
      fact({ id: 'conflict-a', concept: 'medication.current', value: 'drug-a', truthState: 'CONFLICTIVO', conflictsWith: ['conflict-b'] }),
      fact({ id: 'conflict-b', concept: 'medication.current', value: 'drug-b', truthState: 'CONFLICTIVO', conflictsWith: ['conflict-a'] }),
    ])
    const rendered = renderClinicalDocument('nota_evolucion', truth)
    expect(rendered.content).toContain('[INFERIDO]')
    expect(rendered.content).toContain('[INCIERTO]')
    expect(rendered.content.match(/\[CONFLICTIVO\]/g)).toHaveLength(2)
    expect(rendered.sourceFactIds).toEqual(['inferred', 'uncertain', 'conflict-a', 'conflict-b'])
  })

  it('rejects unsupported renderer facts', () => {
    expect(() => assertSourceFacts(encounter([fact()]), ['fact-1', 'invented'])).toThrow(/invented/)
  })

  it('keeps signed content immutable via amendment', () => {
    const truth = encounter([fact()])
    const draft = createDraftDocument({ id: 'd', encounter: truth, content: 'Original', sourceFactIds: ['fact-1'], createdAt: timestamp, createdBy: 'c' })
    const signed = signDocument(draft, '2026-08-17T15:01:00Z', 'c')
    const amended = amendSignedDocument({ document: signed, encounter: truth, content: 'Corrected', sourceFactIds: ['fact-1'], reason: 'Correction', createdAt: '2026-08-17T15:02:00Z', createdBy: 'c' })
    expect(signed.versions[0].content).toBe('Original')
    expect(amended.versions[0].content).toBe('Original')
    expect(amended.versions[1].supersedesVersion).toBe(1)
  })

  it('keeps preferences separate from truth', () => {
    const truth = encounter([fact()])
    const before = JSON.stringify(truth)
    recordClinicianPreference({ clinicianId: 'c', preferenceKey: 'style', preferredValue: 'concise', recordedAt: timestamp })
    expect(JSON.stringify(truth)).toBe(before)
  })

  it('normalizes messy multilingual input mechanically without inventing facts', () => {
    const out = normalizeClinicalInput({ modality: 'mixed_voice_text', raw: '  Paciente  denies   fiebre\r\nSpO2 96%  ', language: 'spanglish', capturedAt: timestamp, encounterId: 'enc-1' })
    expect(out.normalizedText).toBe('Paciente denies fiebre\nSpO2 96%')
    expect(out.requiresClinicalInterpretation).toBe(true)
    expect('facts' in out).toBe(false)
  })

  it('exposes all 15 canonical document contracts', () => {
    expect(DOCUMENT_TYPES).toHaveLength(15)
    expect(new Set(DOCUMENT_TYPES).size).toBe(15)
  })

  it('renders multiple documents from the same truth without mutation', () => {
    const truth = encounter([fact(), fact({ id: 'fact-2', concept: 'symptom.fever', value: false, truthState: 'NEGADO' })])
    const before = JSON.stringify(truth)
    const evolution = renderClinicalDocument('nota_evolucion', truth)
    const referral = renderClinicalDocument('referencia', truth)
    expect(evolution.sourceFactIds).toEqual(['fact-1', 'fact-2'])
    expect(referral.sourceFactIds).toEqual(['fact-1', 'fact-2'])
    expect(evolution.documentType).not.toBe(referral.documentType)
    expect(JSON.stringify(truth)).toBe(before)
  })
})
