/**
 * GOLDEN — la negación a medias: ocho formas vivas y una enfermedad que se borra.
 *
 * ── QUÉ FALLABA (medido con el motor real el 9-ago-2026) ─────────────────────
 *
 * `parser-clinico.ts` es el motor que **arma la nota cuando la IA falla** (el
 * fallback de `/api/expediente/procesar` cuando el proveedor devuelve 529).
 *
 * REG-192 amplió su lista de negadores con `padece` y `padezco` — y los metió
 * **sólo en `NEGADORES`, no en `AFIRMADORES`**. Eso cambió un falso positivo por
 * un falso negativo, que es peor porque no se ve:
 *
 *     extraerComorbilidades('Niega tabaquismo, padece diabetes mellitus.')
 *       → negadas: ['Diabetes mellitus tipo 2', 'Tabaquismo']   ← la diabetes
 *                                                                 DESAPARECE
 *
 * El `niega` del principio sigue alcanzando al término de la segunda cláusula
 * porque `padece` no cierra la negación. Un negador sin su afirmador gemelo no
 * arregla la mitad: la mueve de sitio.
 *
 * Y seguían cayendo del lado afirmativo ocho formas normales de negar:
 *
 *     «No he tenido diabetes.»     «Nunca he tenido diabetes.»
 *     «Jamás ha tenido diabetes.»  «Tampoco tiene diabetes.»
 *     «No sufre de diabetes.»      «No cuenta con diabetes.»
 *     «No fuma.»                   «No es fumador.»
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * La auditoría de nueve dimensiones del 6-ago dejó apuntado el hallazgo C2/C3 en
 * una línea. Al reproducirlo contra `main` —ya con REG-192 dentro— quedó claro
 * que el arreglo anterior había cubierto tres formas y abierto la puerta
 * contraria. No es que no detectara la negación: es que **afirmaba la
 * enfermedad** o, ahora, **la borraba**.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Un antecedente crónico inventado cambia el riesgo quirúrgico, cambia la
 * elección de fármacos y **se arrastra**: los antecedentes se copian a las notas
 * siguientes y cada copia lo vuelve más creíble. Uno que se borra es peor: nadie
 * echa de menos lo que no está. Y `tabaquismoActivo` no se queda en la prosa —
 * entra en STOP-BANG y en Caprini, escalas preoperatorias.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * · «No es diabético» sigue sin detectarse **como término**: `diabético` no está
 *   en `COMORBILIDADES_DIC`. Es hueco del diccionario de enfermedades, no de la
 *   negación (emparenta con C-7).
 * · La lista es **vocabulario**: que falte una forma de negar significa que ese
 *   caso no se vigila, no que se dé por bueno.
 * · No toca `negaciones.ts` — la decisión C-6 del dueño (7-ago) separó ese
 *   vocabulario del de aquí a propósito. Son preguntas distintas.
 * · No decide nada clínico: sólo si la frase niega el término.
 *
 * ── LA NEGACIÓN QUE CRUZA LA COMA: NO SE ADIVINA (queda abierto) ─────────────
 *
 * El primer caso de la revisión del dueño **sigue igual**, y a propósito:
 *
 *     extraerComorbilidades('No es cardiópata, diabetes mellitus tipo 2.')
 *       → la diabetes sale NEGADA
 *
 * No es el hueco del afirmador gemelo —ahí no hay ningún verbo en la segunda
 * cláusula que pudiera cerrar la negación—: es que **el negador cruza la coma**.
 * Y ese mismo comportamiento es el que hace correcta la lista negada, que es
 * como se dicta de verdad un interrogatorio:
 *
 *     'Niega diabetes, hipertensión y asma.'   → las TRES negadas ✔
 *     'No tiene diabetes, hipertensión ni asma.' → las TRES negadas ✔
 *
 * Mismo camino de código, dos intenciones opuestas, y el español no las
 * distingue: cortar en la coma arreglaría el primero y convertiría los otros dos
 * en **cinco antecedentes inventados**. Elegir qué error se prefiere es una
 * decisión clínica del dueño, así que aquí se **declara** en vez de adivinarse
 * (regla 6 de `clinical-safety.md`). Va a su cola como C-10.
 *
 * ── OTRO HUECO DE VOCABULARIO, TAMBIÉN DECLARADO ────────────────────────────
 *
 * «No se queja de diabetes» sale POSITIVA: `queja` no está entre los verbos.
 * Añadir verbos es vocabulario, y este módulo sólo puede señalar de menos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extraerComorbilidades, estaNegado, VOCABULARIO_DE_NEGACION,
} from '@/lib/expediente/parser-clinico'

describe('LAS OCHO FORMAS QUE SEGUÍAN VIVAS', () => {
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

describe('LA TERCERA VEZ DEL MISMO DEFECTO — lo cazó el dueño en revisión', () => {
  /**
   * La primera versión de este PR arregló el hueco de `padece` (REG-192) y lo
   * volvió a abrir con los tres verbos que ella misma añadía. El dueño lo cazó
   * **ejecutando el motor**, no leyendo el diff:
   *
   *     extraerComorbilidades('No cuenta con alergias, cuenta con diabetes…')
   *       → la diabetes caía en NEGADAS
   *
   * Al medir el alcance completo salieron dos más que nadie había nombrado:
   * `hay` y los tiempos compuestos.
   */
  const AFIRMA_LA_SEGUNDA: [string, string][] = [
    ['No cuenta con alergias, cuenta con diabetes mellitus tipo 2.', 'Diabetes mellitus tipo 2'],
    ['Niega tabaquismo, ha tenido diabetes mellitus.', 'Diabetes mellitus tipo 2'],
    ['No hay datos de asma, hay diabetes mellitus.', 'Diabetes mellitus tipo 2'],
    ['Niega tabaquismo, tiene diabetes mellitus.', 'Diabetes mellitus tipo 2'],
    ['Niega tabaquismo, sufre diabetes mellitus.', 'Diabetes mellitus tipo 2'],
  ]
  it.each(AFIRMA_LA_SEGUNDA)('«%s» conserva «%s»', (frase, canonico) => {
    const r = extraerComorbilidades(frase)
    expect(r.positivas).toContain(canonico)
    expect(r.negadas).not.toContain(canonico)
  })

  /**
   * El pronombre intercalado rompía la guarda: `refiere` se leía como afirmador
   * propio en vez de como parte de «no me refiere», así que la negación no valía.
   */
  it('«No me refiere diabetes» sigue siendo una negación', () => {
    const r = extraerComorbilidades('No me refiere diabetes.')
    expect(r.negadas).toContain('Diabetes mellitus tipo 2')
    expect(r.positivas).not.toContain('Diabetes mellitus tipo 2')
  })
})

