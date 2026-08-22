/**
 * GOLDEN — Voice Engine: una ambigüedad clínicamente material quedaba VARADA para siempre al sellar la sesión.
 *
 * QUÉ FALLABA
 *  Un segmento final con `needsReview: true` y dos hipótesis de dosis registradas por el proveedor
 *  («start vanco fifteen» / «start vanco fifty») no tenía ninguna salida hacia la hipótesis rival una vez
 *  sellada la captura:
 *   - `resolveTranscriptReview` —que sí sigue disponible sobre una sesión sellada, por diseño— rechazaba
 *     cualquier `resolvedText` distinto del texto actual cuando el segmento era `final`, remitiendo al
 *     «linaje de corrección clínica» de `reviseTranscriptSegment`;
 *   - pero `reviseTranscriptSegment` está cerrado tras `endVoiceSession` por `assertNotTerminal`, incluso con
 *     `reason: 'clinician_correction'`.
 *  Las dos puertas se remitían la una a la otra y las dos estaban cerradas. El resultado no es que el sistema
 *  «falle seguro»: es que la disposición del médico queda imposible y la única hipótesis que puede sobrevivir
 *  es la que el proveedor dejó encima. Sobre una dosis de vancomicina eso es un factor de más de tres decidido
 *  por el reconocedor y no por el médico, con la marca de revisión encendida a perpetuidad como único registro.
 *
 * CÓMO SE DESCUBRIÓ
 *  Auditoría independiente Codex, sólo lectura, sobre el SHA exacto
 *  f38907a07e9bd6b84b3086b234f1366c419b7c3b: un hallazgo P1 bloqueante restante del checkpoint
 *  VOICE ENGINE 001 (el otro P1 de esa tanda, la contradicción del slice activo canónico, ya está cerrado).
 *
 * CAUSA RAÍZ
 *  Se confundió «final» con «ya dispuesto». `final` dice que el PROVEEDOR dejó de revisar ese texto; no dice
 *  que el MÉDICO haya elegido entre las hipótesis que ese mismo segmento tiene registradas. La guarda trataba
 *  la resolución de revisión —un acto del clínico sobre transcript ya capturado— como si fuera una transición
 *  de captura más, y por eso la ató al estado de la captura.
 *
 * REGLA QUE LO HACE SEGURO
 *  - `resolveTranscriptReview` puede elegir cualquier hipótesis **realmente registrada** del segmento (su texto
 *    actual o una de sus `alternatives`), sea el segmento parcial o final, esté la sesión abierta o sellada.
 *  - Lo prohibido no cambia: texto que nadie oyó se sigue rechazando, hace falta actor identificado y
 *    justificación, y el texto elegido debe pasar la compuerta estructural.
 *  - No es una transición de captura y no relaja ninguna: tras sellar, `appendTranscriptSegment`,
 *    `reviseTranscriptSegment` y `finalizeTranscriptSegment` se siguen rechazando, y la resolución no toca
 *    `status` ni `finalizedAt`.
 *  - El linaje queda entero en `TranscriptReviewResolution`: texto previo, confianza previa, alternativas
 *    previas, quién, cuándo y por qué — y llega intacto a `ClinicalInput`.
 *  - La confianza sigue perteneciendo al texto que la ganó: la alternativa elegida se queda sólo con SU
 *    puntuación registrada, y si nunca se puntuó queda desconocida. Nunca hereda la de la descartada.
 *
 * QUÉ NO CUBRE
 *  - No juzga si la hipótesis que el médico eligió era la clínicamente correcta: sólo que puede elegirla y que
 *    la elección queda atribuida, fechada y reconstruible.
 *  - No abre ninguna vía para recuperar una hipótesis que ya no figura en `alternatives` (por ejemplo, la que
 *    quedó sólo en `reviewResolutions` tras una reapertura): resolver elige entre lo registrado en el segmento.
 *  - No fija política de cuándo debe sellarse una sesión ni umbral de latencia: eso es del Evaluation Kernel y
 *    de la capa de captura, que este slice no construye.
 *  - Sigue sin cubrir el P2 no bloqueante: ante arribos desordenados, el primer parcial útil sigue el orden de
 *    llegada y no la marca de tiempo más temprana.
 */
