/**
 * GOLDEN — el «no» de la consulta no es el «no» de un formulario, y «no sé»
 * nunca fue un «no».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de las nueve dimensiones (6-ago-2026), hallazgos C2 y C3, los dos
 * pendientes de reparar del plan. Se reprodujeron con el motor real antes de
 * tocar nada: se le pasaron a `condicionesNegadas` las formas en que se contesta
 * de verdad en una consulta mexicana y se miró qué devolvía.
 *
 * De doce formas reales de decir que no, **siete no se reconocían**:
 *
 *     «¿Padece diabetes?  Pues no.»                    → []
 *     «¿Tiene hipertensión?  Fíjese que no.»           → []
 *     «¿Es asmático?  Para nada.»                      → []
 *     «¿Ha tenido cáncer?  Qué va.»                    → []
 *     «¿Tiene VIH?  Nel.»                              → []
 *     «¿Presión alta?  Tampoco.»                       → []
 *     «No es diabético.»                               → []
 *
 * Y una que se reconocía y **no debía**:
 *
 *     «¿Tiene diabetes?  No sé.»                       → ['diabetes'] ← negada
 *
 * ── QUÉ FALLABA, Y POR QUÉ LE IMPORTA A UN PACIENTE ─────────────────────────
 *
 * Las dos mitades son el mismo motor, y las dos terminan en el expediente.
 *
 * **La que se escapa (C3).** Este motor es la única defensa determinista contra
 * el fallo que el Dr. encontró en producción el 3-ago: el interrogatorio se
 * dicta NOMBRANDO las enfermedades en la pregunta, el extractor las cosecha, y
 * el paciente que contestó que no sale con dos crónicas que no tiene. Si el
 * motor no entiende la forma en que el paciente contestó, la defensa no existe
 * para ese paciente — y el antecedente se arrastra a todas las notas siguientes.
 *
 * **La que sobra (C2).** Peor, porque escribe. «No sé» empieza por «no», así que
 * se leía como negación, y `corregirCertezaPorNegacion` bajaba la condición a
 * `descartado`. El sistema convertía un «no lo sé» del paciente en un «no la
 * tiene» del expediente. Es la regla 4 de seguridad clínica al revés: ausencia
 * de dato no es dato de ausencia.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Este motor puede equivocarse en dos direcciones y NO son simétricas:
 *
 * - Señalar de menos: un aviso que no sale. Malo.
 * - Fabricar un negativo: el expediente afirma que el paciente NO tiene algo
 *   que nadie descartó. Inaceptable.
 *
 * Por eso la duda gana siempre sobre la negativa, y por eso las marcas que
 * niegan un término suelto («no es diabético») exigen adyacencia: en «no es
 * fumador, tiene diabetes de diez años» el «no es» habla del tabaco.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * 1. **No detecta la duda como tal.** «¿Tiene diabetes? No sé» deja de negar,
 *    pero nadie avisa de que quedó una pregunta abierta. Si la nota afirma la
 *    diabetes a partir de ese «no sé», este motor no lo ve. Hace falta un canal
 *    de «declarado incierto» que hoy no existe.
 * 2. **El vocabulario es vocabulario.** `CRONICAS` no es criterio clínico: lo
 *    que no está en la lista no se vigila. Fibrilación auricular, cirrosis o
 *    lupus no aparecen y por tanto no se contrastan.
 * 3. **Enumeraciones largas con marca de frase.** «Niega diabetes,
 *    hipertensión, dislipidemia, cardiopatía y asma» sigue funcionando porque
 *    `niega` gobierna la frase entera, pero eso significa que una marca de frase
 *    lejana también puede tapar una afirmación real dentro de la misma frase.
 *    Los separadores de `frases()` no incluyen el punto y coma.
 * 4. **Nada de esto decide clínica.** El motor sólo afirma que dictado y nota se
 *    contradicen. Un paciente puede negar una diabetes que sí tiene documentada;
 *    cuál de las dos vale lo decide el médico.
 * 5. **No mide el reconocedor.** Si el ASR no oyó el «no», aquí no llega nada
 *    que reparar: eso es sesgo de vocabulario, otra capa.
 */
import { describe, it, expect } from 'vitest'
import {
  condicionesNegadas,
  contradicciones,
  corregirCertezaPorNegacion,
} from '@/lib/expediente/negaciones'

const negadas = (t: string) => condicionesNegadas(t).map(x => x.condicion)

