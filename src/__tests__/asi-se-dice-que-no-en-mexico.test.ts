/**
 * GOLDEN — el motor de negaciones leía la frase como un saco de palabras.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `negaciones.ts` nació el 3-ago-2026 (REG del «No.» que salió como «Paciente
 * con Hipertensión arterial, Diabetes mellitus tipo 2», ver
 * `negacion-diagnostico-inventado.test.ts`). Reconocía el caso exacto que el Dr.
 * había visto. Fuera de ese caso exacto, fallaba por los dos lados a la vez.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de nueve dimensiones del 6-ago-2026, hallazgos C2/C3 («faltan
 * negadores del habla real»). El hallazgo se reprodujo con el motor —no con la
 * lectura del código— pasándole diecisiete respuestas negativas tal y como se
 * dicen en un consultorio mexicano: **once no se veían**. Y al buscar el resto
 * del defecto aparecieron cuatro errores más, todos del mismo tipo.
 *
 * ── LA CAUSA RAÍZ, QUE ES UNA SOLA ───────────────────────────────────────────
 *
 * El motor no miraba **dónde** estaban las cosas. `NIEGA_EN_LINEA.test(frase)`
 * preguntaba si había un negador *en algún sitio* de la frase, `indexOf`
 * preguntaba si el término estaba *en algún sitio* del texto, y `NEGATIVAS`
 * exigía que el «no» fuera la primera palabra de la respuesta. Cinco síntomas:
 *
 * | # | Entrada | Antes | Por qué duele |
 * |---|---|---|---|
 * | 1 | «¿Padece diabetes? **Pues** no» | no se ve | el antecedente negado entra en la nota |
 * | 2 | «¿Tiene diabetes? **No sé**» | se da por negada | ausencia de dato tratada como dato de ausencia |
 * | 3 | «Refiere diabetes de 10 años; **niega asma**» | niega **las dos** | borra en silencio una diabetes real |
 * | 4 | «se envía **pl·asma** fresco» | contradicción de asma | aviso falso donde se necesita atención |
 * | 5 | «Niega asma… Dx: **Asma** persistente» | ningún aviso | la nota se contradice y nadie lo dice |
 *
 * ── QUÉ LO HACE SEGURO ───────────────────────────────────────────────────────
 *
 * El negador tiene que ir **delante** del término y **en su cláusula** (la coma
 * no corta: es el separador de las enumeraciones negadas; el punto y coma sí).
 * El término tiene que ser una **palabra**, no una subcadena. Y «no sé» se mira
 * antes que «no», porque las dos empiezan igual y sólo una es una negación.
 *
 * Los dos sentidos importan y no son el mismo error: **no ver** una negación
 * mete un antecedente crónico falso que se arrastra a todas las notas
 * siguientes; **ver una de más** reclasifica a *descartado* un diagnóstico que
 * el paciente sí dictó, y eso el médico no lo puede revisar porque no aparece.
 * Por eso este golden vigila los dos, y el segundo bloque es el que más pesa.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * · **No cubre la negación con matiz**: «creo que no», «casi nunca», «hace mucho
 *   que no». Se dejan sin detectar a propósito — son ambiguas, y este motor
 *   alimenta un reclasificador que marca *descartado*. Señalar de menos.
 * · **No cubre quién habla.** Si el médico dicta «no» a otra cosa mientras se
 *   nombra una crónica, el motor no distingue turnos: eso es diarización.
 * · **No cubre las crónicas que no están en `CRONICAS`.** La lista es
 *   vocabulario, no criterio: lo que falta no se vigila, y no por eso se da por
 *   bueno.
 * · **No decide quién tiene razón.** Sigue siendo el médico: ver
 *   `POR_QUE_NO_SE_CORRIGE_SOLO`.
 */
import { describe, it, expect } from 'vitest'
import {
  condicionesNegadas, contradicciones, cronicasEn, corregirCertezaPorNegacion,
} from '@/lib/expediente/negaciones'

const negadas = (t: string) => condicionesNegadas(t).map(x => x.condicion)

/**
 * Cómo se contesta «no» de verdad en la consulta.
 *
 * Ninguna es inventada por gusto: son las formas del español de México que la
 * medición del 6-ago encontró en el habla de consulta —muletilla delante del
 * «no», o negación sin «no» ninguno.
 */
describe('la negación se dice de muchas formas y todas cuentan', () => {
  const CASOS: [string, string][] = [
    ['¿Padece diabetes? Pues no.', 'diabetes'],
    ['¿Padece diabetes? Pos no.', 'diabetes'],
    ['¿Tiene diabetes? Fíjese que no.', 'diabetes'],
    ['¿Diabetes? Pues fíjese que no, doctor.', 'diabetes'],
    ['¿Padece diabetes? Nombre, no.', 'diabetes'],
    ['¿Tiene diabetes? Mmm, no.', 'diabetes'],
    ['¿Tiene presión alta? Este… no.', 'hipertensión arterial'],
    ['¿Tiene diabetes? Bueno, no.', 'diabetes'],
    ['¿Es diabético? Para nada.', 'diabetes'],
    ['¿Padece diabetes? Qué va.', 'diabetes'],
    ['¿Tiene asma? Nunca.', 'asma'],
    ['¿Tiene asma? Jamás.', 'asma'],
    ['¿Diabetes? Ninguna.', 'diabetes'],
    ['¿Tiene diabetes? Nada de eso.', 'diabetes'],
    ['¿Tiene diabetes? No, gracias a Dios.', 'diabetes'],
    ['¿Tiene diabetes? Que yo sepa no.', 'diabetes'],
  ]

  it.each(CASOS)('%s → %s', (dictado, condicion) => {
    expect(negadas(dictado)).toContain(condicion)
  })

  it('el «No.» pelado del caso original sigue viéndose', () => {
    expect(negadas('¿Enfermedades crónicas como diabetes o presión alta? No.'))
      .toEqual(expect.arrayContaining(['diabetes', 'hipertensión arterial']))
  })
})

