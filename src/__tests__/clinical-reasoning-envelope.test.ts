import { describe, expect, it } from 'vitest'
import type { ClinicalDocument, EncounterTruth } from '@/lib/clinical-truth'
import {
  createReasoningEnvelope,
  deterministicClaimFromRegisteredEngine,
  evidenceReferenceFromClaim,
  evidenceReferenceFromSource,
  evidenceSetDigest,
  executeRegisteredEngine,
  issueEvidenceValidationToken,
  recordClinicianDisposition,
  safetyFindingFromRegisteredEngine,
  snapshotReasoningInputs,
} from '@/lib/clinical-reasoning'
import { reconciliar } from '@/lib/uci/reconciliacion'
import { claimDesde, fechaPublicacionDesde, fuente } from '@/types/evidence'

const CLINIC = 'clinic-1'

const encounter: EncounterTruth = {
  encounterId: 'enc-1',
  patientId: 'pat-1',
  updatedAt: '2026-08-17T20:00:00Z',
  facts: [
    {
      id: 'f1', concept: 'temperature', value: 39, truthState: 'INFERIDO',
      uncertaintyReason: 'dictated value pending confirmation',
      provenance: { source: 'dictation', capturedAt: '2026-08-17T20:00:00Z', encounterId: 'enc-1' },
    },
    {
      id: 'f2', concept: 'allergy', value: 'penicillin', truthState: 'CONFLICTIVO', conflictsWith: ['f3'],
      provenance: { source: 'typed_text', capturedAt: '2026-08-17T20:00:01Z', encounterId: 'enc-1' },
    },
    {
      id: 'f3', concept: 'allergy', value: 'none', truthState: 'CONFLICTIVO', conflictsWith: ['f2'],
      provenance: { source: 'clinician_correction', capturedAt: '2026-08-17T20:00:02Z', encounterId: 'enc-1', correctsFactId: 'f2' },
    },
  ],
}

function signedDocument(overrides: Partial<ClinicalDocument> = {}): ClinicalDocument {
  return {
    id: 'doc-1',
    encounterId: 'enc-1',
    versions: [{ version: 1, status: 'signed', content: 'signed', createdAt: '2026-08-17T20:00:00Z', createdBy: 'doc-1', sourceFactIds: ['f2'] }],
    ...overrides,
  }
}

function canonicalEvidence(reasoningClaimId = 'c-evidence', text = 'start antibiotic after clinician review') {
  const literalPassage = 'This synthetic non-PHI evidence passage says start antibiotic after clinician review when clinically appropriate.'
  const made = fuente({
    proveedor: 'pubmed',
    idExterno: '12345',
    titulo: 'Synthetic non-PHI evidence fixture',
    publicado: fechaPublicacionDesde('2026'),
    recuperadoEn: '2026-08-17T21:00:00Z',
    textoRecuperado: `Background sentence. ${literalPassage} Closing sentence.`,
  })
  if (!made.ok) throw new Error(made.detalle)

  const canonical = claimDesde({ texto: text, citas: [1], pasajes: [literalPassage] }, [made.valor])
  if (!canonical.ok) throw new Error(canonical.detalle)

  const ref = evidenceReferenceFromClaim({
    id: 'e-pubmed',
    source: made.valor,
    claim: canonical.valor,
    supportsClaimId: reasoningClaimId,
  })
  return { source: made.valor, claim: canonical.valor, ref }
}

function executedReconciliation() {
  return executeRegisteredEngine({
    engineId: 'uci-reconciliacion',
    entryPoint: 'reconciliar',
    sourceFactIds: ['f1'],
    execute: reconciliar,
    args: ['driving pressure', 20, 14, 'cmH2O'],
  })
}

