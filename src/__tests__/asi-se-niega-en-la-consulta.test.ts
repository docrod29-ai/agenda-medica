/**
 * ASÍ SE NIEGA EN LA CONSULTA — lo que le faltaba al motor DESPUÉS de REG-192
 *
 * ── DE DÓNDE VIENE ESTE ARCHIVO ──────────────────────────────────────────────
 *
 * Nació del hallazgo C2/C3 de la auditoría de nueve dimensiones (6-ago-2026) y
 * cubría dos cosas que, mientras esperaba en la cola de PRs, **REG-192 reparó
 * mejor y ya está en `main`**: la limpieza del ruido de turno y de muletillas
 * (`respuestaNiega`, `RUIDO_ANTES_DE_LA_RESPUESTA`) y el «no sé»
 * (`NO_ES_NEGACION`, que además cubre «no tengo idea» y «no le puedo decir»).
 * Eso se adoptó entero y se tiró lo de aquí que hacía lo mismo peor.
 *
 * De los 28 casos, **16 pasan ya sobre `main` sin tocar nada**: son los que
 * REG-192 cubre, y se conservan porque siguen siendo el contrato de este motor.
 * Los **12 restantes fallan sobre `main`** y son lo que esta rama aporta.
 *
 * ── LOS 12 QUE FALLAN SIN ESTE CAMBIO ────────────────────────────────────────
 *
 *   1. **«Nada más la diabetes»** — afirmación PARCIAL leída como negación.
 *      Descartaba las dos, incluida la que se acababa de afirmar, y bajaba una
 *      hipertensión `confirmado` a `descartado`. Y la limpieza de ruido de
 *      REG-192 lo **agrava**: quita el «pues» y deja la frase empezando por
 *      «nada», así que llegan aquí frases que antes ni se miraban. Es la misma
 *      trampa que `NO_ES_NEGACION` documenta para «no sé», por el otro lado.
 *
 *   2. **«No, sí tengo»** — el paciente se desdice y el motor se quedaba con la
 *      primera palabra. Gemelo de «no sé»: el arranque no es la respuesta.
 *
 *   3. **Las conjugaciones que faltaban** — `no sufre/sufro/sufría/sufrió`,
 *      `no padecía/padeció`, `negó/negaron`. El pretérito es como se cuenta un
 *      antecedente, y «No padeció diabetes.» seguía saliendo POSITIVA.
 *
 *   4. **El impersonal escrito** — «No se refiere asma» es como se redacta un
 *      negativo pertinente, y `NO_ES_NEGACION` se lo traga («no se» casa con
 *      `s[eé]`). Se reconoce en `NIEGA_EN_LINEA`, que se prueba antes, para no
 *      tocar la defensa del «no sé», que está bien puesta.
 *
 *   5. **El guardián del reconocedor**, que nadie había tocado: sin
 *      `padece/sufre` no veía voltearse «no padece diabetes», y su cierre
 *      `(\s|$)` no cerraba en un punto — donde acaban tantas frases dictadas.
 *
 *   6. **La ventana de `estaNegado`, sin normalizar** — se llama por dos
 *      caminos y por el crudo ninguna negación acentuada casaba. Normalizarla
 *      sólo para `NEGADORES` dejaba a `AFIRMADORES` mirando el crudo: la misma
 *      frase daba dos respuestas según llevara tilde.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Los tres primeros salieron de reproducir el hallazgo con los motores reales
 * antes de tocar nada. Los del bloque 1-2-3 los encontró la **revisión del Dr.**
 * sobre este mismo arreglo, en frases que el corpus de casos no cubría. El 4 lo
 * cazó este propio archivo al reconciliar con `main`: el caso ya estaba escrito
 * y se puso rojo solo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Ausencia de dato no es dato de ausencia (`clinical-safety.md` §4). Y los
 * vocabularios son vocabulario, no criterio (§5): se prefiere no señalar a
 * señalar de más, que aquí significa descartar un antecedente real.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Con «no sé», la condición que el extractor cosechó de la PREGUNTA conserva
 *   su certeza. Sólo se garantiza que no se descarte. La tercera salida —«el
 *   paciente dice que no lo sabe», en pantalla— sigue en el backlog (SAFE-005).
 * - No mide el corpus: son casos escritos. Los huecos de la revisión salieron
 *   justo de ahí, y no hay razón para creer que fueran los últimos.
 * - No toca el campo de alergias (`cds.ts`, `alergias.ts`): ése es SAFE-001.
 * - No decide quién tiene razón si el dictado y la nota se contradicen.
 */

