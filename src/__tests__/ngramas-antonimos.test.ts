/**
 * P0 (auditoría): el corrector fonético invertía prefijos clínicos antónimos —
 * "hiper glucemia" → "hipoglucemia" y "hipertensión" → "hipotensión" (significado
 * OPUESTO en la nota). Guardián invierteHiperHipo. Este test lo fija permanente.
 */
import { describe, it, expect } from 'vitest'
import { corregirNGramas, corregirTranscripcion } from '@/lib/expediente/medical-vocabulary'

describe('n-gramas · NUNCA invertir hiper↔hipo', () => {
  const noInvierte = (frase: string) => {
    for (const out of [corregirNGramas(frase).corregido, corregirTranscripcion(frase).corregido]) {
      const o = out.toLowerCase()
      // si la entrada es "hiper…" el resultado no puede volverse "hipo/hypo…"
      if (/hiper|hyper/.test(frase.toLowerCase())) expect(o, `"${frase}"→"${out}"`).not.toMatch(/h[iy]po/)
      if (/^hipo|^\s*hipo/.test(frase.toLowerCase())) expect(o, `"${frase}"→"${out}"`).not.toMatch(/h[iy]per/)
    }
  }
  it.each([
    'hiper glucemia', 'hiper tensión', 'hiper kalemia', 'hiper termia', 'hiper natremia',
    'hipertensión', 'hiperglucemia',
  ])('"%s" no se invierte a hipo', (f) => noInvierte(f))
})
