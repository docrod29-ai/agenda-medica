/**
 * GOLDEN — el paciente no contesta «No.» a secas, y quien no se acuerda no ha
 * negado nada.
 *
 * ── CÓMO SE ENCONTRÓ ─────────────────────────────────────────────────────────
 *
 * Hallazgo C2/C3 de la auditoría de las nueve dimensiones (5-ago-2026),
 * reproducido con el motor real el 7-ago antes de tocar una línea: se le pasaron
 * a `condicionesNegadas` doce respuestas del habla de consulta mexicana y se
 * contaron las que reconocía.
 *
 * De ocho formas negativas reales —«Pues no, doctor», «Fíjese que no», «Gracias
 * a Dios no», «Hasta ahorita no», «Yo no», «Tampoco», «Para nada», «Qué va»—
 * reconoció **cero**. De cuatro respuestas de ignorancia —«No sé», «No me
 * acuerdo», «No estoy seguro», «No sabría decirle»— las contó **las cuatro como
 * negación**.
 *
 * ── LA CAUSA ─────────────────────────────────────────────────────────────────
 *
 *     const NEGATIVAS = /^\s*(?:ah?,?\s*)?(?:no|nop|ninguna|…)\b/i
 *
 * La negación tenía que ser **la primera palabra** de la respuesta. En el habla
 * real va detrás de una muletilla, y las muletillas se acumulan: «Ay pues fíjese
 * que no» lleva tres. Al mismo tiempo, cualquier cosa que empezara por «no»
 * contaba, incluido «no sé».
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Los dos lados hacen daño, y en direcciones opuestas.
 *
 * **La negación perdida** deja pasar el defecto de REG-140 entero: el modelo
 * cosecha «diabetes» de la PREGUNTA, la nota la afirma, y el contraste que
 * debería avisar no tiene nada que contrastar. El paciente dijo que no y se va
 * con una enfermedad crónica en el expediente — que se arrastra a todas las
 * notas siguientes, cambia el riesgo quirúrgico y cambia la elección de fármacos.
 *
 * **La negación inventada** es la regla 4 del charter rota por el propio motor:
 * `corregirCertezaPorNegacion` bajaba a `descartado` una diabetes que el
 * extractor había marcado confirmada, porque el paciente contestó «No sé».
 * Ausencia de dato no es dato de ausencia: quien no se acuerda no ha negado.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * - Las muletillas son una **lista cerrada** y por tanto vocabulario, no
 *   criterio: la que falte no se vigila. Un comodín (`/.*no/`) las cubriría
 *   todas y abriría el fallo caro que aquí se prueba al revés —«Sí, diabetes
 *   desde hace diez años; presión alta no» contando como negación de la
 *   diabetes—, así que la lista se queda corta a propósito.
 * - No cubre la negación repartida entre dos turnos de habla («¿Diabetes? …
 *   Bueno, mi mamá sí, yo no»); eso necesita atribución de hablante, que es otro
 *   motor.
 * - No cubre el orden inverso («Nunca he tenido nada de eso, doctor») cuando la
 *   enfermedad se nombró tres frases antes: la ventana sigue siendo la frase de
 *   la pregunta y la siguiente.
 * - No decide nada clínico. Sigue valiendo lo de REG-140: el motor sólo afirma
 *   que dictado y nota se contradicen; cuál de las dos vale lo decide el médico.
 */
import { describe, it, expect } from 'vitest'
import {
  condicionesNegadas,
  contradicciones,
  corregirCertezaPorNegacion,
  esRespuestaNegativa,
} from '@/lib/expediente/negaciones'

/** Las ocho que el motor perdía, tal como se dictan. */
const NEGATIVAS_DEL_HABLA_REAL: [string, string][] = [
  ['¿Padece diabetes? Pues no, doctor.', 'diabetes'],
  ['¿Tiene diabetes? Fíjese que no.', 'diabetes'],
  ['¿Padece diabetes? Qué va.', 'diabetes'],
  ['¿Tiene diabetes? Gracias a Dios no.', 'diabetes'],
  ['¿Tiene usted asma? Yo no.', 'asma'],
  ['¿Padece hipertensión? Tampoco.', 'hipertensión arterial'],
  ['¿Es diabético? Para nada.', 'diabetes'],
  ['¿Tiene diabetes? Hasta ahorita no.', 'diabetes'],
]

