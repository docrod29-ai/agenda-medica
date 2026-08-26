import { NextRequest, NextResponse } from 'next/server'
import { verificarModuloIA } from '@/lib/auth-server'
import { validateClinicalFact, type ClinicalFact, type EncounterTruth } from '@/lib/clinical-truth'
import {
  type EvidenceReference,
  type ReasoningClaim,
} from '@/lib/clinical-reasoning'
import { assertReasoningHttpBoundary } from '@/lib/expediente/reasoning-http-boundary'
import { buildConsultationReasoningEnvelope } from '@/lib/expediente/reasoning-workflow'

export const runtime = 'nodejs'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings`)
  }
  return [...value]
}

function parseEncounter(value: unknown): EncounterTruth {
  if (!object(value)) throw new Error('encounter is required')
  const encounterId = nonEmptyString(value.encounterId, 'encounter.encounterId')
  const patientId = nonEmptyString(value.patientId, 'encounter.patientId')
  const updatedAt = nonEmptyString(value.updatedAt, 'encounter.updatedAt')
  if (Number.isNaN(Date.parse(updatedAt))) throw new Error('encounter.updatedAt must be a valid timestamp')
  if (!Array.isArray(value.facts)) throw new Error('encounter.facts must be an array')

  const facts = value.facts.map((raw) => {
    if (!object(raw)) throw new Error('encounter facts must be objects')
    const fact = validateClinicalFact(raw as unknown as ClinicalFact)
    if (fact.provenance.encounterId !== encounterId) throw new Error(`Fact ${fact.id} belongs to another encounter`)
    return fact
  })
  return { encounterId, patientId, updatedAt, facts }
}

/**
 * The HTTP edge may carry model hypotheses, but it may NOT self-attest canonical
 * evidence or deterministic execution. Those privileged objects are minted only
 * by the server-side canonical evidence/engine factories and consumed through the
 * shared consultation bridge.
 */
function parseClaims(value: unknown): ReasoningClaim[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('claims must be an array')
  return value.map((raw) => {
    if (!object(raw)) throw new Error('claims must contain objects')
    if (raw.kind !== 'model_hypothesis') throw new Error('HTTP reasoning claims must be model_hypothesis')
    if (raw.evidenceSupport === 'supported') {
      throw new Error('Supported evidence must come from the server canonical Claim/Passage pipeline')
    }
    if (raw.engineId !== undefined || raw.engineExecution !== undefined) {
      throw new Error('HTTP model hypotheses cannot claim deterministic engine provenance')
    }
    return {
      id: nonEmptyString(raw.id, 'claim.id'),
      kind: 'model_hypothesis',
      claimType: raw.claimType as ReasoningClaim['claimType'],
      text: nonEmptyString(raw.text, 'claim.text'),
      sourceFactIds: stringArray(raw.sourceFactIds, 'claim.sourceFactIds'),
      evidenceSupport: raw.evidenceSupport as ReasoningClaim['evidenceSupport'],
      evidenceReferenceIds: raw.evidenceReferenceIds === undefined ? undefined : stringArray(raw.evidenceReferenceIds, 'claim.evidenceReferenceIds'),
      uncertainty: typeof raw.uncertainty === 'string' ? raw.uncertainty : undefined,
    }
  })
}

function parseEvidenceReferences(value: unknown): EvidenceReference[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('evidenceReferences must be an array')
  return value.map((raw) => {
    if (!object(raw)) throw new Error('evidenceReferences must contain objects')
    if (raw.canonicalClaimId !== undefined || raw.passageIds !== undefined) {
      throw new Error('Canonical evidence bindings cannot be supplied by the HTTP caller')
    }
    return {
      id: nonEmptyString(raw.id, 'evidenceReference.id'),
      source: nonEmptyString(raw.source, 'evidenceReference.source'),
      supportsClaimId: nonEmptyString(raw.supportsClaimId, 'evidenceReference.supportsClaimId'),
      sourceId: typeof raw.sourceId === 'string' ? raw.sourceId : undefined,
      retrievedAt: typeof raw.retrievedAt === 'string' ? raw.retrievedAt : undefined,
      versionDate: typeof raw.versionDate === 'string' ? raw.versionDate : undefined,
    }
  })
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ patientId: string }> },
) {
  const access = await verificarModuloIA(req, 'expediente')
  if (!access.ok) return access.response

  // This is a clinical reasoning boundary: fail closed if membership/role could
  // not be resolved by the generic IA entitlement helper's transient fail-open path.
  if (!access.clinicId || (access.role !== 'medico' && access.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'No se pudo verificar rol médico y consultorio para razonamiento clínico.' }, { status: 403 })
  }

  try {
    const { patientId: pathPatientId } = await context.params
    const body: unknown = await req.json()
    if (!object(body)) throw new Error('JSON body must be an object')
    const clinicId = nonEmptyString(body.clinicId, 'clinicId')
    if (clinicId !== access.clinicId) {
      return NextResponse.json({ ok: false, error: 'El razonamiento solicitado pertenece a otro consultorio.' }, { status: 403 })
    }

    const encounter = parseEncounter(body.encounter)
    assertReasoningHttpBoundary({ pathPatientId, encounter, body })

    const envelope = buildConsultationReasoningEnvelope({
      id: nonEmptyString(body.id, 'id'),
      clinicId,
      encounter,
      question: nonEmptyString(body.question, 'question'),
      sourceFactIds: stringArray(body.sourceFactIds, 'sourceFactIds'),
      claims: parseClaims(body.claims),
      evidenceReferences: parseEvidenceReferences(body.evidenceReferences),
      limitedMode: body.limitedMode as Parameters<typeof buildConsultationReasoningEnvelope>[0]['limitedMode'],
    })

    return NextResponse.json({ ok: true, reasoning: envelope })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid reasoning request'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