describe('clinical reasoning envelope core invariants', () => {
  it('preserves inference and conflicts from Clinical Truth without relabeling truth state', () => {
    const envelope = createReasoningEnvelope({ id: 'r1', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1', 'f2', 'f3'] })
    expect(envelope.unresolved.map((u) => u.state)).toEqual(expect.arrayContaining(['INFERIDO', 'CONFLICTIVO']))
    expect(envelope.openConflictIds).toEqual(['f2', 'f3'])
    expect(encounter.facts[0].truthState).toBe('INFERIDO')
  })

  it('blocks claims whose source facts are outside the canonical envelope', () => {
    expect(() => createReasoningEnvelope({
      id: 'r2', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f2'], evidenceSupport: 'not_requested' }],
    })).toThrow(/outside the envelope/)
  })

  it('does not convert evidence provider failure into support', () => {
    expect(() => createReasoningEnvelope({
      id: 'r4', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'], limitedMode: 'evidence_unavailable',
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'lookup_failed', evidenceReferenceIds: ['e1'] }],
      evidenceReferences: [{ id: 'e1', source: 'provider', supportsClaimId: 'c1' }],
    })).toThrow(/lookup failure/)
  })

  it('requires clinician review for P0/P1 safety findings', () => {
    expect(() => createReasoningEnvelope({
      id: 'r5', clinicId: CLINIC, encounter, question: 'safety', sourceFactIds: ['f1'],
      safetyFindings: [{ id: 's1', severity: 'P1', trigger: 'deterministic safety rule', sourceFactIds: ['f1'], requiresClinicianReview: false }],
    })).toThrow(/P1 safety findings require clinician review/)
  })

  it('retains clinician rejection/correction as lineage', () => {
    const base = createReasoningEnvelope({ id: 'r6', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'] })
    const rejected = recordClinicianDisposition(base, { disposition: 'rejected', recordedAt: '2026-08-17T20:01:00Z', clinicianId: 'doc-1' })
    const corrected = recordClinicianDisposition(rejected, { disposition: 'corrected', recordedAt: '2026-08-17T20:02:00Z', clinicianId: 'doc-1', correction: 'different interpretation' })
    expect(corrected.dispositionHistory.map((event) => event.disposition)).toEqual(['rejected', 'corrected'])
  })
})

describe('P1: supported evidence must be canonical Claim/Passage evidence', () => {
  it('preserves Source metadata without letting metadata self-attest support', () => {
    const { source } = canonicalEvidence()
    const metadataOnly = evidenceReferenceFromSource({ id: 'e-meta', source, supportsClaimId: 'c1' })
    expect(metadataOnly.sourceId).toBe('pubmed:12345')
    expect(metadataOnly.canonicalClaimId).toBeUndefined()
    expect(() => createReasoningEnvelope({
      id: 'r-self-attested', clinicId: CLINIC, encounter, question: 'plan', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', claimType: 'treatment_recommendation', text: 'start antibiotic', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: ['e-meta'] }],
      evidenceReferences: [metadataOnly],
    })).toThrow(/canonical validated Claim\/Passage evidence/)
  })

  it('rejects arbitrary synthetic citation metadata even when supportsClaimId matches', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-fake-citation', clinicId: CLINIC, encounter, question: 'plan', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', claimType: 'treatment_recommendation', text: 'start antibiotic', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: ['e1'] }],
      evidenceReferences: [{ id: 'e1', source: 'guideline', supportsClaimId: 'c1' }],
    })).toThrow(/canonical validated Claim\/Passage evidence/)
  })

  it('accepts support only after the canonical Claim is revalidated against literal Passage(s)', () => {
    const text = 'start antibiotic after clinician review'
    const evidence = canonicalEvidence('c-tx', text)
    const envelope = createReasoningEnvelope({
      id: 'r-evidence-ok', clinicId: CLINIC, encounter, question: 'plan', sourceFactIds: ['f1'],
      claims: [{ id: 'c-tx', kind: 'model_hypothesis', claimType: 'treatment_recommendation', text, sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: [evidence.ref.id] }],
      evidenceReferences: [evidence.ref],
      canonicalEvidence: { sources: [evidence.source], claims: [evidence.claim] },
    })
    expect(envelope.claims[0].evidenceSupport).toBe('supported')
    expect(envelope.evidenceReferences[0].passageIds).toHaveLength(1)
  })

  it('rejects a canonical evidence binding when reasoning text does not match the validated Claim', () => {
    const evidence = canonicalEvidence('c-tx', 'start antibiotic after clinician review')
    expect(() => createReasoningEnvelope({
      id: 'r-evidence-text-swap', clinicId: CLINIC, encounter, question: 'plan', sourceFactIds: ['f1'],
      claims: [{ id: 'c-tx', kind: 'model_hypothesis', claimType: 'treatment_recommendation', text: 'double the antibiotic dose', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: [evidence.ref.id] }],
      evidenceReferences: [evidence.ref],
      canonicalEvidence: { sources: [evidence.source], claims: [evidence.claim] },
    })).toThrow(/text is not bound to the canonical evidence claim/)
  })
})

