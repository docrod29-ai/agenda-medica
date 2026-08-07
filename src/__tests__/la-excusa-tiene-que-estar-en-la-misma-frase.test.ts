/**
 * GOLDEN — «Niega diabetes» en el resumen callaba el «Diabetes mellitus 2» del
 * diagnóstico. REG-192.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Los dos guardianes que contrastan el dictado contra la nota antes de firmar
 * —`contradicciones` (lo que el paciente negó) y `desajustesTemporales` (lo que
 * el dictado puso en pasado)— buscaban el término en la nota, miraban 60
 * caracteres hacia atrás y, si encontraban una excusa («niega …», «antecedente
 * de …»), daban el término por bien escrito.
 *
 * Dos cosas mal, y las dos hacia el mismo lado — el de callar:
 *
 * 1. **Sólo se miraba la PRIMERA aparición.** Si venía excusada, las demás no
 *    se miraban.
 * 2. **Los 60 caracteres cruzaban el fin de frase.** La excusa de la línea
 *    anterior tapaba la afirmación de ésta.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * 7-ago-2026, armando el corpus oro del motor de temporalidad (EVAL-002). Al
 * escribir un caso con la nota dispuesta como la arma la app de verdad
 * —`textoDeLaNota` en consulta/page.tsx concatena resumen, luego diagnósticos,
 * luego secciones— el motor devolvió lista vacía. Se midió: del «Diabetes» del
 * diagnóstico al «Niega» del resumen había 53 caracteres, menos de 60.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ────────────────────────────────────────
 *
 * El resumen es justo donde se narra bien el antecedente, y el diagnóstico va
 * después. Así que en la disposición NORMAL de una nota el guardián callaba
 * SIEMPRE, y sólo hablaba cuando el error casualmente iba primero. Una nota que
 * a la vez dice «niega diabetes» y diagnostica «diabetes mellitus tipo 2» es
 * exactamente la contradicción que hay que enseñar antes de firmar: lo que se
 * firma queda en el expediente y se copia a la nota siguiente.
 *
 * Es el defecto de «escrito y conectado, pero el dato no llega»: los dos motores
 * corrían, estaban cableados a la pantalla y sus pruebas pasaban — con notas de
 * una sola línea.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La excusa sólo vale si está en la MISMA frase que el término, con el mismo
 * criterio de corte que `frases()`. Un punto entre dígitos («E11.9», «110.5») es
 * un decimal y no corta: si cortara, la negación se perdería por culpa de una
 * cifra y el falso positivo entraría por la otra puerta.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide si la nota tiene razón. Los dos motores siguen sin decidir nada
 *   clínico: enseñan las dos frases y decide el médico.
 * · El vocabulario no cambió. Lo que no está en `CRONICAS` ni en
 *   `AGUDAS_FRECUENTES` sigue sin vigilarse — y así está declarado allí.
 * · Un término escrito con una forma que el vocabulario no tiene («DM2» donde el
 *   catálogo dice «dm tipo 2») sigue sin encontrarse: esto arregla el recorrido,
 *   no el diccionario.
 * · No toca la ventana de 60 caracteres hacia atrás: sigue siendo la cota, sólo
 *   que ahora recortada por la frase.
 */
import { describe, it, expect } from 'vitest'
import {
  condicionesNegadas, contradicciones, primeraMencionSinExcusa,
} from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'

/**
 * La nota se arma así de verdad — `textoDeLaNota`, consulta/page.tsx: resumen,
 * luego los diagnósticos, luego el valor de cada sección. La etiqueta de la
 * sección NO entra, así que un encabezado «ANTECEDENTES» nunca excusó nada.
 */
const notaComoSeArma = (resumen: string, dxs: readonly string[], secciones: readonly string[]) =>
  [resumen, ...dxs, ...secciones].filter(Boolean).join('\n')

describe('EL CASO QUE LO MOTIVA — la nota en el orden en que la app la arma', () => {
  it('«niega diabetes» en el resumen NO excusa el diagnóstico de diabetes', () => {
    const dictado = '¿Ha tenido diabetes? No, ninguna.'
    const nota = notaComoSeArma(
      'Masculino de 54 años. Niega diabetes e hipertensión.',
      ['Diabetes mellitus tipo 2 descontrolada E11.9'],
      [],
    )
    const c = contradicciones(condicionesNegadas(dictado), nota)
    expect(c).toHaveLength(1)
    expect(c[0].condicion).toBe('diabetes')
    expect(c[0].enLaNota).toContain('Diabetes mellitus tipo 2')
  })

  it('«antecedente de neumonía» en el resumen NO excusa el diagnóstico en presente', () => {
    const dictado = 'El paciente tuvo neumonía hace tres años. Hoy viene por tos.'
    const nota = notaComoSeArma(
      'Masculino de 54 años con antecedente de neumonía en 2023, acude por tos.',
      ['Neumonía adquirida en la comunidad J18.9'],
      [],
    )
    const d = desajustesTemporales(mencionesEnPasado(dictado), nota)
    expect(d).toHaveLength(1)
    expect(d[0].condicion).toBe('neumonía')
    expect(d[0].enLaNota).toContain('Neumonía adquirida en la comunidad')
  })

  it('el fallo era de DISTANCIA, no de contenido: 53 caracteres bastaban para callarlo', () => {
    const nota = 'Masculino de 54 años. Niega diabetes e hipertensión.\nDiabetes mellitus tipo 2'
    const segundo = nota.toLowerCase().indexOf('diabetes', 30)
    const primero = nota.toLowerCase().indexOf('niega')
    expect(segundo - primero).toBeLessThan(60)
  })
})

