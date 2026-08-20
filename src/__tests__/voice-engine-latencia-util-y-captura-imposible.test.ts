/**
 * GOLDEN — Voice Engine: latencia medida sobre ruido, latencia «final» de un transcript que todavía se mueve,
 * y una captura hacia Clinical Truth fechada antes de que existiera la sesión.
 *
 * QUÉ FALLABA
 *  1. `timeToFirstPartialMs` arrancaba con el PRIMER parcial, fuera lo que fuera su texto.
 *     `appendTranscriptSegment` sólo exigía `segment.text.trim()`, así que un parcial de puntuación pura
 *     («…», «,», «...») —el relleno que emite un motor de streaming mientras todavía no ha entendido nada—
 *     fijaba `firstPartialReceivedAt`. El médico no había visto una sola palabra y la métrica ya declaraba que
 *     el motor era útil. Es la latencia más fácil de ganar que existe: se gana no diciendo nada.
 *  2. `timeToFinalMs` se calculaba sobre el subconjunto de segmentos ya finalizados
 *     (`Math.max` de los `status === 'final'`), ignorando que otros segmentos de la MISMA sesión seguían
 *     `partial`. Una sesión cuyo transcript todavía podía cambiar publicaba latencia de transcript estable, y
 *     el número mejoraba cuanto más tarde iban los segmentos lentos, porque los lentos aún no contaban.
 *  3. `voiceSessionToClinicalInput` validaba que `capturedAt` fuera una marca de tiempo válida, pero no que
 *     fuera posible. Un `capturedAt` anterior a `session.startedAt` entraba en Clinical Truth como procedencia
 *     de una captura ocurrida antes de que existiera el encuentro que la produjo. La cronología imposible ya
 *     fallaba cerrada en el segmento (`receivedAt`) y en la métrica; la frontera clínica —justo la que deja
 *     huella medicolegal— era la única puerta que seguía abierta.
 *
 * CÓMO SE DESCUBRIÓ
 *  Auditoría independiente Codex, sólo lectura, sobre el SHA exacto
 *  4367b7c22618c608efd409d8005cf068f87129f1 (run 32411275150): FAIL con exactamente dos hallazgos P1
 *  bloqueantes del checkpoint VOICE ENGINE 001. CI canónico estaba en verde sobre ese mismo SHA.
 *
 * CAUSA RAÍZ
 *  Las tres son la misma omisión: **se midió la llegada de un artefacto, no la llegada del hecho**. Que llegue
 *  un parcial no es que haya llegado texto útil; que un segmento se finalice no es que el transcript se haya
 *  estabilizado; que alguien pase un `capturedAt` no es que esa captura pudiera ocurrir. Cada vez que la
 *  instrumentación acepta el contenedor en lugar del contenido, el número resultante es favorable por
 *  construcción.
 *
 * REGLA QUE LO HACE SEGURO
 *  - La utilidad estructural mínima es UNA sola regla, compartida: `isUsefulTranscriptText` (el texto lleva
 *    contenido: no en blanco y con al menos una letra o cifra) es la primera mitad de
 *    `isFinalizableTranscriptText`, que ya existía. No se inventa criterio clínico nuevo: un parcial que
 *    legítimamente queda a medias sigue siendo útil, y sólo el ruido sin contenido queda fuera.
 *  - `timeToFirstPartialMs` sólo puede nacer de un parcial estructuralmente útil. Si el primer parcial era
 *    ruido y una revisión posterior aporta el texto útil, el reloj arranca en esa revisión.
 *  - `timeToFinalMs` es latencia a transcript ESTABLE: pertenece a la sesión, no al segmento más rápido.
 *    Mientras quede un segmento `partial` queda `undefined` — ausencia explícita, nunca un número optimista.
 *  - `voiceSessionToClinicalInput` rechaza `capturedAt` anterior a `session.startedAt`, igual que
 *    `appendTranscriptSegment` rechaza `receivedAt` anterior a `startedAt`.
 *
 * QUÉ NO CUBRE
 *  - No juzga si un parcial con contenido es clínicamente útil: la utilidad clínica sigue siendo del médico y
 *    de `needsReview`. La compuerta es estructural.
 *  - No fija umbrales de aceptación de latencia útil ni de estabilidad: eso es del Evaluation Kernel.
 *  - No valida `capturedAt` contra el final del dictado ni contra el reloj real, sólo contra el inicio de la
 *    sesión: una captura posterior tardía sigue siendo cronológicamente posible.
 *  - Sigue sin cubrir el P2 no bloqueante: ante arribos desordenados, el primer parcial útil sigue el orden de
 *    llegada y no la marca de tiempo más temprana.
 */
import { describe, expect, it } from 'vitest'
import {
  appendTranscriptSegment,
  createVoiceSession,
  endVoiceSession,
  finalizeTranscriptSegment,
  isFinalizableTranscriptText,
  isUsefulTranscriptText,
  measureVoiceSession,
  reviseTranscriptSegment,
  voiceSessionToClinicalInput,
} from '@/lib/voice-engine'

const startedAt = '2026-08-17T18:00:00.000Z'

function session() {
  return createVoiceSession({ id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language: 'es', startedAt })
}

