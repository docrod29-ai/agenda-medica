/**
 * GOLDEN — Voice Engine: el puente hacia Clinical Truth exige captura sellada y transcript completo.
 *
 * QUÉ FALLABA
 *  `voiceSessionToClinicalInput` filtraba la sesión a sus segmentos `final` y emitía `ClinicalInput` con lo que
 *  quedara, aunque la sesión de voz siguiera abierta. Una sesión con una frase ya finalizada y otra todavía
 *  parcial —justo la que llevaba la dosis ambigua— producía un `ClinicalInput` que **omitía la parcial en
 *  silencio** y, como el segmento omitido era el único que llevaba `needsReview`, la procedencia declaraba
 *  `needsReview: false`. Un transcript truncado no deja huella en el expediente: la nota simplemente no menciona
 *  lo que se cayó, y nada río abajo distingue un transcript incompleto de un dictado corto.
 *
 * CÓMO SE DESCUBRIÓ
 *  Auditoría independiente de sólo lectura de Codex sobre el SHA exacto
 *  58a6d3da6a4dde30427f7bc9321e644e977b782c (run 32614444497), veredicto FAIL con exactamente un P1 bloqueante
 *  del checkpoint VOICE ENGINE 001. CI canónico #1179 estaba en verde sobre ese mismo SHA: la suite no probaba
 *  el caso mixto final + parcial en el puente.
 *
 * CAUSA RAÍZ
 *  El puente trataba «los segmentos finales que tengo delante» como «el transcript». Filtrar es una decisión
 *  silenciosa: descarta sin declarar qué descartó. Y «todo lo que conozco es final» no es el final del dictado
 *  —desde dentro de una sesión abierta una pausa del streaming es indistinguible de haber terminado de hablar—,
 *  cosa que `measureVoiceSession` ya había aprendido con el sellado y el puente no.
 *
 * REGLA QUE LO HACE SEGURO
 *  Dos condiciones, y ninguna se infiere del aspecto de los segmentos:
 *   1. la sesión está sellada explícitamente (`endedAt`, puesto por `endVoiceSession`);
 *   2. no queda ningún segmento no-final/revisable. `endVoiceSession` ya lo exige antes de sellar, pero el
 *      puente lo revalida contra el objeto que de verdad recibe: una sesión malformada o falsificada que lleve
 *      `endedAt` sin haber pasado por la transición de sellado falla cerrada aquí también, **nombrando** los
 *      segmentos que se niega a soltar en vez de filtrarlos.
 *  `endVoiceSession` sigue siendo la única transición de sellado y sigue exigiendo que todo esté final antes de
 *  sellar. La resolución tardía del médico (`resolveTranscriptReview`) sigue disponible tras sellar; la captura
 *  del proveedor (agregar / revisar / finalizar) sigue cerrada.
 *
 * QUÉ NO CUBRE
 *  - No decide CUÁNDO debe sellarse una sesión: esa política vive en la capa de captura que esta rebanada no
 *    construye. El puente sólo se niega a inventar el final.
 *  - No valida `endedAt` contra el reloj de pared ni contra el final del audio, ni `capturedAt` contra `endedAt`.
 *  - No juzga si el transcript sellado es clínicamente suficiente: eso sigue siendo del médico y de
 *    `needsReview`.
 *  - No cubre la elección de proveedor de ASR ni umbrales de aceptación (Evaluation Kernel).
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

/** Una frase ya finalizada, la sesión todavía abierta: el médico sólo hizo una pausa. */
function openWithFinalSegment() {
  return appendTranscriptSegment(session(), {
    id: 'seg-1', sequence: 0, text: 'paciente niega fiebre', status: 'final',
    receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.400Z', needsReview: false,
  })
}

/**
 * El caso del hallazgo: una frase final y otra todavía parcial con dos hipótesis de dosis en competencia.
 * La parcial es la clínicamente material y es la única que lleva la marca de revisión.
 */
function openWithFinalPlusAmbiguousPartial() {
  return appendTranscriptSegment(openWithFinalSegment(), {
    id: 'seg-2', sequence: 1, text: 'start vanco fifteen', status: 'partial', receivedAt: '2026-08-17T18:00:02.000Z', confidence: 0.44,
    alternatives: [{ text: 'start vanco fifty', confidence: 0.41 }, { text: 'start vanco fifteen', confidence: 0.44 }], needsReview: false,
  })
}

