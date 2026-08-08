/**
 * LO QUE EL PACIENTE NIEGA NO PUNTÚA EN STOP-BANG — REG-264.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `extraerStopBang()` marcaba los cuatro ítems del interrogatorio —ronquido,
 * somnolencia diurna, apneas presenciadas e hipertensión— con SOLO MENCIONAR el
 * término. El único guardián era el literal `!/niega (hipertension|hta)/`, que
 * dejaba pasar la misma idea escrita de otras cuatro maneras: «niega **presión
 * alta**», «**sin** hipertensión», «**no tiene** hipertensión», «**descarta**
 * HTA». Los otros tres ítems no tenían guardián de ninguna clase.
 *
 * Y dos funciones más abajo, en este mismo archivo, Caprini ya llamaba a
 * `estaNegado()` — el motor de negación del expediente— por exactamente este
 * motivo. STOP-BANG se había quedado fuera.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * 8-ago-2026, revisando los hallazgos crudos del barrido de auditoría
 * (`docs/audit/hallazgos-crudos-workflow.json`) contra el código de hoy. El
 * reporte señalaba sólo «niega presión alta»; al pasarle al motor real las
 * cuatro preguntas del interrogatorio, negadas de las formas en que se dictan,
 * los cuatro ítems salieron en `true`.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Un paciente que niega las cuatro preguntas salía con **4/8 — riesgo
 * Intermedio**, que imprime «extremar precauciones perioperatorias, limitar
 * sedantes y opioides, oximetría posoperatoria». Si además es varón mayor de 50,
 * los puntos fabricados lo cruzan al **riesgo Alto**, que propone polisomnografía
 * y valoración por neumología antes de una cirugía electiva.
 *
 * Cuatro de los ocho puntos de la escala salían de frases donde el paciente dijo
 * que NO. Y la casilla llega palomeada a la pantalla: al médico le toca notar
 * que sobra, que es mucho más difícil que notar que falta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Una sola fuente de verdad para «lo negado no se documenta como presente»:
 * `estaNegado()`, el mismo motor que usan las comorbilidades y Caprini. Nada de
 * guardianes literales por ítem, que es como se llegó aquí.
 *
 * ── LO QUE ESTO NO CUBRE ─────────────────────────────────────────────────────
 *
 * - **No amplía `NEGADORES`.** Sigue cubriendo «niega / sin / no tiene / no
 *   presenta / no refiere / no hay / no ha tenido / nunca ha / nunca tuvo /
 *   ausente / descarta». Formas que NO reconoce: «lo dudo», «para nada», «que yo
 *   sepa no». El ronquido lleva su propio «no ronca» porque su término es un
 *   verbo y no un sustantivo — los otros tres no lo necesitan.
 * - **No toca los ítems que no se interrogan**: IMC, cuello, sexo y edad salen de
 *   una cifra o de una palabra, no de una respuesta que se pueda negar.
 * - **No cambia los umbrales de la escala** (≤2 Bajo, 3-4 Intermedio, ≥5 Alto):
 *   siguen siendo los de `calcularStopBang`, que el médico dueño ya revisó.
 * - **Marcar `false` no imprime la escala.** `capturado()` en `PreopAssessment`
 *   descarta los `false`, así que una valoración donde el paciente lo negó todo
 *   sigue sin imprimir el renglón de STOP-BANG. Si el médico quiere dejar
 *   constancia del negativo, palomea; no se decide por él.
 */
import { describe, it, expect } from 'vitest'
import { extraerStopBang } from '@/lib/expediente/parser-clinico'
import { calcularStopBang } from '@/lib/expediente/preop'

describe('hipertensión — el guardián literal dejaba pasar cuatro formas de negar', () => {
  it('«niega presión alta» no puntúa — la forma exacta del reporte de auditoría', () => {
    expect(extraerStopBang('niega presión alta').pressure).toBe(false)
  })

  it('«sin hipertensión arterial» no puntúa', () => {
    expect(extraerStopBang('sin hipertensión arterial').pressure).toBe(false)
  })

  it('«no tiene hipertensión» no puntúa — el afirmador «tiene» no cierra el «no»', () => {
    expect(extraerStopBang('no tiene hipertensión').pressure).toBe(false)
  })

  it('«descarta HTA» no puntúa', () => {
    expect(extraerStopBang('descarta HTA').pressure).toBe(false)
  })

  it('«niega hipertensión» sigue sin puntuar — lo único que ya funcionaba', () => {
    expect(extraerStopBang('niega hipertensión').pressure).toBe(false)
  })
})