describe('C3 — las formas en que un paciente mexicano dice que no', () => {
  const casos: [string, string][] = [
    ['¿Padece diabetes? Pues no.', 'diabetes'],
    ['¿Tiene usted hipertensión? Fíjese que no.', 'hipertensión arterial'],
    ['¿Diabetes? Pues fíjese que no, doctor.', 'diabetes'],
    ['¿Es asmático? Para nada.', 'asma'],
    ['¿Ha tenido cáncer? Qué va.', 'cáncer'],
    ['¿Tiene VIH? Nel.', 'VIH'],
    ['¿Epilepsia o convulsiones? Nada de eso.', 'epilepsia'],
    ['¿Le han encontrado EPOC? Jamás.', 'EPOC'],
  ]
  for (const [dictado, esperada] of casos) {
    it(`«${dictado}» → niega ${esperada}`, () => {
      expect(negadas(dictado)).toContain(esperada)
    })
  }

  it('«tampoco» niega la pregunta que le toca, no la anterior', () => {
    // Encadenar preguntas es lo normal; la respuesta corta cuelga de la última.
    expect(negadas('¿Toma algo? No. ¿Presión alta? Tampoco.')).toEqual([
      'hipertensión arterial',
    ])
  })

  it('la muletilla no cambia la respuesta', () => {
    expect(negadas('¿Tiene asma? Mmm, no.')).toContain('asma')
    expect(negadas('¿Tiene asma? Ay no, nunca.')).toContain('asma')
  })
})

describe('C2 — la negación pegada al término', () => {
  it('«no es diabético» es una negación, aunque no diga «no tiene»', () => {
    expect(negadas('No es diabético.')).toContain('diabetes')
  })

  it('la niega a lo largo de la enumeración que ella misma gobierna', () => {
    expect(negadas('No es diabético ni hipertenso.')).toEqual([
      'diabetes',
      'hipertensión arterial',
    ])
  })

  it('«nunca ha tenido asma»', () => {
    expect(negadas('Nunca ha tenido asma.')).toContain('asma')
  })

  it('«negó» con acento cuenta igual que «niega»', () => {
    // El reconocedor acentúa como quiere; «ó» no es «o» para un regex.
    expect(negadas('Negó diabetes e hipertensión.')).toContain('diabetes')
  })

  it('«no cuenta con antecedente de…»', () => {
    expect(negadas('No cuenta con antecedente de hipertensión.')).toContain(
      'hipertensión arterial',
    )
  })

  it('un «no es» que habla de OTRA cosa no borra el antecedente real', () => {
    /**
     * El caso caro y la razón de la adyacencia: aquí el «no es» habla del
     * tabaco. Leerlo como negación de la diabetes borraría un antecedente que
     * el paciente sí tiene, y con la lista de crónicas se arrastraría solo.
     */
    expect(negadas('No es fumador, tiene diabetes de diez años.')).toEqual([])
  })
})

describe('«NO SÉ» NO ES «NO» — ausencia de dato no es dato de ausencia', () => {
  const dudas = [
    '¿Tiene diabetes? No sé.',
    '¿Tiene diabetes? No me acuerdo.',
    '¿Tiene diabetes? No estoy seguro.',
    '¿Tiene diabetes? No recuerdo, doctor.',
    '¿Padece diabetes? Pues no sé, nunca me han checado.',
    '¿Tiene diabetes? Quién sabe.',
  ]
  for (const d of dudas) {
    it(`«${d}» NO cuenta como negación`, () => {
      expect(negadas(d)).toEqual([])
    })
  }

  it('y por tanto el extractor NO baja la condición a descartado', () => {
    /**
     * Ésta es la mitad que escribe. Con el defecto vivo, un «no sé» del
     * paciente bajaba a `descartado` una condición que el extractor había
     * marcado — el expediente afirmaba lo que nadie descartó.
     */
    const entrada = [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }]
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      entrada,
      condicionesNegadas('¿Tiene diabetes? No sé.'),
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('pero una negativa de verdad SÍ la baja', () => {
    // La prueba al revés de la anterior: si nada bajara nunca, no protegería nada.
    const entrada = [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }]
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      entrada,
      condicionesNegadas('¿Tiene diabetes? Pues no.'),
    )
    expect(conditions[0].certeza).toBe('descartado')
    expect(corregidas).toHaveLength(1)
  })
})

