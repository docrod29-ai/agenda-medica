import { describe, expect, it } from 'vitest'
import type { ClinicalDocument, EncounterTruth } from '@/lib/clinical-truth'
import {
  createReasoningEnvelope,
  deterministicClaimFromRegisteredEngine,
  evidenceReferenceFromSource,
  evidenceSetDigest,
  issueEvidenceValidationToken,
  recordClinicianDisposition,
  safetyFindingFromRegisteredEngine,
  snapshotReasoningInputs,
} from '@/lib/clinical-reasoning'
import { fechaPublicacionDesde, fuente } from '@/types/evidence'

const CLINIC = 'clinic-1'

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

function signedDocument(overrides: Partial<ClinicalDocument> = {}): ClinicalDocument {
  return {
    id: 'doc-1',
    encounterId: 'enc-1',
    versions: [{ version: 1, status: 'signed', content: 'signed', createdAt: '2026-08-17T20:00:00Z', createdBy: 'doc-1', sourceFactIds: ['f2'] }],
    ...overrides,
  }
}

describe('clinical reasoning envelope', () => {
  it('preserves inference and conflicts from Clinical Truth without relabeling truth state', () => {
    const envelope = createReasoningEnvelope({ id: 'r1', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1','f2','f3'] })
    expect(envelope.unresolved.map((u) => u.state)).toEqual(expect.arrayContaining(['INFERIDO','CONFLICTIVO']))
    expect(envelope.openConflictIds).toEqual(['f2','f3'])
    expect(encounter.facts[0].truthState).toBe('INFERIDO')
  })

  it('blocks claims whose provenance is outside the canonical envelope', () => {
    expect(() => createReasoningEnvelope({
      id: 'r2', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f2'], evidenceSupport: 'not_requested' }],
    })).toThrow(/outside the envelope/)
  })

  it('cannot label evidence as supported without a matching citation', () => {
    expect(() => createReasoningEnvelope({
      id: 'r3', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: ['e1'] }],
      evidenceReferences: [{ id: 'e1', source: 'guideline', supportsClaimId: 'different-claim' }],
    })).toThrow(/Unsupported citation/)
  })

  it('does not convert evidence provider failure into support', () => {
    expect(() => createReasoningEnvelope({
      id: 'r4', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'], limitedMode: 'evidence_unavailable',
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'lookup_failed', evidenceReferenceIds: ['e1'] }],
      evidenceReferences: [{ id: 'e1', source: 'provider', supportsClaimId: 'c1' }],
    })).toThrow(/lookup failure/)
  })

  it('requires clinician review for P0/P1 safety findings even if the model is unavailable', () => {
    const envelope = createReasoningEnvelope({
      id: 'r5', clinicId: CLINIC, encounter, question: 'safety', sourceFactIds: ['f1'], limitedMode: 'model_unavailable',
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
      id: 'r-shadow', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c-model', kind: 'model_hypothesis', engineId: 'news2-set', text: 'model output', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' }],
    })).toThrow(/cannot claim deterministic engine provenance/)
  })

  it('maps existing registered safety rules without choosing new clinical policy', () => {
    const finding = safetyFindingFromRegisteredEngine({
      id: 's-news2', engineId: 'news2-set', severity: 'P1', trigger: 'pre-existing engine trigger', sourceFactIds: ['f1'], requiresClinicianReview: true,
    })
    const envelope = createReasoningEnvelope({ id: 'r-safety', clinicId: CLINIC, encounter, question: 'safety', sourceFactIds: ['f1'], safetyFindings: [finding] })
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
      id: 'r-evidence', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: ['e-pubmed'] }],
      evidenceReferences: [ref],
    })
    expect(envelope.evidenceReferences[0].source).toBe('pubmed')
  })

  it('retains clinician rejection/correction as lineage', () => {
    const base = createReasoningEnvelope({ id: 'r6', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'] })
    const rejected = recordClinicianDisposition(base, { disposition: 'rejected', recordedAt: '2026-08-17T20:01:00Z', clinicianId: 'doc-1' })
    const corrected = recordClinicianDisposition(rejected, { disposition: 'corrected', recordedAt: '2026-08-17T20:02:00Z', clinicianId: 'doc-1', correction: 'different interpretation' })
    expect(corrected.dispositionHistory.map((e) => e.disposition)).toEqual(['rejected','corrected'])
  })

  it('snapshots inputs without mutating signed document or Clinical Truth', () => {
    const signed = signedDocument({ versions: [{ version: 1, status: 'signed', content: 'signed', createdAt: '2026-08-17T20:00:00Z', createdBy: 'doc-1', sourceFactIds: ['f1'] }] })
    const snap = snapshotReasoningInputs({ clinicId: CLINIC, encounter, document: { clinicId: CLINIC, document: signed } })
    snap.encounter.facts[0].concept = 'changed'
    if (snap.document) snap.document.versions[0].content = 'changed'
    expect(encounter.facts[0].concept).toBe('temperature')
    expect(signed.versions[0].content).toBe('signed')
  })
})

