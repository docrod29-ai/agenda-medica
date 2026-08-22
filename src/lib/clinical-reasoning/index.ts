import type { ClinicalDocument, ClinicalFact, EncounterTruth, TruthState } from '../clinical-truth'
import { assertSourceFacts } from '../clinical-truth'
import { CLINICAL_ENGINE_REGISTRY } from '../clinical/registry'
import { huellaContenido } from '../expediente/huella-impreso'
import { claimDesdeJSON, type Claim, type Source } from '@/types/evidence'

export const REASONING_CLAIM_KINDS = ['deterministic', 'model_hypothesis'] as const
export type ReasoningClaimKind = (typeof REASONING_CLAIM_KINDS)[number]

export const REASONING_CLAIM_TYPES = [
  'clinical_observation',
  'differential_hypothesis',
  'treatment_recommendation',
  'investigation_recommendation',
] as const
export type ReasoningClaimType = (typeof REASONING_CLAIM_TYPES)[number]

export const EVIDENCE_SUPPORT_STATES = ['supported', 'unsupported', 'lookup_failed', 'not_requested'] as const
export type EvidenceSupport = (typeof EVIDENCE_SUPPORT_STATES)[number]

export const CLINICIAN_DISPOSITIONS = ['pending', 'accepted', 'rejected', 'corrected'] as const
export type ClinicianDisposition = (typeof CLINICIAN_DISPOSITIONS)[number]

export const SAFETY_SEVERITIES = ['P0', 'P1', 'P2', 'P3'] as const
export type SafetySeverity = (typeof SAFETY_SEVERITIES)[number]

const RECOMMENDATION_CLAIM_TYPES: readonly ReasoningClaimType[] = [
  'treatment_recommendation',
  'investigation_recommendation',
]
const LIMITED_MODES = ['model_unavailable', 'evidence_unavailable', 'insufficient_patient_data'] as const

/** Runtime-only brand. JSON/casts cannot manufacture a trusted engine execution. */
const ENGINE_EXECUTION_BRAND: unique symbol = Symbol('ausculta.executed-clinical-engine')

export interface RegisteredEngineExecution<T = unknown> {
  readonly [ENGINE_EXECUTION_BRAND]: true
  readonly engineId: string
  readonly engineVersion: string
  readonly entryPoint: string
  readonly sourceFactIds: readonly string[]
  readonly output: T
  readonly outputDigest: string
}

export interface EvidenceReference {
  id: string
  source: string
  supportsClaimId: string
  /** Canonical Source id when the reference came through the existing evidence model. */
  sourceId?: string
  retrievedAt?: string
  versionDate?: string
  /** Required for `supported`: id of a Claim revalidated against literal Passage(s). */
  canonicalClaimId?: string
  /** Required for `supported`: exact Passage ids used by the canonical Claim. */
  passageIds?: string[]
}

export interface EvidenceValidationToken {
  evidenceDigest: string
  validatedAt: string
  validatedBy: string
}

export interface ReasoningClaim {
  id: string
  kind: ReasoningClaimKind
  claimType?: ReasoningClaimType
  text: string
  sourceFactIds: string[]
  /** Derived from `engineExecution`; a bare caller-supplied id never grants deterministic provenance. */
  engineId?: string
  engineExecution?: RegisteredEngineExecution
  evidenceSupport: EvidenceSupport
  evidenceReferenceIds?: string[]
  uncertainty?: string
}

export interface SafetyFinding {
  id: string
  severity: SafetySeverity
  trigger: string
  sourceFactIds: string[]
  engineId?: string
  requiresClinicianReview: boolean
}

export interface ClinicianDispositionEvent {
  disposition: ClinicianDisposition
  recordedAt: string
  clinicianId: string
  correction?: string
}

export interface ScopedClinicalDocument {
  clinicId: string
  document: ClinicalDocument
}

export interface CanonicalEvidenceBundle {
  /** Retrieved canonical sources. Claims are rehydrated against these sources at the envelope boundary. */
  sources: readonly Source[]
  /** Serialized or in-memory canonical Claim objects. Runtime revalidation is mandatory. */
  claims: readonly unknown[]
}

