import type { ClinicalDocument, ClinicalFact, EncounterTruth, TruthState } from '../clinical-truth'
import { assertSourceFacts } from '../clinical-truth'
import { CLINICAL_ENGINE_REGISTRY } from '../clinical/registry'
import { huellaContenido } from '../expediente/huella-impreso'
import type { Source } from '@/types/evidence'

export const REASONING_CLAIM_KINDS = ['deterministic','model_hypothesis'] as const
export type ReasoningClaimKind = (typeof REASONING_CLAIM_KINDS)[number]

/**
 * What the claim is asking the clinician to do. Recommendations are held to the
 * existing provenance/evidence contract: no new clinical policy is introduced
 * here, only the requirement that an actionable claim name a trusted origin.
 */
export const REASONING_CLAIM_TYPES = ['clinical_observation','differential_hypothesis','treatment_recommendation','investigation_recommendation'] as const
export type ReasoningClaimType = (typeof REASONING_CLAIM_TYPES)[number]
const RECOMMENDATION_CLAIM_TYPES: readonly ReasoningClaimType[] = ['treatment_recommendation','investigation_recommendation']

export type EvidenceSupport = 'supported'|'unsupported'|'lookup_failed'|'not_requested'
export type ClinicianDisposition = 'pending'|'accepted'|'rejected'|'corrected'
export type SafetySeverity = 'P0'|'P1'|'P2'|'P3'

export interface EvidenceReference {
  id: string
  source: string
  supportsClaimId: string
  /** Canonical Source id when the reference came through the existing evidence model. */
  sourceId?: string
  retrievedAt?: string
  versionDate?: string
}

/**
 * Binds a validated evidence collection to its exact contents. A token issued
 * for one set must not travel with a different or edited set, so it carries a
 * deterministic digest of the evidence identities rather than a bare flag.
 *
 * The digest reuses the repository's existing FNV-1a content fingerprint: it
 * detects substitution or edition of the evidence set, it is not an adversarial
 * MAC and does not pretend to be one.
 */
export interface EvidenceValidationToken {
  evidenceDigest: string
  validatedAt: string
  validatedBy: string
}

export interface ReasoningClaim {
  id: string
  kind: ReasoningClaimKind
  /** Defaults to `clinical_observation`; recommendations require material support. */
  claimType?: ReasoningClaimType
  text: string
  sourceFactIds: string[]
  /** Existing deterministic engine registry id; forbidden for model hypotheses. */
  engineId?: string
  evidenceSupport: EvidenceSupport
  evidenceReferenceIds?: string[]
  uncertainty?: string
}

export interface SafetyFinding {
  id: string
  severity: SafetySeverity
  trigger: string
  sourceFactIds: string[]
  /** Existing registered safety engine when this finding is deterministic. */
  engineId?: string
  requiresClinicianReview: boolean
}

export interface ClinicianDispositionEvent {
  disposition: ClinicianDisposition
  recordedAt: string
  clinicianId: string
  correction?: string
}

/**
 * A signed/draft document offered as reasoning lineage, with the tenant scope the
 * caller is authorized for. `ClinicalDocument` only carries `encounterId`, so the
 * clinic is declared here and checked before any identifier is sealed.
 */
export interface ScopedClinicalDocument {
  clinicId: string
  document: ClinicalDocument
}

export interface ClinicalReasoningEnvelope {
  id: string
  clinicId: string
  patientId: string
  encounterId: string
  sourceFactIds: string[]
  /** Documents that passed the tenant/encounter check and contributed lineage. */
  documentIds: string[]
  /** Source facts still in CONFLICTIVO at sealing time; never silently resolved. */
  openConflictIds: string[]
  question: string
  claims: ReasoningClaim[]
  evidenceReferences: EvidenceReference[]
  evidenceValidationToken?: EvidenceValidationToken
  safetyFindings: SafetyFinding[]
  unresolved: { factId: string; state: Extract<TruthState,'INFERIDO'|'INCIERTO'|'CONFLICTIVO'|'NO_DOCUMENTADO'|'NO_INTERROGADO'|'DESCONOCIDO'>; reason?: string }[]
  limitedMode?: 'model_unavailable'|'evidence_unavailable'|'insufficient_patient_data'
  dispositionHistory: ClinicianDispositionEvent[]
}

