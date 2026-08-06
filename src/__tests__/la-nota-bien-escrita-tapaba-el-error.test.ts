/**
 * GOLDEN — la nota BIEN escrita apagaba las dos compuertas (REG-192).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `contradicciones()` (lo que el paciente negó y la nota afirma) y
 * `desajustesTemporales()` (lo que el dictado puso en pasado y la nota afirma
 * como actual) buscaban el padecimiento en la nota con un `indexOf` **por forma
 * y una sola vez**, y descartaban esa aparición si venía encuadrada.
 *
 * En una nota bien redactada la PRIMERA aparición es casi siempre la correcta
 * —está en antecedentes, o viene negada en el interrogatorio— así que se
 * descartaba, y ahí acababa la búsqueda: la afirmación de más abajo, que es
 * exactamente el defecto que hay que cazar, no se miraba nunca.
 *
 *     dictado: «El paciente niega asma.»
 *     nota:    «Interrogatorio por aparatos: niega asma.
 *               Se agrega en la lista de problemas asma persistente moderada.»
 *     aviso:   ninguno
 *
 * El segundo fallo es hermano: la ventana de 60 caracteres hacia atrás se
 * medía en caracteres, no en oraciones, y 60 caracteres cruzan un renglón. Una
 * negación que hablaba de OTRA enfermedad exculpaba a la de abajo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditando `temporalidad.ts` —el motor que EVAL-002 señala como el único sin
 * corpus— siguiendo el camino del padecimiento de punta a punta: quién lo pone
 * en pasado, quién lo busca en la nota y qué lo exculpa. Los cuatro casos de
 * abajo se reprodujeron contra los motores reales antes de tocar nada, y los
 * cuatro devolvían lista vacía.
 *
 * Las dos copias del rastreo llevaban el riesgo escrito en su propio comentario
 * —«una negación ajena taparía una afirmación real, que es el fallo caro»— y
 * ninguna lo había cerrado.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Las dos compuertas existen para que un antecedente que nadie dijo, o una
 * enfermedad de hace tres años, no queden escritas como diagnóstico actual: eso
 * se arrastra a todas las notas siguientes y cambia el riesgo quirúrgico y la
 * elección de fármacos. Callaban justo en la nota mejor escrita, que es donde
 * el médico más confía en ellas.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * El mismo rastreo copiado en dos módulos. Hoy vive una sola vez en
 * `donde-lo-dice-la-nota.ts`, y esta prueba comprueba **los dos llamadores**.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No mide la calidad del vocabulario: lo que no está en `CRONICAS` ni en
 *   `AGUDAS_FRECUENTES` sigue sin vigilarse, y así está declarado allí.
 * · No juzga si el padecimiento sigue activo — eso es clínico y no es del motor.
 * · La ventana sigue siendo de 60 caracteres dentro de la oración: una marca
 *   más lejana que eso, en la misma oración, no exculpa.
 * · No cubre notas sin puntuación: si todo va en una sola oración, la ventana
 *   vuelve a ser lo único que acota.
 */
import { describe, it, expect } from 'vitest'
import { condicionesNegadas, contradicciones } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'
import {
  contextoAntesDe,
  afirmacionSinEncuadre,
  sinAcentos,
  VENTANA_HACIA_ATRAS,
} from '@/lib/expediente/donde-lo-dice-la-nota'

describe('LA PRIMERA APARICIÓN, BIEN ESCRITA, NO PUEDE APAGAR LA SEGUNDA', () => {
  it('negaciones: «niega asma» arriba no exculpa al asma afirmada abajo', () => {
    const negadas = condicionesNegadas('El paciente niega asma.')
    const nota = 'Interrogatorio por aparatos: niega asma.\n'
      + 'Se agrega en la lista de problemas asma persistente moderada, se inicia budesonida.'
    const out = contradicciones(negadas, nota)
    expect(out).toHaveLength(1)
    expect(out[0].condicion).toBe('asma')
    // La cita tiene que apuntar a la afirmación, no a la negación bien escrita.
    expect(out[0].enLaNota).toContain('lista de problemas')
  })

  it('temporalidad: «neumonía en 2019» en antecedentes no exculpa a la neumonía actual', () => {
    const pasadas = mencionesEnPasado('Tuvo neumonía hace tres años.')
    const nota = 'Antecedentes personales: neumonía en 2019, resuelta.\n'
      + 'Impresión diagnóstica: neumonía adquirida en la comunidad, en manejo antibiótico.'
    const out = desajustesTemporales(pasadas, nota)
    expect(out).toHaveLength(1)
    expect(out[0].enLaNota).toContain('Impresión diagnóstica')
  })
})