export interface ClinicalReasoningEnvelope {
  id: string
  clinicId: string
  patientId: string
  encounterId: string
  sourceFactIds: string[]
  documentIds: string[]
  openConflictIds: string[]
  question: string
  claims: ReasoningClaim[]
  evidenceReferences: EvidenceReference[]
  evidenceValidationToken?: EvidenceValidationToken
  safetyFindings: SafetyFinding[]
  unresolved: {
    factId: string
    state: Extract<TruthState, 'INFERIDO' | 'INCIERTO' | 'CONFLICTIVO' | 'NO_DOCUMENTADO' | 'NO_INTERROGADO' | 'DESCONOCIDO'>
    reason?: string
  }[]
  limitedMode?: 'model_unavailable' | 'evidence_unavailable' | 'insufficient_patient_data'
  dispositionHistory: ClinicianDispositionEvent[]
}

function deepCloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => deepCloneValue(item)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) out[key] = deepCloneValue(nested)
    return out as T
  }
  return value
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  return Object.freeze(value)
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(',')}}`
}

function cloneFact<T>(fact: ClinicalFact<T>): ClinicalFact<T> {
  return {
    ...fact,
    value: fact.value === undefined ? undefined : deepCloneValue(fact.value),
    provenance: deepCloneValue(fact.provenance),
    conflictsWith: fact.conflictsWith ? [...fact.conflictsWith] : undefined,
  }
}

function registeredEngine(engineId: string) {
  return CLINICAL_ENGINE_REGISTRY.find((engine) => engine.id === engineId)
}

function assertUniqueIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label}: ${id}`)
    seen.add(id)
  }
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function engineExecutionDigest(input: {
  engineId: string
  engineVersion: string
  entryPoint: string
  sourceFactIds: readonly string[]
  output: unknown
}): string {
  return huellaContenido(
    [stableSerialize(input.output)],
    [input.engineId, input.engineVersion, input.entryPoint, [...input.sourceFactIds].sort().join(',')].join('|'),
  )
}

/**
 * Executes the supplied registered entry point NOW and seals its identity, registry
 * version, source facts and exact output. The hidden runtime brand prevents JSON,
 * model output or a cast object from masquerading as a deterministic execution.
 */
export function executeRegisteredEngine<TArgs extends unknown[], TResult>(input: {
  engineId: string
  entryPoint: string
  sourceFactIds: string[]
  execute: (...args: TArgs) => TResult
  args: TArgs
}): RegisteredEngineExecution<TResult> {
  const engine = registeredEngine(input.engineId)
  if (!engine) throw new Error(`Unknown deterministic clinical engine: ${input.engineId}`)
  if (!engine.entryPoints.includes(input.entryPoint)) {
    throw new Error(`Entry point ${input.entryPoint} is not registered for clinical engine ${input.engineId}`)
  }
  if (input.execute.name !== input.entryPoint) {
    throw new Error(`Executed function ${input.execute.name || '<anonymous>'} does not match registered entry point ${input.entryPoint}`)
  }
  if (!input.sourceFactIds.length) throw new Error('Deterministic engine execution requires sourceFactIds')
  assertUniqueIds(input.sourceFactIds, 'engine source fact id')

  const output = deepFreeze(deepCloneValue(input.execute(...input.args)))
  const execution: RegisteredEngineExecution<TResult> = {
    [ENGINE_EXECUTION_BRAND]: true,
    engineId: engine.id,
    engineVersion: engine.version,
    entryPoint: input.entryPoint,
    sourceFactIds: Object.freeze([...input.sourceFactIds]),
    output,
    outputDigest: engineExecutionDigest({
      engineId: engine.id,
      engineVersion: engine.version,
      entryPoint: input.entryPoint,
      sourceFactIds: input.sourceFactIds,
      output,
    }),
  }
  return Object.freeze(execution)
}

function assertTrustedEngineExecution(claim: ReasoningClaim): RegisteredEngineExecution {
  const execution = claim.engineExecution
  if (!execution || execution[ENGINE_EXECUTION_BRAND] !== true) {
    throw new Error(`Deterministic claim ${claim.id} requires an executed registered engine result`)
  }
  const engine = registeredEngine(execution.engineId)
  if (!engine) throw new Error(`Unknown deterministic clinical engine: ${execution.engineId}`)
  if (execution.engineVersion !== engine.version) throw new Error(`Deterministic claim ${claim.id} engine version does not match registry`)
  if (!engine.entryPoints.includes(execution.entryPoint)) throw new Error(`Deterministic claim ${claim.id} entry point is not registered`)
  if (claim.engineId !== execution.engineId) throw new Error(`Deterministic claim ${claim.id} engine identity does not match execution`)
  const expectedDigest = engineExecutionDigest(execution)
  if (expectedDigest !== execution.outputDigest) throw new Error(`Deterministic claim ${claim.id} engine output binding is invalid`)
  for (const factId of claim.sourceFactIds) {
    if (!execution.sourceFactIds.includes(factId)) throw new Error(`Deterministic claim ${claim.id} uses a fact not present in its engine execution`)
  }
  return execution
}