describe('LA SEGUNDA APARICIÓN TAMBIÉN SE MIRA', () => {
  it('negación: excusada arriba, afirmada abajo → avisa', () => {
    const dictado = '¿Ha tenido hipertensión? No.'
    const nota = 'Niega hipertensión.\n\nMuy lejos de la negación anterior, se afirma hipertensión arterial.'
    expect(contradicciones(condicionesNegadas(dictado), nota)).toHaveLength(1)
  })

  it('temporalidad: antecedente arriba, presente abajo → avisa', () => {
    const dictado = 'Tuvo neumonía hace tres años.'
    const nota = 'Antecedente de neumonía.\n\nCursa hoy con neumonía basal derecha en el estudio de imagen.'
    expect(desajustesTemporales(mencionesEnPasado(dictado), nota)).toHaveLength(1)
  })

  it('si TODAS las apariciones vienen excusadas, sigue callado', () => {
    const dictado = '¿Ha tenido diabetes? No, ninguna.'
    const nota = 'Niega diabetes.\nSin antecedentes de diabetes.\nNo tiene diabetes documentada.'
    expect(contradicciones(condicionesNegadas(dictado), nota)).toEqual([])
  })
})

describe('LA TRAMPA — lo bien escrito sigue sin avisar', () => {
  it('una nota que sólo lo escribe como negado no produce aviso', () => {
    const dictado = '¿Ha tenido diabetes? No, ninguna.'
    expect(contradicciones(condicionesNegadas(dictado), 'Niega diabetes.')).toEqual([])
  })

  it('una nota que sólo lo escribe como antecedente no produce aviso', () => {
    const dictado = 'Tuvo neumonía hace tres años.'
    expect(desajustesTemporales(mencionesEnPasado(dictado), 'Antecedente de neumonía en 2023.')).toEqual([])
  })

  it('«desde hace tres años tiene diabetes» sigue siendo presente y no se marca', () => {
    expect(mencionesEnPasado('Desde hace tres años tiene diabetes.')).toEqual([])
  })
})

describe('EL DECIMAL NO CORTA LA FRASE', () => {
  /**
   * Si el punto de «110.5» contara como fin de frase, la negación quedaría fuera
   * de la ventana y el guardián avisaría de una nota bien escrita. El falso
   * positivo entraría por la puerta que este arreglo abrió.
   */
  it('«no tiene glucosa de 110.5 ni diabetes» sigue excusado', () => {
    const dictado = '¿Ha tenido diabetes? No, ninguna.'
    expect(contradicciones(condicionesNegadas(dictado), 'No tiene glucosa de 110.5 ni diabetes.')).toEqual([])
  })

  it('un CIE-10 con punto dentro de la excusa tampoco la parte', () => {
    const dictado = '¿Ha tenido diabetes? No, ninguna.'
    expect(contradicciones(condicionesNegadas(dictado), 'Niega E11.9 diabetes.')).toEqual([])
  })
})

describe('EL RECORRIDO ES UNO SOLO — no se vuelve a escribir por motor', () => {
  /**
   * REG-192 se coló en los dos guardianes a la vez porque el recorrido estaba
   * copiado. Ahora lo comparten y lo único propio de cada uno es qué cuenta como
   * excusa.
   */
  it('la excusa de la frase anterior no cuenta', () => {
    expect(primeraMencionSinExcusa('Niega diabetes.\nDiabetes tipo 2.', ['diabetes'], /\bniega\b/i))
      .toContain('Diabetes tipo 2')
  })

  it('la excusa de la misma frase sí cuenta', () => {
    expect(primeraMencionSinExcusa('Niega diabetes tipo 2.', ['diabetes'], /\bniega\b/i)).toBeNull()
  })

  it('un término que no está en la nota devuelve null', () => {
    expect(primeraMencionSinExcusa('Sin hallazgos.', ['diabetes'], /\bniega\b/i)).toBeNull()
  })

  it('los acentos no cambian el resultado', () => {
    expect(primeraMencionSinExcusa('Cursa con neumonía basal.', ['neumonia'], /\bantecedente\b/i))
      .toContain('neumonía')
  })
})