import { describe, expect, it } from 'vitest'
import {
  appendTranscriptSegment,
  createVoiceSession,
  endVoiceSession,
  finalizeTranscriptSegment,
  measureVoiceSession,
  resolveTranscriptReview,
  reviseTranscriptSegment,
  voiceSessionToClinicalInput,
  type TranscriptAlternative,
} from '@/lib/voice-engine'

const startedAt = '2026-08-17T18:00:00.000Z'
const ALTERNATIVES: readonly TranscriptAlternative[] = [
  { text: 'start vanco fifty', confidence: 0.41 },
  { text: 'start vanco fifteen', confidence: 0.44 },
]

/** Dosis ambigua, ya final, y la captura sellada: el médico llega a revisar cuando el micrófono ya se cerró. */
function sealedAmbiguousDose(alternatives: readonly TranscriptAlternative[] = ALTERNATIVES) {
  const captured = appendTranscriptSegment(
    createVoiceSession({ id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language: 'spanglish', startedAt }),
    {
      id: 'seg-1', sequence: 0, text: 'start vanco fifteen', status: 'final',
      receivedAt: '2026-08-17T18:00:00.200Z', finalizedAt: '2026-08-17T18:00:00.600Z', confidence: 0.44,
      alternatives, needsReview: false,
    },
  )
  expect(captured.segments[0].needsReview).toBe(true)
  return endVoiceSession(captured, '2026-08-17T18:00:00.800Z')
}