/** Deterministic identity of an evidence-reference collection; order-independent. */
export function evidenceSetDigest(references: readonly EvidenceReference[]): string {
  const lines = references
    .map((ref) => [
      ref.id,
      ref.source,
      ref.sourceId ?? '',
      ref.supportsClaimId,
      ref.canonicalClaimId ?? '',
      [...(ref.passageIds ?? [])].sort().join(','),
      ref.retrievedAt ?? '',
      ref.versionDate ?? '',
    ].join('|'))
    .sort()
  return huellaContenido(lines, `n=${lines.length}`)
}

export function issueEvidenceValidationToken(input: {
  evidenceReferences: readonly EvidenceReference[]
  validatedAt: string
  validatedBy: string
}): EvidenceValidationToken {
  if (!input.validatedBy.trim() || Number.isNaN(Date.parse(input.validatedAt))) {
    throw new Error('Evidence validation token requires validator identity and timestamp')
  }
  return {
    evidenceDigest: evidenceSetDigest(input.evidenceReferences),
    validatedAt: input.validatedAt,
    validatedBy: input.validatedBy,
  }
}

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

/** A deterministic claim can only be created from an execution receipt minted above. */
export function deterministicClaimFromRegisteredEngine(input: {
  id: string
  execution: RegisteredEngineExecution
  text: string
  sourceFactIds?: string[]
  evidenceSupport?: EvidenceSupport
  evidenceReferenceIds?: string[]
}): ReasoningClaim {
  const sourceFactIds = input.sourceFactIds ? [...input.sourceFactIds] : [...input.execution.sourceFactIds]
  const claim: ReasoningClaim = {
    id: input.id,
    kind: 'deterministic',
    engineId: input.execution.engineId,
    engineExecution: input.execution,
    text: input.text,
    sourceFactIds,
    evidenceSupport: input.evidenceSupport ?? 'not_requested',
    evidenceReferenceIds: input.evidenceReferenceIds ? [...input.evidenceReferenceIds] : undefined,
  }
  assertTrustedEngineExecution(claim)
  return claim
}

/**
 * Metadata-only reference. It preserves Source provenance, but deliberately cannot
 * satisfy `supported` by itself because it is not bound to a validated Claim/Passage.
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

/** Builds a reasoning reference from the repository's canonical validated Claim/Passage contract. */
export function evidenceReferenceFromClaim(input: {
  id: string
  source: Source
  claim: Claim
  supportsClaimId: string
}): EvidenceReference {
  const passages = input.claim.apoyos.filter((passage) => passage.sourceId === input.source.id)
  if (!passages.length) throw new Error(`Canonical evidence claim ${input.claim.id} has no passage from source ${input.source.id}`)
  const base = evidenceReferenceFromSource({ id: input.id, source: input.source, supportsClaimId: input.supportsClaimId })
  return {
    ...base,
    canonicalClaimId: input.claim.id,
    passageIds: passages.map((passage) => passage.id),
  }
}

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
  if (!isOneOf(input.severity, SAFETY_SEVERITIES)) throw new Error('Safety finding severity is invalid')
  return { ...input, sourceFactIds: [...input.sourceFactIds] }
}

function revalidateEvidenceBundle(bundle: CanonicalEvidenceBundle | undefined): Map<string, Claim> {
  const claims = new Map<string, Claim>()
  if (!bundle) return claims
  for (const rawClaim of bundle.claims) {
    const result = claimDesdeJSON(rawClaim, bundle.sources)
    if (!result.ok) throw new Error(`Canonical evidence claim failed runtime validation: ${result.motivo}`)
    if (claims.has(result.valor.id)) throw new Error(`Duplicate canonical evidence claim id: ${result.valor.id}`)
    claims.set(result.valor.id, result.valor)
  }
  return claims
}

