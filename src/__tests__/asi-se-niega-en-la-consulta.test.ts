/**
 * ASÍ SE NIEGA EN LA CONSULTA — REG-192
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Los tres motores que leen lo que se dictó para decidir si un antecedente está
 * NEGADO usaban un vocabulario que no es el del consultorio mexicano. Fallaban
 * en las dos direcciones, y las dos acaban en el expediente:
 *
 *   1. Negación que no se ve → antecedente crónico INVENTADO.
 *      `extraerComorbilidades('No padece diabetes.')` devolvía
 *      `positivas: ['Diabetes mellitus tipo 2']`, y la nota del parser local
 *      imprimía «Antecedentes: Diabetes mellitus tipo 2.» sobre un dictado que
 *      la niega. «Padece» no estaba entre los negadores; tampoco «sufre», ni
 *      «negó».
 *
 *   2. Negación que se ve donde no la hay → antecedente BORRADO.
 *      «¿Tiene diabetes? No sé, doctor.» contaba como negación —empieza por
 *      «no»— y `corregirCertezaPorNegacion` reclasificaba a `descartado` una
 *      diabetes confirmada. No saber no es negar.
 *
 *   Y en medio, el habla real: «Pues no», «Fíjese que no», «Mmm, no», «Este… no»
 *   NO contaban como respuesta negativa. El paciente decía que no y el motor no
 *   se enteraba.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Hallazgo C2/C3 de la auditoría de nueve dimensiones (6-ago-2026), reproducido
 * el 8-ago-2026 ejecutando los motores reales sobre frases de consulta antes de
 * tocar una línea. El caso 2 apareció al reproducir: no estaba en el hallazgo.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * Vocabulario escrito mirando la nota redactada («niega diabetes») y no el
 * dictado hablado («pues no, doctor»). Y un detalle del motor de expresiones:
 * `\b` de JavaScript no considera letra a la «é», así que `/no sé\b/` nunca casa
 * con «no sé, doctor» — una regla que se lee bien y no dispara jamás.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Ausencia de dato no es dato de ausencia (`clinical-safety.md` §4): no saber no
 * es negar. Y los vocabularios son vocabulario, no criterio (§5): por eso «qué
 * va» queda fuera —puede empezar una frase— y por eso se prefiere no señalar a
 * señalar de más, que aquí significa descartar un antecedente real.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Cuando la respuesta es «no sé», la condición que el extractor cosechó de la
 *   PREGUNTA conserva su certeza (`LO_QUE_NO_SE_CUBRE_AUN`). Sólo se garantiza
 *   que no se descarte. La tercera salida —«el paciente dice que no lo sabe»,
 *   enseñada en pantalla— queda en el backlog.
 * - No mide el corpus: son casos escritos, no frases medidas del dictado real.
 * - No toca el campo de alergias (`cds.ts`, `alergias.ts`): ése es SAFE-001.
 * - No decide quién tiene razón si el dictado y la nota se contradicen. Eso
 *   sigue siendo del médico.
 */

import { describe, it, expect } from 'vitest'
import { extraerComorbilidades, parsearTranscripcion } from '@/lib/expediente/parser-clinico'
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

describe('El guardián del reconocedor ve voltearse «no padece»', () => {
  it('perder el «no» de «no padece diabetes» es un volteo de negación', () => {
    const v = verificar('no padece diabetes', 'padece diabetes')
    expect(v.violaciones.map(x => x.clase)).toContain('volteo_negacion')
  })

  it('una corrección léxica que respeta la negación no se marca', () => {
    const v = verificar('no padece diabetes', 'no padece diabetes mellitus')
    expect(v.violaciones.map(x => x.clase)).not.toContain('volteo_negacion')
  })
})
