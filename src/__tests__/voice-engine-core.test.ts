import { describe, expect, it } from 'vitest'
import { appendTranscriptSegment, createVoiceSession, finalizeTranscriptSegment, measureVoiceSession, reviseTranscriptSegment, voiceSessionToClinicalInput } from '@/lib/voice-engine'

const startedAt = '2026-08-17T18:00:00.000Z'

function session(language: 'es' | 'en' | 'spanglish' = 'es') {
  return createVoiceSession({ id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language, startedAt })
}

describe('Voice Engine core', () => {
  it('preserves provisional revision lineage and emits only one final clinical input', () => {
    let current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'Paciente niega fiebre', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', confidence: 0.82, needsReview: false,
    })
    current = reviseTranscriptSegment({ session: current, segmentId: 'seg-1', revisedText: 'Paciente niega fiebre y escalofríos', revisedAt: '2026-08-17T18:00:00.350Z', reason: 'provider_revision' })
    current = finalizeTranscriptSegment({ session: current, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.600Z' })

    expect(current.segments[0].revisions).toHaveLength(1)
    const input = voiceSessionToClinicalInput(current, '2026-08-17T18:00:00.700Z')
    expect(input.raw).toBe('Paciente niega fiebre y escalofríos')
    expect(input.encounterId).toBe('enc-1')
  })

  it('does not allow a finalized segment to be silently replaced', () => {
    const finalized = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'metotrexate', status: 'final', receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.300Z', needsReview: false,
    })
    expect(() => reviseTranscriptSegment({ session: finalized, segmentId: 'seg-1', revisedText: 'metronidazole', revisedAt: '2026-08-17T18:00:00.400Z', reason: 'contextual_correction' })).toThrow(/cannot be silently replaced/)

    const corrected = reviseTranscriptSegment({ session: finalized, segmentId: 'seg-1', revisedText: 'metotrexate 2 gramos', revisedAt: '2026-08-17T18:00:00.500Z', reason: 'clinician_correction' })
    expect(corrected.segments[0].revisions[0]).toMatchObject({ previousText: 'metotrexate', revisedText: 'metotrexate 2 gramos', reason: 'clinician_correction' })
  })

  it('keeps unresolved ambiguity explicit and never invents confidence', () => {
    const current = appendTranscriptSegment(session('spanglish'), {
      id: 'seg-1', sequence: 0, text: 'start vanco fifteen', status: 'final', receivedAt: '2026-08-17T18:00:00.120Z', finalizedAt: '2026-08-17T18:00:00.500Z',
      alternatives: [{ text: 'start vanco fifty' }, { text: 'start vanco fifteen' }], needsReview: true,
    })
    expect(current.segments[0].needsReview).toBe(true)
    expect(current.segments[0].confidence).toBeUndefined()
    expect(measureVoiceSession(current).unresolvedReviewCount).toBe(1)
  })

  it.each(['es', 'en', 'spanglish'] as const)('preserves %s language through the Clinical Truth bridge', (language) => {
    const current = appendTranscriptSegment(session(language), {
      id: 'seg-1', sequence: 0, text: 'SpO2 96%, denies dyspnea', status: 'final', receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.300Z', needsReview: false,
    })
    expect(voiceSessionToClinicalInput(current, '2026-08-17T18:00:00.400Z').language).toBe(language)
  })

  it('passes transcript text to Clinical Truth without semantic invention', () => {
    const current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'posible neumonía, confirmar', status: 'final', receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.300Z', needsReview: true,
    })
    const input = voiceSessionToClinicalInput(current, '2026-08-17T18:00:00.400Z')
    expect(input.raw).toBe('posible neumonía, confirmar')
    expect('facts' in input).toBe(false)
  })

  it('measures deterministic latency and revision metrics from supplied timestamps', () => {
    let current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona', status: 'partial', receivedAt: '2026-08-17T18:00:00.120Z', needsReview: false,
    })
    current = reviseTranscriptSegment({ session: current, segmentId: 'seg-1', revisedText: 'ceftriaxona 2 gramos IV', revisedAt: '2026-08-17T18:00:00.240Z', reason: 'provider_revision' })
    current = finalizeTranscriptSegment({ session: current, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.620Z' })
    expect(measureVoiceSession(current)).toEqual({ timeToFirstPartialMs: 120, timeToFinalMs: 620, revisionCount: 1, unresolvedReviewCount: 0 })
  })

  it('preserves segment order even when arrival calls are out of order', () => {
    let current = appendTranscriptSegment(session(), {
      id: 'seg-2', sequence: 1, text: 'segunda frase', status: 'final', receivedAt: '2026-08-17T18:00:00.200Z', finalizedAt: '2026-08-17T18:00:00.400Z', needsReview: false,
    })
    current = appendTranscriptSegment(current, {
      id: 'seg-1', sequence: 0, text: 'primera frase', status: 'final', receivedAt: '2026-08-17T18:00:00.250Z', finalizedAt: '2026-08-17T18:00:00.450Z', needsReview: false,
    })
    expect(current.segments.map((segment) => segment.id)).toEqual(['seg-1', 'seg-2'])
    expect(voiceSessionToClinicalInput(current, '2026-08-17T18:00:00.500Z').raw).toBe('primera frase\nsegunda frase')
  })
})
