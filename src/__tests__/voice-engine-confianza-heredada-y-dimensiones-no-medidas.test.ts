/**
 * GOLDEN — Voice Engine: confianza heredada por otra hipótesis, latencia final desde un parcial, y
 * dimensiones del banco de pruebas nunca medidas que se reportaban como perfectas.
 *
 * QUÉ FALLABA
 *  1. La confianza se trataba como una propiedad del *hueco* del segmento, no de la *hipótesis*.
 *     `reviseTranscriptSegment` hacía `confidence: input.confidence ?? s.confidence`: al reemplazar el texto sin
 *     aportar confianza para el texto nuevo, el segmento se quedaba con la puntuación que había ganado el texto
 *     anterior. «ceftriaxona» oída con 0.82 se convertía en «cefepime» con 0.82 — una certeza que nadie midió
 *     sobre una palabra que nadie puntuó. Lo mismo por la vía de resolución: elegir la hipótesis rival
 *     («start vanco fifty») dejaba intacta la confianza de la hipótesis descartada («start vanco fifteen»,
 *     0.44), aunque la alternativa elegida se hubiera oído con 0.41 o sin puntuación alguna.
 *  2. Un segmento `partial` podía llevar `finalizedAt`. `appendTranscriptSegment` sólo validaba el caso final, y
 *     `measureVoiceSession` calculaba `timeToFinalMs` con `segments.filter(s => s.finalizedAt)`, sin mirar el
 *     estado. Una hipótesis todavía revisable producía así métrica de latencia final: el número que se usará
 *     para comparar proveedores salía de texto que aún podía cambiar.
 *  3. Una dimensión clínica que el corpus nunca midió se reportaba como 0 — es decir, como perfecta.
 *     `criticalTermErrorRate` dividía entre `Math.max(1, criticalTerms.length)` y medicación/dosis/negación
 *     usaban `?? 0`. Un caso sin un solo término de medicación declaraba «tasa de error de medicación: 0», y
 *     `summarizeVoiceBenchmark` promediaba ese 0 con los casos realmente medidos, bajando la media global.
 *     Un corpus vacío de esas dimensiones parecía un motor clínicamente impecable.
 *
 * CÓMO SE DESCUBRIÓ
 *  Auditoría independiente Codex, sólo lectura, sobre el SHA exacto
 *  ce11fae427ae2ed957d9b1deb063c8de3d744547 (run 32382463886): FAIL con exactamente tres hallazgos P1
 *  bloqueantes del checkpoint VOICE ENGINE 001.
 *
 * CAUSA RAÍZ
 *  Las tres son la misma confusión aplicada a tres campos: **el hueco donde vive un dato no es el dato**. La
 *  confianza pertenece al texto que se puntuó, no al segmento que lo contiene; la marca de finalización
 *  pertenece a la transición a `final`, no al registro; y una tasa pertenece a su denominador, no a su columna
 *  del informe. Cuando el hueco sobrevive al dato, el valor viejo —o el cero— se lee como medición nueva.
 *
 * REGLA QUE LO HACE SEGURO
 *  - La confianza sólo sobrevive mientras sobrevive el texto que puntuó. Texto distinto sin confianza aportada
 *    para ÉL queda con confianza desconocida; al elegir una alternativa se toma la confianza registrada para
 *    esa alternativa, si existe. La puntuación anterior no se pierde: baja al linaje (`previousConfidence` de
 *    la revisión o de la resolución).
 *  - `finalizedAt` sólo puede existir tras una transición válida a `final`. Anexar un `partial` con
 *    `finalizedAt` se rechaza, y `measureVoiceSession` lanza ante ese estado imposible en vez de medir.
 *  - Sin denominador no hay tasa: término crítico, medicación, dosis y negación quedan `undefined` explícito, y
 *    el resumen las excluye en vez de promediar un cero que nadie midió.
 *
 * QUÉ NO CUBRE
 *  - No juzga si la confianza que aporta el proveedor es correcta, sólo a qué texto pertenece.
 *  - No fija umbrales de aceptación de latencia, WER ni tasa de error clínico: eso es del Evaluation Kernel.
 *  - No impone que un corpus mida todas las dimensiones; sólo impide que la ausencia se lea como acierto.
 *  - No cubre el P2 no bloqueante registrado en la directiva: la latencia de primer parcial sigue el orden de
 *    llegada y no la marca de tiempo más temprana ante arribos desordenados.
 */
