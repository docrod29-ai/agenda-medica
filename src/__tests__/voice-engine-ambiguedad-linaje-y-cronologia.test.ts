/**
 * GOLDEN — Voice Engine: ambigüedad no resuelta, linaje de revisión y cronología imposible.
 *
 * QUÉ FALLABA
 *  1. La ambigüedad se podía limpiar en silencio. `appendTranscriptSegment` aceptaba `needsReview: false`
 *     aunque el segmento trajera hipótesis en competencia, y `finalizeTranscriptSegment` /
 *     `reviseTranscriptSegment` sobrescribían un `needsReview: true` con `false` con sólo pasar el argumento.
 *     Un dictado ambiguo («start vanco fifteen» vs «start vanco fifty») podía llegar a `ClinicalInput` como
 *     transcript final sin marca de revisión, por el mero hecho de finalizarlo.
 *  2. El linaje de revisión guardaba sólo el texto anterior. La confianza y las alternativas en competencia
 *     que la revisión reemplazaba se perdían: la procedencia de la revisión quedaba incompleta y no se podía
 *     reconstruir con qué grado de certeza —ni contra qué hipótesis rivales— se había escrito lo anterior.
 *  3. La cronología imposible se aplanaba en vez de rechazarse. `measureVoiceSession` calculaba la latencia con
 *     `Math.max(0, …)`, así que un segmento fechado ANTES del inicio de su propia sesión no se rechazaba:
 *     se reportaba como 0 ms, es decir, como la mejor latencia posible del corpus.
 *  4. Faltaban dimensiones obligatorias del banco de pruebas: no había medición explícita de corrección
 *     contextual / calidad de recuperación, y la repetición forzada existía sólo como conteo absoluto, sin
 *     tasa ni denominador, por lo que no era comparable entre casos ni entre proveedores.
 *
 * CÓMO SE DESCUBRIÓ
 *  Auditoría independiente Codex, sólo lectura, sobre el SHA exacto
 *  4aba2a9cb2dfdd05bcd87205d22a8bab7fec8b41 (run de origen 32335436023): FAIL con exactamente cuatro
 *  hallazgos P1 bloqueantes del checkpoint VOICE ENGINE 001.
 *
 * CAUSA RAÍZ
 *  Las tres primeras comparten la misma raíz: una transición de estado se trataba como si tuviera autoridad
 *  para reescribir hechos que no le pertenecen. Finalizar es un cambio de estado del transcript, no un acto
 *  clínico que resuelva ambigüedad; revisar reemplaza texto, no borra de dónde venía; y una marca de tiempo
 *  imposible es un defecto de reloj, no un cero. La cuarta es una laguna del contrato de métricas: un conteo
 *  sin denominador no es una tasa.
 *
 * REGLA QUE LO HACE SEGURO
 *  - Las hipótesis en competencia FUERZAN `needsReview`. `needsReview` es monótona en toda transición: se
 *    puede subir, nunca bajar. La única salida es `resolveTranscriptReview`, que exige actor identificado,
 *    justificación, y texto **ya escuchado** (el actual o una alternativa registrada) — resolver es elegir
 *    entre hipótesis, nunca redactar una nueva.
 *  - Toda `TranscriptRevision` y toda `TranscriptReviewResolution` conservan `previousText`,
 *    `previousConfidence` y `previousAlternatives`.
 *  - `receivedAt` anterior a `startedAt` se rechaza al anexar, y `measureVoiceSession` lanza en vez de aplanar.
 *  - `forcedRepeatRate` y `contextualRecoveryRate` sólo existen con denominador válido; sin él quedan
 *    `undefined` explícito, nunca 0.
 *
 * QUÉ NO CUBRE
 *  - No juzga si la resolución del médico fue clínicamente correcta: sólo que es auditable, atribuida y
 *    elegida entre lo que de verdad se oyó.
 *  - No define umbrales de aceptación de latencia, WER ni tasa de repetición: eso es del Evaluation Kernel.
 *  - No cubre la elección de proveedor de ASR ni captura real de audio.
 *  - `hasCompetingAlternatives` compara texto normalizado, no significado: dos alternativas que dicen lo mismo
 *    con otras palabras se cuentan como competencia (señala de más, nunca de menos).
 */
import { describe, expect, it } from 'vitest'
import {
  appendTranscriptSegment,
  createVoiceSession,
  evaluateVoiceBenchmarkCase,
  finalizeTranscriptSegment,
  measureVoiceSession,
  resolveTranscriptReview,
  reviseTranscriptSegment,
  summarizeVoiceBenchmark,
  voiceSessionToClinicalInput,
  type VoiceSession,
} from '@/lib/voice-engine'

const startedAt = '2026-08-17T18:00:00.000Z'

function session() {
  return createVoiceSession({ id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language: 'spanglish', startedAt })
}

