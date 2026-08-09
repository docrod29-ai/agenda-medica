/**
 * GOLDEN — «No padece diabetes» salía como ANTECEDENTE POSITIVO (REG-201).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `parser-clinico.ts` es el motor que **arma la nota cuando la IA falla** (el
 * fallback de `/api/expediente/procesar` cuando el proveedor devuelve 529). Su
 * lista de negadores sólo conocía:
 *
 *     niega | sin | no (tiene|presenta|refiere|hay|ha tenido) | nunca (ha|tuvo)
 *
 * Todo lo demás caía del lado afirmativo. No es que no detectara la negación:
 * es que **afirmaba la enfermedad**, porque `extraerComorbilidades` sólo tiene
 * dos casillas y la que no es `negadas` es `positivas`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * La auditoría de nueve dimensiones del 6-ago lo dejó apuntado en una línea
 * (hallazgo C2/C3): «"No padece diabetes" sale como antecedente positivo». El
 * 8-ago se reprodujo con el motor real antes de tocar nada, y resultó bastante
 * más ancho que la línea — cada una de estas devolvía la enfermedad en
 * `positivas`:
 *
 *     «No padece diabetes.»        «No tengo diabetes.»
 *     «No he tenido diabetes.»     «Nunca he tenido diabetes.»
 *     «Jamás ha tenido diabetes.»  «Tampoco tiene diabetes.»
 *     «No sufre de diabetes.»      «No cuenta con diabetes.»
 *     «No fuma.»                   «No es fumador.»
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Tres motores contestan a tres preguntas distintas sobre la negación y cada uno
 * tiene su vocabulario. `negaciones.ts` ya conocía «no padece» desde el 3-ago
 * (REG-151) y este parser nunca se enteró: nadie los mira juntos.
 *
 * **No se arregló compartiéndolos.** El dueño decidió lo contrario el 7-ago
 * (C-6), después de que ensanchar el vocabulario compartido fabricara una
 * negación que el paciente no había dicho. Aquí se ensancha **sólo** el de este
 * parser, que es el que estaba corto.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Un antecedente crónico inventado cambia el riesgo quirúrgico, cambia la
 * elección de fármacos y **se arrastra**: los antecedentes se copian a las notas
 * siguientes y cada copia lo vuelve más creíble. Y `tabaquismoActivo` no se
 * queda en la prosa — entra en STOP-BANG y en Caprini, que son escalas
 * preoperatorias.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * · «No es diabético» sigue sin detectarse **como término**: `diabético` no está
 *   en `COMORBILIDADES_DIC`. Es hueco del diccionario de enfermedades, no de la
 *   negación (queda en el backlog como VOC-001, y emparenta con C-7).
 * · La lista es **vocabulario**: que falte una forma de negar significa que ese
 *   caso no se vigila, no que se dé por bueno.
 * · No toca el lado del dictado (`negaciones.ts`, REG-199/194) ni la disculpa en
 *   la nota. Son otras dos preguntas, con su golden.
 * · No decide nada clínico: sólo si la frase niega el término.
 */
import { describe, it, expect } from 'vitest'
import { extraerComorbilidades, estaNegado } from '@/lib/expediente/parser-clinico'

