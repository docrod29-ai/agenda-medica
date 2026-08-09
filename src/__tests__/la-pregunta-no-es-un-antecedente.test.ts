/**
 * LA ENFERMEDAD NOMBRADA EN LA PREGUNTA NO ES UN ANTECEDENTE — REG-280 y 281.
 *
 * ── EL FALLO MÁS REPETIDO DE ESTE REPOSITORIO, VIVO EN EL MOTOR LOCAL ───────
 *
 * Medido el 9-ago-2026 con `extraerComorbilidades` de verdad:
 *
 *     «¿Diabetes? No. ¿Hipertensión? Tampoco.»
 *       → positivas: ['Hipertensión arterial', 'Diabetes mellitus tipo 2']
 *
 * Dos enfermedades que el paciente acababa de negar, registradas como que **sí
 * las tiene**.
 *
 * ── DOS CAUSAS, Y LAS DOS SON DE LIBRO ──────────────────────────────────────
 *
 * **REG-280 — «tampoco» no estaba en la lista de negadores.** Y «tampoco» es
 * exactamente como se contesta a la segunda pregunta de una serie: no es una
 * forma rebuscada, es la normal.
 *
 * **REG-281 — el interrogatorio nombra la enfermedad en la PREGUNTA.**
 * `estaNegado` sólo mira hacia ATRÁS, y delante de «¿Diabetes?» no hay ningún
 * negador: la negación viene **después**, en la respuesta.
 *
 * ── POR QUÉ SOBREVIVIÓ A SU PROPIA REPARACIÓN ───────────────────────────────
 *
 * Esto se arregló en v976 — **para la vía de la IA**:
 * `corregirCertezaPorNegacion` reclasifica lo que el modelo extrae. El motor
 * determinista local, que es el que entra **cuando la IA falla** (sin créditos,
 * timeout, límite de peticiones), nunca pasó por ese guardián.
 *
 * Es la forma de REG-267: reparado en un sitio, vivo en el de al lado. Y el que
 * quedó vivo es justo **el que corre cuando lo demás no**.
 *
 * ── Y UN TERCER ESTADO QUE FALTABA ──────────────────────────────────────────
 *
 * «¿Padece asma? **No sé**» dejaba el asma POSITIVA. «No sé» no niega —y hace
 * bien: no saber no es negar— pero tampoco afirma. Con sólo dos casillas, el
 * término caía en la equivocada.
 *
 * **Ausencia de dato no es dato de ausencia, y tampoco es dato de presencia.**
 */
import { describe, it, expect } from 'vitest'
import { extraerComorbilidades, esSoloLaPregunta, estaNegado } from '@/lib/expediente/parser-clinico'

const comorb = (t: string) => extraerComorbilidades(t)

describe('el caso que lo motiva', () => {
  it('«¿Diabetes? No. ¿Hipertensión? Tampoco.» no deja NI UN antecedente positivo', () => {
    const r = comorb('¿Diabetes? No. ¿Hipertensión? Tampoco.')
    expect(r.positivas, 'se fabricaron antecedentes que el paciente negó').toEqual([])
    expect(r.negadas.sort()).toEqual(['Diabetes mellitus tipo 2', 'Hipertensión arterial'])
  })

  it('y funciona sin el «¿» de apertura, que el dictado casi nunca pone', () => {
    const r = comorb('Diabetes? No. Hipertensión? Tampoco.')
    expect(r.positivas).toEqual([])
  })

  it('cada pregunta se queda con SU respuesta, no con la de la siguiente', () => {
    /**
     * Sin el tope, «¿Diabetes? No. ¿Hipertensión? Sí» le daría a la diabetes la
     * respuesta de la hipertensión — y al revés, que es peor.
     */
    const r = comorb('¿Diabetes? No. ¿Hipertensión? Sí.')
    expect(r.negadas).toEqual(['Diabetes mellitus tipo 2'])
    expect(r.positivas).toEqual(['Hipertensión arterial'])
  })
})