describe('P1: deterministic reasoning requires an actually executed registered engine', () => {
  it('binds identity, registry version, entry point and exact output', () => {
    const execution = executedReconciliation()
    const deterministic = deterministicClaimFromRegisteredEngine({
      id: 'c-det', execution, text: 'reconciliation engine produced a discrepancy', sourceFactIds: ['f1'],
    })
    const envelope = createReasoningEnvelope({
      id: 'r-det', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'], claims: [deterministic],
    })
    expect(envelope.claims[0].engineId).toBe('uci-reconciliacion')
    expect(envelope.claims[0].engineExecution?.entryPoint).toBe('reconciliar')
    expect(envelope.claims[0].engineExecution?.outputDigest).toBe(execution.outputDigest)
  })

  it('rejects a caller that merely names a registered engine', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-fake-det', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c-fake', kind: 'deterministic', engineId: 'uci-reconciliacion', text: 'caller text pretending to be an engine result', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' }],
    })).toThrow(/requires an executed registered engine result/)
  })

  it('rejects an unknown or mismatched registered entry point before execution', () => {
    expect(() => executeRegisteredEngine({
      engineId: 'uci-reconciliacion', entryPoint: 'inventedEntryPoint', sourceFactIds: ['f1'], execute: reconciliar, args: ['x', 1, 1, 'unit'],
    })).toThrow(/is not registered/)
  })

  it('still rejects model output carrying deterministic engine provenance', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-shadow', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c-model', kind: 'model_hypothesis', engineId: 'uci-reconciliacion', text: 'model output', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' }],
    })).toThrow(/cannot claim deterministic engine provenance/)
  })
})

describe('P1: runtime labels fail closed', () => {
  it('rejects an invented kind such as observed_fact', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-bad-kind', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c-bad', kind: 'observed_fact' as never, text: 'must never become observed truth', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' }],
    })).toThrow(/kind is invalid/)
  })

  it('rejects unknown claim type and evidence-support labels from cast or JSON input', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-bad-type', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c-bad', kind: 'model_hypothesis', claimType: 'prescription_fact' as never, text: 'x', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' }],
    })).toThrow(/type is invalid/)
    expect(() => createReasoningEnvelope({
      id: 'r-bad-support', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c-bad', kind: 'model_hypothesis', text: 'x', sourceFactIds: ['f1'], evidenceSupport: 'verified_by_model' as never }],
    })).toThrow(/evidence support is invalid/)
  })
})

describe('P1: snapshots are deeply immutable with respect to Clinical Truth', () => {
  it('deep-clones nested fact objects and arrays, not only top-level fields', () => {
    const nestedEncounter: EncounterTruth = {
      encounterId: 'enc-nested', patientId: 'pat-nested', updatedAt: '2026-08-17T20:00:00Z',
      facts: [{
        id: 'f-nested', concept: 'medication-context',
        value: { medications: [{ name: 'amoxicillin', dose: { value: 500, unit: 'mg' } }], flags: ['reported'] },
        truthState: 'INFERIDO', uncertaintyReason: 'synthetic non-PHI fixture',
        provenance: { source: 'typed_text', capturedAt: '2026-08-17T20:00:00Z', encounterId: 'enc-nested' },
      }],
    }
    const snapshot = snapshotReasoningInputs({ clinicId: CLINIC, encounter: nestedEncounter })
    const snapValue = snapshot.encounter.facts[0].value as { medications: { name: string; dose: { value: number; unit: string } }[]; flags: string[] }
    snapValue.medications[0].dose.value = 999
    snapValue.flags.push('mutated')

    const original = nestedEncounter.facts[0].value as { medications: { dose: { value: number } }[]; flags: string[] }
    expect(original.medications[0].dose.value).toBe(500)
    expect(original.flags).toEqual(['reported'])
  })

  it('also clones signed document versions', () => {
    const signed = signedDocument({ versions: [{ version: 1, status: 'signed', content: 'signed', createdAt: '2026-08-17T20:00:00Z', createdBy: 'doc-1', sourceFactIds: ['f1'] }] })
    const snapshot = snapshotReasoningInputs({ clinicId: CLINIC, encounter, document: { clinicId: CLINIC, document: signed } })
    if (snapshot.document) snapshot.document.versions[0].sourceFactIds.push('mutated')
    expect(signed.versions[0].sourceFactIds).toEqual(['f1'])
  })
})

