import { describe, expect, it } from 'vitest'
import {
  normalizeClinicalInput,
  type ClinicalInput,
} from '@/lib/clinical-truth'
import {
  appendTranscriptSegment,
  createVoiceSession,
  endVoiceSession,
} from '@/lib/voice-engine'
import { sealedVoiceSessionToClinicalInput } from '@/lib/voice-engine/clinical-truth-bridge'

const encounterId = 'enc-gp7-synthetic'
const actorId = 'clinician-gp7-synthetic'
const capturedAt = '2026-08-24T14:15:00.000Z'
const raw = 'Paciente niega fiebre y refiere tos de tres dias.'

function typed(): ClinicalInput {
  return {
    modality: 'free_text',
    raw,
    language: 'es',
    capturedAt,
    actorId,
    encounterId,
  }
}

function voice(): ClinicalInput {
  const session = endVoiceSession(
    appendTranscriptSegment(
      createVoiceSession({
        id: 'voice-gp7-synthetic',
        encounterId,
        provider: 'synthetic-test-provider',
        language: 'es',
        startedAt: '2026-08-24T14:14:59.000Z',
      }),
      {
        id: 'seg-1',
        sequence: 0,
        text: raw,
        status: 'final',
        receivedAt: '2026-08-24T14:14:59.100Z',
        finalizedAt: '2026-08-24T14:14:59.800Z',
        needsReview: false,
      },
    ),
    '2026-08-24T14:14:59.900Z',
  )
  return sealedVoiceSessionToClinicalInput(session, capturedAt, actorId)
}

function mixed(): ClinicalInput {
  return {
    modality: 'mixed_voice_text',
    raw,
    language: 'es',
    capturedAt,
    actorId,
    encounterId,
  }
}

describe('Consultorio GP7 — typed / voice / mixed convergen en Clinical Truth', () => {
  it('las tres modalidades cruzan la misma frontera de normalizacion y conservan exactamente el mismo contenido clinico', () => {
    const outputs = [typed(), voice(), mixed()].map(normalizeClinicalInput)

    expect(outputs.map((input) => input.normalizedText)).toEqual([raw, raw, raw])
    expect(outputs.every((input) => input.encounterId === encounterId)).toBe(true)
    expect(outputs.every((input) => input.actorId === actorId)).toBe(true)
    expect(outputs.every((input) => input.requiresClinicalInterpretation)).toBe(true)
    expect(outputs.map((input) => input.modality)).toEqual(['free_text', 'dictation', 'mixed_voice_text'])
  })

  it('voz no obtiene una puerta distinta: una captura no sellada no puede entrar aunque typed/mixed si tengan texto valido', () => {
    const open = appendTranscriptSegment(
      createVoiceSession({
        id: 'voice-open-gp7',
        encounterId,
        provider: 'synthetic-test-provider',
        language: 'es',
        startedAt: '2026-08-24T14:14:59.000Z',
      }),
      {
        id: 'seg-open',
        sequence: 0,
        text: raw,
        status: 'final',
        receivedAt: '2026-08-24T14:14:59.100Z',
        finalizedAt: '2026-08-24T14:14:59.800Z',
        needsReview: false,
      },
    )

    expect(() => sealedVoiceSessionToClinicalInput(open, capturedAt, actorId)).toThrow(/not sealed/)
    expect(() => normalizeClinicalInput(typed())).not.toThrow()
    expect(() => normalizeClinicalInput(mixed())).not.toThrow()
  })

  it('ninguna modalidad puede saltarse identidad de encuentro, contenido o timestamp validos', () => {
    for (const modality of ['free_text', 'dictation', 'mixed_voice_text'] as const) {
      expect(() => normalizeClinicalInput({ ...typed(), modality, encounterId: '' })).toThrow(/encounterId is required/)
      expect(() => normalizeClinicalInput({ ...typed(), modality, raw: '   ' })).toThrow(/ClinicalInput.raw is required/)
      expect(() => normalizeClinicalInput({ ...typed(), modality, capturedAt: 'no-es-fecha' })).toThrow(/capturedAt must be a valid timestamp/)
    }
  })
})
