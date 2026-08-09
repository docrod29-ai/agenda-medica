/**
 * CASO ORO — REG-210: EL INTERROGATORIO EN PASADO NO ES UN ANTECEDENTE.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `mencionesEnPasado` leía la transcripción frase a frase sin mirar si la frase
 * era una **pregunta** ni si venía **negada**. El interrogatorio dirigido se
 * dicta nombrando la enfermedad en la pregunta, así que entraba entero:
 *
 *     dictado:  «¿Tuvo tuberculosis?  No.»
 *     motor:    mención pasada → tuberculosis, cita: «¿Tuvo tuberculosis?»
 *
 * Y lo mismo con la negación en línea en pretérito: «No tuvo tuberculosis»
 * devolvía tuberculosis, porque `PASADO` cazaba «tuvo» y nadie miraba el «no»
 * de delante — `NIEGA_EN_LINEA` sólo conocía el presente («no tiene», «no
 * padece»).
 *
 * En el otro sentido faltaba el caso legítimo: «¿Ha tenido neumonía alguna vez?
 * Sí, hace tres años» devolvía **nada**. La pregunta dice qué y no dice cuándo;
 * la respuesta dice cuándo y no dice qué. Por separado ninguna es una mención.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Iteración del Master Loop V7 sobre el ítem EVAL-002 del backlog («el motor de
 * temporalidad no tiene corpus: sus casos son los que yo escribí»). Al escribir
 * las frases del interrogatorio dirigido —las que el Dr. dicta en cada consulta
 * y que ningún caso del motor tocaba— salieron las tres en la primera corrida,
 * con el motor real.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El encabezado de `temporalidad.ts` dice que este motor viene a evitar el
 * defecto que costó tres versiones reparar en `negaciones.ts` —«el
 * interrogatorio nombraba la enfermedad en la PREGUNTA y el extractor la
 * cosechaba»— y lo traía dentro: reutilizó el **vocabulario** de aquel módulo,
 * pero no su **emparejado de pregunta y respuesta**.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Porque el aviso que sale de aquí es «esto se dijo en pasado», que es la frase
 * con la que uno mueve una condición a antecedentes. Una negación convertida en
 * antecedente es **historia clínica fabricada**: un «nunca tuve tuberculosis»
 * acaba escrito como tuberculosis pasada, se arrastra a las notas siguientes y
 * cambia cómo otro médico lee un PPD dentro de seis meses.
 *
 * Y por el lado del falso positivo: el mismo dictado producía dos avisos del
 * mismo hecho con explicaciones que se contradicen —uno de negación y otro de
 * temporalidad—, que es la manera más rápida de que se dejen de leer los dos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Lo negado no es un antecedente. Una pregunta sólo cuenta con su respuesta
 * delante, y sólo si la respuesta es un sí claro: el silencio y la duda no se
 * cuentan como afirmación. El par se juzga entero, y el PRESENTE sigue mandando
 * también dentro del par.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * · No separa voces. Si el dictado no lleva signos de interrogación, la pregunta
 *   no se reconoce como tal y se lee como una frase cualquiera. La diarización
 *   es otro camino y otra defensa.
 * · «Creo que sí», «puede ser» y «no sé» **no** cuentan como afirmación: esos
 *   casos dejan de vigilarse. Es la dirección segura —señalar de menos— pero es
 *   un hueco declarado, no un acierto.
 * · Sigue sin decidir nada clínico: no reclasifica, no borra y no afirma que la
 *   enfermedad esté resuelta.
 * · El vocabulario es el que es. Que falte un padecimiento significa que ese
 *   caso no se vigila, no que se dé por bueno.
 */
import { describe, it, expect } from 'vitest'
import {
  mencionesEnPasado, desajustesTemporales, avisosTemporalesDelExtractor,
} from '@/lib/expediente/temporalidad'
import { condicionesNegadas, niegaEnLinea, respuestaA, esRespuestaAfirmativa } from '@/lib/expediente/negaciones'

describe('la pregunta del interrogatorio no es un antecedente', () => {
  it('«¿Tuvo tuberculosis? No.» no deja ninguna mención pasada', () => {
    expect(mencionesEnPasado('¿Tuvo tuberculosis? No.')).toEqual([])
  })

  it('tampoco cuando la respuesta va pegada en la misma frase', () => {
    expect(mencionesEnPasado('¿Tuvo tuberculosis? No, nunca.')).toEqual([])
  })

  it('una pregunta SIN respuesta no se cuenta: el silencio no es un sí', () => {
    expect(mencionesEnPasado('¿Tuvo tuberculosis?')).toEqual([])
  })

  it('el interrogatorio entero de una consulta no fabrica un solo antecedente', () => {
    const dictado = '¿Ha tenido neumonía alguna vez? No, nunca. '
      + '¿Tuvo tuberculosis? No. '
      + '¿Le operaron de algo? No, de nada.'
    expect(mencionesEnPasado(dictado)).toEqual([])
  })
})