/**
 * P1-1 — tenant/encounter isolation of signed documents.
 *
 * Qué fallaba: `createReasoningEnvelope` no recibía documentos y
 * `snapshotReasoningInputs` aceptaba cualquier `ClinicalDocument`, así que un
 * documento firmado de OTRO consultorio u OTRO encuentro podía aportar hechos,
 * conflictos abiertos e identificadores al rastro sellado del razonamiento.
 *
 * Causa raíz: no había frontera de arrendatario en el límite de razonamiento;
 * `ClinicalDocument` sólo lleva `encounterId` y nadie lo comparaba.
 *
 * Regla que lo hace seguro: se falla cerrado ANTES de sellar cualquier id — un
 * documento fuera de alcance no aporta ni hechos, ni `openConflictIds`, ni su id.
 *
 * Qué NO cubre: no valida permisos de sesión ni reglas de Firestore; el alcance
 * autorizado sigue siendo responsabilidad del servidor que llama.
 */
describe('reasoning envelope fails closed on foreign documents', () => {
  it('rejects a signed document from another clinic before sealing lineage', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-foreign-clinic', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      documents: [{ clinicId: 'clinic-2', document: signedDocument() }],
    })).toThrow(/belongs to another clinic/)
  })

  it('rejects a signed document from another encounter before sealing lineage', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-foreign-enc', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      documents: [{ clinicId: CLINIC, document: signedDocument({ id: 'doc-other', encounterId: 'enc-999' }) }],
    })).toThrow(/belongs to another encounter/)
  })

  it('rejects a document whose facts do not belong to this encounter', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-foreign-facts', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      documents: [{ clinicId: CLINIC, document: signedDocument({ versions: [{ version: 1, status: 'signed', content: 'signed', createdAt: '2026-08-17T20:00:00Z', createdBy: 'doc-1', sourceFactIds: ['fx'] }] }) }],
    })).toThrow(/outside this encounter/)
  })

  it('rejects a foreign document through the read-only snapshot path too', () => {
    expect(() => snapshotReasoningInputs({ clinicId: CLINIC, encounter, document: { clinicId: 'clinic-2', document: signedDocument() } })).toThrow(/belongs to another clinic/)
  })

  it('seals facts, conflicts and document ids only from in-scope documents', () => {
    const envelope = createReasoningEnvelope({
      id: 'r-scoped', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      documents: [{ clinicId: CLINIC, document: signedDocument() }],
    })
    expect(envelope.documentIds).toEqual(['doc-1'])
    expect(envelope.sourceFactIds).toEqual(['f1','f2'])
    expect(envelope.openConflictIds).toEqual(['f2'])
  })
})

/**
 * P1-2 — identificadores únicos en el sello.
 *
 * Qué fallaba: los ids se colapsaban en `Set`/`Map`. Con dos referencias de
 * evidencia con el mismo id, el mapa de validación se quedaba con la última y el
 * sobre conservaba las dos: lo validado y lo guardado dejaban de coincidir.
 *
 * Regla que lo hace segura: un id repetido es un defecto, no algo que se
 * deduplique en silencio.
 *
 * Qué NO cubre: no verifica que dos ids distintos describan cosas distintas.
 */
describe('reasoning envelope rejects duplicate identifiers', () => {
  it('rejects duplicate source fact ids', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-dup-fact', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1','f1'],
    })).toThrow(/Duplicate source fact id: f1/)
  })

  it('rejects duplicate evidence reference ids instead of letting the last one win', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-dup-ref', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ id: 'c1', kind: 'model_hypothesis', text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: ['e1'] }],
      evidenceReferences: [
        { id: 'e1', source: 'guideline', supportsClaimId: 'other-claim' },
        { id: 'e1', source: 'guideline', supportsClaimId: 'c1' },
      ],
    })).toThrow(/Duplicate evidence reference id: e1/)
  })

  it('rejects duplicate reasoning claim ids', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-dup-claim', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [
        { id: 'c1', kind: 'model_hypothesis', text: 'hypothesis a', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' },
        { id: 'c1', kind: 'model_hypothesis', text: 'hypothesis b', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' },
      ],
    })).toThrow(/Duplicate reasoning claim id: c1/)
  })
})

/**
 * P1-3 — una recomendación no pasa sin apoyo material.
 *
 * Qué fallaba: una recomendación de tratamiento o de estudio podía sellarse con
 * `evidenceSupport: 'not_requested'` y cero respaldo, porque el sobre sólo exigía
 * citas cuando la afirmación YA se declaraba «supported».
 *
 * Regla que lo hace segura: lo accionable exige un origen ya confiable — motor
 * determinista registrado o el contrato de evidencia existente. No se inventa
 * política clínica nueva; se exige la que ya está.
 *
 * Qué NO cubre: no juzga si la recomendación es clínicamente correcta ni si la
 * evidencia citada realmente la sostiene.
 */
