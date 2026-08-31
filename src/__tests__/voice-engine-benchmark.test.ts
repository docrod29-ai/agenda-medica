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

  it('measures every mandatory clinical voice evaluation dimension without inventing unmeasured values', () => {
    const measured = evaluateVoiceBenchmarkCase({
      id: 'full-metric-contract',
      reference: 'SpO2 88 percent, PEEP 10, start norepinephrine 0.1 mcg/kg/min, denies chest pain',
      hypothesis: 'SpO2 98 percent, PEEP 10, start norepinephrine 0.1 mcg/kg/min, chest pain',
      criticalTerms: [
        { value: 'SpO2 88 percent', kind: 'numeric_lab' },
        { value: 'PEEP 10', kind: 'specialty_term' },
        { value: 'start norepinephrine', kind: 'code_switching' },
        { value: 'norepinephrine', kind: 'medication' },
        { value: '0.1 mcg/kg/min', kind: 'dose' },
        { value: 'denies', kind: 'negation' },
      ],
      timeToFirstPartialMs: 80,
      timeToFinalMs: 420,
      revisionCount: 1,
      unresolvedReviewCount: 1,
      forcedRepeatCount: 0,
      clinicallySignificantReferenceCount: 2,
      clinicallySignificantOmissionSubstitutionCount: 2,
      hallucinatedContentCount: 1,
      physicianEditTimeMs: 12500,
      physicianSatisfactionScore: 4,
    })
    expect(measured.numericLabErrorRate).toBe(1)
    expect(measured.specialtyTerminologyErrorRate).toBe(0)
    expect(measured.codeSwitchingErrorRate).toBe(0)
    expect(measured.clinicallySignificantOmissionSubstitutionRate).toBe(1)
    expect(measured.hallucinatedContentRate).toBeGreaterThan(0)
    expect(measured.physicianEditTimeMs).toBe(12500)
    expect(measured.physicianSatisfactionScore).toBe(4)

    const unmeasured = evaluateVoiceBenchmarkCase({
      id: 'unmeasured-human-metrics', reference: 'niega fiebre', hypothesis: 'niega fiebre',
      criticalTerms: [{ value: 'niega', kind: 'negation' }], revisionCount: 0, unresolvedReviewCount: 0, forcedRepeatCount: 0,
    })
    expect(unmeasured.numericLabErrorRate).toBeUndefined()
    expect(unmeasured.physicianEditTimeMs).toBeUndefined()
    expect(unmeasured.physicianSatisfactionScore).toBeUndefined()
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

  it('summarizes provider-neutral cases deterministically including optional clinical/human metrics', () => {
    const first = evaluateVoiceBenchmarkCase({
      id: 'a', reference: 'ceftriaxona 2 g SpO2 96', hypothesis: 'ceftriaxona 2 g SpO2 96',
      criticalTerms: [{ value: 'ceftriaxona', kind: 'medication' }, { value: '2 g', kind: 'dose' }, { value: 'SpO2 96', kind: 'numeric_lab' }],
      timeToFirstPartialMs: 100, timeToFinalMs: 500, revisionCount: 0, unresolvedReviewCount: 0, forcedRepeatCount: 0,
      physicianEditTimeMs: 10000, physicianSatisfactionScore: 5,
    })
    const second = evaluateVoiceBenchmarkCase({
      id: 'b', reference: 'niega fiebre SpO2 90', hypothesis: 'fiebre SpO2 99',
      criticalTerms: [{ value: 'niega', kind: 'negation' }, { value: 'SpO2 90', kind: 'numeric_lab' }],
      timeToFirstPartialMs: 200, timeToFinalMs: 700, revisionCount: 2, unresolvedReviewCount: 1, forcedRepeatCount: 1,
      physicianEditTimeMs: 20000, physicianSatisfactionScore: 3,
    })
    expect(summarizeVoiceBenchmark([first, second])).toMatchObject({
      cases: 2,
      meanNumericLabErrorRate: 0.5,
      meanTimeToFirstPartialMs: 150,
      meanTimeToFinalMs: 600,
      meanCorrectionBurden: 1,
      meanUnresolvedReviewCount: 0.5,
      meanForcedRepeatCount: 0.5,
      meanPhysicianEditTimeMs: 15000,
      meanPhysicianSatisfactionScore: 4,
    })
  })
})