import { describe, expect, it } from 'vitest'
import {
  appendTranscriptSegment,
  createVoiceSession,
  endVoiceSession,
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

function session(language: 'es' | 'en' | 'spanglish' = 'es') {
  return createVoiceSession({ id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language, startedAt })
}

/** Hipótesis puntuada por el proveedor: un texto y la confianza que ese texto —y sólo ese— ganó. */
function scoredPartial() {
  return appendTranscriptSegment(session(), {
    id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', confidence: 0.82, needsReview: false,
  })
}

/** Dictado ambiguo con dos hipótesis puntuadas por separado. */
function ambiguousPartial(alternatives: readonly { text: string; confidence?: number }[]) {
  return appendTranscriptSegment(session('spanglish'), {
    id: 'seg-1', sequence: 0, text: 'start vanco fifteen', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', confidence: 0.44,
    alternatives, needsReview: false,
  })
}

describe('Voice Engine — el texto de reemplazo no hereda la confianza de otra hipótesis', () => {
  it('una revisión que cambia el texto sin aportar confianza deja la confianza desconocida, no la del texto anterior', () => {
    const revised = reviseTranscriptSegment({
      session: scoredPartial(), segmentId: 'seg-1', revisedText: 'cefepime 2 gramos IV', revisedAt: '2026-08-17T18:00:00.350Z', reason: 'provider_revision',
    })
    expect(revised.segments[0].text).toBe('cefepime 2 gramos IV')
    expect(revised.segments[0].confidence).toBeUndefined()
    // La puntuación anterior no se pierde: queda en el linaje, atada al texto que sí la ganó.
    expect(revised.segments[0].revisions[0]).toMatchObject({ previousText: 'ceftriaxona 2 gramos IV', previousConfidence: 0.82 })
  })

  it('la confianza desconocida llega desconocida a ClinicalInput, sin recuperarse en la finalización', () => {
    let current = reviseTranscriptSegment({
      session: scoredPartial(), segmentId: 'seg-1', revisedText: 'cefepime 2 gramos IV', revisedAt: '2026-08-17T18:00:00.350Z', reason: 'clinician_correction',
    })
    current = finalizeTranscriptSegment({ session: current, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.600Z' })
    const provenance = voiceSessionToClinicalInput(current, '2026-08-17T18:00:00.700Z').voiceProvenance
    expect(provenance.segments[0].confidence).toBeUndefined()
    expect(provenance.segments[0].revisions[0].previousConfidence).toBe(0.82)
  })

  it('la confianza aportada PARA el texto nuevo sí se conserva, y el texto sin cambio conserva la suya', () => {
    const scored = reviseTranscriptSegment({
      session: scoredPartial(), segmentId: 'seg-1', revisedText: 'cefepime 2 gramos IV', revisedAt: '2026-08-17T18:00:00.350Z', reason: 'provider_revision', confidence: 0.61,
    })
    expect(scored.segments[0].confidence).toBe(0.61)

    // Misma hipótesis, sólo se declaran alternativas: la confianza sigue perteneciendo a ese mismo texto.
    const unchangedText = reviseTranscriptSegment({
      session: scoredPartial(), segmentId: 'seg-1', revisedText: 'ceftriaxona 2 gramos IV', revisedAt: '2026-08-17T18:00:00.350Z', reason: 'provider_revision',
      alternatives: [{ text: 'ceftriaxona 1 gramo IV', confidence: 0.4 }, { text: 'ceftriaxona 2 gramos IV', confidence: 0.82 }],
    })
    expect(unchangedText.segments[0].confidence).toBe(0.82)
  })

  it('elegir la hipótesis rival toma la confianza de ESA alternativa, no la de la descartada', () => {
    const resolved = resolveTranscriptReview({
      session: ambiguousPartial([{ text: 'start vanco fifty', confidence: 0.41 }, { text: 'start vanco fifteen', confidence: 0.44 }]),
      segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:00:00.900Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo',
    })
    expect(resolved.segments[0].text).toBe('start vanco fifty')
    expect(resolved.segments[0].confidence).toBe(0.41)
    expect(resolved.segments[0].reviewResolutions?.[0]).toMatchObject({ previousText: 'start vanco fifteen', previousConfidence: 0.44 })
  })

  it('elegir una alternativa sin puntuación deja la confianza desconocida, nunca la de la hipótesis descartada', () => {
    const resolved = resolveTranscriptReview({
      session: ambiguousPartial([{ text: 'start vanco fifty' }, { text: 'start vanco fifteen', confidence: 0.44 }]),
      segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:00:00.900Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo',
    })
    expect(resolved.segments[0].confidence).toBeUndefined()
    expect(resolved.segments[0].reviewResolutions?.[0].previousConfidence).toBe(0.44)
    expect(resolved.segments[0].reviewResolutions?.[0].previousAlternatives).toHaveLength(2)
  })

  it('confirmar la hipótesis actual no borra su propia confianza', () => {
    const resolved = resolveTranscriptReview({
      session: ambiguousPartial([{ text: 'start vanco fifty', confidence: 0.41 }, { text: 'start vanco fifteen', confidence: 0.44 }]),
      segmentId: 'seg-1', resolvedText: 'start vanco fifteen', resolvedAt: '2026-08-17T18:00:00.900Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma quince miligramos por kilo',
    })
    expect(resolved.segments[0].confidence).toBe(0.44)
  })
})

describe('Voice Engine — un segmento parcial no produce métrica de latencia final', () => {
  it('rechaza anexar un parcial que ya trae finalizedAt', () => {
    expect(() => appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z',
      finalizedAt: '2026-08-17T18:00:00.500Z', needsReview: false,
    })).toThrow(/Partial transcript segment cannot carry finalizedAt/)
  })

  it('la métrica lanza en vez de reportar timeToFinalMs desde un parcial con marca final', () => {
    const impossible = {
      id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language: 'es', startedAt,
      firstPartialReceivedAt: '2026-08-17T18:00:00.200Z',
      segments: [{
        id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z',
        finalizedAt: '2026-08-17T18:00:00.500Z', needsReview: false, revisions: [],
      }],
    } as unknown as VoiceSession
    expect(() => measureVoiceSession(impossible)).toThrow(/partial transcript segment seg-1 carries finalizedAt/)
  })

  it('mientras el transcript sigue parcial no hay latencia final; sólo aparece tras la transición válida', () => {
    const partial = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', needsReview: false,
    })
    expect(measureVoiceSession(partial).timeToFinalMs).toBeUndefined()

    const finalized = finalizeTranscriptSegment({ session: partial, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.620Z' })
    // Reforzado por la directiva P1 de 75d86a20: la transición válida es condición necesaria pero ya no
    // suficiente — la latencia estable exige además que la sesión esté sellada.
    expect(measureVoiceSession(finalized).timeToFinalMs).toBeUndefined()
    expect(measureVoiceSession(endVoiceSession(finalized, '2026-08-17T18:00:00.700Z')).timeToFinalMs).toBe(620)
  })

  // Reforzado por la directiva P1 de 4367b7c2: mientras quede UN parcial en la sesión no hay latencia estable
  // en absoluto. Ver `voice-engine-latencia-util-y-captura-imposible.test.ts`.
  it('un parcial pendiente deja la latencia final indefinida, no la del subconjunto ya finalizado', () => {
    let current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'primera frase', status: 'partial', receivedAt: '2026-08-17T18:00:00.100Z', needsReview: false,
    })
    current = finalizeTranscriptSegment({ session: current, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.400Z' })
    current = appendTranscriptSegment(current, {
      id: 'seg-2', sequence: 1, text: 'segunda frase todavía en curso', status: 'partial', receivedAt: '2026-08-17T18:00:00.500Z', needsReview: false,
    })
    expect(measureVoiceSession(current).timeToFinalMs).toBeUndefined()

    const stable = endVoiceSession(
      finalizeTranscriptSegment({ session: current, segmentId: 'seg-2', finalizedAt: '2026-08-17T18:00:00.900Z' }),
      '2026-08-17T18:00:01.000Z',
    )
    expect(measureVoiceSession(stable).timeToFinalMs).toBe(900)
  })
})

describe('Voice Engine — una dimensión nunca medida no puede parecer perfecta', () => {
  const base = {
    reference: 'Paciente estable, sin cambios',
    hypothesis: 'Paciente estable, sin cambios',
    revisionCount: 0,
    unresolvedReviewCount: 0,
    forcedRepeatCount: 0,
  }

  it('un corpus sin términos críticos no reporta cero error clínico: reporta ausencia de medición', () => {
    const result = evaluateVoiceBenchmarkCase({ ...base, id: 'sin-terminos-criticos', criticalTerms: [] })
    expect(result.criticalTermErrorRate).toBeUndefined()
    expect(result.medicationErrorRate).toBeUndefined()
    expect(result.doseErrorRate).toBeUndefined()
    expect(result.negationErrorRate).toBeUndefined()
    // La transcripción sí se midió; sólo las dimensiones clínicas sin denominador quedan sin tasa.
    expect(result.wordErrorRate).toBe(0)
  })

  it('sólo queda medida la dimensión que el corpus realmente declaró', () => {
    const result = evaluateVoiceBenchmarkCase({
      ...base, id: 'solo-negacion', reference: 'Paciente niega fiebre', hypothesis: 'Paciente niega fiebre',
      criticalTerms: [{ value: 'niega', kind: 'negation' }],
    })
    expect(result.negationErrorRate).toBe(0)
    expect(result.criticalTermErrorRate).toBe(0)
    expect(result.medicationErrorRate).toBeUndefined()
    expect(result.doseErrorRate).toBeUndefined()
  })

  it('el resumen excluye la dimensión no medida en vez de convertirla en cero error', () => {
    const unmeasured = evaluateVoiceBenchmarkCase({ ...base, id: 'sin-medir', criticalTerms: [] })
    const empty = summarizeVoiceBenchmark([unmeasured])
    expect(empty.meanCriticalTermErrorRate).toBeUndefined()
    expect(empty.meanMedicationErrorRate).toBeUndefined()
    expect(empty.meanDoseErrorRate).toBeUndefined()
    expect(empty.meanNegationErrorRate).toBeUndefined()

    // Un caso de medicación fallada no se diluye con casos que jamás midieron medicación.
    const missedMedication = evaluateVoiceBenchmarkCase({
      ...base, id: 'medicacion-fallada', reference: 'Dar metotrexate 15 mg semanal', hypothesis: 'Dar metronidazol 15 mg semanal',
      criticalTerms: [{ value: 'metotrexate', kind: 'medication' }],
    })
    expect(missedMedication.medicationErrorRate).toBe(1)
    expect(summarizeVoiceBenchmark([missedMedication, unmeasured, unmeasured]).meanMedicationErrorRate).toBe(1)
  })
})