function assertCanonicalEvidenceSupport(
  claim: ReasoningClaim,
  refs: Map<string, EvidenceReference>,
  canonicalClaims: Map<string, Claim>,
): void {
  if (!claim.evidenceReferenceIds?.length) throw new Error(`Supported claim ${claim.id} requires evidence references`)
  if (canonicalClaims.size === 0) throw new Error(`Supported claim ${claim.id} requires canonical validated Claim/Passage evidence`)

  for (const refId of claim.evidenceReferenceIds) {
    const ref = refs.get(refId)
    if (!ref || ref.supportsClaimId !== claim.id) throw new Error(`Unsupported citation ${refId} for claim ${claim.id}`)
    if (!ref.canonicalClaimId || !ref.passageIds?.length) {
      throw new Error(`Supported claim ${claim.id} requires a canonical Claim/Passage binding`)
    }
    const canonical = canonicalClaims.get(ref.canonicalClaimId)
    if (!canonical) throw new Error(`Canonical evidence claim ${ref.canonicalClaimId} was not validated`)
    if (canonical.texto.trim() !== claim.text.trim()) {
      throw new Error(`Supported claim ${claim.id} text is not bound to the canonical evidence claim`)
    }
    const canonicalPassages = new Set(canonical.apoyos.map((passage) => passage.id))
    for (const passageId of ref.passageIds) {
      if (!canonicalPassages.has(passageId)) throw new Error(`Evidence passage ${passageId} is not part of canonical claim ${canonical.id}`)
    }
    if (ref.sourceId && !canonical.apoyos.some((passage) => passage.sourceId === ref.sourceId)) {
      throw new Error(`Evidence source ${ref.sourceId} is not part of canonical claim ${canonical.id}`)
    }
  }
}