describe('Voice Engine — sellar no puede dejar varada una ambigüedad clínicamente material', () => {
  it('el médico puede elegir la hipótesis rival ya registrada sobre un segmento final de una sesión sellada', () => {
    const sealed = sealedAmbiguousDose()
    expect(measureVoiceSession(sealed).unresolvedReviewCount).toBe(1)

    const resolved = resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo, no quince',
    })

    expect(resolved.segments[0].text).toBe('start vanco fifty')
    expect(resolved.segments[0].needsReview).toBe(false)
    expect(resolved.segments[0].alternatives).toBeUndefined()
    expect(measureVoiceSession(resolved).unresolvedReviewCount).toBe(0)
  })

  it('resolver no es una transición de captura: no toca el estado final ni la marca de finalización ni el sellado', () => {
    const sealed = sealedAmbiguousDose()
    const resolved = resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo',
    })
    expect(resolved.segments[0].status).toBe('final')
    expect(resolved.segments[0].finalizedAt).toBe('2026-08-17T18:00:00.600Z')
    expect(resolved.endedAt).toBe('2026-08-17T18:00:00.800Z')
    expect(resolved.segments[0].revisions).toHaveLength(0)
    // La latencia estable no se mueve por una disposición del médico horas después.
    expect(measureVoiceSession(resolved).timeToFinalMs).toBe(600)
  })

  it('sigue sin poder redactar texto que nadie oyó, ni sin actor, ni sin justificación', () => {
    const sealed = sealedAmbiguousDose()
    expect(() => resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vancomycin 50 mg per kilo', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'lo reconstruyo yo',
    })).toThrow(/must select recorded transcript text, not new text/)
    expect(() => resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: '   ', rationale: 'era cincuenta',
    })).toThrow(/requires an identified resolver and a rationale/)
    expect(() => resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: '   ',
    })).toThrow(/requires an identified resolver and a rationale/)
    // Y una resolución fechada antes del linaje ya registrado sigue siendo un artefacto obsoleto.
    expect(() => resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:00:00.500Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'era cincuenta',
    })).toThrow(/Stale voice transition rejected: resolvedAt precedes the newest recorded state of transcript segment seg-1/)
    expect(sealed.segments[0].text).toBe('start vanco fifteen')
  })

  it('la captura del proveedor sigue cerrada tras sellar: ni agregar, ni revisar, ni finalizar', () => {
    const sealed = sealedAmbiguousDose()
    expect(() => appendTranscriptSegment(sealed, {
      id: 'seg-2', sequence: 1, text: 'frase que llega tarde', status: 'partial', receivedAt: '2026-08-17T18:05:00.000Z', needsReview: false,
    })).toThrow(/is already ended; appending a transcript segment cannot modify a sealed capture session/)
    for (const reason of ['provider_revision', 'contextual_correction', 'clinician_correction'] as const) {
      expect(() => reviseTranscriptSegment({
        session: sealed, segmentId: 'seg-1', revisedText: 'start vanco fifty', revisedAt: '2026-08-17T18:05:00.000Z', reason,
      })).toThrow(/is already ended; a revision cannot modify a sealed capture session/)
    }

    // Y la finalización también, incluso partiendo de una sesión sellada con un segmento resuelto.
    const resolved = resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo',
    })
    expect(() => finalizeTranscriptSegment({ session: resolved, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:06:00.000Z' }))
      .toThrow(/is already ended; finalization cannot modify a sealed capture session/)
  })

  it('el linaje de la resolución conserva texto, confianza, alternativas, actor, motivo y momento, y llega a ClinicalInput', () => {
    const resolved = resolveTranscriptReview({
      session: sealedAmbiguousDose(), segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo, no quince',
    })
    expect(resolved.segments[0].reviewResolutions?.[0]).toMatchObject({
      previousText: 'start vanco fifteen',
      resolvedText: 'start vanco fifty',
      previousConfidence: 0.44,
      resolvedBy: 'clinician-synthetic-1',
      resolvedAt: '2026-08-17T18:05:00.000Z',
      rationale: 'El médico confirma cincuenta miligramos por kilo, no quince',
    })
    expect(resolved.segments[0].reviewResolutions?.[0].previousAlternatives).toEqual([
      { text: 'start vanco fifty', confidence: 0.41 },
      { text: 'start vanco fifteen', confidence: 0.44 },
    ])

    const provenance = voiceSessionToClinicalInput(resolved, '2026-08-17T18:06:00.000Z').voiceProvenance
    expect(provenance.needsReview).toBe(false)
    expect(provenance.segments[0].reviewResolutions?.[0].previousText).toBe('start vanco fifteen')
    expect(provenance.segments[0].reviewResolutions?.[0].previousAlternatives?.map((a) => a.text))
      .toEqual(['start vanco fifty', 'start vanco fifteen'])
    expect(voiceSessionToClinicalInput(resolved, '2026-08-17T18:06:00.000Z').raw).toBe('start vanco fifty')
  })

  it('la hipótesis elegida se queda sólo con SU confianza registrada, nunca con la de la descartada', () => {
    const scored = resolveTranscriptReview({
      session: sealedAmbiguousDose(), segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo',
    })
    expect(scored.segments[0].confidence).toBe(0.41)
    expect(scored.segments[0].confidence).not.toBe(0.44)

    const unscored = resolveTranscriptReview({
      session: sealedAmbiguousDose([{ text: 'start vanco fifty' }, { text: 'start vanco fifteen', confidence: 0.44 }]),
      segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo',
    })
    expect(unscored.segments[0].confidence).toBeUndefined()
    expect(unscored.segments[0].reviewResolutions?.[0].previousConfidence).toBe(0.44)

    // Confirmar el texto actual sí conserva la confianza de ESE texto.
    const confirmed = resolveTranscriptReview({
      session: sealedAmbiguousDose(), segmentId: 'seg-1', resolvedText: 'start vanco fifteen', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma quince miligramos por kilo',
    })
    expect(confirmed.segments[0].confidence).toBe(0.44)
  })

  it('sin revisión pendiente no hay nada que resolver: no es una vía libre para cambiar un transcript final', () => {
    const unambiguous = endVoiceSession(
      appendTranscriptSegment(
        createVoiceSession({ id: 'voice-2', encounterId: 'enc-1', provider: 'synthetic-test-provider', language: 'es', startedAt }),
        {
          id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'final',
          receivedAt: '2026-08-17T18:00:00.200Z', finalizedAt: '2026-08-17T18:00:00.600Z', needsReview: false,
        },
      ),
      '2026-08-17T18:00:00.800Z',
    )
    expect(() => resolveTranscriptReview({
      session: unambiguous, segmentId: 'seg-1', resolvedText: 'ceftriaxona 2 gramos IV', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'nada que resolver',
    })).toThrow(/no unresolved review to resolve/)
  })
})