function cloneFact<T>(fact: ClinicalFact<T>): ClinicalFact<T> {
  return { ...fact, provenance: { ...fact.provenance }, conflictsWith: fact.conflictsWith ? [...fact.conflictsWith] : undefined }
}

function registeredEngine(engineId: string) {
  return CLINICAL_ENGINE_REGISTRY.find((engine) => engine.id === engineId)
}

/**
 * Identifier collisions are rejected instead of deduplicated. Collapsing them into
 * a lookup map silently picks a winner, and the sealed envelope then disagrees
 * with the list of identifiers it claims to have validated.
 */
function assertUniqueIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label}: ${id}`)
    seen.add(id)
  }
}

/** Deterministic identity of an evidence collection; order-independent. */
export function evidenceSetDigest(references: readonly EvidenceReference[]): string {
  const lines = references
    .map((ref) => [ref.id, ref.source, ref.sourceId ?? '', ref.supportsClaimId, ref.retrievedAt ?? '', ref.versionDate ?? ''].join('|'))
    .sort()
  return huellaContenido(lines, `n=${lines.length}`)
}

export function issueEvidenceValidationToken(input: {
  evidenceReferences: readonly EvidenceReference[]
  validatedAt: string
  validatedBy: string
}): EvidenceValidationToken {
  if (!input.validatedBy.trim() || Number.isNaN(Date.parse(input.validatedAt))) throw new Error('Evidence validation token requires validator identity and timestamp')
  return { evidenceDigest: evidenceSetDigest(input.evidenceReferences), validatedAt: input.validatedAt, validatedBy: input.validatedBy }
}

/**
 * Fails closed: a document from another clinic or another encounter contributes
 * nothing — not its facts, not its conflicts, not its id. The check runs before
 * any identifier is sealed into the envelope.
 */
function assertDocumentInScope(scoped: ScopedClinicalDocument, clinicId: string, encounter: EncounterTruth): void {
  const documentId = scoped.document.id
  if (!scoped.clinicId.trim()) throw new Error(`Document ${documentId} requires an explicit clinic scope`)
  if (scoped.clinicId !== clinicId) throw new Error(`Document ${documentId} belongs to another clinic`)
  if (scoped.document.encounterId !== encounter.encounterId) throw new Error(`Document ${documentId} belongs to another encounter`)
  const known = new Set(encounter.facts.map((fact) => fact.id))
  for (const version of scoped.document.versions) {
    for (const factId of version.sourceFactIds) {
      if (!known.has(factId)) throw new Error(`Document ${documentId} references a fact outside this encounter: ${factId}`)
    }
  }
}

/**
 * Adapter over the existing Clinical Engine Registry. It does not execute or
 * reinterpret medical policy: it only proves that a deterministic claim names
 * an already-registered engine instead of inventing a second calculation path.
 */
export function deterministicClaimFromRegisteredEngine(input: {
  id: string
  engineId: string
  text: string
  sourceFactIds: string[]
  evidenceSupport?: EvidenceSupport
  evidenceReferenceIds?: string[]
}): ReasoningClaim {
  const engine = registeredEngine(input.engineId)
  if (!engine) throw new Error(`Unknown deterministic clinical engine: ${input.engineId}`)
  return {
    id: input.id,
    kind: 'deterministic',
    engineId: engine.id,
    text: input.text,
    sourceFactIds: [...input.sourceFactIds],
    evidenceSupport: input.evidenceSupport ?? 'not_requested',
    evidenceReferenceIds: input.evidenceReferenceIds ? [...input.evidenceReferenceIds] : undefined,
  }
}

/**
 * Adapter over the existing evidence Source model. A retrieved source is not
 * automatically "support": callers still have to associate it with a claim and
 * the envelope validates that association. No publication precision is invented.
 */
export function evidenceReferenceFromSource(input: {
  id: string
  source: Source
  supportsClaimId: string
}): EvidenceReference {
  const publication = input.source.publicado
  const versionDate = publication.precision === 'dia' ? publication.iso
    : publication.precision === 'mes' ? publication.iso
      : publication.precision === 'anio' ? publication.iso
        : undefined
  return {
    id: input.id,
    source: input.source.proveedor,
    sourceId: input.source.id,
    supportsClaimId: input.supportsClaimId,
    retrievedAt: input.source.recuperadoEn,
    versionDate,
  }
}

/**
 * Adapter for an already-triggered deterministic safety engine. This function
 * does not choose severity or trigger thresholds; those remain owned by the
 * existing engine/policy. It only requires that the named engine is registered
 * as a safety rule and preserves its provenance into the canonical envelope.
 */
export function safetyFindingFromRegisteredEngine(input: {
  id: string
  engineId: string
  severity: SafetySeverity
  trigger: string
  sourceFactIds: string[]
  requiresClinicianReview: boolean
}): SafetyFinding {
  const engine = registeredEngine(input.engineId)
  if (!engine) throw new Error(`Unknown deterministic clinical engine: ${input.engineId}`)
  if (engine.tipo !== 'regla-de-seguridad') throw new Error(`Clinical engine ${input.engineId} is not registered as a safety rule`)
  return { ...input, sourceFactIds: [...input.sourceFactIds] }
}

export function createReasoningEnvelope(input: {
  id: string
  clinicId: string
  encounter: EncounterTruth
  question: string
  sourceFactIds: string[]
  claims?: ReasoningClaim[]
  evidenceReferences?: EvidenceReference[]
  evidenceValidationToken?: EvidenceValidationToken
  safetyFindings?: SafetyFinding[]
  documents?: ScopedClinicalDocument[]
  limitedMode?: ClinicalReasoningEnvelope['limitedMode']
}): ClinicalReasoningEnvelope {
  if (!input.id.trim() || !input.question.trim()) throw new Error('Reasoning id and question are required')
  if (!input.clinicId.trim()) throw new Error('Reasoning envelope requires an explicit clinic scope')
  assertUniqueIds(input.sourceFactIds, 'source fact id')
  assertSourceFacts(input.encounter, input.sourceFactIds)

  // Tenant/encounter check first: a foreign document must not reach the seal.
  const documents = input.documents ?? []
  for (const scoped of documents) assertDocumentInScope(scoped, input.clinicId, input.encounter)
  assertUniqueIds(documents.map((scoped) => scoped.document.id), 'document id')

  const sealedFactIds = [...input.sourceFactIds]
  const sourceSet = new Set(sealedFactIds)
  for (const scoped of documents) {
    for (const version of scoped.document.versions) {
      for (const factId of version.sourceFactIds) {
        if (sourceSet.has(factId)) continue
        sourceSet.add(factId)
        sealedFactIds.push(factId)
      }
    }
  }

  const claims = (input.claims ?? []).map((claim) => ({ ...claim, sourceFactIds: [...claim.sourceFactIds], evidenceReferenceIds: claim.evidenceReferenceIds ? [...claim.evidenceReferenceIds] : undefined }))
  assertUniqueIds(claims.map((claim) => claim.id), 'reasoning claim id')
  const refs = (input.evidenceReferences ?? []).map((ref) => ({ ...ref }))
  assertUniqueIds(refs.map((ref) => ref.id), 'evidence reference id')
  const refMap = new Map(refs.map((ref) => [ref.id, ref]))
  if (input.evidenceValidationToken && input.evidenceValidationToken.evidenceDigest !== evidenceSetDigest(refs)) {
    throw new Error('Evidence validation token does not match this evidence set')
  }

  for (const claim of claims) {
    if (!claim.id.trim() || !claim.text.trim()) throw new Error('Reasoning claims require id and text')
    if (!claim.sourceFactIds.length) throw new Error(`Reasoning claim ${claim.id} requires sourceFactIds`)
    for (const factId of claim.sourceFactIds) if (!sourceSet.has(factId)) throw new Error(`Reasoning claim ${claim.id} references a fact outside the envelope: ${factId}`)
    if (claim.kind === 'model_hypothesis' && claim.engineId) throw new Error(`Model hypothesis ${claim.id} cannot claim deterministic engine provenance`)
    if (claim.kind === 'deterministic' && claim.engineId && !registeredEngine(claim.engineId)) throw new Error(`Unknown deterministic clinical engine: ${claim.engineId}`)
    if (claim.evidenceSupport === 'supported') {
      if (!claim.evidenceReferenceIds?.length) throw new Error(`Supported claim ${claim.id} requires evidence references`)
      for (const refId of claim.evidenceReferenceIds) {
        const ref = refMap.get(refId)
        if (!ref || ref.supportsClaimId !== claim.id) throw new Error(`Unsupported citation ${refId} for claim ${claim.id}`)
      }
    }
    if (claim.evidenceSupport === 'lookup_failed' && claim.evidenceReferenceIds?.length) throw new Error('Evidence lookup failure cannot carry supporting citations')
    // An actionable recommendation must name a trusted origin: either an already
    // registered deterministic engine, or the evidence contract validated above.
    // Zero material support is not a passing state for a recommendation.
    if (RECOMMENDATION_CLAIM_TYPES.includes(claim.claimType ?? 'clinical_observation')) {
      const deterministicSupport = claim.kind === 'deterministic' && !!claim.engineId
      if (!deterministicSupport && claim.evidenceSupport !== 'supported') {
        throw new Error(`Recommendation claim ${claim.id} requires deterministic engine provenance or supported evidence`)
      }
    }
  }

  const safetyFindings = (input.safetyFindings ?? []).map((finding) => ({ ...finding, sourceFactIds: [...finding.sourceFactIds] }))
  for (const finding of safetyFindings) {
    for (const factId of finding.sourceFactIds) if (!sourceSet.has(factId)) throw new Error(`Safety finding ${finding.id} references a fact outside the envelope: ${factId}`)
    if (finding.engineId) {
      const engine = registeredEngine(finding.engineId)
      if (!engine) throw new Error(`Unknown deterministic clinical engine: ${finding.engineId}`)
      if (engine.tipo !== 'regla-de-seguridad') throw new Error(`Clinical engine ${finding.engineId} is not registered as a safety rule`)
    }
    if ((finding.severity === 'P0' || finding.severity === 'P1') && !finding.requiresClinicianReview) throw new Error(`${finding.severity} safety findings require clinician review`)
  }

  const unresolved = input.encounter.facts
    .filter((fact) => sourceSet.has(fact.id) && ['INFERIDO','INCIERTO','CONFLICTIVO','NO_DOCUMENTADO','NO_INTERROGADO','DESCONOCIDO'].includes(fact.truthState))
    .map((fact) => ({ factId: fact.id, state: fact.truthState as ClinicalReasoningEnvelope['unresolved'][number]['state'], reason: fact.uncertaintyReason }))

  const openConflictIds = input.encounter.facts
    .filter((fact) => sourceSet.has(fact.id) && fact.truthState === 'CONFLICTIVO')
    .map((fact) => fact.id)

  const limitedMode = input.limitedMode ?? (sealedFactIds.length === 0 ? 'insufficient_patient_data' : undefined)

  return {
    id: input.id,
    clinicId: input.clinicId,
    patientId: input.encounter.patientId,
    encounterId: input.encounter.encounterId,
    sourceFactIds: sealedFactIds,
    documentIds: documents.map((scoped) => scoped.document.id),
    openConflictIds,
    question: input.question,
    claims,
    evidenceReferences: refs,
    evidenceValidationToken: input.evidenceValidationToken ? { ...input.evidenceValidationToken } : undefined,
    safetyFindings,
    unresolved,
    limitedMode,
    dispositionHistory: [],
  }
}

export function recordClinicianDisposition(envelope: ClinicalReasoningEnvelope, event: ClinicianDispositionEvent): ClinicalReasoningEnvelope {
  if (!event.clinicianId.trim() || Number.isNaN(Date.parse(event.recordedAt))) throw new Error('Valid clinician disposition metadata is required')
  if (event.disposition === 'corrected' && !event.correction?.trim()) throw new Error('Corrected disposition requires correction text')
  return { ...envelope, dispositionHistory: [...envelope.dispositionHistory, { ...event }] }
}

/**
 * Reasoning is read-only with respect to canonical truth and signed documents,
 * and it reads only what belongs to this clinic and this encounter: the same
 * fail-closed scope check as the envelope, so this cannot become a side door.
 */
export function snapshotReasoningInputs(input: {
  clinicId: string
  encounter: EncounterTruth
  document?: ScopedClinicalDocument
}): { encounter: EncounterTruth; document?: ClinicalDocument } {
  if (!input.clinicId.trim()) throw new Error('Reasoning envelope requires an explicit clinic scope')
  if (input.document) assertDocumentInScope(input.document, input.clinicId, input.encounter)
  const document = input.document?.document
  return {
    encounter: { ...input.encounter, facts: input.encounter.facts.map(cloneFact) },
    document: document ? { ...document, versions: document.versions.map((v) => ({ ...v, sourceFactIds: [...v.sourceFactIds] })) } : undefined,
  }
}
