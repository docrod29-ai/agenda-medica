/**
 * GOLDEN — Voice Engine: transiciones obsoletas y revalidación del texto final revisado.
 *
 * QUÉ FALLABA
 *  1. Las transiciones de estado del transcript (`reviseTranscriptSegment`, `finalizeTranscriptSegment`,
 *     `appendTranscriptSegment`) sólo miraban el *estado* del segmento (partial/final) y nunca su *linaje
 *     temporal*. Un artefacto viejo podía replayearse encima de un transcript más nuevo: aplicar una revisión
 *     fechada antes de la última revisión ya registrada, o finalizar un segmento con `finalizedAt` anterior a
 *     su propia revisión más reciente. El resultado era un texto final construido sobre una hipótesis ya
 *     superada, con métricas de latencia deterministas enmascaradas por el `Math.max(0, …)` de
 *     `measureVoiceSession`.
 *  2. `reviseTranscriptSegment` conservaba `status: 'final'` sólo porque el segmento de origen ya era final,
 *     sin revalidar el texto revisado. Una corrección clínica que dejaba el texto estructuralmente incompleto
 *     (sólo puntuación, o cortado a mitad de enunciado) seguía siendo final y entraba a `ClinicalInput` como
 *     verdad finalizada.
 *
 * CÓMO SE DESCUBRIÓ
 *  Auditoría independiente Codex sobre el SHA exacto 4b5f66d9565cb15aa06350f7b544d39226c8434d (run
 *  32200858183), dos hallazgos P1 bloqueantes del checkpoint VOICE ENGINE 001. El informe nombra las puertas
 *  como `advanceVoiceSession` / `applyVoiceRevision`; en este repositorio esas transiciones viven en
 *  `finalizeTranscriptSegment` / `appendTranscriptSegment` y `reviseTranscriptSegment` respectivamente.
 *
 * CAUSA RAÍZ
 *  Los guardianes validaban un enum de estado, no el linaje. «Era final» y «este texto puede ser final» se
 *  trataban como la misma pregunta, y «llegó una transición» se trataba como «llegó la transición más nueva».
 *
 * REGLA QUE LO HACE SEGURO
 *  - Toda transición se compara contra la cabeza del linaje del segmento objetivo —máximo de `receivedAt`,
 *    de todos los `revisedAt` y de `finalizedAt`—. Una transición fechada antes de esa cabeza se rechaza:
 *    un artefacto obsoleto no se promueve, no se finaliza y no se replayea sobre un transcript más nuevo.
 *  - El texto se revalida en cada puerta hacia `final`. Si el texto revisado es estructuralmente incompleto,
 *    la revisión sobre un segmento final se rechaza (el final previo queda íntegro) y la revisión sobre un
 *    segmento parcial queda marcada `needsReview`, con lo que tampoco puede promoverse a final.
 *
 * QUÉ NO CUBRE
 *  - `isFinalizableTranscriptText` es una compuerta **estructural**, no clínica: no juzga si un enunciado
 *    completo dice lo suficiente. Eso sigue siendo del médico y de `needsReview`. No inventa umbrales
 *    clínicos ni exige unidades, dosis ni desenlaces.
 *  - No se impone orden de finalización *entre* segmentos: un motor de streaming puede finalizar el segmento
 *    2 antes que el 1 legítimamente. La obsolescencia se juzga contra el linaje del propio segmento.
 *  - No cubre `receivedAt` anterior a `startedAt` de la sesión ni la elección de proveedor de ASR.
 */
import { describe, expect, it } from 'vitest'
import {
  appendTranscriptSegment,
  createVoiceSession,
  endVoiceSession,
  finalizeTranscriptSegment,
  isFinalizableTranscriptText,
  measureVoiceSession,
  reviseTranscriptSegment,
  voiceSessionToClinicalInput,
} from '@/lib/voice-engine'

const startedAt = '2026-08-17T18:00:00.000Z'

function session() {
  return createVoiceSession({ id: 'voice-1', encounterId: 'enc-1', provider: 'synthetic-test-provider', language: 'es', startedAt })
}

/** Segmento parcial ya revisado: cabeza de linaje en .350. */
function revisedPartial() {
  const appended = appendTranscriptSegment(session(), {
    id: 'seg-1', sequence: 0, text: 'ceftriaxona', status: 'partial', receivedAt: '2026-08-17T18:00:00.200Z', needsReview: false,
  })
  return reviseTranscriptSegment({
    session: appended, segmentId: 'seg-1', revisedText: 'ceftriaxona 2 gramos IV', revisedAt: '2026-08-17T18:00:00.350Z', reason: 'provider_revision',
  })
}