describe('EL CASO — «no padece diabetes» era un antecedente positivo', () => {
  /** Las formas medidas contra el motor real el 8-ago. Todas salían positivas. */
  const NEGADAS: [string, string][] = [
    ['No padece diabetes.', 'Diabetes mellitus tipo 2'],
    ['No padezco diabetes.', 'Diabetes mellitus tipo 2'],
    ['No tengo diabetes.', 'Diabetes mellitus tipo 2'],
    ['No he tenido diabetes.', 'Diabetes mellitus tipo 2'],
    ['Nunca he tenido diabetes.', 'Diabetes mellitus tipo 2'],
    ['Jamás ha tenido diabetes.', 'Diabetes mellitus tipo 2'],
    ['Tampoco tiene diabetes.', 'Diabetes mellitus tipo 2'],
    ['No sufre de diabetes.', 'Diabetes mellitus tipo 2'],
    ['No cuenta con diabetes.', 'Diabetes mellitus tipo 2'],
    ['No padece hipertensión arterial.', 'Hipertensión arterial'],
    ['No refiere hipertensión.', 'Hipertensión arterial'],
  ]

  it.each(NEGADAS)('«%s» NO es un antecedente', (frase, canonico) => {
    const r = extraerComorbilidades(frase)
    expect(r.positivas).not.toContain(canonico)
    expect(r.negadas).toContain(canonico)
  })

  it('la nota de respaldo escribe «Niega», no «Antecedentes»', () => {
    const r = extraerComorbilidades('Paciente de 40 años. No padece diabetes.')
    expect(r.negadas).toContain('Diabetes mellitus tipo 2')
    expect(r.positivas).toHaveLength(0)
  })

  /**
   * El término que ES el verbo. `tabaquismoActivo` puntúa en STOP-BANG y en
   * Caprini, así que aquí un falso positivo no se queda en la prosa.
   */
  it('«No fuma» no deja al paciente como fumador', () => {
    const r = extraerComorbilidades('El paciente no fuma.')
    expect(r.positivas).not.toContain('Tabaquismo')
    expect(r.negadas).toContain('Tabaquismo')
  })

  it('«No es fumador» tampoco', () => {
    expect(extraerComorbilidades('No es fumador.').positivas).not.toContain('Tabaquismo')
  })

  it('la bandera preoperatoria de tabaquismo queda en false, no en true', () => {
    expect(extraerComorbilidades('No fuma.').preopFlags.tabaquismoActivo).toBe(false)
  })
})

describe('EL ERROR CONTRARIO — una enfermedad real que desaparece', () => {
  /**
   * Si `padece` no cierra la negación anterior, el `niega` del principio se come
   * el término de la cláusula siguiente. Tan caro como inventar un antecedente.
   */
  it('«Niega tabaquismo, padece diabetes mellitus» conserva la diabetes', () => {
    const r = extraerComorbilidades('Niega tabaquismo, padece diabetes mellitus.')
    expect(r.positivas).toContain('Diabetes mellitus tipo 2')
    expect(r.negadas).toContain('Tabaquismo')
  })

  it('«Niega TVP. Padece diabetes» conserva la diabetes', () => {
    expect(extraerComorbilidades('Niega TVP. Padece diabetes.').positivas)
      .toContain('Diabetes mellitus tipo 2')
  })

  it('«No ha mejorado su diabetes» NO la niega — no es un comodín', () => {
    const r = extraerComorbilidades('No ha mejorado su diabetes.')
    expect(r.positivas).toContain('Diabetes mellitus tipo 2')
    expect(r.negadas).not.toContain('Diabetes mellitus tipo 2')
  })

  it('la afirmación limpia sigue siendo afirmación', () => {
    for (const f of ['Padece diabetes.', 'Tiene diabetes.', 'Presenta diabetes.', 'Sufre diabetes.']) {
      expect(extraerComorbilidades(f).positivas).toContain('Diabetes mellitus tipo 2')
    }
  })

  /** La coma corta la partícula pegada: «hipertensión no, diabetes sí». */
  it('«no,» con coma no niega el término siguiente', () => {
    const t = 'hipertension no, diabetes si'
    expect(estaNegado(t, t.indexOf('diabetes'))).toBe(false)
  })

  it('el punto sigue cerrando la negación de la cláusula anterior', () => {
    const t = 'niega tvp. presenta diabetes'
    expect(estaNegado(t, t.indexOf('diabetes'))).toBe(false)
  })
})

describe('EL AFIRMADOR EMBEBIDO EN UN NEGADOR NO CIERRA LA NEGACIÓN', () => {
  const CASOS: [string, string][] = [
    ['no padece diabetes', 'diabetes'],
    ['tampoco tiene diabetes', 'diabetes'],
    ['jamas ha tenido cancer', 'cancer'],
    ['nunca tuvo cancer', 'cancer'],
    ['no tiene diabetes', 'diabetes'],
  ]
  it.each(CASOS)('«%s» · «%s» sigue negado', (texto, term) => {
    expect(estaNegado(texto, texto.indexOf(term))).toBe(true)
  })
})
