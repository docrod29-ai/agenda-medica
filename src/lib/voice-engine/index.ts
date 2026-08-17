import type { ClinicalInput } from '@/lib/clinical-truth'

export type VoiceLanguage = 'es' | 'en' | 'spanglish'
export type TranscriptStatus = 'partial' | 'final'

export interface TranscriptAlternative {
  text: string
  confidence?: number
}

export interface TranscriptRevision {
  previousText: string
  revisedText: string
  revisedAt: string
  reason: 'provider_revision' | 'contextual_correction' | 'clinician_correction'
}

export interface TranscriptSegment {
  id: string
  sequence: number
  text: string
  status: TranscriptStatus
  receivedAt: string
  finalizedAt?: string
  speaker?: string
  confidence?: number
  alternatives?: TranscriptAlternative[]
  needsReview: boolean
  revisions: TranscriptRevision[]
}

export interface VoiceSession {
  id: string
  encounterId: string
  provider: string
  language: VoiceLanguage
  startedAt: string
  segments: TranscriptSegment[]
}

export interface VoiceMetrics {
  timeToFirstPartialMs?: number
  timeToFinalMs?: number
  revisionCount: number
  unresolvedReviewCount: number
}

function assertTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value)
  if (!value || Number.isNaN(parsed)) throw new Error(`${field} must be a valid timestamp`)
  return parsed
}

function assertConfidence(value: number | undefined): void {
  if (value !== undefined && (value < 0 || value > 1)) throw new Error('confidence must be between 0 and 1')
}

function sortSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return [...segments].sort((a, b) => a.sequence - b.sequence)
}

export function createVoiceSession(input: Omit<VoiceSession, 'segments'>): VoiceSession {
  assertTimestamp(input.startedAt, 'startedAt')
  if (!input.id.trim() || !input.encounterId.trim() || !input.provider.trim()) throw new Error('Voice session identity, encounter, and provider are required')
  return { ...input, segments: [] }
}

export function appendTranscriptSegment(session: VoiceSession, segment: Omit<TranscriptSegment, 'revisions'>): VoiceSession {
  assertTimestamp(segment.receivedAt, 'receivedAt')
  if (segment.finalizedAt) assertTimestamp(segment.finalizedAt, 'finalizedAt')
  assertConfidence(segment.confidence)
  segment.alternatives?.forEach((alternative) => assertConfidence(alternative.confidence))
  if (!segment.id.trim() || !segment.text.trim()) throw new Error('Transcript segment id and text are required')
  if (segment.sequence < 0 || !Number.isInteger(segment.sequence)) throw new Error('Transcript sequence must be a non-negative integer')
  if (session.segments.some((existing) => existing.id === segment.id)) throw new Error(`Transcript segment already exists: ${segment.id}`)
  if (session.segments.some((existing) => existing.sequence === segment.sequence)) throw new Error(`Transcript sequence already exists: ${segment.sequence}`)
  if (segment.status === 'final' && !segment.finalizedAt) throw new Error('Final transcript segment requires finalizedAt')
  return { ...session, segments: sortSegments([...session.segments, { ...segment, revisions: [] }]) }
}

export function reviseTranscriptSegment(input: {
  session: VoiceSession
  segmentId: string
  revisedText: string
  revisedAt: string
  reason: TranscriptRevision['reason']
  needsReview?: boolean
  confidence?: number
  alternatives?: TranscriptAlternative[]
}): VoiceSession {
  assertTimestamp(input.revisedAt, 'revisedAt')
  assertConfidence(input.confidence)
  input.alternatives?.forEach((alternative) => assertConfidence(alternative.confidence))
  if (!input.revisedText.trim()) throw new Error('Revised transcript text is required')
  const target = input.session.segments.find((segment) => segment.id === input.segmentId)
  if (!target) throw new Error(`Unknown transcript segment: ${input.segmentId}`)
  if (target.status === 'final' && input.reason !== 'clinician_correction') throw new Error('Final transcript cannot be silently replaced; use clinician correction lineage')

  const revision: TranscriptRevision = {
    previousText: target.text,
    revisedText: input.revisedText,
    revisedAt: input.revisedAt,
    reason: input.reason,
  }

  return {
    ...input.session,
    segments: input.session.segments.map((segment) => segment.id === input.segmentId ? {
      ...segment,
      text: input.revisedText,
      confidence: input.confidence ?? segment.confidence,
      alternatives: input.alternatives ?? segment.alternatives,
      needsReview: input.needsReview ?? segment.needsReview,
      revisions: [...segment.revisions, revision],
    } : segment),
  }
}

export function finalizeTranscriptSegment(input: { session: VoiceSession; segmentId: string; finalizedAt: string; needsReview?: boolean }): VoiceSession {
  assertTimestamp(input.finalizedAt, 'finalizedAt')
  const target = input.session.segments.find((segment) => segment.id === input.segmentId)
  if (!target) throw new Error(`Unknown transcript segment: ${input.segmentId}`)
  if (target.status === 'final') throw new Error('Transcript segment is already final')
  return {
    ...input.session,
    segments: input.session.segments.map((segment) => segment.id === input.segmentId ? {
      ...segment,
      status: 'final',
      finalizedAt: input.finalizedAt,
      needsReview: input.needsReview ?? segment.needsReview,
    } : segment),
  }
}

export function voiceSessionToClinicalInput(session: VoiceSession, capturedAt: string): ClinicalInput {
  assertTimestamp(capturedAt, 'capturedAt')
  const finalSegments = sortSegments(session.segments.filter((segment) => segment.status === 'final'))
  if (!finalSegments.length) throw new Error('Voice session has no final transcript segments')
  const raw = finalSegments.map((segment) => segment.text).join('\n')
  return {
    modality: 'dictation',
    raw,
    language: session.language,
    capturedAt,
    encounterId: session.encounterId,
  }
}

export function measureVoiceSession(session: VoiceSession): VoiceMetrics {
  const started = assertTimestamp(session.startedAt, 'startedAt')
  const orderedByArrival = [...session.segments].sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt))
  const firstPartial = orderedByArrival.find((segment) => segment.status === 'partial' || segment.revisions.length > 0)
  const finalTimes = session.segments.filter((segment) => segment.finalizedAt).map((segment) => assertTimestamp(segment.finalizedAt as string, 'finalizedAt'))
  return {
    timeToFirstPartialMs: firstPartial ? Math.max(0, assertTimestamp(firstPartial.receivedAt, 'receivedAt') - started) : undefined,
    timeToFinalMs: finalTimes.length ? Math.max(0, Math.max(...finalTimes) - started) : undefined,
    revisionCount: session.segments.reduce((sum, segment) => sum + segment.revisions.length, 0),
    unresolvedReviewCount: session.segments.filter((segment) => segment.needsReview).length,
  }
}