/** Segmento final íntegro, listo para recibir una corrección del médico. */
function finalizedSegment() {
  return appendTranscriptSegment(session(), {
    id: 'seg-1', sequence: 0, text: 'metotrexate 2 gramos IV', status: 'final', receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.300Z', needsReview: false,
  })
}

describe('Voice Engine — un artefacto obsoleto no se promueve sobre un transcript más nuevo', () => {
  it('rechaza replayear una revisión fechada antes de la última revisión registrada', () => {
    const current = revisedPartial()
    expect(() => reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: 'ceftriaxona 2 gramos', revisedAt: '2026-08-17T18:00:00.300Z', reason: 'provider_revision',
    })).toThrow(/Stale voice transition rejected: revisedAt/)
    expect(current.segments[0].text).toBe('ceftriaxona 2 gramos IV')
    expect(current.segments[0].revisions).toHaveLength(1)
  })

  it('rechaza finalizar con un finalizedAt anterior a la revisión más reciente del propio segmento', () => {
    const current = revisedPartial()
    expect(() => finalizeTranscriptSegment({
      session: current, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.250Z',
    })).toThrow(/Stale voice transition rejected: finalizedAt/)
    expect(current.segments[0].status).toBe('partial')
    // CORREGIDA por el P1 de 58a6d3da: el puente ya no filtra por estado, exige captura sellada.
    expect(() => voiceSessionToClinicalInput(current, '2026-08-17T18:00:00.700Z')).toThrow(/is not sealed; end capture through endVoiceSession/)
  })

  it('rechaza finalizar un segmento obsoleto cuando ya existe transcript final más nuevo en la sesión', () => {
    const withNewer = appendTranscriptSegment(revisedPartial(), {
      id: 'seg-2', sequence: 1, text: 'sin datos de choque', status: 'final', receivedAt: '2026-08-17T18:00:00.400Z', finalizedAt: '2026-08-17T18:00:00.500Z', needsReview: false,
    })
    expect(() => finalizeTranscriptSegment({
      session: withNewer, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.300Z',
    })).toThrow(/Stale voice transition rejected: finalizedAt/)
    // CORREGIDA por el P1 de 58a6d3da: esta aserción exigía justamente la omisión silenciosa. seg-1 sigue
    // revisable, así que la sesión no puede sellarse ni cruzar a Clinical Truth dejando fuera su hipótesis.
    expect(() => endVoiceSession(withNewer, '2026-08-17T18:00:00.700Z'))
      .toThrow(/cannot be sealed while transcript segments are still revisable: seg-1/)
    expect(() => voiceSessionToClinicalInput(withNewer, '2026-08-17T18:00:00.700Z')).toThrow(/is not sealed; end capture through endVoiceSession/)
  })

  it('rechaza una corrección del médico fechada antes de la finalización que pretende corregir', () => {
    const current = finalizeTranscriptSegment({ session: revisedPartial(), segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.600Z' })
    expect(() => reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: 'ceftriaxona 1 gramo IV', revisedAt: '2026-08-17T18:00:00.400Z', reason: 'clinician_correction',
    })).toThrow(/Stale voice transition rejected: revisedAt/)
    expect(current.segments[0].text).toBe('ceftriaxona 2 gramos IV')
  })

  it('rechaza anexar un segmento final cuyo finalizedAt precede a su propia llegada', () => {
    expect(() => appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: 'ceftriaxona 2 gramos IV', status: 'final', receivedAt: '2026-08-17T18:00:00.400Z', finalizedAt: '2026-08-17T18:00:00.300Z', needsReview: false,
    })).toThrow(/Stale voice transition rejected: finalizedAt precedes receivedAt/)
  })

  it('sigue admitiendo la transición no obsoleta, incluso en el borde exacto del linaje', () => {
    // Sellar la sesión es lo que convierte «todo finalizado» en transcript estable (directiva P1 de 75d86a20).
    const current = endVoiceSession(
      finalizeTranscriptSegment({ session: revisedPartial(), segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.350Z' }),
      '2026-08-17T18:00:00.400Z',
    )
    expect(current.segments[0].status).toBe('final')
    expect(measureVoiceSession(current)).toEqual({ timeToFirstPartialMs: 200, timeToFinalMs: 350, revisionCount: 1, unresolvedReviewCount: 0 })
    expect(voiceSessionToClinicalInput(current, '2026-08-17T18:00:00.700Z').raw).toBe('ceftriaxona 2 gramos IV')
  })
})

