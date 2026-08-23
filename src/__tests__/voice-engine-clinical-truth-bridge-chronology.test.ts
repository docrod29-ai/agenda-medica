import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  appendTranscriptSegment,
  createVoiceSession,
  endVoiceSession,
  type VoiceSession,
} from '@/lib/voice-engine'
import { sealedVoiceSessionToClinicalInput } from '@/lib/voice-engine/clinical-truth-bridge'

function finalSession() {
  return appendTranscriptSegment(
    createVoiceSession({
      id: 'voice-safe-bridge',
      encounterId: 'enc-safe-bridge',
      provider: 'synthetic-test-provider',
      language: 'es',
      startedAt: '2026-08-23T18:00:00.000Z',
    }),
    {
      id: 'seg-1',
      sequence: 0,
      text: 'paciente niega fiebre',
      status: 'final',
      receivedAt: '2026-08-23T18:00:00.100Z',
      finalizedAt: '2026-08-23T18:00:02.000Z',
      needsReview: false,
    },
  )
}

function sourceFiles(root: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    const absolute = join(root, entry)
    const stat = statSync(absolute)
    if (stat.isDirectory()) out.push(...sourceFiles(absolute))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(absolute)
  }
  return out
}

describe('Voice → Clinical Truth production bridge', () => {
  it('rejects a forged seal that predates a final transcript transition', () => {
    const forged: VoiceSession = {
      ...finalSession(),
      endedAt: '2026-08-23T18:00:01.000Z',
    }

    expect(() => sealedVoiceSessionToClinicalInput(forged, '2026-08-23T18:00:03.000Z'))
      .toThrow(/endedAt precedes the newest recorded state of transcript segment seg-1/)
  })

  it('rejects ClinicalInput capture time before the voice capture was actually sealed', () => {
    const sealed = endVoiceSession(finalSession(), '2026-08-23T18:00:02.500Z')

    expect(() => sealedVoiceSessionToClinicalInput(sealed, '2026-08-23T18:00:02.400Z'))
      .toThrow(/capturedAt precedes endedAt/)
  })

  it('passes a chronologically valid sealed session without changing its transcript', () => {
    const sealed = endVoiceSession(finalSession(), '2026-08-23T18:00:02.500Z')
    const input = sealedVoiceSessionToClinicalInput(sealed, '2026-08-23T18:00:03.000Z', 'clinician-test')

    expect(input.raw).toBe('paciente niega fiebre')
    expect(input.encounterId).toBe('enc-safe-bridge')
    expect(input.actorId).toBe('clinician-test')
    expect(input.voiceProvenance.segments.map((segment) => segment.id)).toEqual(['seg-1'])
  })

  it('prevents production code from bypassing the hardened bridge by importing the raw serializer', () => {
    const srcRoot = join(process.cwd(), 'src')
    const allowed = new Set([
      'src/lib/voice-engine/index.ts',
      'src/lib/voice-engine/clinical-truth-bridge.ts',
    ])
    const offenders = sourceFiles(srcRoot)
      .map((file) => relative(process.cwd(), file).replaceAll('\\', '/'))
      .filter((file) => !file.startsWith('src/__tests__/'))
      .filter((file) => !allowed.has(file))
      .filter((file) => readFileSync(join(process.cwd(), file), 'utf8').includes('voiceSessionToClinicalInput'))

    expect(offenders).toEqual([])
  })
})