describe('los tres ítems que no tenían guardián de ninguna clase', () => {
  it('«niega somnolencia diurna» no puntúa', () => {
    expect(extraerStopBang('niega somnolencia diurna').tiredness).toBe(false)
  })

  it('«no refiere cansancio diurno» no puntúa', () => {
    expect(extraerStopBang('no refiere cansancio diurno').tiredness).toBe(false)
  })

  it('«la esposa niega apneas observadas» no puntúa', () => {
    expect(extraerStopBang('la esposa niega apneas observadas').observed).toBe(false)
  })

  it('«sin apneas observadas» no puntúa', () => {
    expect(extraerStopBang('sin apneas observadas').observed).toBe(false)
  })

  it('«no ronca fuerte» no puntúa — el término es un verbo, no un sustantivo', () => {
    expect(extraerStopBang('no ronca fuerte').snoring).toBe(false)
  })

  it('«niega roncar fuerte» no puntúa', () => {
    expect(extraerStopBang('niega roncar fuerte').snoring).toBe(false)
  })
})

describe('el positivo sigue puntuando — la defensa no se comió el dato', () => {
  it('«ronca fuerte tras puertas cerradas»', () => {
    expect(extraerStopBang('ronca fuerte tras puertas cerradas').snoring).toBe(true)
  })

  it('«refiere somnolencia diurna importante»', () => {
    expect(extraerStopBang('refiere somnolencia diurna importante').tiredness).toBe(true)
  })

  it('«la esposa refiere apneas observadas»', () => {
    expect(extraerStopBang('la esposa refiere apneas observadas').observed).toBe(true)
  })

  it('«hipertensión arterial en tratamiento con losartán»', () => {
    expect(extraerStopBang('hipertensión arterial en tratamiento con losartán').pressure).toBe(true)
  })

  it('el punto se cierra: «niega apneas. Refiere somnolencia diurna» — el punto reabre la frase', () => {
    const r = extraerStopBang('niega apneas observadas. Refiere somnolencia diurna')
    expect(r.observed).toBe(false)
    expect(r.tiredness).toBe(true)
  })

  it('«ronca poco» sigue siendo negativo documentado', () => {
    expect(extraerStopBang('ronca poco, casi nada').snoring).toBe(false)
  })
})

describe('los ítems que no se interrogan no cambian', () => {
  it('IMC, cuello y sexo salen de la cifra, no de una respuesta negable', () => {
    const r = extraerStopBang('hombre con IMC de 38, cuello de 44 cm')
    expect(r.bmi35).toBe(true)
    expect(r.neck40).toBe(true)
    expect(r.genderMale).toBe(true)
  })
})

describe('la escala completa — el defecto medido en puntos', () => {
  /**
   * El dictado real de un preoperatorio en el que el paciente niega las cuatro
   * preguntas. Antes de REG-264 daba 5/8 (los cuatro fabricados + varón) y la
   * nota proponía polisomnografía y neumología. Sintético; ningún paciente real.
   */
  const NIEGA_TODO = 'Paciente masculino de 58 años. No ronca. '
    + 'Niega somnolencia diurna. Sin apneas observadas. Niega presión alta.'

  it('el varón que niega las cuatro preguntas puntúa 1, no 5', () => {
    const r = calcularStopBang(extraerStopBang(NIEGA_TODO))
    expect(r.puntos).toBe(1)
    expect(r.nivel).toBe('Bajo')
  })

  it('y no se propone polisomnografía', () => {
    const r = calcularStopBang(extraerStopBang(NIEGA_TODO))
    expect(r.interpretacion).not.toMatch(/polisomnograf/i)
  })

  it('el mismo paciente que SÍ afirma las cuatro sigue llegando a Alto', () => {
    const afirma = 'Paciente masculino de 58 años. Ronca fuerte tras puertas cerradas. '
      + 'Refiere somnolencia diurna. La esposa refiere apneas observadas. Hipertensión arterial en tratamiento.'
    const r = calcularStopBang(extraerStopBang(afirma))
    expect(r.puntos).toBe(5)
    expect(r.nivel).toBe('Alto')
  })
})
