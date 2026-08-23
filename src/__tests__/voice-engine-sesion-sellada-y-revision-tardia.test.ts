/**
 * GOLDEN — Voice Engine: latencia «estable» publicada durante una pausa del streaming, y una revisión tardía del
 * proveedor que pisa en silencio lo que el médico ya había resuelto.
 *
 * QUÉ FALLABA
 *  1. `measureVoiceSession` trataba «todos los segmentos que conozco ahora mismo son finales» como transcript
 *     estable y publicaba `timeToFinalMs`. Pero la sesión seguía ABIERTA: `appendTranscriptSegment` aceptaba un
 *     segmento nuevo justo después, y el número recién publicado dejaba de ser cierto. Desde dentro de la sesión,
 *     una pausa entre dos frases del mismo dictado es indistinguible del final del dictado; el motor no tenía
 *     ninguna forma de decir «esto terminó». El resultado es la métrica que se usará para comparar proveedores
 *     medida sobre un silencio.
 *  2. Tras `resolveTranscriptReview` —la única salida auditable de una ambigüedad, con actor, justificación y
 *     texto realmente oído— el segmento quedaba `needsReview: false` y sin alternativas. Una revisión posterior
 *     del proveedor (`provider_revision` / `contextual_correction`) cambiaba entonces el texto y calculaba
 *     `needsReview` desde ese `false`: sin alternativas en el segmento, `hasCompetingAlternatives` no veía nada
 *     en competencia y la marca se quedaba abajo. La hipótesis rival que el médico había DESCARTADO volvía a
 *     entrar, se podía finalizar y cruzaba a Clinical Truth como verdad libre de revisión. Con una dosis
 *     («start vanco fifteen» → «start vanco fifty») eso es un factor de más de tres en vancomicina, firmado.
 *
 * CÓMO SE DESCUBRIÓ
 *  Auditoría independiente Codex, sólo lectura, sobre el SHA exacto
 *  75d86a20df4955a82d7157e8f2f8b1cc053292d1 (run 32421053031): FAIL con exactamente dos hallazgos P1 bloqueantes
 *  del checkpoint VOICE ENGINE 001. El CI canónico #1142 estaba en verde sobre ese mismo SHA.
 *
 * CAUSA RAÍZ
 *  Las dos son la misma omisión con dos caras: **se dio por terminado algo que nadie había declarado terminado**.
 *  El transcript se dio por estable porque nada se movía en ese instante, y la disposición del médico se dio por
 *  vigente sobre un texto que ya no era el que él había dispuesto. En ambos casos falta un acto explícito —sellar
 *  la sesión, reabrir la revisión— y en ambos casos la ausencia de ese acto se leyó como permiso.
 *
 * REGLA QUE LO HACE SEGURO
 *  - Estado terminal explícito: `endVoiceSession` sella la captura. Sólo se puede sellar cuando ningún segmento
 *    sigue siendo revisable y `endedAt` es cronológicamente posible contra el inicio de la sesión y contra el
 *    linaje de cada segmento. Después, `appendTranscriptSegment`, `reviseTranscriptSegment` y
 *    `finalizeTranscriptSegment` se rechazan.
 *  - `timeToFinalMs` exige AMBAS cosas: sesión sellada y ningún segmento parcial. Mientras falte una, es
 *    `undefined` — ausencia explícita, nunca un número optimista.
 *  - `resolveTranscriptReview` sigue disponible sobre una sesión sellada: limpiar una revisión es un acto del
 *    médico sobre transcript ya capturado, no una transición de captura. (La restricción original —sobre un
 *    segmento final una resolución sólo podía confirmar el texto ya presente— dejaba varada la ambigüedad al
 *    sellar y quedó SUPERADA por el P1 de `f38907a0`; ver
 *    `voice-engine-ambiguedad-varada-tras-sellar.test.ts`. Lo que no cambió: sólo se puede elegir entre las
 *    hipótesis realmente registradas, nunca redactar texto nuevo.)
 *  - Una revisión de proveedor o contextual que cambia el texto que un médico ya dispuso REABRE la revisión
 *    (`reopenedResolvedReview` en el linaje). La resolución no se borra: sigue en `reviewResolutions` con su
 *    actor, su justificación y las hipótesis que descartó. Como `needsReview` es monótona, finalizar no la puede
 *    bajar y el segmento no cruza a Clinical Truth como verdad libre de revisión hasta que el médico vuelva a
 *    disponer. Una `clinician_correction` es el médico actuando otra vez y no reabre.
 *
 * QUÉ NO CUBRE
 *  - No juzga si la resolución del médico era clínicamente correcta, ni si la hipótesis tardía del proveedor era
 *    la buena: sólo que la sustitución no puede ocurrir en silencio.
 *  - No fija umbral alguno de latencia estable ni política de cuándo debe sellarse una sesión: eso es del
 *    Evaluation Kernel y de la capa de captura, que este slice no construye.
 *  - No valida `endedAt` contra el reloj real ni contra el fin del audio, sólo contra el inicio de la sesión y el
 *    linaje ya registrado.
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
  type VoiceSession,
} from '@/lib/voice-engine'

const startedAt = '2026-08-17T18:00:00.000Z'

function session(language: 'es' | 'en' | 'spanglish' = 'es') {
  return createVoiceSession({ id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language, startedAt })
}

/** Una frase ya finalizada mientras el médico simplemente respira: la sesión sigue abierta. */
function pausedStream() {
  return appendTranscriptSegment(session(), {
    id: 'seg-1', sequence: 0, text: 'primera frase del dictado', status: 'final',
    receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.400Z', needsReview: false,
  })
}

