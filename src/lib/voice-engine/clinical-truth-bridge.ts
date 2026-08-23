import {
  voiceSessionToClinicalInput,
  type TranscriptSegment,
  type VoiceClinicalInput,
  type VoiceSession,
} from '@/lib/voice-engine'

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value)
  if (!value || Number.isNaN(parsed)) throw new Error(`${field} must be a valid timestamp`)
  return parsed
}

function newestRecordedState(segment: TranscriptSegment): number {
  let newest = timestamp(segment.receivedAt, 'receivedAt')
  for (const revision of segment.revisions) newest = Math.max(newest, timestamp(revision.revisedAt, 'revisedAt'))
  for (const resolution of segment.reviewResolutions ?? []) newest = Math.max(newest, timestamp(resolution.resolvedAt, 'resolvedAt'))
  if (segment.finalizedAt) newest = Math.max(newest, timestamp(segment.finalizedAt, 'finalizedAt'))
  return newest
}

/**
 * Production boundary from sealed voice capture into Clinical Truth.
 *
 * `voiceSessionToClinicalInput` remains the provider-neutral serializer. This
 * boundary adds the chronology checks that a forged/deserialized VoiceSession
 * must satisfy before clinical data can cross into Clinical Truth:
 * - the seal must exist and be a valid timestamp;
 * - every segment must be final;
 * - the seal must be at/after every recorded segment transition;
 * - capturedAt cannot claim the ClinicalInput existed before capture ended.
 */
export function sealedVoiceSessionToClinicalInput(
  session: VoiceSession,
  capturedAt: string,
  actorId?: string,
): VoiceClinicalInput {
  if (!session.endedAt) {
    throw new Error(`Voice session ${session.id} is not sealed; end capture through endVoiceSession before producing ClinicalInput`)
  }

  const endedAt = timestamp(session.endedAt, 'endedAt')
  const startedAt = timestamp(session.startedAt, 'startedAt')
  if (endedAt < startedAt) {
    throw new Error(`Impossible voice chronology rejected: endedAt precedes session startedAt for voice session ${session.id}`)
  }

  const stillOpen = session.segments.filter((segment) => segment.status !== 'final')
  if (stillOpen.length) {
    throw new Error(`Voice session ${session.id} cannot produce ClinicalInput while transcript segments are still revisable: ${stillOpen.map((segment) => segment.id).join(', ')}`)
  }

  for (const segment of session.segments) {
    if (endedAt < newestRecordedState(segment)) {
      throw new Error(`Impossible voice chronology rejected: endedAt precedes the newest recorded state of transcript segment ${segment.id}`)
    }
  }

  const capturedAtMs = timestamp(capturedAt, 'capturedAt')
  if (capturedAtMs < endedAt) {
    throw new Error(`Impossible voice chronology rejected: capturedAt precedes endedAt for voice session ${session.id}`)
  }

  const input = voiceSessionToClinicalInput(session, capturedAt)
  return actorId ? Object.freeze({ ...input, actorId }) : input
}