describe('la negación del habla real llega al motor', () => {
  it.each(NEGATIVAS_DEL_HABLA_REAL)('«%s» se cuenta como negación', (dictado, condicion) => {
    expect(condicionesNegadas(dictado).map(n => n.condicion)).toContain(condicion)
  })

  it('las muletillas se acumulan y se quitan todas', () => {
    // «Ay pues fíjese que no» lleva tres delante del «no». Con una sola pasada
    // de limpieza quedaría «pues fíjese que no» y se perdería igual.
    expect(esRespuestaNegativa('Ay pues fíjese que no')).toBe(true)
    expect(esRespuestaNegativa('Bueno pues no')).toBe(true)
  })

  it('la negación perdida era una contradicción que nadie veía', () => {
    // El caso completo de REG-140, con la respuesta que da un paciente de verdad:
    // el término se cosecha de la PREGUNTA y la nota lo afirma.
    const negadas = condicionesNegadas('¿Padece diabetes o presión alta? Pues no, doctor.')
    const choques = contradicciones(negadas, 'Paciente con Diabetes mellitus tipo 2 e Hipertensión arterial.')
    expect(choques.map(c => c.condicion).sort()).toEqual(['diabetes', 'hipertensión arterial'])
  })

  it('lo que ya funcionaba sigue funcionando', () => {
    expect(condicionesNegadas('¿Enfermedades crónicas como diabetes o presión alta? No.').map(n => n.condicion))
      .toEqual(['diabetes', 'hipertensión arterial'])
    expect(condicionesNegadas('No padece diabetes.').map(n => n.condicion)).toEqual(['diabetes'])
    expect(condicionesNegadas('¿Diabetes? No que yo sepa.').map(n => n.condicion)).toEqual(['diabetes'])
  })
})

/** Las cuatro que el motor convertía en un «no» que el paciente nunca dijo. */
const NO_SABE = [
  '¿Tiene diabetes? No sé.',
  '¿Tiene diabetes? No me acuerdo.',
  '¿Tiene diabetes? No estoy seguro.',
  '¿Tiene diabetes? No sabría decirle.',
  '¿Tiene diabetes? Bueno, no sé.',
]

describe('quien no se acuerda no ha negado nada', () => {
  it.each(NO_SABE)('«%s» NO es una negación', dictado => {
    expect(condicionesNegadas(dictado)).toEqual([])
  })

  it('y por eso el extractor ya no descarta un antecedente confirmado', () => {
    // Éste es el daño que se paga fuera de la pantalla: el aviso al médico se
    // puede ignorar, pero la certeza corregida viaja con la entidad.
    const negadas = condicionesNegadas('¿Tiene diabetes? No sé, nunca me han revisado.')
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }],
      negadas,
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('«no se preocupe» no es lo mismo que «no sé»', () => {
    // El punto o la coma después del «sé» es lo que los separa; sin él, la
    // guarda de ignorancia se comería negaciones de verdad.
    expect(esRespuestaNegativa('No se preocupe, no tengo nada')).toBe(true)
  })
})

describe('lo que el ensanche NO puede llegar a hacer', () => {
  it('una frase que AFIRMA una enfermedad y niega otra no niega la primera', () => {
    // El control negativo del comodín: con `/.*no/` esta frase habría contado
    // como negación de la diabetes, porque la frase lleva las dos enfermedades y
    // el motor no sabe a cuál se refiere el «no».
    expect(condicionesNegadas('¿Padece algo? Sí, diabetes desde hace diez años; presión alta no.')).toEqual([])
  })

  it('el silencio sigue sin ser una negación', () => {
    expect(condicionesNegadas('¿Padece diabetes?')).toEqual([])
    expect(esRespuestaNegativa('')).toBe(false)
  })

  it('una respuesta afirmativa no se vuelve negativa por llevar muletilla', () => {
    expect(esRespuestaNegativa('Pues sí, desde hace años')).toBe(false)
    expect(esRespuestaNegativa('Fíjese que sí')).toBe(false)
  })
})
