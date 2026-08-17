import { describe, expect, it } from 'vitest'
import type { EncounterTruth } from '@/lib/clinical-truth'
import {
  createReasoningEnvelope,
  deterministicClaimFromRegisteredEngine,
  evidenceReferenceFromSource,
  recordClinicianDisposition,
  safetyFindingFromRegisteredEngine,
  snapshotReasoningInputs,
} from '@/lib/clinical-reasoning'
import { fechaPublicacionDesde, fuente } from '@/types/evidence'

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

  it('reuses the existing deterministic registry instead of accepting a shadow engine', () => {
    const claim = deterministicClaimFromRegisteredEngine({
      id: 'c-news2', engineId: 'news2-set', text: 'deterministic engine output', sourceFactIds: ['f1'],
    })
    expect(claim.kind).toBe('deterministic')
    expect(claim.engineId).toBe('news2-set')
    expect(() => deterministicClaimFromRegisteredEngine({
      id: 'c-shadow', engineId: 'shadow-engine', text: 'invented engine', sourceFactIds: ['f1'],
    })).toThrow(/Unknown deterministic clinical engine/)
    expect(() => createReasoningEnvelope({
      id: 'r-shadow', encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c-model', kind: 'model_hypothesis', engineId: 'news2-set', text: 'model output', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' }],
    })).toThrow(/cannot claim deterministic engine provenance/)
  })

  it('maps existing registered safety rules without choosing new clinical policy', () => {
    const finding = safetyFindingFromRegisteredEngine({
      id: 's-news2', engineId: 'news2-set', severity: 'P1', trigger: 'pre-existing engine trigger', sourceFactIds: ['f1'], requiresClinicianReview: true,
    })
    const envelope = createReasoningEnvelope({ id: 'r-safety', encounter, question: 'safety', sourceFactIds: ['f1'], safetyFindings: [finding] })
    expect(envelope.safetyFindings[0].engineId).toBe('news2-set')
    expect(() => safetyFindingFromRegisteredEngine({
      id: 's-unknown', engineId: 'shadow-engine', severity: 'P2', trigger: 'x', sourceFactIds: ['f1'], requiresClinicianReview: false,
    })).toThrow(/Unknown deterministic clinical engine/)
  })

  it('maps the existing evidence Source model while preserving retrieval and publication precision', () => {
    const made = fuente({
      proveedor: 'pubmed', idExterno: '12345', titulo: 'Synthetic non-PHI evidence fixture',
      publicado: fechaPublicacionDesde('2026'), recuperadoEn: '2026-08-17T21:00:00Z', textoRecuperado: 'Synthetic abstract text.',
    })
    expect(made.ok).toBe(true)
    if (!made.ok) return
    const ref = evidenceReferenceFromSource({ id: 'e-pubmed', source: made.valor, supportsClaimId: 'c1' })
    expect(ref.sourceId).toBe('pubmed:12345')
    expect(ref.retrievedAt).toBe('2026-08-17T21:00:00Z')
    expect(ref.versionDate).toBe('2026')
    const envelope = createReasoningEnvelope({
      id: 'r-evidence', encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: ['e-pubmed'] }],
      evidenceReferences: [ref],
    })
    expect(envelope.evidenceReferences[0].source).toBe('pubmed')
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