import { describe, it, expect } from 'vitest'
import { estaNegado, extraerComorbilidades, parsearTranscripcion } from '@/lib/expediente/parser-clinico'
import { condicionesNegadas, corregirCertezaPorNegacion } from '@/lib/expediente/negaciones'
import { verificar } from '@/lib/asr/guardian-sustituciones'

describe('El parser local no inventa el antecedente que el paciente negó', () => {
  it('«No padece diabetes» no es un antecedente de diabetes', () => {
    const r = extraerComorbilidades('No padece diabetes.')
    expect(r.positivas).toEqual([])
    expect(r.negadas).toContain('Diabetes mellitus tipo 2')
  })

  it('«no padezco» — el paciente hablando de sí mismo', () => {
    const r = extraerComorbilidades('No padezco diabetes, doctor.')
    expect(r.positivas).toEqual([])
  })

  it('«no sufre de» — la otra forma de decirlo', () => {
    const r = extraerComorbilidades('No sufre de hipertensión arterial.')
    expect(r.positivas).toEqual([])
    expect(r.negadas).toContain('Hipertensión arterial')
  })

  it('«negó» con tilde: la frontera de palabra de JS no la reconoce', () => {
    expect(extraerComorbilidades('Negó diabetes.').positivas).toEqual([])
  })

  it('la bandera de preop también queda en falso, no ausente', () => {
    // Un `diabetes: true` de mentira mueve el Caprini y el riesgo quirúrgico.
    expect(extraerComorbilidades('No padece diabetes.').preopFlags.diabetes).toBe(false)
  })

  it('el resumen que se imprime dice «Niega», no «Antecedentes»', () => {
    const r = parsearTranscripcion('Paciente de 54 años. No padece diabetes ni hipertensión.')
    expect(r.comorbilidades).toEqual([])
    expect(r.resumenClinico).not.toMatch(/Antecedentes:/)
    expect(r.resumenClinico).toMatch(/Niega:/)
  })

  it('lo AFIRMADO sigue afirmado — el negador nuevo no se come lo que sí hay', () => {
    expect(extraerComorbilidades('Padece diabetes.').positivas).toContain('Diabetes mellitus tipo 2')
    expect(extraerComorbilidades('Refiere hipertensión arterial.').positivas).toContain('Hipertensión arterial')
  })

  it('una negación no se derrama a la frase siguiente', () => {
    const r = extraerComorbilidades('No padece diabetes. Presenta hipertensión arterial.')
    expect(r.positivas).toContain('Hipertensión arterial')
    expect(r.negadas).toContain('Diabetes mellitus tipo 2')
  })
})

describe('Así contesta «no» un paciente de verdad', () => {
  const negadasDe = (t: string) => condicionesNegadas(t).map(n => n.condicion)

  it('«Pues no, doctor» — la muletilla no puede tapar la negación', () => {
    expect(negadasDe('¿Padece diabetes o presión alta? Pues no, doctor.'))
      .toEqual(expect.arrayContaining(['diabetes', 'hipertensión arterial']))
  })

  it('«Fíjese que no» — la forma cortés mexicana', () => {
    expect(negadasDe('¿Padece diabetes? Fíjese que no.')).toContain('diabetes')
    expect(negadasDe('¿Padece diabetes? Pues fíjese que no.')).toContain('diabetes')
  })

  it('«Mmm, no» y «Este… no» — el titubeo del que piensa antes de contestar', () => {
    expect(negadasDe('¿Le han dicho que tiene diabetes? Mmm, no.')).toContain('diabetes')
    expect(negadasDe('¿Tiene diabetes? Este… no.')).toContain('diabetes')
  })

  it('«Para nada» y «Jamás» — las enfáticas', () => {
    expect(negadasDe('¿Tiene asma? Para nada.')).toContain('asma')
    expect(negadasDe('¿Tiene asma? Jamás.')).toContain('asma')
  })

  it('«Creo que no» niega; el «sí» no se convierte en negación por llevar muletilla', () => {
    expect(negadasDe('¿Tiene diabetes? Creo que no.')).toContain('diabetes')
    expect(negadasDe('¿Tiene diabetes? Pues sí, desde hace diez años.')).toEqual([])
  })

  it('la negación en línea también aprende el habla real', () => {
    expect(negadasDe('No sufre de asma.')).toContain('asma')
    expect(negadasDe('Negó diabetes.')).toContain('diabetes')
  })
})