describe('Voice Engine — sin sellar no hay ClinicalInput', () => {
  it('rechaza una sesión abierta aunque su único segmento ya sea final', () => {
    const open = openWithFinalSegment()
    expect(open.segments.every((s) => s.status === 'final')).toBe(true)
    expect(open.endedAt).toBeUndefined()
    expect(() => voiceSessionToClinicalInput(open, '2026-08-17T18:00:00.500Z'))
      .toThrow(/Voice session voice-1 is not sealed; end capture through endVoiceSession before producing ClinicalInput/)
  })

  it('rechaza la sesión mixta final + parcial ambigua, y la parcial no puede caerse en silencio', () => {
    const open = openWithFinalPlusAmbiguousPartial()
    // Las hipótesis en competencia fuerzan revisión: el segmento omitido era justo el que la llevaba.
    expect(open.segments[1].needsReview).toBe(true)
    expect(measureVoiceSession(open).unresolvedReviewCount).toBe(1)

    expect(() => voiceSessionToClinicalInput(open, '2026-08-17T18:00:03.000Z')).toThrow(/is not sealed/)
    // Y no hay atajo por el sellado: seg-2 sigue revisable, así que la sesión tampoco puede sellarse.
    expect(() => endVoiceSession(open, '2026-08-17T18:00:03.000Z'))
      .toThrow(/cannot be sealed while transcript segments are still revisable: seg-2/)

    // Aun si la sesión llega al puente con el sello puesto por fuera, la parcial se nombra, no se filtra:
    // la hipótesis de dosis no entra a Clinical Truth por ninguna de las tres puertas.
    const forged: VoiceSession = { ...open, endedAt: '2026-08-17T18:00:03.000Z' }
    expect(() => voiceSessionToClinicalInput(forged, '2026-08-17T18:00:03.500Z'))
      .toThrow(/Voice session voice-1 cannot produce ClinicalInput while transcript segments are still revisable: seg-2/)
  })

  it('convierte la sesión sellada con todo el transcript final', () => {
    const sealed = endVoiceSession(
      finalizeTranscriptSegment({
        session: openWithFinalPlusAmbiguousPartial(), segmentId: 'seg-2', finalizedAt: '2026-08-17T18:00:02.400Z',
      }),
      '2026-08-17T18:00:02.600Z',
    )
    const input = voiceSessionToClinicalInput(sealed, '2026-08-17T18:00:03.000Z')
    expect(input.raw).toBe('paciente niega fiebre\nstart vanco fifteen')
    expect(input.capturedAt).toBe('2026-08-17T18:00:03.000Z')
    expect(input.encounterId).toBe('enc-1')
    expect(input.voiceProvenance.segments.map((s) => s.id)).toEqual(['seg-1', 'seg-2'])
  })

  it('falla cerrada ante una sesión malformada: sello ilegible, sello imposible o parcial superviviente', () => {
    const open = openWithFinalPlusAmbiguousPartial()
    // Sello ilegible + parcial pendiente: se rechaza, y se rechaza nombrando la parcial.
    const unreadableSealWithPartial: VoiceSession = { ...open, endedAt: 'al rato' }
    expect(() => voiceSessionToClinicalInput(unreadableSealWithPartial, '2026-08-17T18:00:03.000Z'))
      .toThrow(/cannot produce ClinicalInput while transcript segments are still revisable: seg-2/)

    const allFinal = finalizeTranscriptSegment({ session: open, segmentId: 'seg-2', finalizedAt: '2026-08-17T18:00:02.400Z' })
    // Sin parcial pendiente, un sello ilegible sigue sin poder emitir procedencia de captura.
    const unreadableSeal: VoiceSession = { ...allFinal, endedAt: 'al rato' }
    expect(() => voiceSessionToClinicalInput(unreadableSeal, '2026-08-17T18:00:03.000Z'))
      .toThrow(/endedAt must be a valid timestamp/)
    // Un sello anterior al inicio de la sesión es una captura imposible, no una captura rápida.
    const impossibleSeal: VoiceSession = { ...allFinal, endedAt: '2026-08-17T17:59:59.900Z' }
    expect(() => voiceSessionToClinicalInput(impossibleSeal, '2026-08-17T18:00:03.000Z'))
      .toThrow(/Impossible voice chronology rejected: endedAt precedes session startedAt/)
  })
})