describe('Voice Engine — el ruido no gana la latencia de primer parcial útil', () => {
  it.each(['…', '...', ',', '. . .', '  —  '])('un parcial de puntuación pura (%s) no arranca el reloj', (noise) => {
    const current = appendTranscriptSegment(session(), {
      id: 'seg-noise', sequence: 0, text: noise, status: 'partial', receivedAt: '2026-08-17T18:00:00.050Z', needsReview: false,
    })
    expect(isUsefulTranscriptText(noise)).toBe(false)
    expect(current.firstPartialReceivedAt).toBeUndefined()
    expect(measureVoiceSession(current).timeToFirstPartialMs).toBeUndefined()
  })

  it('el ruido anterior no le roba la latencia al primer parcial que sí llevaba texto', () => {
    let current = appendTranscriptSegment(session(), {
      id: 'seg-noise', sequence: 0, text: '…', status: 'partial', receivedAt: '2026-08-17T18:00:00.050Z', needsReview: false,
    })
    current = appendTranscriptSegment(current, {
      id: 'seg-1', sequence: 1, text: 'ceftriaxona 2 gramos IV', status: 'partial', receivedAt: '2026-08-17T18:00:00.400Z', needsReview: false,
    })
    expect(current.firstPartialReceivedAt).toBe('2026-08-17T18:00:00.400Z')
    expect(measureVoiceSession(current).timeToFirstPartialMs).toBe(400)
  })

  it('si el texto útil aparece en una revisión, el reloj arranca ahí y no en el ruido', () => {
    let current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: '...', status: 'partial', receivedAt: '2026-08-17T18:00:00.050Z', needsReview: false,
    })
    expect(measureVoiceSession(current).timeToFirstPartialMs).toBeUndefined()

    current = reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: 'ceftriaxona 2 gramos IV', revisedAt: '2026-08-17T18:00:00.300Z', reason: 'provider_revision',
    })
    expect(measureVoiceSession(current).timeToFirstPartialMs).toBe(300)
  })

  it('un parcial legítimamente cortado a media frase sigue siendo útil: la compuerta es de contenido, no de completitud', () => {
    const current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos', status: 'partial', receivedAt: '2026-08-17T18:00:00.120Z', needsReview: false,
    })
    expect(isUsefulTranscriptText('ceftriaxona 2 gramos,')).toBe(true)
    expect(isFinalizableTranscriptText('ceftriaxona 2 gramos,')).toBe(false)
    expect(measureVoiceSession(current).timeToFirstPartialMs).toBe(120)
  })
})

describe('Voice Engine — no hay latencia estable mientras el transcript siga cambiando', () => {
  it('un parcial pendiente impide reportar latencia final aunque otros segmentos ya sean finales', () => {
    let current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'primera frase', status: 'final', receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.300Z', needsReview: false,
    })
    current = appendTranscriptSegment(current, {
      id: 'seg-2', sequence: 1, text: 'segunda frase todavía en curso', status: 'partial', receivedAt: '2026-08-17T18:00:00.350Z', needsReview: false,
    })
    expect(measureVoiceSession(current).timeToFinalMs).toBeUndefined()
  })

  it('la latencia estable aparece sólo cuando ya no queda ningún segmento revisable Y la sesión está sellada, y es la del último', () => {
    let current = appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'primera frase', status: 'final', receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.300Z', needsReview: false,
    })
    current = appendTranscriptSegment(current, {
      id: 'seg-2', sequence: 1, text: 'segunda frase todavía en curso', status: 'partial', receivedAt: '2026-08-17T18:00:00.350Z', needsReview: false,
    })
    current = finalizeTranscriptSegment({ session: current, segmentId: 'seg-2', finalizedAt: '2026-08-17T18:00:00.980Z' })
    // Reforzado por la directiva P1 de 75d86a20: finalizar todo lo conocido no sella la sesión.
    expect(measureVoiceSession(current).timeToFinalMs).toBeUndefined()
    current = endVoiceSession(current, '2026-08-17T18:00:01.100Z')
    expect(measureVoiceSession(current).timeToFinalMs).toBe(980)
  })

  it('una sesión sin segmentos no tiene latencia estable: ausencia explícita, no 0 ms', () => {
    expect(measureVoiceSession(session()).timeToFinalMs).toBeUndefined()
    expect(measureVoiceSession(endVoiceSession(session(), '2026-08-17T18:00:01.000Z')).timeToFinalMs).toBeUndefined()
  })
})

describe('Voice Engine — la captura hacia Clinical Truth tiene que ser cronológicamente posible', () => {
  function finalized() {
    return appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'final', receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.400Z', needsReview: false,
    })
  }

  it('rechaza un capturedAt anterior al inicio de la sesión en vez de dejarlo entrar como procedencia', () => {
    expect(() => voiceSessionToClinicalInput(finalized(), '2026-08-17T17:59:59.900Z'))
      .toThrow(/Impossible voice chronology rejected: capturedAt precedes session startedAt/)
  })

  it('el borde exacto sigue siendo válido y la captura posterior no se toca', () => {
    expect(voiceSessionToClinicalInput(finalized(), startedAt).capturedAt).toBe(startedAt)
    expect(voiceSessionToClinicalInput(finalized(), '2026-08-17T18:00:00.500Z').capturedAt).toBe('2026-08-17T18:00:00.500Z')
  })

  it('sigue rechazando un capturedAt que no es una marca de tiempo', () => {
    expect(() => voiceSessionToClinicalInput(finalized(), 'ayer por la tarde')).toThrow(/capturedAt must be a valid timestamp/)
  })
})
