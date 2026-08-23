import { NextRequest, NextResponse } from 'next/server'
import { verificarModuloIA } from '@/lib/auth-server'
import { sealedVoiceSessionToClinicalInput } from '@/lib/voice-engine/clinical-truth-bridge'
import type {
  TranscriptAlternative,
  TranscriptRevision,
  TranscriptReviewResolution,
  TranscriptSegment,
  VoiceLanguage,
  VoiceSession,
} from '@/lib/voice-engine'

export const runtime = 'nodejs'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  return requiredString(value, label)
}

function optionalConfidence(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`)
  }
  return value
}

function parseAlternatives(value: unknown): TranscriptAlternative[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new Error('segment.alternatives must be an array')
  return value.map((raw) => {
    if (!object(raw)) throw new Error('transcript alternative must be an object')
    return {
      text: requiredString(raw.text, 'alternative.text'),
      confidence: optionalConfidence(raw.confidence, 'alternative.confidence'),
    }
  })
}

function parseRevisions(value: unknown): TranscriptRevision[] {
  if (!Array.isArray(value)) throw new Error('segment.revisions must be an array')
  return value.map((raw) => {
    if (!object(raw)) throw new Error('transcript revision must be an object')
    const reason = raw.reason
    if (reason !== 'provider_revision' && reason !== 'contextual_correction' && reason !== 'clinician_correction') {
      throw new Error('revision.reason is invalid')
    }
    return {
      previousText: requiredString(raw.previousText, 'revision.previousText'),
      revisedText: requiredString(raw.revisedText, 'revision.revisedText'),
      revisedAt: requiredString(raw.revisedAt, 'revision.revisedAt'),
      reason,
      previousConfidence: optionalConfidence(raw.previousConfidence, 'revision.previousConfidence'),
      previousAlternatives: parseAlternatives(raw.previousAlternatives),
      reopenedResolvedReview: typeof raw.reopenedResolvedReview === 'boolean' ? raw.reopenedResolvedReview : undefined,
    }
  })
}

function parseResolutions(value: unknown): TranscriptReviewResolution[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new Error('segment.reviewResolutions must be an array')
  return value.map((raw) => {
    if (!object(raw)) throw new Error('transcript review resolution must be an object')
    return {
      resolvedAt: requiredString(raw.resolvedAt, 'resolution.resolvedAt'),
      resolvedBy: requiredString(raw.resolvedBy, 'resolution.resolvedBy'),
      previousText: requiredString(raw.previousText, 'resolution.previousText'),
      resolvedText: requiredString(raw.resolvedText, 'resolution.resolvedText'),
      rationale: requiredString(raw.rationale, 'resolution.rationale'),
      previousConfidence: optionalConfidence(raw.previousConfidence, 'resolution.previousConfidence'),
      previousAlternatives: parseAlternatives(raw.previousAlternatives),
    }
  })
}

function parseSegment(value: unknown): TranscriptSegment {
  if (!object(value)) throw new Error('transcript segment must be an object')
  if (value.status !== 'partial' && value.status !== 'final') throw new Error('segment.status is invalid')
  if (typeof value.sequence !== 'number' || !Number.isInteger(value.sequence) || value.sequence < 0) {
    throw new Error('segment.sequence must be a non-negative integer')
  }
  if (typeof value.needsReview !== 'boolean') throw new Error('segment.needsReview must be boolean')
  return {
    id: requiredString(value.id, 'segment.id'),
    sequence: value.sequence,
    text: requiredString(value.text, 'segment.text'),
    status: value.status,
    receivedAt: requiredString(value.receivedAt, 'segment.receivedAt'),
    finalizedAt: optionalString(value.finalizedAt, 'segment.finalizedAt'),
    speaker: optionalString(value.speaker, 'segment.speaker'),
    confidence: optionalConfidence(value.confidence, 'segment.confidence'),
    alternatives: parseAlternatives(value.alternatives),
    needsReview: value.needsReview,
    revisions: parseRevisions(value.revisions),
    reviewResolutions: parseResolutions(value.reviewResolutions),
  }
}

function parseSession(value: unknown): VoiceSession {
  if (!object(value)) throw new Error('session is required')
  const language = value.language
  if (language !== 'es' && language !== 'en' && language !== 'spanglish') throw new Error('session.language is invalid')
  if (!Array.isArray(value.segments)) throw new Error('session.segments must be an array')
  return {
    id: requiredString(value.id, 'session.id'),
    encounterId: requiredString(value.encounterId, 'session.encounterId'),
    provider: requiredString(value.provider, 'session.provider'),
    language: language as VoiceLanguage,
    startedAt: requiredString(value.startedAt, 'session.startedAt'),
    firstPartialReceivedAt: optionalString(value.firstPartialReceivedAt, 'session.firstPartialReceivedAt'),
    endedAt: optionalString(value.endedAt, 'session.endedAt'),
    segments: value.segments.map(parseSegment),
  }
}

/**
 * Server boundary for Voice Engine → Clinical Truth.
 *
 * The browser cannot mint ClinicalInput directly. It submits the provider-neutral
 * session, the server re-parses the entire lineage, requires a verified physician
 * context, and the hardened bridge rejects incomplete or impossible chronology.
 */
export async function POST(req: NextRequest) {
  const access = await verificarModuloIA(req, 'expediente')
  if (!access.ok) return access.response
  if (!access.clinicId || (access.role !== 'medico' && access.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'No se pudo verificar rol médico y consultorio para convertir voz a expediente.' }, { status: 403 })
  }

  try {
    const raw: unknown = await req.json()
    if (!object(raw)) throw new Error('JSON body must be an object')
    const clinicId = requiredString(raw.clinicId, 'clinicId')
    if (clinicId !== access.clinicId) {
      return NextResponse.json({ ok: false, error: 'La captura de voz pertenece a otro consultorio.' }, { status: 403 })
    }

    const session = parseSession(raw.session)
    const capturedAt = requiredString(raw.capturedAt, 'capturedAt')
    const clinicalInput = sealedVoiceSessionToClinicalInput(session, capturedAt, access.uid)
    return NextResponse.json({ ok: true, clinicalInput })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid voice session'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