describe('Voice Engine — una pausa del streaming no es el final del dictado', () => {
  it('no publica latencia estable mientras la sesión siga abierta, aunque todo lo conocido sea final', () => {
    const paused = pausedStream()
    expect(paused.segments.every((s) => s.status === 'final')).toBe(true)
    expect(paused.endedAt).toBeUndefined()
    expect(measureVoiceSession(paused).timeToFinalMs).toBeUndefined()
  })

  it('la pausa era pausa: llega otra frase y la sesión abierta sigue sin latencia estable', () => {
    let current = appendTranscriptSegment(pausedStream(), {
      id: 'seg-2', sequence: 1, text: 'segunda frase tras la pausa', status: 'partial', receivedAt: '2026-08-17T18:00:03.000Z', needsReview: false,
    })
    expect(measureVoiceSession(current).timeToFinalMs).toBeUndefined()

    current = finalizeTranscriptSegment({ session: current, segmentId: 'seg-2', finalizedAt: '2026-08-17T18:00:03.500Z' })
    expect(measureVoiceSession(current).timeToFinalMs).toBeUndefined()

    current = endVoiceSession(current, '2026-08-17T18:00:03.600Z')
    expect(measureVoiceSession(current).timeToFinalMs).toBe(3500)
  })

  it('sellar exige que no quede ningún segmento revisable', () => {
    const open = appendTranscriptSegment(pausedStream(), {
      id: 'seg-2', sequence: 1, text: 'segunda frase todavía en curso', status: 'partial', receivedAt: '2026-08-17T18:00:01.000Z', needsReview: false,
    })
    expect(() => endVoiceSession(open, '2026-08-17T18:00:02.000Z'))
      .toThrow(/cannot be sealed while transcript segments are still revisable: seg-2/)
  })

  it('una sesión sellada ya no acepta más captura: ni agregar, ni revisar, ni finalizar', () => {
    const sealed = endVoiceSession(pausedStream(), '2026-08-17T18:00:00.500Z')
    expect(() => appendTranscriptSegment(sealed, {
      id: 'seg-2', sequence: 1, text: 'frase que llega tarde', status: 'partial', receivedAt: '2026-08-17T18:00:01.000Z', needsReview: false,
    })).toThrow(/is already ended; appending a transcript segment cannot modify a sealed capture session/)
    expect(() => reviseTranscriptSegment({
      session: sealed, segmentId: 'seg-1', revisedText: 'primera frase del dictado corregida', revisedAt: '2026-08-17T18:00:01.000Z', reason: 'clinician_correction',
    })).toThrow(/is already ended; a revision cannot modify a sealed capture session/)
    expect(() => endVoiceSession(sealed, '2026-08-17T18:00:01.000Z')).toThrow(/is already ended/)

    const withPartial = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'frase en curso', status: 'partial', receivedAt: '2026-08-17T18:00:00.100Z', needsReview: false,
    })
    const sealedLater = endVoiceSession(
      finalizeTranscriptSegment({ session: withPartial, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.400Z' }),
      '2026-08-17T18:00:00.500Z',
    )
    expect(() => finalizeTranscriptSegment({ session: sealedLater, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.900Z' }))
      .toThrow(/is already ended; finalization cannot modify a sealed capture session/)
  })

  it('la cronología del sellado falla cerrada, no se recorta', () => {
    expect(() => endVoiceSession(pausedStream(), '2026-08-17T17:59:59.900Z'))
      .toThrow(/Impossible voice chronology rejected: endedAt precedes session startedAt/)
    expect(() => endVoiceSession(pausedStream(), '2026-08-17T18:00:00.300Z'))
      .toThrow(/Impossible voice chronology rejected: endedAt precedes the newest recorded state of transcript segment seg-1/)
    expect(() => endVoiceSession(pausedStream(), 'al rato')).toThrow(/endedAt must be a valid timestamp/)

    const impossible = {
      id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language: 'es', startedAt,
      endedAt: '2026-08-17T18:00:00.200Z',
      segments: [{
        id: 'seg-1', sequence: 0, text: 'primera frase del dictado', status: 'final',
        receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.600Z', needsReview: false, revisions: [],
      }],
    } as unknown as VoiceSession
    expect(() => measureVoiceSession(impossible))
      .toThrow(/transcript finalized after voice session voice-1 was ended/)
  })

  it('sellar no le cierra la puerta al médico: la resolución de una revisión sigue disponible', () => {
    const ambiguous = appendTranscriptSegment(session('spanglish'), {
      id: 'seg-1', sequence: 0, text: 'start vanco fifteen', status: 'final',
      receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.500Z', confidence: 0.44,
      alternatives: [{ text: 'start vanco fifty', confidence: 0.41 }, { text: 'start vanco fifteen', confidence: 0.44 }], needsReview: true,
    })
    const sealed = endVoiceSession(ambiguous, '2026-08-17T18:00:00.700Z')
    expect(measureVoiceSession(sealed)).toMatchObject({ timeToFinalMs: 500, unresolvedReviewCount: 1 })

    const resolved = resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifteen', resolvedAt: '2026-08-17T18:00:30.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma quince, no cincuenta',
    })
    expect(resolved.segments[0].needsReview).toBe(false)
    expect(measureVoiceSession(resolved).timeToFinalMs).toBe(500)
  })
})

describe('Voice Engine — una revisión tardía no pisa en silencio lo que el médico ya resolvió', () => {
  /** Dosis ambigua resuelta por el médico: quince, no cincuenta. */
  function resolvedDose() {
    const ambiguous = appendTranscriptSegment(session('spanglish'), {
      id: 'seg-1', sequence: 0, text: 'start vanco fifteen', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', confidence: 0.44,
      alternatives: [{ text: 'start vanco fifty', confidence: 0.41 }, { text: 'start vanco fifteen', confidence: 0.44 }], needsReview: false,
    })
    expect(ambiguous.segments[0].needsReview).toBe(true)
    return resolveTranscriptReview({
      session: ambiguous, segmentId: 'seg-1', resolvedText: 'start vanco fifteen', resolvedAt: '2026-08-17T18:00:00.500Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma quince miligramos por kilo, no cincuenta',
    })
  }

  it.each(['provider_revision', 'contextual_correction'] as const)(
    'una %s posterior que reintroduce la dosis descartada reabre la revisión en vez de sustituirla',
    (reason) => {
      const resolved = resolvedDose()
      expect(resolved.segments[0].needsReview).toBe(false)

      const late = reviseTranscriptSegment({
        session: resolved, segmentId: 'seg-1', revisedText: 'start vanco fifty', revisedAt: '2026-08-17T18:00:00.800Z', reason,
      })
      expect(late.segments[0].text).toBe('start vanco fifty')
      expect(late.segments[0].needsReview).toBe(true)
      expect(late.segments[0].revisions[0]).toMatchObject({ previousText: 'start vanco fifteen', reason, reopenedResolvedReview: true })
      // La procedencia de la resolución del médico sigue intacta: quién, cuándo, por qué y qué descartó.
      expect(late.segments[0].reviewResolutions?.[0]).toMatchObject({
        resolvedBy: 'clinician-synthetic-1', resolvedText: 'start vanco fifteen', resolvedAt: '2026-08-17T18:00:00.500Z',
      })
      expect(late.segments[0].reviewResolutions?.[0].previousAlternatives).toHaveLength(2)

      // Y no puede volver a bajar la marca por la puerta de atrás de la finalización.
      expect(() => finalizeTranscriptSegment({
        session: late, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:01.000Z', needsReview: false,
      })).toThrow(/Unresolved transcript review cannot be cleared by finalization/)

      const finalized = finalizeTranscriptSegment({ session: late, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:01.000Z' })
      expect(finalized.segments[0].needsReview).toBe(true)
      const sealed = endVoiceSession(finalized, '2026-08-17T18:00:01.100Z')
      const provenance = voiceSessionToClinicalInput(sealed, '2026-08-17T18:00:01.200Z').voiceProvenance
      expect(provenance.needsReview).toBe(true)
      expect(provenance.segments[0].revisions[0].reopenedResolvedReview).toBe(true)
      expect(provenance.segments[0].reviewResolutions?.[0].resolvedBy).toBe('clinician-synthetic-1')
    },
  )

  it('reintroducir la hipótesis rival como alternativa, sin tocar el texto, también reabre la revisión', () => {
    const late = reviseTranscriptSegment({
      session: resolvedDose(), segmentId: 'seg-1', revisedText: 'start vanco fifteen', revisedAt: '2026-08-17T18:00:00.800Z',
      reason: 'provider_revision', alternatives: [{ text: 'start vanco fifty', confidence: 0.52 }, { text: 'start vanco fifteen', confidence: 0.44 }],
    })
    expect(late.segments[0].needsReview).toBe(true)
  })

  it('una revisión del proveedor que no cambia lo dispuesto no reabre nada', () => {
    const late = reviseTranscriptSegment({
      session: resolvedDose(), segmentId: 'seg-1', revisedText: 'start vanco fifteen', revisedAt: '2026-08-17T18:00:00.800Z', reason: 'provider_revision',
    })
    expect(late.segments[0].needsReview).toBe(false)
    expect(late.segments[0].revisions[0].reopenedResolvedReview).toBeUndefined()
  })

  it('el médico corrigiendo su propia disposición no se autoreabre revisión', () => {
    const corrected = reviseTranscriptSegment({
      session: resolvedDose(), segmentId: 'seg-1', revisedText: 'start vanco fifteen milligrams per kilo', revisedAt: '2026-08-17T18:00:00.800Z',
      reason: 'clinician_correction',
    })
    expect(corrected.segments[0].needsReview).toBe(false)
    expect(corrected.segments[0].revisions[0].reopenedResolvedReview).toBeUndefined()
    expect(corrected.segments[0].reviewResolutions).toHaveLength(1)
  })

  it('sin resolución previa, una revisión del proveedor se comporta exactamente como antes', () => {
    const clean = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', needsReview: false,
    })
    const revised = reviseTranscriptSegment({
      session: clean, segmentId: 'seg-1', revisedText: 'ceftriaxona 1 gramo IV', revisedAt: '2026-08-17T18:00:00.300Z', reason: 'provider_revision',
    })
    expect(revised.segments[0].needsReview).toBe(false)
    expect(revised.segments[0].revisions[0].reopenedResolvedReview).toBeUndefined()
  })
})