describe('la negación en línea, dicha como la escribe un internista', () => {
  it.each([
    ['El paciente no padece diabetes.', 'diabetes'],
    ['El paciente no es diabético.', 'diabetes'],
    ['No cuenta con antecedente de diabetes.', 'diabetes'],
    ['Nunca ha tenido diabetes.', 'diabetes'],
    ['Nunca ha padecido asma.', 'asma'],
    ['Sin antecedente de cáncer.', 'cáncer'],
  ])('%s → %s', (texto, condicion) => {
    expect(negadas(texto)).toContain(condicion)
  })
})

/**
 * El bloque que más pesa.
 *
 * Una negación de más no se queda en un aviso que sobra: `corregirCertezaPorNegacion`
 * marca *descartado* la condición extraída, y a partir de ahí el diagnóstico
 * real desaparece de la pantalla. El médico puede corregir lo que ve; no puede
 * corregir lo que el sistema borró.
 */
describe('lo que NO es una negación no se cuenta como tal', () => {
  it('«no sé» es ignorancia, no negación — ausencia de dato no es dato de ausencia', () => {
    expect(negadas('¿Tiene diabetes? No sé.')).toEqual([])
    expect(negadas('¿Tiene diabetes? No lo sé.')).toEqual([])
    expect(negadas('¿Tiene diabetes? No me acuerdo.')).toEqual([])
    expect(negadas('¿Tiene diabetes? No recuerdo, doctor.')).toEqual([])
    expect(negadas('¿Tiene diabetes? No estoy segura.')).toEqual([])
    expect(negadas('¿Tiene diabetes? No sabría decirle.')).toEqual([])
  })

  it('pero «No, no sé si me hicieron estudios» empieza por un no que sí niega', () => {
    expect(negadas('¿Tiene diabetes? No, no sé si me hicieron estudios.')).toContain('diabetes')
  })

  it('un negador NO alcanza a lo que está delante de él', () => {
    // El caso caro: la diabetes la dictó el paciente y se marcaba como negada.
    expect(negadas('Refiere diabetes de 10 años; niega asma.')).toEqual(['asma'])
    expect(negadas('Tiene diabetes, no tiene hipertensión.')).toEqual(['hipertensión arterial'])
  })

  it('ni la negación de una cláusula pasa a la siguiente', () => {
    expect(negadas('Niega asma; refiere diabetes de 10 años.')).toEqual(['asma'])
  })

  it('pero sí alcanza a la enumeración que va detrás, separada por comas', () => {
    expect(negadas('No tiene diabetes, hipertensión ni asma.'))
      .toEqual(expect.arrayContaining(['diabetes', 'hipertensión arterial', 'asma']))
  })

  it('«no es» sólo niega pegado al término, no a distancia', () => {
    expect(negadas('No es candidato a metformina por su diabetes.')).toEqual([])
  })

  it('una subcadena no es una palabra: plasma no es asma', () => {
    expect(cronicasEn('Se toma muestra de plasma para química sanguínea.')).toEqual([])
    expect(cronicasEn('El paciente refiere un miasma en la casa.')).toEqual([])
  })

  it('pero el plural sí cuenta', () => {
    expect(cronicasEn('control de pacientes diabéticos')).toContain('diabetes')
  })
})

describe('la contradicción se busca en TODA la nota, no en la primera mención', () => {
  const negada = [{ condicion: 'asma', cita: '¿asma? No.' }]

  it('la nota que se niega arriba y se afirma abajo levanta el aviso', () => {
    const nota = 'Antecedentes: niega asma en la infancia.\nDiagnósticos: 1. Asma persistente moderada.'
    const c = contradicciones(negada, nota)
    expect(c).toHaveLength(1)
    expect(c[0].enLaNota).toContain('Asma persistente')
  })

  it('la nota que sólo la niega no levanta nada', () => {
    expect(contradicciones(negada, 'Antecedentes: niega asma. Resto sin datos.')).toEqual([])
  })

  it('una subcadena en la nota no levanta un aviso falso', () => {
    expect(contradicciones(negada, 'Se envía plasma fresco congelado.')).toEqual([])
  })
})

describe('lo que llega al panel de entidades', () => {
  it('lo negado viaja como descartado y se declara la corrección', () => {
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }],
      condicionesNegadas('¿Padece diabetes? Pues no.'),
    )
    expect(conditions[0].certeza).toBe('descartado')
    expect(corregidas).toHaveLength(1)
  })

  it('y una diabetes dictada NO se descarta porque en la frase se niegue otra cosa', () => {
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'Diabetes mellitus tipo 2', certeza: 'confirmado' }],
      condicionesNegadas('Refiere diabetes de 10 años; niega asma.'),
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })
})
