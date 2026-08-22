import { describe, expect, it } from 'vitest'
import type { EncounterTruth } from '@/lib/clinical-truth'
import { buildConsultationReasoningEnvelope } from '@/lib/expediente/reasoning-workflow'
import { evidenceReferenceFromClaim, safetyFindingFromRegisteredEngine } from '@/lib/clinical-reasoning'
import { claimDesde, fechaPublicacionDesde, fuente } from '@/types/evidence'

const encounter: EncounterTruth = {
  encounterId: 'enc-reasoning-route',
  patientId: 'pat-synthetic',
  updatedAt: '2026-08-21T22:00:00Z',
  facts: [{
    id: 'fact-problem',
    concept: 'active-problem',
    value: 'synthetic clinical problem',
    truthState: 'INFERIDO',
    uncertaintyReason: 'synthetic non-PHI test fixture',
    provenance: { source: 'typed_text', capturedAt: '2026-08-21T22:00:00Z', encounterId: 'enc-reasoning-route' },
  }],
}

describe('production consultation reasoning bridge', () => {
  it('preserves existing canonical safety and evidence findings through one envelope', () => {
    const literal = 'This synthetic evidence passage supports clinician review before a treatment recommendation is accepted.'
    const source = fuente({
      proveedor: 'pubmed', idExterno: 'bridge-1', titulo: 'Synthetic non-PHI bridge evidence',
      publicado: fechaPublicacionDesde('2026'), recuperadoEn: '2026-08-21T22:01:00Z',
      textoRecuperado: `Synthetic preface. ${literal} Synthetic ending.`,
    })
    expect(source.ok).toBe(true)
    if (!source.ok) return

    const canonicalClaim = claimDesde({
      texto: 'review treatment recommendation with evidence',
      citas: [1],
      pasajes: [literal],
    }, [source.valor])
    expect(canonicalClaim.ok).toBe(true)
    if (!canonicalClaim.ok) return

    const evidenceReference = evidenceReferenceFromClaim({
      id: 'e-bridge', source: source.valor, claim: canonicalClaim.valor, supportsClaimId: 'claim-bridge',
    })
    const safetyFinding = safetyFindingFromRegisteredEngine({
      id: 's-bridge', engineId: 'news2-set', severity: 'P1', trigger: 'pre-existing deterministic safety finding',
      sourceFactIds: ['fact-problem'], requiresClinicianReview: true,
    })

    const envelope = buildConsultationReasoningEnvelope({
      id: 'reasoning-bridge',
      clinicId: 'clinic-synthetic',
      encounter,
      question: 'What needs clinician review?',
      sourceFactIds: ['fact-problem'],
      claims: [{
        id: 'claim-bridge', kind: 'model_hypothesis', claimType: 'treatment_recommendation',
        text: canonicalClaim.valor.texto, sourceFactIds: ['fact-problem'],
        evidenceSupport: 'supported', evidenceReferenceIds: ['e-bridge'],
      }],
      evidenceReferences: [evidenceReference],
      canonicalEvidence: { sources: [source.valor], claims: [canonicalClaim.valor] },
      safetyFindings: [safetyFinding],
    })

    expect(envelope.evidenceReferences[0].canonicalClaimId).toBe(canonicalClaim.valor.id)
    expect(envelope.evidenceReferences[0].passageIds).toEqual([canonicalClaim.valor.apoyos[0].id])
    expect(envelope.safetyFindings).toEqual([safetyFinding])
    expect(envelope.claims[0].evidenceSupport).toBe('supported')
  })
})