describe('lo negado en línea tampoco', () => {
  it('«No tuvo tuberculosis» es una negación, no un antecedente', () => {
    expect(mencionesEnPasado('No tuvo tuberculosis.')).toEqual([])
  })

  it('«Nunca ha tenido asma» tampoco', () => {
    expect(mencionesEnPasado('Nunca ha tenido asma.')).toEqual([])
  })

  it('el pretérito con acento se lee igual que sin él', () => {
    expect(niegaEnLinea('No padeció tuberculosis')).toBe(true)
    expect(niegaEnLinea('No padecio tuberculosis')).toBe(true)
  })

  it('y ahora el motor de negaciones SÍ la ve — antes se le escapaba', () => {
    const negadas = condicionesNegadas('No tuvo tuberculosis.')
    expect(negadas.map(n => n.condicion)).toEqual(['tuberculosis'])
  })
})

describe('la mitad legítima del interrogatorio sí se cosecha', () => {
  it('«¿Ha tenido neumonía alguna vez? Sí, hace tres años.» es una mención pasada', () => {
    const m = mencionesEnPasado('¿Ha tenido neumonía alguna vez? Sí, hace tres años.')
    expect(m.map(x => x.condicion)).toEqual(['neumonía'])
  })

  it('la cita trae la pregunta Y la respuesta, que es lo que el médico necesita ver', () => {
    const m = mencionesEnPasado('¿Ha tenido neumonía alguna vez? Sí, hace tres años.')
    expect(m[0].cita).toContain('neumonía')
    expect(m[0].cita).toContain('hace tres años')
  })

  it('y llega hasta el aviso contra la nota', () => {
    const d = desajustesTemporales(
      mencionesEnPasado('¿Ha tenido neumonía alguna vez? Sí, hace tres años.'),
      'Paciente con neumonía adquirida en la comunidad.',
    )
    expect(d.map(x => x.condicion)).toEqual(['neumonía'])
  })

  it('el PRESENTE sigue mandando dentro del par', () => {
    // «Desde hace tres años» es la forma normal de contar una crónica activa.
    expect(mencionesEnPasado('¿Tiene diabetes? Sí, desde hace tres años.')).toEqual([])
  })

  it('«creo que sí» no cuenta como afirmación — hueco declarado, no acierto', () => {
    expect(esRespuestaAfirmativa('Creo que sí')).toBe(false)
    expect(mencionesEnPasado('¿Tuvo neumonía? Creo que sí, hace años.')).toEqual([])
  })
})

describe('lo que ya funcionaba no se movió', () => {
  it('la frase declarativa de siempre sigue detectándose', () => {
    expect(mencionesEnPasado('Tuvo neumonía hace tres años.').map(m => m.condicion)).toEqual(['neumonía'])
  })

  it('«desde hace tres años tiene diabetes» sigue sin marcarse', () => {
    expect(mencionesEnPasado('Desde hace tres años tiene diabetes.')).toEqual([])
  })
})

describe('el extractor: la negación ya no vuelve como antecedente', () => {
  /**
   * Éste es el daño concreto. El extractor devuelve `estado: 'activo'` por
   * omisión del esquema; si además le llega un aviso de «se dijo en pasado», lo
   * que el médico ve le pide mover a antecedentes algo que el paciente negó.
   */
  it('no se avisa nada de una tuberculosis que el paciente negó', () => {
    const avisos = avisosTemporalesDelExtractor(
      [{ texto: 'tuberculosis', estado: 'activo' }],
      mencionesEnPasado('¿Tuvo tuberculosis? No.'),
    )
    expect(avisos).toEqual([])
  })

  it('y sí se avisa de la que contestó que sí', () => {
    const avisos = avisosTemporalesDelExtractor(
      [{ texto: 'neumonía', estado: 'activo' }],
      mencionesEnPasado('¿Ha tenido neumonía alguna vez? Sí, hace tres años.'),
    )
    expect(avisos.map(a => a.condicion)).toEqual(['neumonía'])
  })
})

describe('el emparejado de pregunta y respuesta vive en un solo sitio', () => {
  /**
   * Los dos motores tienen que leer el mismo turno. Si uno mirase una frase más
   * allá que el otro, el mismo dictado daría un aviso de negación y otro de
   * temporalidad que se contradicen — que es el defecto de partida.
   */
  it('el resto de la misma frase gana a la frase siguiente', () => {
    expect(respuestaA(['¿Tuvo neumonía? Sí, hace años.', 'No.'], 0)).toBe('Sí, hace años.')
  })

  it('sin resto se toma la frase siguiente', () => {
    expect(respuestaA(['¿Tuvo neumonía?', 'Sí, hace años.'], 0)).toBe('Sí, hace años.')
  })

  it('sin signo de cierre no hay resto — devolvía la pregunta como su propia respuesta', () => {
    expect(respuestaA(['¿Tuvo neumonía', 'No.'], 0)).toBe('No.')
  })

  it('y la última frase del dictado no inventa una respuesta', () => {
    expect(respuestaA(['¿Tuvo neumonía?'], 0)).toBe('')
  })
})
