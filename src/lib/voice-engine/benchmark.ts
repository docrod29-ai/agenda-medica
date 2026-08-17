export interface VoiceBenchmarkCriticalTerm {
  value: string
  kind: 'clinical_term' | 'medication' | 'dose' | 'negation'
}

export interface VoiceBenchmarkCase {
  id: string
  reference: string
  hypothesis: string
  criticalTerms: readonly VoiceBenchmarkCriticalTerm[]
  timeToFirstPartialMs?: number
  timeToFinalMs?: number
  revisionCount: number
  unresolvedReviewCount: number
  forcedRepeatCount: number
}

export interface VoiceBenchmarkResult {
  caseId: string
  wordErrorRate: number
  criticalTermErrorRate: number
  medicationErrorRate: number
  doseErrorRate: number
  negationErrorRate: number
  timeToFirstPartialMs?: number
  timeToFinalMs?: number
  correctionBurden: number
  unresolvedReviewCount: number
  forcedRepeatCount: number
}

function tokens(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('es-MX')
    .replace(/[^\p{L}\p{N}%./+-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function levenshtein(a: readonly string[], b: readonly string[]): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}

function containsPhrase(hypothesisTokens: readonly string[], phrase: string): boolean {
  const expected = tokens(phrase)
  if (!expected.length) return false
  for (let i = 0; i <= hypothesisTokens.length - expected.length; i += 1) {
    if (expected.every((token, offset) => hypothesisTokens[i + offset] === token)) return true
  }
  return false
}

function errorRateForKind(
  criticalTerms: readonly VoiceBenchmarkCriticalTerm[],
  hypothesisTokens: readonly string[],
  kind: VoiceBenchmarkCriticalTerm['kind'],
): number {
  const terms = criticalTerms.filter((term) => term.kind === kind)
  if (!terms.length) return 0
  const errors = terms.filter((term) => !containsPhrase(hypothesisTokens, term.value)).length
  return errors / terms.length
}

export function evaluateVoiceBenchmarkCase(input: VoiceBenchmarkCase): VoiceBenchmarkResult {
  if (!input.id.trim()) throw new Error('benchmark case id is required')
  if (!input.reference.trim()) throw new Error('benchmark reference is required')
  if (!input.hypothesis.trim()) throw new Error('benchmark hypothesis is required')
  for (const value of [input.revisionCount, input.unresolvedReviewCount, input.forcedRepeatCount]) {
    if (!Number.isInteger(value) || value < 0) throw new Error('benchmark counts must be non-negative integers')
  }
  for (const value of [input.timeToFirstPartialMs, input.timeToFinalMs]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error('benchmark latencies must be non-negative')
  }

  const referenceTokens = tokens(input.reference)
  const hypothesisTokens = tokens(input.hypothesis)
  const criticalErrors = input.criticalTerms.filter((term) => !containsPhrase(hypothesisTokens, term.value)).length

  return {
    caseId: input.id,
    wordErrorRate: levenshtein(referenceTokens, hypothesisTokens) / Math.max(1, referenceTokens.length),
    criticalTermErrorRate: criticalErrors / Math.max(1, input.criticalTerms.length),
    medicationErrorRate: errorRateForKind(input.criticalTerms, hypothesisTokens, 'medication'),
    doseErrorRate: errorRateForKind(input.criticalTerms, hypothesisTokens, 'dose'),
    negationErrorRate: errorRateForKind(input.criticalTerms, hypothesisTokens, 'negation'),
    timeToFirstPartialMs: input.timeToFirstPartialMs,
    timeToFinalMs: input.timeToFinalMs,
    correctionBurden: input.revisionCount,
    unresolvedReviewCount: input.unresolvedReviewCount,
    forcedRepeatCount: input.forcedRepeatCount,
  }
}

export function summarizeVoiceBenchmark(results: readonly VoiceBenchmarkResult[]) {
  if (!results.length) throw new Error('at least one benchmark result is required')
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const present = (values: Array<number | undefined>) => values.filter((value): value is number => value !== undefined)
  const firstPartial = present(results.map((result) => result.timeToFirstPartialMs))
  const final = present(results.map((result) => result.timeToFinalMs))
  return {
    cases: results.length,
    meanWordErrorRate: mean(results.map((result) => result.wordErrorRate)),
    meanCriticalTermErrorRate: mean(results.map((result) => result.criticalTermErrorRate)),
    meanMedicationErrorRate: mean(results.map((result) => result.medicationErrorRate)),
    meanDoseErrorRate: mean(results.map((result) => result.doseErrorRate)),
    meanNegationErrorRate: mean(results.map((result) => result.negationErrorRate)),
    meanTimeToFirstPartialMs: firstPartial.length ? mean(firstPartial) : undefined,
    meanTimeToFinalMs: final.length ? mean(final) : undefined,
    meanCorrectionBurden: mean(results.map((result) => result.correctionBurden)),
    meanUnresolvedReviewCount: mean(results.map((result) => result.unresolvedReviewCount)),
    meanForcedRepeatCount: mean(results.map((result) => result.forcedRepeatCount)),
  }
}