describe('reasoning envelope keeps prior tenant and identity boundaries', () => {
  it('rejects a signed document from another clinic or encounter', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-foreign-clinic', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      documents: [{ clinicId: 'clinic-2', document: signedDocument() }],
    })).toThrow(/belongs to another clinic/)
    expect(() => createReasoningEnvelope({
      id: 'r-foreign-enc', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      documents: [{ clinicId: CLINIC, document: signedDocument({ id: 'doc-other', encounterId: 'enc-999' }) }],
    })).toThrow(/belongs to another encounter/)
  })

  it('rejects duplicate source, evidence and claim identifiers', () => {
    expect(() => createReasoningEnvelope({ id: 'r-dup-fact', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1', 'f1'] })).toThrow(/Duplicate source fact id/)
    expect(() => createReasoningEnvelope({
      id: 'r-dup-ref', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      evidenceReferences: [{ id: 'e1', source: 'a', supportsClaimId: 'c1' }, { id: 'e1', source: 'b', supportsClaimId: 'c1' }],
    })).toThrow(/Duplicate evidence reference id/)
    expect(() => createReasoningEnvelope({
      id: 'r-dup-claim', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [
        { id: 'c1', kind: 'model_hypothesis', text: 'a', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' },
        { id: 'c1', kind: 'model_hypothesis', text: 'b', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' },
      ],
    })).toThrow(/Duplicate reasoning claim id/)
  })

  it('maps registered safety rules without introducing a shadow engine', () => {
    const finding = safetyFindingFromRegisteredEngine({
      id: 's-news2', engineId: 'news2-set', severity: 'P1', trigger: 'pre-existing engine trigger', sourceFactIds: ['f1'], requiresClinicianReview: true,
    })
    const envelope = createReasoningEnvelope({ id: 'r-safety', clinicId: CLINIC, encounter, question: 'safety', sourceFactIds: ['f1'], safetyFindings: [finding] })
    expect(envelope.safetyFindings[0].engineId).toBe('news2-set')
    expect(() => safetyFindingFromRegisteredEngine({ id: 's-shadow', engineId: 'shadow-engine', severity: 'P2', trigger: 'x', sourceFactIds: ['f1'], requiresClinicianReview: false })).toThrow(/Unknown deterministic clinical engine/)
  })
})

describe('evidence validation token remains bound to the exact reference set', () => {
  const refA = { id: 'e1', source: 'guideline', supportsClaimId: 'c1', retrievedAt: '2026-08-17T21:00:00Z' }
  const refB = { id: 'e2', source: 'other-guideline', supportsClaimId: 'c1', retrievedAt: '2026-08-17T21:00:00Z' }
  const token = issueEvidenceValidationToken({ evidenceReferences: [refA], validatedAt: '2026-08-17T21:05:00Z', validatedBy: 'doc-1' })

  it('is order-independent for the same set but changes when the set changes', () => {
    expect(evidenceSetDigest([refA, refB])).toBe(evidenceSetDigest([refB, refA]))
    expect(evidenceSetDigest([refA])).not.toBe(evidenceSetDigest([refA, refB]))
  })

  it('accepts its exact reference set and rejects substitution', () => {
    const envelope = createReasoningEnvelope({
      id: 'r-token-ok', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      evidenceReferences: [refA], evidenceValidationToken: token,
    })
    expect(envelope.evidenceValidationToken?.evidenceDigest).toBe(evidenceSetDigest([refA]))
    expect(() => createReasoningEnvelope({
      id: 'r-token-swap', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      evidenceReferences: [refB], evidenceValidationToken: token,
    })).toThrow(/token does not match this evidence set/)
  })
})