describe('REG-280 — los negadores que faltaban', () => {
  for (const [frase, esperado] of [
    ['Tampoco diabetes', true],
    ['Jamás ha tenido diabetes', true],
    ['Niego diabetes', true],
    ['Niega diabetes', true],
  ] as const) {
    it(`«${frase}» se lee como negación`, () => {
      expect(comorb(frase).negadas).toContain('Diabetes mellitus tipo 2')
      expect(comorb(frase).positivas).toEqual([])
      expect(esperado).toBe(true)
    })
  }

  it('y NO se niega de más: lo afirmado sigue afirmado', () => {
    /**
     * El error contrario es el caro: negar de más **borra un antecedente real**.
     * Por eso no se añadió `no` a secas — «no acude por diabetes» no niega la
     * diabetes.
     */
    for (const frase of [
      'Diabetes mellitus tipo 2',
      'Acude por diabetes descompensada',
      'En tratamiento para diabetes',
      'No acude por diabetes, tiene hipertensión',
    ]) {
      expect(comorb(frase).positivas, frase).toContain('Diabetes mellitus tipo 2')
    }
  })

  it('«pero» sigue cerrando la negación', () => {
    const r = comorb('Niega diabetes pero tiene hipertensión')
    expect(r.negadas).toEqual(['Diabetes mellitus tipo 2'])
    expect(r.positivas).toEqual(['Hipertensión arterial'])
  })
})

describe('REG-281 — el tercer estado: ni afirmada ni negada', () => {
  it('«¿Padece asma? No sé» no entra en NINGUNA lista', () => {
    const r = comorb('¿Padece asma? No sé')
    expect(r.positivas).toEqual([])
    expect(r.negadas).toEqual([])
  })

  it('pero el dato NO se pierde si consta afirmado en otro sitio', () => {
    /**
     * Callar por la primera mención sería perder un antecedente real — el otro
     * error, el caro.
     */
    const r = comorb('¿Padece asma? No sé. En tratamiento con salbutamol por asma')
    expect(r.positivas).toEqual(['Asma'])
  })

  it('`esSoloLaPregunta` es falso cuando la respuesta decide', () => {
    const sinSaber = '¿padece asma? no se'
    const afirmando = '¿padece asma? si'
    const negando = '¿padece asma? no'
    expect(esSoloLaPregunta(sinSaber, sinSaber.indexOf('asma'))).toBe(true)
    expect(esSoloLaPregunta(afirmando, afirmando.indexOf('asma'))).toBe(false)
    expect(esSoloLaPregunta(negando, negando.indexOf('asma'))).toBe(false)
  })

  it('y fuera de una pregunta no se aplica nunca', () => {
    /** Un término suelto en la prosa no tiene «respuesta» que consultar. */
    const t = 'paciente con asma en tratamiento'
    expect(esSoloLaPregunta(t, t.indexOf('asma'))).toBe(false)
    expect(estaNegado(t, t.indexOf('asma'))).toBe(false)
  })
})

describe('el interrogatorio completo, como se dicta de verdad', () => {
  it('una serie entera de negaciones no deja ni un positivo', () => {
    const dictado =
      '¿Diabetes? No. ¿Presión alta? Tampoco. ¿Asma? No. ¿Fuma? Nunca. ¿Alguna cirugía? No.'
    const r = comorb(dictado)
    expect(r.positivas, `se fabricó: ${r.positivas.join(', ')}`).toEqual([])
  })

  it('y una serie mixta separa bien lo que sí de lo que no', () => {
    const dictado = '¿Diabetes? Sí, desde hace diez años. ¿Presión alta? No. ¿Fuma? Tampoco.'
    const r = comorb(dictado)
    expect(r.positivas).toEqual(['Diabetes mellitus tipo 2'])
    expect(r.negadas.sort()).toEqual(['Hipertensión arterial', 'Tabaquismo'])
  })
})