/** Dictado ambiguo real: dos hipótesis de dosis en competencia, y el proveedor las declara sin marcar revisión. */
function ambiguousSegment() {
  return appendTranscriptSegment(session(), {
    id: 'seg-1', sequence: 0, text: 'start vanco fifteen', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', confidence: 0.44,
    alternatives: [{ text: 'start vanco fifty', confidence: 0.41 }, { text: 'start vanco fifteen', confidence: 0.44 }], needsReview: false,
  })
}

describe('Voice Engine — la ambigüedad no resuelta no se limpia en silencio', () => {
  it('las hipótesis en competencia fuerzan revisión aunque el proveedor diga que no hace falta', () => {
    const current = ambiguousSegment()
    expect(current.segments[0].needsReview).toBe(true)
    expect(measureVoiceSession(current).unresolvedReviewCount).toBe(1)
  })

  it('finalizar NO convierte un dictado ambiguo en transcript libre de revisión', () => {
    const current = ambiguousSegment()
    expect(() => finalizeTranscriptSegment({
      session: current, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.600Z', needsReview: false,
    })).toThrow(/Unresolved transcript review cannot be cleared by finalization/)

    const finalized = finalizeTranscriptSegment({ session: current, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.600Z' })
    expect(finalized.segments[0].needsReview).toBe(true)
    expect(voiceSessionToClinicalInput(finalized, '2026-08-17T18:00:00.700Z').voiceProvenance.needsReview).toBe(true)
  })

  it('una revisión tampoco puede bajar la marca de revisión, ni conservando las hipótesis rivales', () => {
    const current = ambiguousSegment()
    expect(() => reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: 'start vanco fifteen milligrams', revisedAt: '2026-08-17T18:00:00.300Z', reason: 'contextual_correction', needsReview: false,
    })).toThrow(/Unresolved transcript review cannot be cleared by a revision/)

    const revised = reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: 'start vanco fifteen milligrams', revisedAt: '2026-08-17T18:00:00.300Z', reason: 'contextual_correction',
    })
    expect(revised.segments[0].needsReview).toBe(true)
  })

  it('una alternativa en competencia introducida por la revisión levanta la marca de revisión', () => {
    const clean = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', needsReview: false,
    })
    const revised = reviseTranscriptSegment({
      session: clean, segmentId: 'seg-1', revisedText: 'ceftriaxona 2 gramos IV', revisedAt: '2026-08-17T18:00:00.300Z', reason: 'provider_revision',
      alternatives: [{ text: 'ceftriaxona 1 gramo IV', confidence: 0.46 }, { text: 'ceftriaxona 2 gramos IV', confidence: 0.48 }],
    })
    expect(revised.segments[0].needsReview).toBe(true)
  })

  it('sólo la resolución explícita y atribuida limpia la revisión, y queda auditable', () => {
    const finalized = finalizeTranscriptSegment({ session: ambiguousSegment(), segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.600Z' })
    const resolved = resolveTranscriptReview({
      session: finalized, segmentId: 'seg-1', resolvedText: 'start vanco fifteen', resolvedAt: '2026-08-17T18:00:00.900Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma quince miligramos por kilo, no cincuenta',
    })
    expect(resolved.segments[0].needsReview).toBe(false)
    expect(resolved.segments[0].alternatives).toBeUndefined()
    expect(resolved.segments[0].reviewResolutions?.[0]).toMatchObject({
      resolvedBy: 'clinician-synthetic-1', previousText: 'start vanco fifteen', resolvedText: 'start vanco fifteen', previousConfidence: 0.44,
    })
    expect(resolved.segments[0].reviewResolutions?.[0].previousAlternatives).toHaveLength(2)

    const provenance = voiceSessionToClinicalInput(resolved, '2026-08-17T18:00:01.000Z').voiceProvenance
    expect(provenance.needsReview).toBe(false)
    expect(provenance.segments[0].reviewResolutions?.[0].previousAlternatives?.map((a) => a.text)).toEqual(['start vanco fifty', 'start vanco fifteen'])
  })

  it('resolver no autoriza a redactar texto nuevo, ni sin actor, ni sin justificación, ni sin revisión pendiente', () => {
    const current = ambiguousSegment()
    expect(() => resolveTranscriptReview({
      session: current, segmentId: 'seg-1', resolvedText: 'start vancomycin 15 mg per kilo', resolvedAt: '2026-08-17T18:00:00.900Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'reconstrucción',
    })).toThrow(/must select recorded transcript text, not new text/)
    expect(() => resolveTranscriptReview({
      session: current, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:00:00.900Z', resolvedBy: '  ', rationale: 'ok',
    })).toThrow(/requires an identified resolver and a rationale/)
    expect(() => resolveTranscriptReview({
      session: current, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:00:00.900Z', resolvedBy: 'clinician-synthetic-1', rationale: '   ',
    })).toThrow(/requires an identified resolver and a rationale/)

    const clean = appendTranscriptSegment(session(), {
      id: 'seg-9', sequence: 9, text: 'sin datos de choque', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', needsReview: false,
    })
    expect(() => resolveTranscriptReview({
      session: clean, segmentId: 'seg-9', resolvedText: 'sin datos de choque', resolvedAt: '2026-08-17T18:00:00.900Z', resolvedBy: 'clinician-synthetic-1', rationale: 'nada que resolver',
    })).toThrow(/no unresolved review to resolve/)
    expect(current.segments[0].needsReview).toBe(true)
  })

  it('resolver no es una puerta trasera para reemplazar un transcript ya final', () => {
    const finalized = finalizeTranscriptSegment({ session: ambiguousSegment(), segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.600Z' })
    expect(() => resolveTranscriptReview({
      session: finalized, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:00:00.900Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'era cincuenta',
    })).toThrow(/Final transcript cannot be silently replaced by a review resolution/)
    expect(finalized.segments[0].text).toBe('start vanco fifteen')
  })
})

describe('Voice Engine — el linaje de revisión conserva confianza y alternativas reemplazadas', () => {
  it('la confianza y las hipótesis rivales anteriores siguen siendo recuperables tras ser reemplazadas', () => {
    const revised = reviseTranscriptSegment({
      session: ambiguousSegment(), segmentId: 'seg-1', revisedText: 'start vanco fifteen milligrams per kilo', revisedAt: '2026-08-17T18:00:00.300Z',
      reason: 'contextual_correction', confidence: 0.91, alternatives: [{ text: 'start vanco fifteen milligrams per kilo', confidence: 0.91 }],
    })
    const revision = revised.segments[0].revisions[0]
    expect(revision.previousText).toBe('start vanco fifteen')
    expect(revision.previousConfidence).toBe(0.44)
    expect(revision.previousAlternatives).toEqual([
      { text: 'start vanco fifty', confidence: 0.41 },
      { text: 'start vanco fifteen', confidence: 0.44 },
    ])
    expect(revised.segments[0].confidence).toBe(0.91)
    expect(revised.segments[0].alternatives).toHaveLength(1)
  })

  it('el historial completo llega intacto a ClinicalInput a través de varias revisiones', () => {
    let current = reviseTranscriptSegment({
      session: ambiguousSegment(), segmentId: 'seg-1', revisedText: 'start vanco fifteen milligrams', revisedAt: '2026-08-17T18:00:00.300Z',
      reason: 'provider_revision', confidence: 0.72, alternatives: [{ text: 'start vanco fifteen milligrams', confidence: 0.72 }],
    })
    current = reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: 'start vanco fifteen milligrams per kilo', revisedAt: '2026-08-17T18:00:00.450Z',
      reason: 'clinician_correction', confidence: 0.99,
    })
    current = finalizeTranscriptSegment({ session: current, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.700Z' })

    const revisions = voiceSessionToClinicalInput(current, '2026-08-17T18:00:00.800Z').voiceProvenance.segments[0].revisions
    expect(revisions).toHaveLength(2)
    expect(revisions[0].previousConfidence).toBe(0.44)
    expect(revisions[0].previousAlternatives).toHaveLength(2)
    expect(revisions[1].previousConfidence).toBe(0.72)
    expect(revisions[1].previousAlternatives).toEqual([{ text: 'start vanco fifteen milligrams', confidence: 0.72 }])
    expect(revisions[1].previousText).toBe('start vanco fifteen milligrams')
  })

  it('no inventa confianza previa donde el proveedor nunca la dio', () => {
    const noConfidence = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'niega disnea', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', needsReview: false,
    })
    const revised = reviseTranscriptSegment({
      session: noConfidence, segmentId: 'seg-1', revisedText: 'niega disnea y dolor torácico', revisedAt: '2026-08-17T18:00:00.300Z', reason: 'provider_revision',
    })
    expect(revised.segments[0].revisions[0].previousConfidence).toBeUndefined()
    expect(revised.segments[0].revisions[0].previousAlternatives).toBeUndefined()
  })
})

