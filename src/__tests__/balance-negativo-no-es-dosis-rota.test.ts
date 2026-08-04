/**
 * GOLDEN — un balance hídrico negativo pedía confirmación en CADA frase.
 *
 * ── CÓMO SE ENCONTRÓ ─────────────────────────────────────────────────────────
 *
 * Midiendo. El 4-ago-2026 se corrió por primera vez el corpus de **6 000 frases**
 * del Dr. contra el pipeline (regresión de texto, sin gastar audio). De las 6 000:
 *
 *     intactas ................. 5 761  (96.02 %)
 *     términos clave perdidos ..     0
 *     piden confirmación ....... 25  (0.42 %)
 *
 * Y las 25 eran **la misma frase**: balance hídrico con resultado negativo.
 *
 *     «Ingresos 1200 mL, egresos 800 mL y balance neto −1500 mL en 24 horas.»
 *
 * ── LA CAUSA ─────────────────────────────────────────────────────────────────
 *
 * `ES_CANTIDAD` en `dosis-sin-numero.ts` no aceptaba un signo delante de la
 * cifra. Así que leía «−1500 mL», no reconocía «−1500» como cantidad y concluía
 * que **faltaba la dosis**. El aviso llegaba a decir, literalmente, «Falta la
 * cantidad en «−1500 mL»» — enseñando el número que decía no encontrar.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ─────────────────────────────────────
 *
 * Un balance negativo es lo normal en un paciente en diuresis o en
 * ultrafiltración: en UCI se dicta todos los días. Y la compuerta que se
 * disparaba de más es **la misma** que avisa de una dosis que perdió su número —
 * el fallo más peligroso que se midió en el corpus de 498.
 *
 * O sea que el ruido no estaba en cualquier aviso: estaba gastando justo el que
 * no se puede ignorar. Un aviso que salta donde no debe se acaba ignorando, y
 * con él se ignoran los que sí importan.
 *
 * ── LO QUE ESTE ARREGLO NO HACE ──────────────────────────────────────────────
 *
 * No debilita la detección. El signo sólo cuenta si va **pegado a una cifra**:
 * una unidad sin número delante se sigue marcando exactamente igual.
 */
import { describe, it, expect } from 'vitest'
import { dosisSinNumero } from '@/lib/uci/dosis-sin-numero'
import { procesarTranscript } from '@/lib/asr/pipeline'

const FRASE_DEL_CORPUS = 'Ingresos 1200 mL, egresos 800 mL y balance neto -1500 mL en 24 horas.'

describe('LAS 25 FRASES DEL CORPUS QUE PREGUNTABAN DE MÁS', () => {
  it('la frase exacta del corpus ya no pide confirmación', () => {
    const r = procesarTranscript(FRASE_DEL_CORPUS)
    expect(r.motivos).toEqual([])
    expect(r.requiereConfirmacion).toBe(false)
  })

  it('ni con las variantes que trae el corpus', () => {
    // El corpus las combina: ingresos × egresos × balance. Todas negativas.
    for (const ing of [1200, 1800, 2400]) {
      for (const bal of [-500, -1500]) {
        const f = `Ingresos ${ing} mL, egresos 800 mL y balance neto ${bal} mL en 24 horas.`
        expect(procesarTranscript(f).motivos, f).toEqual([])
      }
    }
  })

  it('los cuatro signos que aparecen en un dictado transcrito', () => {
    /**
     * El menos de teclado, el más, el menos tipográfico (U+2212) y la raya
     * (U+2013). El reconocedor y los editores los intercambian sin avisar, y
     * arreglar sólo uno dejaría el fallo vivo en los otros tres.
     */
    for (const signo of ['-', '+', '−', '–']) {
      expect(dosisSinNumero(`balance neto ${signo}500 mL`), signo).toEqual([])
    }
  })

  it('y un balance positivo tampoco preguntaba ni preguntará', () => {
    expect(dosisSinNumero('balance neto 500 mL')).toEqual([])
  })
})

describe('LA DEFENSA SIGUE EN PIE — que es la mitad que importa', () => {
  it('«Meropenem gramos cada ocho horas» se sigue marcando', () => {
    /**
     * El fallo real del corpus de 498: el reconocedor funde «-nem dos» en «-nem»
     * y la dosis desaparece. Falló 6 de 6 veces en las tres voces.
     */
    const r = dosisSinNumero('Meropenem gramos cada ocho horas en infusión extendida')
    expect(r).toHaveLength(1)
    expect(r[0].antes).toBe('Meropenem')
    expect(r[0].unidad).toBe('gramos')
  })

  it('y sigue pidiendo confirmación por el canal de siempre', () => {
    const r = procesarTranscript('Meropenem gramos cada ocho horas.')
    expect(r.motivos).toContain('dosis_o_unidad_ambigua')
    expect(r.requiereConfirmacion).toBe(true)
  })

  it('un signo suelto NO convierte en cantidad lo que no lo es', () => {
    // El signo sólo vale pegado a una cifra: «- mg» no es una dosis.
    expect(dosisSinNumero('paracetamol - mg cada ocho horas')).toHaveLength(1)
  })

  it('y el motor NUNCA completa la cifra que falta', () => {
    /**
     * La regla que sostiene todo este módulo: una dosis inventada es peor que
     * una dosis ausente. Detecta y avisa; no rellena.
     */
    const r = dosisSinNumero('Meropenem gramos cada ocho horas')
    expect(r[0].mensaje).toMatch(/NO la completa/)
    expect(r[0].mensaje).not.toMatch(/\d/)
  })
})