describe('recommendations require material support', () => {
  it('rejects an unsupported treatment recommendation', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-tx', clinicId: CLINIC, encounter, question: 'plan', sourceFactIds: ['f1'],
      claims: [{ id: 'c-tx', kind: 'model_hypothesis', claimType: 'treatment_recommendation', text: 'start antibiotic', sourceFactIds: ['f1'], evidenceSupport: 'not_requested' }],
    })).toThrow(/Recommendation claim c-tx requires deterministic engine provenance or supported evidence/)
  })

  it('rejects an unsupported investigation recommendation, including after evidence lookup failure', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-inv', clinicId: CLINIC, encounter, question: 'plan', sourceFactIds: ['f1'], limitedMode: 'evidence_unavailable',
      claims: [{ id: 'c-inv', kind: 'model_hypothesis', claimType: 'investigation_recommendation', text: 'order blood cultures', sourceFactIds: ['f1'], evidenceSupport: 'lookup_failed' }],
    })).toThrow(/Recommendation claim c-inv requires deterministic engine provenance or supported evidence/)
  })

  it('accepts a recommendation backed by a registered deterministic engine', () => {
    const claim = deterministicClaimFromRegisteredEngine({ id: 'c-det', engineId: 'news2-set', text: 'escalate monitoring', sourceFactIds: ['f1'] })
    const envelope = createReasoningEnvelope({
      id: 'r-det', clinicId: CLINIC, encounter, question: 'plan', sourceFactIds: ['f1'],
      claims: [{ ...claim, claimType: 'investigation_recommendation' }],
    })
    expect(envelope.claims[0].claimType).toBe('investigation_recommendation')
  })

  it('accepts a recommendation backed by the existing evidence contract', () => {
    const envelope = createReasoningEnvelope({
      id: 'r-evi-tx', clinicId: CLINIC, encounter, question: 'plan', sourceFactIds: ['f1'],
      claims: [{ id: 'c-tx', kind: 'model_hypothesis', claimType: 'treatment_recommendation', text: 'start antibiotic', sourceFactIds: ['f1'], evidenceSupport: 'supported', evidenceReferenceIds: ['e1'] }],
      evidenceReferences: [{ id: 'e1', source: 'guideline', supportsClaimId: 'c-tx' }],
    })
    expect(envelope.claims[0].evidenceSupport).toBe('supported')
  })
})

/**
 * P1-4 — el token de validación de evidencia se ata al conjunto exacto.
 *
 * Qué fallaba: nada ligaba una validación de evidencia a lo que se validó, así
 * que un token emitido para un conjunto podía viajar con otro conjunto —o con el
 * mismo conjunto ya editado— y seguir pareciendo válido.
 *
 * Regla que lo hace segura: el token lleva una huella determinista de las
 * identidades de la evidencia y se vuelve a comprobar al sellar.
 *
 * Qué NO cubre: la huella FNV-1a detecta sustitución y edición, no es un MAC
 * criptográfico y no resiste a un adversario que busque colisiones.
 */
describe('evidence validation token binds to its exact evidence set', () => {
  const refA = { id: 'e1', source: 'guideline', supportsClaimId: 'c1', retrievedAt: '2026-08-17T21:00:00Z' }
  const refB = { id: 'e2', source: 'other-guideline', supportsClaimId: 'c1', retrievedAt: '2026-08-17T21:00:00Z' }
  const token = issueEvidenceValidationToken({ evidenceReferences: [refA], validatedAt: '2026-08-17T21:05:00Z', validatedBy: 'doc-1' })

  const supportedClaim = { id: 'c1', kind: 'model_hypothesis' as const, text: 'possible infection', sourceFactIds: ['f1'], evidenceSupport: 'supported' as const, evidenceReferenceIds: ['e1'] }

  it('is order independent for the same evidence set', () => {
    expect(evidenceSetDigest([refA, refB])).toBe(evidenceSetDigest([refB, refA]))
    expect(evidenceSetDigest([refA])).not.toBe(evidenceSetDigest([refA, refB]))
  })

  it('accepts the token issued for this exact evidence set', () => {
    const envelope = createReasoningEnvelope({
      id: 'r-token-ok', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [supportedClaim], evidenceReferences: [refA], evidenceValidationToken: token,
    })
    expect(envelope.evidenceValidationToken?.evidenceDigest).toBe(evidenceSetDigest([refA]))
  })

  it('rejects a token reused with a substituted evidence set', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-token-swap', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [{ ...supportedClaim, evidenceReferenceIds: ['e2'] }],
      evidenceReferences: [{ ...refB, supportsClaimId: 'c1' }],
      evidenceValidationToken: token,
    })).toThrow(/token does not match this evidence set/)
  })

  it('rejects a token reused with an enlarged or edited evidence set', () => {
    expect(() => createReasoningEnvelope({
      id: 'r-token-grow', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [supportedClaim], evidenceReferences: [refA, refB], evidenceValidationToken: token,
    })).toThrow(/token does not match this evidence set/)
    expect(() => createReasoningEnvelope({
      id: 'r-token-edit', clinicId: CLINIC, encounter, question: 'assessment', sourceFactIds: ['f1'],
      claims: [supportedClaim], evidenceReferences: [{ ...refA, retrievedAt: '2026-08-18T09:00:00Z' }], evidenceValidationToken: token,
    })).toThrow(/token does not match this evidence set/)
  })
})