describe('Voice Engine — sellar no resuelve la revisión, sólo cierra la captura', () => {
  /** Dosis ambigua ya final y sesión sellada: el micrófono se cerró con la revisión pendiente. */
  function sealedWithUnresolvedReview() {
    return endVoiceSession(appendTranscriptSegment(session('spanglish'), {
      id: 'seg-1', sequence: 0, text: 'start vanco fifteen', status: 'final',
      receivedAt: '2026-08-17T18:00:00.200Z', finalizedAt: '2026-08-17T18:00:00.600Z', confidence: 0.44,
      alternatives: [{ text: 'start vanco fifty', confidence: 0.41 }, { text: 'start vanco fifteen', confidence: 0.44 }], needsReview: false,
    }), '2026-08-17T18:00:00.800Z')
  }

  it('la sesión sellada con revisión pendiente llega a ClinicalInput como needsReview hasta que el médico dispone', () => {
    const sealed = sealedWithUnresolvedReview()
    expect(sealed.segments[0].needsReview).toBe(true)
    const before = voiceSessionToClinicalInput(sealed, '2026-08-17T18:01:00.000Z').voiceProvenance
    expect(before.needsReview).toBe(true)
    expect(before.segments[0].alternatives).toHaveLength(2)

    const resolved = resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta, no quince',
    })
    const after = voiceSessionToClinicalInput(resolved, '2026-08-17T18:06:00.000Z')
    expect(after.voiceProvenance.needsReview).toBe(false)
    expect(after.raw).toBe('start vanco fifty')
  })

  it('tras sellar, la captura del proveedor sigue cerrada y sólo la disposición del médico queda auditable', () => {
    const sealed = sealedWithUnresolvedReview()
    expect(() => appendTranscriptSegment(sealed, {
      id: 'seg-2', sequence: 1, text: 'frase que llega tarde', status: 'partial', receivedAt: '2026-08-17T18:05:00.000Z', needsReview: false,
    })).toThrow(/is already ended; appending a transcript segment cannot modify a sealed capture session/)
    for (const reason of ['provider_revision', 'contextual_correction', 'clinician_correction'] as const) {
      expect(() => reviseTranscriptSegment({
        session: sealed, segmentId: 'seg-1', revisedText: 'start vanco fifty', revisedAt: '2026-08-17T18:05:00.000Z', reason,
      })).toThrow(/is already ended; a revision cannot modify a sealed capture session/)
    }

    const resolved = resolveTranscriptReview({
      session: sealed, segmentId: 'seg-1', resolvedText: 'start vanco fifty', resolvedAt: '2026-08-17T18:05:00.000Z',
      resolvedBy: 'clinician-synthetic-1', rationale: 'El médico confirma cincuenta miligramos por kilo',
    })
    expect(() => finalizeTranscriptSegment({ session: resolved, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:06:00.000Z' }))
      .toThrow(/is already ended; finalization cannot modify a sealed capture session/)

    // Quién resolvió, cuándo, por qué y qué descartó llega intacto a Clinical Truth.
    const provenance = voiceSessionToClinicalInput(resolved, '2026-08-17T18:06:00.000Z').voiceProvenance
    expect(provenance.segments[0].reviewResolutions?.[0]).toMatchObject({
      resolvedBy: 'clinician-synthetic-1', previousText: 'start vanco fifteen', resolvedText: 'start vanco fifty',
      resolvedAt: '2026-08-17T18:05:00.000Z', previousConfidence: 0.44,
    })
    expect(provenance.segments[0].reviewResolutions?.[0].previousAlternatives?.map((a) => a.text))
      .toEqual(['start vanco fifty', 'start vanco fifteen'])
    // Sellar no se mueve por una disposición posterior del médico.
    expect(resolved.endedAt).toBe('2026-08-17T18:00:00.800Z')
    expect(measureVoiceSession(resolved).timeToFinalMs).toBe(600)
  })
})
