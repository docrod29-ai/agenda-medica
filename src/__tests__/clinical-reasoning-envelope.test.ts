import { describe, expect, it } from 'vitest'
import type { EncounterTruth } from '@/lib/clinical-truth'
import { createReasoningEnvelope, recordClinicianDisposition, snapshotReasoningInputs } from '@/lib/clinical-reasoning'

const encounter: EncounterTruth = {
  encounterId: 'enc-1',
  patientId: 'pat-1',
  updatedAt: '2026-08-17T20:00:00Z',
  facts: [
    { id: 'f1', concept: 'temperature', value: 39, truthState: 'INFERIDO', uncertaintyReason: 'dictated value pending confirmation', provenance: { source: 'dictation', capturedAt: '2026-08-17T20:00:00Z', encounterId: 'enc-1' } },
    { id: 'f2', concept: 'allergy', value: 'penicillin', truthState: 'CONFLICTIVO', conflictsWith: ['f3'], provenance: { source: 'typed_text', capturedAt: '2026-08-17T20:00:01Z', encounterId: 'enc-1' } },
    { id: 'f3', concept: 'allergy', value: 'none', truthState: 'CONFLICTIVO', conflictsWith: ['f2'], provenance: { source: 'clinician_correction', capturedAt: '2026-08-17T20:00:02Z', encounterId: 'enc-1', correctsFactId: 'f2' } },
  ],
}

describe('clinical reasoning envelope', () => {
  it('preserves inference and conflicts from Clinical Truth without relabeling truth state', () => {
    const envelope = createReasoningEnvelope({ id: 'r1', encounter, question: 'assessment', sourceFactIds: ['f1','f2','f3'] })
    expect(envelope.unresolved.map((u) => u.state)).toEqual(expect.arrayContaining(['INFERIDO','CONFLICTIVO']))
    expect(encounter.facts[0].truthState).toBe('INFERIDO')
  })

  it('blocks claims whose provenance is outside the canonical envelope', () => {
    expect(() => createReasoningEnvelope({
      id: 'r2', encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f2'], evidenceSupport: 'not_requested' }],
    })).toThrow(/outside the envelope/)
  })

  it('cannot label evidence as supported without a matching citation', () => {
    expect(() => createReasoningEnvelope({
      id: 'r3', encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: ['e1'] }],
      evidenceReferences: [{ id: 'e1', source: 'guideline', supportsClaimId: 'different-claim' }],
    })).toThrow(/Unsupported citation/)
  })

  it('does not convert evidence provider failure into support', () => {
    expect(() => createReasoningEnvelope({
      id: 'r4', encounter, question: 'assessment', sourceFactIds: ['f1'], limitedMode: 'evidence_unavailable',
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'lookup_failed', evidenceReferenceIds: ['e1'] }],
      evidenceReferences: [{ id: 'e1', source: 'provider', supportsClaimId: 'c1' }],
    })).toThrow(/lookup failure/)
  })

  it('requires clinician review for P0/P1 safety findings even if the model is unavailable', () => {
    const envelope = createReasoningEnvelope({
      id: 'r5', encounter, question: 'safety', sourceFactIds: ['f1'], limitedMode: 'model_unavailable',
      safetyFindings: [{ id: 's1', severity: 'P1', trigger: 'deterministic safety rule', sourceFactIds: ['f1'], requiresClinicianReview: true }],
    })
    expect(envelope.safetyFindings[0].requiresClinicianReview).toBe(true)
    expect(envelope.limitedMode).toBe('model_unavailable')
  })

  it('retains clinician rejection/correction as lineage', () => {
    const base = createReasoningEnvelope({ id: 'r6', encounter, question: 'assessment', sourceFactIds: ['f1'] })
    const rejected = recordClinicianDisposition(base, { disposition: 'rejected', recordedAt: '2026-08-17T20:01:00Z', clinicianId: 'doc-1' })
    const corrected = recordClinicianDisposition(rejected, { disposition: 'corrected', recordedAt: '2026-08-17T20:02:00Z', clinicianId: 'doc-1', correction: 'different interpretation' })
    expect(corrected.dispositionHistory.map((e) => e.disposition)).toEqual(['rejected','corrected'])
  })

  it('snapshots inputs without mutating signed document or Clinical Truth', () => {
    const signed = { id: 'd1', encounterId: 'enc-1', versions: [{ version: 1, status: 'signed' as const, content: 'signed', createdAt: '2026-08-17T20:00:00Z', createdBy: 'doc-1', sourceFactIds: ['f1'] }] }
    const snap = snapshotReasoningInputs(encounter, signed)
    snap.encounter.facts[0].concept = 'changed'
    if (snap.document) snap.document.versions[0].content = 'changed'
    expect(encounter.facts[0].concept).toBe('temperature')
    expect(signed.versions[0].content).toBe('signed')
  })
})