describe('No saber no es negar', () => {
  const negadasDe = (t: string) => condicionesNegadas(t).map(n => n.condicion)

  it('«No sé, doctor» no niega nada', () => {
    expect(negadasDe('¿Tiene diabetes? No sé, doctor.')).toEqual([])
    expect(negadasDe('¿Tiene diabetes? Pues no sé.')).toEqual([])
  })

  it('«no recuerdo», «no me acuerdo», «no estoy seguro», «no sabría decirle»', () => {
    for (const r of ['No recuerdo.', 'No me acuerdo.', 'No estoy seguro.', 'No sabría decirle.']) {
      expect(negadasDe(`¿Tiene diabetes? ${r}`)).toEqual([])
    }
  })

  it('el efecto que se evita: una diabetes confirmada NO se reclasifica a descartado', () => {
    const negadas = condicionesNegadas('¿Tiene diabetes? No sé, doctor.')
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }], negadas,
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('el impersonal escrito «no se refiere X» SÍ sigue siendo negación', () => {
    // La excepción existe para no confundir «no sé» con «no se refiere».
    expect(negadasDe('¿Hay asma en la familia? No se refiere asma en la familia.')).toContain('asma')
  })
})

/**
 * ── LO QUE ENCONTRÓ LA REVISIÓN DEL DR. SOBRE ESTE MISMO ARREGLO ─────────────
 *
 * Tres huecos, reproducidos uno por uno antes de tocar nada. Los dos primeros
 * son el mismo defecto que este archivo repara, en frases que el corpus de
 * casos no cubría: `NEGATIVAS` sólo mira el ARRANQUE de la respuesta, y el
 * arranque no siempre es lo que se contestó.
 */
describe('La respuesta no es su primera palabra', () => {
  const negadasDe = (t: string) => condicionesNegadas(t).map(n => n.condicion)

  it('«Nada más la diabetes» afirma una y no niega la otra', () => {
    // Contarlo como negación descartaba LAS DOS, incluida la que se afirmó.
    expect(negadasDe('¿Tiene diabetes o presión alta? Nada más la diabetes.')).toEqual([])
    expect(negadasDe('¿Tiene diabetes o presión alta? No más la diabetes.')).toEqual([])
  })

  it('el daño que se evita: una hipertensión confirmada no se descarta', () => {
    const negadas = condicionesNegadas('¿Tiene diabetes o presión alta? Nada más la diabetes.')
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'Hipertensión arterial', certeza: 'confirmado' }], negadas,
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('«No, sí tengo» — el paciente se desdice a media frase', () => {
    expect(negadasDe('¿Tiene diabetes? No, sí tengo, desde hace años.')).toEqual([])
  })

  it('el veto de «más» no se come una negación de verdad', () => {
    // El «más» sólo estorba pegado al primer «no»; aquí la negación es limpia.
    expect(negadasDe('¿Tiene diabetes? No, ninguna.')).toContain('diabetes')
  })

  it('el pretérito: «no padeció» es como se cuenta un antecedente', () => {
    const r = extraerComorbilidades('No padeció diabetes.')
    expect(r.positivas).toEqual([])
    expect(r.negadas).toContain('Diabetes mellitus tipo 2')
    expect(negadasDe('No padeció diabetes.')).toContain('diabetes')
  })

  it('la tilde no puede decidir si una negación queda cerrada', () => {
    // `AFIRMADORES` se probaba sobre la ventana CRUDA mientras `NEGADORES` ya se
    // normalizaba: «con diagnóstico de» y «con diagnostico de» daban respuestas
    // distintas sobre la misma frase.
    const conTilde = 'No refiere, con diagnóstico de asma bronquial.'
    const sinTilde = 'No refiere, con diagnostico de asma bronquial.'
    expect(estaNegado(conTilde, conTilde.indexOf('asma')))
      .toBe(estaNegado(sinTilde, sinTilde.indexOf('asma')))
  })
})

describe('El guardián del reconocedor ve voltearse «no padece»', () => {
  it('perder el «no» de «no padece diabetes» es un volteo de negación', () => {
    const v = verificar('no padece diabetes', 'padece diabetes')
    expect(v.violaciones.map(x => x.clase)).toContain('volteo_negacion')
  })

  it('una corrección léxica que respeta la negación no se marca', () => {
    const v = verificar('no padece diabetes', 'no padece diabetes mellitus')
    expect(v.violaciones.map(x => x.clase)).not.toContain('volteo_negacion')
  })

  it('la negación al FINAL de la frase también se vigila', () => {
    // El cierre era `(\s|$)` y no cerraba en un punto, que es donde acaban
    // tantas frases dictadas. Encontrado por la revisión del Dr.
    const v = verificar('el paciente no padece.', 'el paciente padece.')
    expect(v.violaciones.map(x => x.clase)).toContain('volteo_negacion')
  })

  it('el guardián también conoce «negó», como los otros dos motores', () => {
    const v = verificar('negó diabetes', 'diabetes')
    expect(v.violaciones.map(x => x.clase)).toContain('volteo_negacion')
  })
})
