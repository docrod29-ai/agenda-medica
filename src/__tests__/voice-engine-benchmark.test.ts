import { describe, expect, it } from 'vitest'
import { evaluateVoiceBenchmarkCase, summarizeVoiceBenchmark } from '@/lib/voice-engine'

describe('Voice Engine benchmark contract', () => {
  it('scores exact clinical transcription as zero error', () => {
    const result = evaluateVoiceBenchmarkCase({
      id: 'exact-es',
      reference: 'Niega fiebre. Iniciar ceftriaxona 2 g IV cada 24 horas.',
      hypothesis: 'Niega fiebre. Iniciar ceftriaxona 2 g IV cada 24 horas.',
      criticalTerms: [
        { value: 'niega', kind: 'negation' },
        { value: 'ceftriaxona', kind: 'medication' },
        { value: '2 g', kind: 'dose' },
      ],
      timeToFirstPartialMs: 120,
      timeToFinalMs: 610,
      revisionCount: 0,
      unresolvedReviewCount: 0,
      forcedRepeatCount: 0,
    })
    expect(result.wordErrorRate).toBe(0)
    expect(result.criticalTermErrorRate).toBe(0)
    expect(result.medicationErrorRate).toBe(0)
    expect(result.doseErrorRate).toBe(0)
    expect(result.negationErrorRate).toBe(0)
  })

  it('makes a clinically dangerous medication/dose/negation miss visible even when most words are correct', () => {
    const result = evaluateVoiceBenchmarkCase({
      id: 'critical-miss',
      reference: 'Paciente niega alergia. Dar metotrexate 15 mg semanal.',
      hypothesis: 'Paciente alergia. Dar metronidazol 50 mg semanal.',
      criticalTerms: [
        { value: 'niega', kind: 'negation' },
        { value: 'metotrexate', kind: 'medication' },
        { value: '15 mg', kind: 'dose' },
      ],
      revisionCount: 2,
      unresolvedReviewCount: 1,
      forcedRepeatCount: 1,
    })
    expect(result.wordErrorRate).toBeGreaterThan(0)
    expect(result.medicationErrorRate).toBe(1)
    expect(result.doseErrorRate).toBe(1)
    expect(result.negationErrorRate).toBe(1)
    expect(result.criticalTermErrorRate).toBe(1)
  })

  it('preserves latency, correction burden, unresolved review and forced-repeat metrics', () => {
    const result = evaluateVoiceBenchmarkCase({
      id: 'spanglish',
      reference: 'Start vanco 1 gram, denies dyspnea',
      hypothesis: 'Start vanco 1 gram, denies dyspnea',
      criticalTerms: [
        { value: 'vanco', kind: 'medication' },
        { value: '1 gram', kind: 'dose' },
        { value: 'denies', kind: 'negation' },
      ],
      timeToFirstPartialMs: 90,
      timeToFinalMs: 430,
      revisionCount: 3,
      unresolvedReviewCount: 1,
      forcedRepeatCount: 2,
    })
    expect(result).toMatchObject({
      timeToFirstPartialMs: 90,
      timeToFinalMs: 430,
      correctionBurden: 3,
      unresolvedReviewCount: 1,
      forcedRepeatCount: 2,
    })
  })

  it('summarizes provider-neutral cases deterministically', () => {
    const first = evaluateVoiceBenchmarkCase({
      id: 'a', reference: 'ceftriaxona 2 g', hypothesis: 'ceftriaxona 2 g',
      criticalTerms: [{ value: 'ceftriaxona', kind: 'medication' }, { value: '2 g', kind: 'dose' }],
      timeToFirstPartialMs: 100, timeToFinalMs: 500, revisionCount: 0, unresolvedReviewCount: 0, forcedRepeatCount: 0,
    })
    const second = evaluateVoiceBenchmarkCase({
      id: 'b', reference: 'niega fiebre', hypothesis: 'fiebre',
      criticalTerms: [{ value: 'niega', kind: 'negation' }],
      timeToFirstPartialMs: 200, timeToFinalMs: 700, revisionCount: 2, unresolvedReviewCount: 1, forcedRepeatCount: 1,
    })
    expect(summarizeVoiceBenchmark([first, second])).toMatchObject({
      cases: 2,
      meanTimeToFirstPartialMs: 150,
      meanTimeToFinalMs: 600,
      meanCorrectionBurden: 1,
      meanUnresolvedReviewCount: 0.5,
      meanForcedRepeatCount: 0.5,
    })
  })
})