describe('Voice Engine — el texto revisado se revalida antes de seguir siendo final', () => {
  it('rechaza una corrección que deja el texto final sin contenido alguno', () => {
    const current = finalizedSegment()
    expect(() => reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: '…', revisedAt: '2026-08-17T18:00:00.400Z', reason: 'clinician_correction',
    })).toThrow(/Structurally incomplete revised text cannot remain final/)
    expect(current.segments[0].text).toBe('metotrexate 2 gramos IV')
    const sealed = endVoiceSession(current, '2026-08-17T18:00:00.450Z')
    expect(voiceSessionToClinicalInput(sealed, '2026-08-17T18:00:00.500Z').raw).toBe('metotrexate 2 gramos IV')
  })

  it('rechaza una corrección final cortada a mitad de enunciado', () => {
    const current = finalizedSegment()
    expect(() => reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: 'metotrexate 2 gramos IV y además', revisedAt: '2026-08-17T18:00:00.400Z', reason: 'clinician_correction',
    })).not.toThrow()
    expect(() => reviseTranscriptSegment({
      session: current, segmentId: 'seg-1', revisedText: 'metotrexate 2 gramos IV,', revisedAt: '2026-08-17T18:00:00.400Z', reason: 'clinician_correction',
    })).toThrow(/Structurally incomplete revised text cannot remain final/)
    expect(current.segments[0].status).toBe('final')
    expect(current.segments[0].revisions).toHaveLength(0)
  })

  it('marca para revisión una revisión parcial incompleta y le cierra la promoción a final', () => {
    const incomplete = reviseTranscriptSegment({
      session: revisedPartial(), segmentId: 'seg-1', revisedText: 'ceftriaxona 2 gramos IV cada...', revisedAt: '2026-08-17T18:00:00.450Z', reason: 'provider_revision', needsReview: false,
    })
    expect(incomplete.segments[0].needsReview).toBe(true)
    expect(incomplete.segments[0].text).toBe('ceftriaxona 2 gramos IV cada...')
    expect(incomplete.segments[0].revisions).toHaveLength(2)
    expect(measureVoiceSession(incomplete).unresolvedReviewCount).toBe(1)
    expect(() => finalizeTranscriptSegment({
      session: incomplete, segmentId: 'seg-1', finalizedAt: '2026-08-17T18:00:00.600Z',
    })).toThrow(/Structurally incomplete transcript segment cannot be promoted to final: seg-1/)
    expect(() => voiceSessionToClinicalInput(incomplete, '2026-08-17T18:00:00.700Z')).toThrow(/is not sealed; end capture through endVoiceSession/)
  })

  it('rechaza anexar como final un texto sin contenido', () => {
    expect(() => appendTranscriptSegment(session(), {
      id: 'seg-1', sequence: 0, text: '---', status: 'final', receivedAt: '2026-08-17T18:00:00.100Z', finalizedAt: '2026-08-17T18:00:00.300Z', needsReview: false,
    })).toThrow(/Structurally incomplete transcript text cannot be appended as final/)
  })

  it('deja pasar la corrección completa del médico y la lleva íntegra a ClinicalInput', () => {
    const corrected = reviseTranscriptSegment({
      session: finalizedSegment(), segmentId: 'seg-1', revisedText: 'metotrexate 15 mg semanal', revisedAt: '2026-08-17T18:00:00.400Z', reason: 'clinician_correction',
    })
    expect(corrected.segments[0].status).toBe('final')
    expect(corrected.segments[0].needsReview).toBe(false)
    expect(corrected.segments[0].revisions[0]).toMatchObject({ previousText: 'metotrexate 2 gramos IV', revisedText: 'metotrexate 15 mg semanal', reason: 'clinician_correction' })
    expect(voiceSessionToClinicalInput(endVoiceSession(corrected, '2026-08-17T18:00:00.450Z'), '2026-08-17T18:00:00.500Z').raw).toBe('metotrexate 15 mg semanal')
  })

  it('declara la frontera estructural de isFinalizableTranscriptText', () => {
    expect(isFinalizableTranscriptText('SpO2 96%, denies dyspnea')).toBe(true)
    expect(isFinalizableTranscriptText('start vanco fifteen')).toBe(true)
    expect(isFinalizableTranscriptText('   ')).toBe(false)
    expect(isFinalizableTranscriptText('...')).toBe(false)
    expect(isFinalizableTranscriptText('¿?')).toBe(false)
    expect(isFinalizableTranscriptText('paciente con disnea;')).toBe(false)
  })
})