describe('LA VENTANA NO PUEDE SALTAR DE ORACIÓN', () => {
  it('negaciones: un «no tiene» que habla de tuberculosis no exculpa al asma', () => {
    const negadas = condicionesNegadas('El paciente niega asma.')
    const nota = 'No tiene antecedentes de tuberculosis.\nIDx: asma persistente moderada.'
    expect(contradicciones(negadas, nota)).toHaveLength(1)
  })

  it('temporalidad: un «antecedente» de tabaquismo no exculpa a la neumonía actual', () => {
    const pasadas = mencionesEnPasado('Tuvo neumonía hace tres años.')
    const nota = 'Antecedente de tabaquismo suspendido. Cursa con neumonía adquirida en la comunidad.'
    expect(desajustesTemporales(pasadas, nota)).toHaveLength(1)
  })
})

describe('Y LO QUE ESTÁ BIEN ESCRITO SIGUE SIN AVISAR', () => {
  /**
   * La otra mitad del trato. Ensanchar la búsqueda es la forma más fácil de
   * fabricar falsos positivos, y un aviso que salta cuando no debe se acaba
   * ignorando — con él se ignoran los que sí importan.
   */
  it('negaciones: una nota que sólo la niega no contradice nada', () => {
    const negadas = condicionesNegadas('El paciente niega asma.')
    expect(contradicciones(negadas, 'Interrogatorio por aparatos: niega asma.')).toEqual([])
  })

  it('negaciones: y aunque la nombre dos veces, si las dos vienen negadas', () => {
    const negadas = condicionesNegadas('El paciente niega asma.')
    const nota = 'Interrogatorio: niega asma.\nAntecedentes: sin antecedentes de asma ni de EPOC.'
    expect(contradicciones(negadas, nota)).toEqual([])
  })

  it('temporalidad: «antecedente de neumonía» está bien escrito', () => {
    const pasadas = mencionesEnPasado('Tuvo neumonía hace tres años.')
    expect(desajustesTemporales(pasadas, 'Antecedente de neumonía tratada en 2019.')).toEqual([])
  })

  it('temporalidad: y dos veces en pasado tampoco avisan', () => {
    const pasadas = mencionesEnPasado('Tuvo neumonía hace tres años.')
    const nota = 'Antecedentes personales: neumonía en 2019.\nTuvo neumonía que requirió hospitalización.'
    expect(desajustesTemporales(pasadas, nota)).toEqual([])
  })
})

describe('EL CORTE DE ORACIÓN — dónde sí y dónde no', () => {
  const ctx = (nota: string, aguja: string) =>
    contextoAntesDe(sinAcentos(nota), sinAcentos(nota).indexOf(sinAcentos(aguja)))

  it('los dos puntos NO cortan: «Antecedentes personales: neumonía» es lo correcto', () => {
    expect(ctx('Antecedentes personales: neumonía en 2019.', 'neumonía')).toContain('antecedentes')
  })

  it('el punto de una abreviatura tampoco: exige espacio detrás', () => {
    // «Dr.» y «c.s.p.» van pegados a la palabra siguiente; partir ahí dejaría la
    // marca fuera de la ventana y fabricaría un aviso falso.
    expect(ctx('Sin antecedente de Dr.Sosa ni de asma.', 'asma')).toContain('sin antecedente')
  })

  it('un decimal no corta: «2.5» es una cifra, no un fin de oración', () => {
    expect(ctx('Antecedente de tabaquismo 2.5 cajetillas y neumonía.', 'neumonía'))
      .toContain('antecedente')
  })

  it('el punto seguido sí corta', () => {
    expect(ctx('Niega tuberculosis. Cursa con asma.', 'asma')).not.toContain('niega')
  })

  it('y el salto de línea a secas también', () => {
    expect(ctx('Niega tuberculosis\nIDx: asma', 'asma')).not.toContain('niega')
  })

  it('la ventana sigue siendo de 60 caracteres dentro de la oración', () => {
    const lejos = `antecedente de ${'x'.repeat(VENTANA_HACIA_ATRAS)} asma`
    expect(ctx(lejos, 'asma')).not.toContain('antecedente')
  })
})

describe('EL RASTREADOR, POR SU CUENTA', () => {
  const nunca = () => false
  const siempre = () => true

  it('devuelve null cuando la nota no lo nombra', () => {
    expect(afirmacionSinEncuadre('nada que ver', ['asma'], nunca)).toBeNull()
  })

  it('devuelve null cuando todas las apariciones vienen encuadradas', () => {
    expect(afirmacionSinEncuadre('asma y asma', ['asma'], siempre)).toBeNull()
  })

  it('devuelve la aparición más temprana sin encuadrar, no la de la primera forma', () => {
    /**
     * Las formas se recorren en el orden del vocabulario, que no es el orden de
     * la nota. Sin quedarse con el mínimo, «diabetes mellitus» —forma tardía de
     * la lista pero temprana en el texto— perdía frente a «dm2».
     */
    const nota = 'diabetes mellitus tipo 2 descontrolada, en manejo con dm2 referida'
    const idx = afirmacionSinEncuadre(nota, ['dm2', 'diabetes mellitus'], nunca)
    expect(idx).toBe(0)
  })

  it('no se atasca con una forma vacía', () => {
    expect(afirmacionSinEncuadre('asma', [''], nunca)).toBeNull()
  })
})