describe('EL GUARDIÁN — ningún verbo puede quedarse de un solo lado', () => {
  /**
   * Tres veces seguidas se añadió un verbo a los negadores y no a los
   * afirmadores (REG-192 con `padece`; este mismo PR con `es`/`era`/`cuenta
   * con`; y al medir, `hay` y los compuestos). Un comentario pidiendo que se
   * acuerden ya se probó y no bastó.
   *
   * Esto no comprueba una lista escrita a mano: **recorre la de verdad**. Si
   * mañana alguien añade un verbo sólo a `NEGADORES`, este caso se pone rojo
   * antes de que un antecedente desaparezca de una nota.
   */
  const { verbos, participios, negadores, afirmadores } = VOCABULARIO_DE_NEGACION

  it.each(verbos)('el verbo «%s» niega Y afirma', verbo => {
    // Se prueba con la forma que el regex genera, no con el literal del array.
    const muestra = new RegExp(`^(?:${verbo})$`, 'i')
    const ejemplo = ['tiene', 'tengo', 'tenia', 'tuvo', 'tuve', 'presenta', 'presento',
      'refiere', 'refiero', 'padece', 'padezco', 'padecia', 'padecio', 'sufre', 'sufro',
      'sufria', 'fuma', 'fumo', 'fumaba', 'cuenta con', 'hay', 'es', 'era']
      .find(e => muestra.test(e))
    expect(ejemplo, `sin ejemplo para «${verbo}» — añádelo a la lista de muestras`).toBeTruthy()
    expect(negadores.test(`no ${ejemplo}`), `«no ${ejemplo}» debería negar`).toBe(true)
    expect(afirmadores.test(String(ejemplo)), `«${ejemplo}» debería afirmar`).toBe(true)
  })

  it.each(participios)('el compuesto «ha %s» niega Y afirma', participio => {
    expect(negadores.test(`no ha ${participio}`)).toBe(true)
    expect(afirmadores.test(`ha ${participio}`)).toBe(true)
  })

  it('los afirmadores se DERIVAN de los negadores, no se copian', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/expediente/parser-clinico.ts'), 'utf8')
    // Si vuelve a escribirse a mano, esta prueba cae y con ella el patrón.
    expect(src).toContain('const AFIRMADORES = new RegExp(')
    expect(src).toMatch(/\$\{VERBOS_AFIRMATIVOS\}/)
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