describe('la contradicción con la nota, con el vocabulario nuevo', () => {
  it('«pues no» en el dictado + diabetes afirmada en la nota = contradicción', () => {
    const c = contradicciones(
      condicionesNegadas('¿Padece diabetes? Pues no.'),
      'Paciente con Diabetes mellitus tipo 2 en tratamiento.',
    )
    expect(c).toHaveLength(1)
    expect(c[0].condicion).toBe('diabetes')
  })

  it('si la nota dice «no es diabético» no hay nada que contradecir', () => {
    // Antes se avisaba igual: la nota decía lo correcto y el aviso sobraba.
    expect(
      contradicciones(
        condicionesNegadas('¿Padece diabetes? Pues no.'),
        'Paciente sano, no es diabético.',
      ),
    ).toEqual([])
  })

  it('el escudo doble sigue valiendo mirando TODAS las apariciones', () => {
    /**
     * La costura entre este arreglo y REG-192 de `main`: `contradicciones` ya no
     * para en la primera mención, y el escudo ya no es un solo regex. Si alguien
     * devolviera `ESCUDO_DE_LA_NEGACION` a `NIEGA_EN_LINEA` a secas, la defensa
     * de adyacencia desaparecería de aquí en silencio y sólo quedaría en
     * `condicionesNegadas`.
     *
     * Arriba la nota está bien escrita; abajo está el defecto, y es la de abajo
     * la que cambia la conducta de hoy.
     */
    /**
     * Las dos menciones van MUY separadas a propósito: la cita que se le enseña
     * al médico es de 100 caracteres alrededor del hallazgo, y con las dos
     * pegadas una cita cualquiera contendría las dos palabras — la prueba
     * pasaría sin distinguir nada. Ya ocurrió al escribirla.
     */
    const nota =
      'Antecedentes personales patológicos: no es diabético, no fuma, sin cirugías previas. ' +
      'Refiere buen apego a medidas higiénico-dietéticas y actividad física regular. ' +
      'Exploración física sin datos de descompensación aguda al momento de la valoración. ' +
      'Impresión diagnóstica: diabetes mellitus tipo 2 de reciente diagnóstico.'
    const c = contradicciones(condicionesNegadas('¿Padece diabetes? Pues no.'), nota)
    expect(c).toHaveLength(1)
    expect(c[0].enLaNota).toContain('Impresión')
    expect(c[0].enLaNota).not.toContain('Antecedentes')
  })

  it('si TODAS las apariciones vienen escudadas —por una marca o por la otra— no avisa', () => {
    /**
     * Igual de separadas: si «niega» quedara a menos de 60 caracteres de la
     * segunda mención, la escudaría ella y esta prueba no diría nada sobre la
     * marca de adyacencia.
     */
    const nota =
      'Interrogatorio por aparatos y sistemas: niega diabetes. ' +
      'Refiere únicamente cefalea ocasional de predominio vespertino, sin otros síntomas. ' +
      'Exploración física: no es diabético conocido ni tiene datos de neuropatía.'
    expect(
      contradicciones(condicionesNegadas('¿Padece diabetes? Pues no.'), nota),
    ).toEqual([])
  })

  it('un «no sé» no genera contradicción con la nota que lo afirma', () => {
    /**
     * No es que la nota tenga razón: es que el dictado no negó nada, así que
     * este motor no tiene nada que decir. Queda declarado en «qué NO cubre».
     */
    expect(
      contradicciones(
        condicionesNegadas('¿Padece diabetes? No sé.'),
        'Paciente con Diabetes mellitus tipo 2.',
      ),
    ).toEqual([])
  })
})

describe('lo que ya estaba sigue estando', () => {
  it('el caso original del Dr. (3-ago) sigue detectándose', () => {
    expect(
      negadas('¿Enfermedades crónicas como diabetes o presión alta? No.'),
    ).toEqual(['diabetes', 'hipertensión arterial'])
  })

  it('el silencio sigue sin ser una negación', () => {
    expect(
      negadas(
        '¿Enfermedades crónicas como diabetes o presión alta? Bueno, doctor, mi mamá sí tenía.',
      ),
    ).toEqual([])
  })

  it('«nada más» es «sólo», no una negación', () => {
    expect(negadas('¿Toma algo para la diabetes? Nada más metformina.')).toEqual([])
  })

  it('«qué va a…» es futuro, no respuesta', () => {
    expect(negadas('¿Qué va a pasar con la diabetes si no me cuido?')).toEqual([])
  })

  it('una enfermedad afirmada no entra en la lista de negadas', () => {
    expect(negadas('¿Padece diabetes? Sí, desde hace diez años.')).toEqual([])
  })
})
