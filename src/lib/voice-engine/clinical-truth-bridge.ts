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

/** Newest provider/capture transition. Clinician review may legitimately happen after the capture seal. */
function newestCaptureState(segment: TranscriptSegment): number {
  let newest = timestamp(segment.receivedAt, 'receivedAt')
  for (const revision of segment.revisions) newest = Math.max(newest, timestamp(revision.revisedAt, 'revisedAt'))
  if (segment.finalizedAt) newest = Math.max(newest, timestamp(segment.finalizedAt, 'finalizedAt'))
  return newest
}

/** Newest state that the resulting ClinicalInput actually claims, including post-seal clinician review. */
function newestClinicalState(segment: TranscriptSegment): number {
  let newest = newestCaptureState(segment)
  for (const resolution of segment.reviewResolutions ?? []) newest = Math.max(newest, timestamp(resolution.resolvedAt, 'resolvedAt'))
  return newest
}

/**
 * Production boundary from sealed voice capture into Clinical Truth.
 *
 * `voiceSessionToClinicalInput` remains the provider-neutral serializer. This
 * boundary adds chronology checks that a forged/deserialized VoiceSession must
 * satisfy before clinical data can cross into Clinical Truth:
 * - the capture seal must exist and follow every provider/capture transition;
 * - every segment must be final;
 * - capturedAt must follow the seal and any later clinician review resolution.
 *
 * Review resolution is intentionally allowed after `endedAt`: the physician may
 * resolve an ambiguity after dictation stops. The seal therefore constrains the
 * provider capture lineage, while `capturedAt` constrains the complete clinical
 * lineage that is actually emitted.
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
    if (endedAt < newestCaptureState(segment)) {
      throw new Error(`Impossible voice chronology rejected: endedAt precedes the newest provider capture state of transcript segment ${segment.id}`)
    }
  }

  const capturedAtMs = timestamp(capturedAt, 'capturedAt')
  if (capturedAtMs < endedAt) {
    throw new Error(`Impossible voice chronology rejected: capturedAt precedes endedAt for voice session ${session.id}`)
  }
  for (const segment of session.segments) {
    if (capturedAtMs < newestClinicalState(segment)) {
      throw new Error(`Impossible voice chronology rejected: capturedAt precedes the newest clinical state of transcript segment ${segment.id}`)
    }
  }

  const input = voiceSessionToClinicalInput(session, capturedAt)
  return actorId ? Object.freeze({ ...input, actorId }) : input
}