export function createReasoningEnvelope(input: {
  id: string
  clinicId: string
  encounter: EncounterTruth
  question: string
  sourceFactIds: string[]
  claims?: ReasoningClaim[]
  evidenceReferences?: EvidenceReference[]
  canonicalEvidence?: CanonicalEvidenceBundle
  evidenceValidationToken?: EvidenceValidationToken
  safetyFindings?: SafetyFinding[]
  documents?: ScopedClinicalDocument[]
  limitedMode?: ClinicalReasoningEnvelope['limitedMode']
}): ClinicalReasoningEnvelope {
  if (!input.id.trim() || !input.question.trim()) throw new Error('Reasoning id and question are required')
  if (!input.clinicId.trim()) throw new Error('Reasoning envelope requires an explicit clinic scope')
  if (input.limitedMode !== undefined && !isOneOf(input.limitedMode, LIMITED_MODES)) throw new Error('Reasoning limitedMode is invalid')
  assertUniqueIds(input.sourceFactIds, 'source fact id')
  assertSourceFacts(input.encounter, input.sourceFactIds)

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

  const claims = (input.claims ?? []).map((claim) => ({
    ...claim,
    sourceFactIds: [...claim.sourceFactIds],
    evidenceReferenceIds: claim.evidenceReferenceIds ? [...claim.evidenceReferenceIds] : undefined,
    engineExecution: claim.engineExecution,
  }))
  assertUniqueIds(claims.map((claim) => claim.id), 'reasoning claim id')

  const refs = (input.evidenceReferences ?? []).map((ref) => ({
    ...ref,
    passageIds: ref.passageIds ? [...ref.passageIds] : undefined,
  }))
  assertUniqueIds(refs.map((ref) => ref.id), 'evidence reference id')
  const refMap = new Map(refs.map((ref) => [ref.id, ref]))
  const canonicalClaims = revalidateEvidenceBundle(input.canonicalEvidence)

  if (input.evidenceValidationToken && input.evidenceValidationToken.evidenceDigest !== evidenceSetDigest(refs)) {
    throw new Error('Evidence validation token does not match this evidence set')
  }

  for (const claim of claims) {
    if (!claim.id.trim() || !claim.text.trim()) throw new Error('Reasoning claims require id and text')
    if (!isOneOf(claim.kind, REASONING_CLAIM_KINDS)) throw new Error(`Reasoning claim ${claim.id} kind is invalid`)
    if (claim.claimType !== undefined && !isOneOf(claim.claimType, REASONING_CLAIM_TYPES)) throw new Error(`Reasoning claim ${claim.id} type is invalid`)
    if (!isOneOf(claim.evidenceSupport, EVIDENCE_SUPPORT_STATES)) throw new Error(`Reasoning claim ${claim.id} evidence support is invalid`)
    if (!claim.sourceFactIds.length) throw new Error(`Reasoning claim ${claim.id} requires sourceFactIds`)
    for (const factId of claim.sourceFactIds) {
      if (!sourceSet.has(factId)) throw new Error(`Reasoning claim ${claim.id} references a fact outside the envelope: ${factId}`)
    }

    if (claim.kind === 'model_hypothesis') {
      if (claim.engineId || claim.engineExecution) throw new Error(`Model hypothesis ${claim.id} cannot claim deterministic engine provenance`)
    } else {
      assertTrustedEngineExecution(claim)
    }

    if (claim.evidenceSupport === 'supported') assertCanonicalEvidenceSupport(claim, refMap, canonicalClaims)
    if (claim.evidenceSupport === 'lookup_failed' && claim.evidenceReferenceIds?.length) {
      throw new Error('Evidence lookup failure cannot carry supporting citations')
    }

    const claimType = claim.claimType ?? 'clinical_observation'
    if (RECOMMENDATION_CLAIM_TYPES.includes(claimType)) {
      const deterministicSupport = claim.kind === 'deterministic' && !!claim.engineExecution
      if (!deterministicSupport && claim.evidenceSupport !== 'supported') {
        throw new Error(`Recommendation claim ${claim.id} requires executed deterministic provenance or supported canonical evidence`)
      }
    }
  }

  const safetyFindings = (input.safetyFindings ?? []).map((finding) => ({
    ...finding,
    sourceFactIds: [...finding.sourceFactIds],
  }))
  for (const finding of safetyFindings) {
    if (!isOneOf(finding.severity, SAFETY_SEVERITIES)) throw new Error(`Safety finding ${finding.id} severity is invalid`)
    for (const factId of finding.sourceFactIds) {
      if (!sourceSet.has(factId)) throw new Error(`Safety finding ${finding.id} references a fact outside the envelope: ${factId}`)
    }
    if (finding.engineId) {
      const engine = registeredEngine(finding.engineId)
      if (!engine) throw new Error(`Unknown deterministic clinical engine: ${finding.engineId}`)
      if (engine.tipo !== 'regla-de-seguridad') throw new Error(`Clinical engine ${finding.engineId} is not registered as a safety rule`)
    }
    if ((finding.severity === 'P0' || finding.severity === 'P1') && !finding.requiresClinicianReview) {
      throw new Error(`${finding.severity} safety findings require clinician review`)
    }
  }

  const unresolved = input.encounter.facts
    .filter((fact) => sourceSet.has(fact.id) && ['INFERIDO', 'INCIERTO', 'CONFLICTIVO', 'NO_DOCUMENTADO', 'NO_INTERROGADO', 'DESCONOCIDO'].includes(fact.truthState))
    .map((fact) => ({
      factId: fact.id,
      state: fact.truthState as ClinicalReasoningEnvelope['unresolved'][number]['state'],
      reason: fact.uncertaintyReason,
    }))

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

export function recordClinicianDisposition(
  envelope: ClinicalReasoningEnvelope,
  event: ClinicianDispositionEvent,
): ClinicalReasoningEnvelope {
  if (!isOneOf(event.disposition, CLINICIAN_DISPOSITIONS)) throw new Error('Clinician disposition is invalid')
  if (!event.clinicianId.trim() || Number.isNaN(Date.parse(event.recordedAt))) throw new Error('Valid clinician disposition metadata is required')
  if (event.disposition === 'corrected' && !event.correction?.trim()) throw new Error('Corrected disposition requires correction text')
  return {
    ...envelope,
    dispositionHistory: [...envelope.dispositionHistory, deepCloneValue(event)],
  }
}

/** Read-only snapshot: nested fact values/arrays/objects cannot mutate Clinical Truth. */
export function snapshotReasoningInputs(input: {
  clinicId: string
  encounter: EncounterTruth
  document?: ScopedClinicalDocument
}): { encounter: EncounterTruth; document?: ClinicalDocument } {
  if (!input.clinicId.trim()) throw new Error('Reasoning envelope requires an explicit clinic scope')
  if (input.document) assertDocumentInScope(input.document, input.clinicId, input.encounter)
  const document = input.document?.document
  return {
    encounter: {
      ...input.encounter,
      facts: input.encounter.facts.map(cloneFact),
    },
    document: document ? deepCloneValue(document) : undefined,
  }
}