describe('Voice Engine — la cronología imposible se rechaza, no se aplana a cero', () => {
  it('rechaza un segmento que llega antes de que su propia sesión empezara', () => {
    expect(() => appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T17:59:59.900Z', needsReview: false,
    })).toThrow(/Impossible voice chronology rejected: receivedAt precedes session startedAt/)
  })

  it('la métrica determinista lanza en vez de reportar 0 ms ante un reloj imposible', () => {
    const impossible = {
      id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language: 'es', startedAt,
      firstPartialReceivedAt: '2026-08-17T17:59:59.800Z',
      segments: [{
        id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T17:59:59.800Z', needsReview: false, revisions: [],
      }],
    } as unknown as VoiceSession
    expect(() => measureVoiceSession(impossible)).toThrow(/Impossible voice chronology rejected/)
  })

  it('el borde exacto sigue siendo medible: llegar en el instante de inicio son 0 ms legítimos', () => {
    const current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: startedAt, needsReview: false,
    })
    expect(measureVoiceSession(current).timeToFirstPartialMs).toBe(0)
  })
})

describe('Voice Engine — dimensiones obligatorias del banco de pruebas', () => {
  const base = {
    reference: 'Start vanco 1 gram, denies dyspnea',
    hypothesis: 'Start vanco 1 gram, denies dyspnea',
    criticalTerms: [{ value: 'vanco', kind: 'medication' as const }, { value: 'denies', kind: 'negation' as const }],
    revisionCount: 2,
    unresolvedReviewCount: 1,
  }

  it('mide calidad de recuperación contextual y tasa de repetición forzada con denominador válido', () => {
    const result = evaluateVoiceBenchmarkCase({
      ...base, id: 'recovery-and-repeat', timeToFirstPartialMs: 90, timeToFinalMs: 430,
      forcedRepeatCount: 2, physicianUtteranceCount: 8, contextualRecoveryOpportunityCount: 4, contextualRecoveredCount: 3,
    })
    expect(result.forcedRepeatRate).toBe(0.25)
    expect(result.contextualRecoveryRate).toBe(0.75)
    // Las dimensiones previas siguen intactas.
    expect(result).toMatchObject({ timeToFirstPartialMs: 90, timeToFinalMs: 430, correctionBurden: 2, unresolvedReviewCount: 1, forcedRepeatCount: 2 })
    expect(result.wordErrorRate).toBe(0)
    expect(result.medicationErrorRate).toBe(0)
    expect(result.negationErrorRate).toBe(0)
  })

  it('sin denominador la tasa queda undefined explícito, nunca cero', () => {
    const result = evaluateVoiceBenchmarkCase({ ...base, id: 'no-denominator', forcedRepeatCount: 2 })
    expect(result.forcedRepeatRate).toBeUndefined()
    expect(result.contextualRecoveryRate).toBeUndefined()
    expect(result.forcedRepeatCount).toBe(2)
  })

  it('rechaza denominadores ausentes o imposibles en vez de reescalarlos', () => {
    expect(() => evaluateVoiceBenchmarkCase({ ...base, id: 'x', forcedRepeatCount: 0, contextualRecoveredCount: 2 }))
      .toThrow(/contextual recovery count requires a positive contextual recovery opportunity count/)
    expect(() => evaluateVoiceBenchmarkCase({ ...base, id: 'x', forcedRepeatCount: 0, contextualRecoveryOpportunityCount: 2, contextualRecoveredCount: 3 }))
      .toThrow(/contextual recovery count cannot exceed its opportunity count/)
    expect(() => evaluateVoiceBenchmarkCase({ ...base, id: 'x', forcedRepeatCount: 5, physicianUtteranceCount: 4 }))
      .toThrow(/forced repeat count cannot exceed the physician utterance count/)
    expect(() => evaluateVoiceBenchmarkCase({ ...base, id: 'x', forcedRepeatCount: 0, physicianUtteranceCount: 2.5 }))
      .toThrow(/benchmark counts must be non-negative integers/)
  })

  it('el resumen agrega las dos dimensiones nuevas sin inventar las ausentes', () => {
    const measured = evaluateVoiceBenchmarkCase({
      ...base, id: 'a', forcedRepeatCount: 2, physicianUtteranceCount: 8, contextualRecoveryOpportunityCount: 4, contextualRecoveredCount: 3,
    })
    const alsoMeasured = evaluateVoiceBenchmarkCase({
      ...base, id: 'b', forcedRepeatCount: 3, physicianUtteranceCount: 4, contextualRecoveryOpportunityCount: 4, contextualRecoveredCount: 1,
    })
    const unmeasured = evaluateVoiceBenchmarkCase({ ...base, id: 'c', forcedRepeatCount: 1 })

    expect(summarizeVoiceBenchmark([measured, alsoMeasured])).toMatchObject({ cases: 2, meanForcedRepeatRate: 0.5, meanContextualRecoveryRate: 0.5 })
    expect(summarizeVoiceBenchmark([unmeasured]).meanForcedRepeatRate).toBeUndefined()
    expect(summarizeVoiceBenchmark([unmeasured]).meanContextualRecoveryRate).toBeUndefined()
    // Un caso sin denominador no arrastra a la baja la media de los que sí lo tienen.
    expect(summarizeVoiceBenchmark([measured, alsoMeasured, unmeasured]).meanForcedRepeatRate).toBe(0.5)
  })
})
