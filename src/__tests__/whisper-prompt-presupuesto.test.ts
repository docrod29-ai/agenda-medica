import { describe, it, expect } from 'vitest'
import {
  WHISPER_PROMPT_MEDICO, WHISPER_PROMPT_UCI,
  LIMITE_TOKENS_PROMPT, tokensAprox,
} from '@/lib/expediente/medical-vocabulary'

/**
 * PRESUPUESTO DE TOKENS DEL PROMPT — defecto medido en el corpus de 498.
 *
 * Whisper usa sólo los ÚLTIMOS ~224 tokens. `WHISPER_PROMPT_MEDICO` iba en ~242:
 * el principio se truncaba EN SILENCIO. No había forma de notarlo — el modelo no
 * avisa, simplemente ignora la parte que sobra.
 *
 * Y el prompt no traía NI UNA palabra de cuidados críticos, por eso CVVHDF,
 * VExUS, RASS y sweep gas fallaban: el sesgo apuntaba a fármacos de consultorio.
 */

describe('el prompt CABE en lo que el modelo lee', () => {
  it('el de consulta no se pasa', () => {
    expect(tokensAprox(WHISPER_PROMPT_MEDICO)).toBeLessThanOrEqual(LIMITE_TOKENS_PROMPT)
  })

  it('el de UCI tampoco', () => {
    expect(tokensAprox(WHISPER_PROMPT_UCI)).toBeLessThanOrEqual(LIMITE_TOKENS_PROMPT)
  })

  it('no se mandan los dos juntos: no cabrían', () => {
    // Y diluir el sesgo con vocabulario de otro dominio es peor que no sesgarlo.
    expect(tokensAprox(WHISPER_PROMPT_MEDICO + WHISPER_PROMPT_UCI))
      .toBeGreaterThan(LIMITE_TOKENS_PROMPT)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('cada prompt trae el vocabulario de SU dominio', () => {
  // El sesgo funciona sin distinguir mayúsculas: «Norepinefrina» al inicio de
  // frase vale igual que «norepinefrina».
  const trae = (p: string, t: string) => p.toLowerCase().includes(t.toLowerCase())

  it('el de UCI trae lo que se midió fallando', () => {
    for (const t of ['CVVHDF', 'PaFi', 'RASS', 'VExUS', 'sweep gas', 'chatter']) {
      expect(trae(WHISPER_PROMPT_UCI, t), `falta «${t}»`).toBe(true)
    }
  })

  it('y NO sólo eso: cubre el dominio, no el dataset', () => {
    // Sesgar únicamente hacia los siete errores medidos sería sobreajustar a
    // este corpus; el dictado real trae los otros cien términos del dominio.
    for (const t of ['PEEP', 'driving pressure', 'norepinefrina', 'TAPSE',
      'bicarbonato', 'dexmedetomidina', 'vancomicina']) {
      expect(trae(WHISPER_PROMPT_UCI, t), `falta «${t}»`).toBe(true)
    }
  })

  it('lo más crítico va al FINAL: el modelo lee los últimos tokens', () => {
    const cola = WHISPER_PROMPT_UCI.slice(-220)
    expect(cola).toContain('CVVHDF')
    expect(cola).toContain('dos gramos cada ocho horas')
  })

  it('el de consulta conserva su vocabulario ambulatorio', () => {
    for (const t of ['empagliflozina', 'atorvastatina', 'apixabán']) {
      expect(WHISPER_PROMPT_MEDICO).toContain(t)
    }
  })
})
