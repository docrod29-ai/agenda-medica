/**
 * EL VOCABULARIO NO VIVE DENTRO DE OTRA PALABRA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Los dos motores que leen vocabulario clínico —el de negaciones (v985) y el de
 * temporalidad (v1027)— buscaban cada forma con `includes`, que no sabe dónde
 * acaba una palabra. Tres colisiones reales, medidas:
 *
 *     «sida»     (VIH)                vive dentro de  obesidad · necesidad · densidad
 *     «asma»     (asma)               vive dentro de  plasma · plasmaféresis
 *     «cistitis» (infección urinaria) vive dentro de  colecistitis
 *
 * Y una cuarta que la palabra entera NO arregla, porque el término sobra:
 *
 *     «derrame»  (evento vascular cerebral)  →  derrame pleural · pericárdico · articular
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * 8-ago-2026, al construir el corpus sintético del motor de temporalidad
 * (EVAL-002 del backlog). El corpus no era de casos de temporalidad: era una
 * lista de términos que un internista dicta a diario y que **no** son ninguna de
 * las canónicas. Trece de veinte devolvieron una.
 *
 * ── LA CAUSA RAÍZ Y POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────
 *
 * El motor de negaciones no sólo avisa: **reclasifica**. Reproducido con el
 * motor real antes de tocar nada:
 *
 *     dictado: «Paciente con VIH en control con antirretroviral.
 *               Niega necesidad de oxígeno suplementario.»
 *     → condicionesNegadas()          →  [VIH negado]
 *     → corregirCertezaPorNegacion()  →  «VIH en control con TAR»
 *                                        pasa de `confirmado` a `descartado`
 *
 * El paciente negó necesitar oxígeno. El diagnóstico que sostiene el tratamiento
 * entero en la consulta de un infectólogo salía del expediente marcado como
 * descartado, y los antecedentes se arrastran a todas las notas siguientes.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Los dos vocabularios llevan escrito desde el primer día que **sólo pueden
 * señalar de menos, nunca de más**. Un término que falta es un caso que no se
 * vigila; un término que sobra es un diagnóstico que nadie tuvo. `includes`
 * violaba justo la mitad prohibida.
 *
 * El plural se tolera a propósito (`fracturas`, `infartos`, `convulsiones`): las
 * tres colisiones fallan por el PRINCIPIO de la palabra, no por el final.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * · No busca colisiones nuevas: es una lista fija. Cada forma que se añada al
 *   vocabulario puede traer la suya, y sólo la caza quien la escriba.
 * · No arregla las formas que sobran por significado y no por subcadena. De
 *   ésas sólo se retiró «derrame»; puede haber más.
 * · `desajustesTemporales` y `contradicciones` siguen mirando la PRIMERA
 *   aparición del término en la nota. Una nota que escribe «antecedente de
 *   neumonía» arriba y «neumonía adquirida en la comunidad» abajo no avisa.
 *   Confirmado con el motor real el 8-ago-2026 y anotado en el backlog
 *   (TEMP-002): es señalar de menos, que es la dirección tolerada.
 * · No mide la cobertura del motor de temporalidad. EVAL-002 sigue abierto.
 */
import { describe, it, expect } from 'vitest'
import {
  cronicasEn,
  condicionesNegadas,
  corregirCertezaPorNegacion,
  contradicciones,
  indiceDeTermino,
  mencionaTermino,
} from '@/lib/expediente/negaciones'
import {
  padecimientosEn,
  mencionesEnPasado,
  desajustesTemporales,
} from '@/lib/expediente/temporalidad'

describe('las tres colisiones de subcadena que se midieron', () => {
  /**
   * Las tres, en la forma en que aparecieron. Un bucle porque son el MISMO
   * defecto: si se rompe una, se rompieron las tres.
   */
  const COLISIONES: { texto: string; canonicaQueNoDebeSalir: string }[] = [
    { texto: 'Obesidad grado dos.', canonicaQueNoDebeSalir: 'VIH' },
    { texto: 'Sin necesidad de oxígeno suplementario.', canonicaQueNoDebeSalir: 'VIH' },
    { texto: 'Densidad mineral ósea conservada.', canonicaQueNoDebeSalir: 'VIH' },
    { texto: 'Se transfundió plasma fresco congelado.', canonicaQueNoDebeSalir: 'asma' },
    { texto: 'Se programó plasmaféresis.', canonicaQueNoDebeSalir: 'asma' },
  ]

  it('ninguna palabra que sólo CONTIENE una forma nombra su canónica', () => {
    for (const c of COLISIONES) {
      expect(cronicasEn(c.texto)).not.toContain(c.canonicaQueNoDebeSalir)
    }
  })

  it('«colecistitis» no es una infección urinaria', () => {
    expect(padecimientosEn('Colecistitis aguda litiásica.')).not.toContain('infección urinaria')
    // La cirugía sí: una colecistectomía es una cirugía, y eso es correcto.
    expect(padecimientosEn('Le hicieron colecistectomía.')).toContain('cirugía')
  })

  it('«esteatohepatitis» no dispara la hepatitis aguda del vocabulario', () => {
    expect(padecimientosEn('Esteatohepatitis no alcohólica.')).not.toContain('hepatitis')
  })
})

describe('el VIH descartado por negar el oxígeno — el caso que motivó todo', () => {
  const DICTADO = 'Paciente con VIH en control con antirretroviral. '
    + 'Niega necesidad de oxígeno suplementario. '
    + 'Saturación de 96 por ciento al aire ambiente.'

  it('negar la necesidad de oxígeno no niega el VIH', () => {
    expect(condicionesNegadas(DICTADO)).toEqual([])
  })

  it('la condición confirmada NO se reclasifica a descartado', () => {
    const negadas = condicionesNegadas(DICTADO)
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'VIH en control con TAR', certeza: 'confirmado' }],
      negadas,
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('tampoco se avisa de una contradicción con la nota', () => {
    const negadas = condicionesNegadas(DICTADO)
    expect(contradicciones(negadas, 'Diagnóstico: VIH estadio A1, en tratamiento.')).toEqual([])
  })

  it('«no tiene indicación de plasmaféresis» no niega el asma', () => {
    expect(condicionesNegadas('No tiene indicación de plasmaféresis por ahora.')).toEqual([])
  })
})

describe('«derrame» sin apellido ya no nombra un ictus', () => {
  /**
   * Los tres derrames que un internista dicta de verdad. El aviso decía
   * «evento vascular cerebral» en los tres.
   */
  const DERRAMES = ['pleural derecho', 'pericárdico moderado', 'articular de rodilla']

  it('ningún derrame con apellido es un evento vascular cerebral', () => {
    for (const d of DERRAMES) {
      expect(padecimientosEn(`Hace dos meses tuvo derrame ${d}.`))
        .not.toContain('evento vascular cerebral')
    }
  })

  it('el derrame cerebral sí se sigue vigilando', () => {
    expect(padecimientosEn('Hace tres años tuvo un derrame cerebral.'))
      .toContain('evento vascular cerebral')
  })
})

describe('lo que se vigilaba se sigue vigilando', () => {
  it('el titular del motor de temporalidad sigue avisando', () => {
    const pasadas = mencionesEnPasado('El paciente tuvo neumonía hace tres años.')
    expect(pasadas.map(p => p.condicion)).toEqual(['neumonía'])
    expect(desajustesTemporales(pasadas, 'Diagnóstico: Neumonía adquirida en la comunidad.'))
      .toHaveLength(1)
  })

  it('el caso que bautizó el motor de negaciones sigue cazándose', () => {
    const negadas = condicionesNegadas('¿Enfermedades crónicas como diabetes o presión alta? No.')
    expect(negadas.map(n => n.condicion)).toEqual(['diabetes', 'hipertensión arterial'])
  })

  it('el plural no se pierde: el dictado lo dice más en plural que en singular', () => {
    expect(padecimientosEn('Tuvo dos fracturas costales.')).toContain('fractura')
    expect(cronicasEn('Refiere convulsiones desde la infancia.')).toContain('epilepsia')
    expect(cronicasEn('Antecedente de dos infartos.')).toContain('cardiopatía')
  })

  it('el guion no rompe la frontera: covid-19 y sars-cov-2', () => {
    expect(padecimientosEn('Tuvo covid-19 en 2021.')).toContain('COVID-19')
    expect(padecimientosEn('PCR para SARS-CoV-2 positiva.')).toContain('COVID-19')
  })

  it('la puntuación pegada tampoco: «diabetes:», «(asma)», «neumonía.»', () => {
    expect(cronicasEn('Diagnósticos: diabetes:')).toContain('diabetes')
    expect(cronicasEn('Crisis (asma) nocturna')).toContain('asma')
    expect(padecimientosEn('Ingresó por neumonía.')).toContain('neumonía')
  })
})

describe('el buscador de términos, por su cuenta', () => {
  it('devuelve el índice de la palabra entera, no el de la subcadena', () => {
    // «obesidad» ocupa 0..7; la forma «sida» estaba dentro, en el 4.
    expect(indiceDeTermino('obesidad y sida avanzado', 'sida')).toBe(11)
  })

  it('la ventana de los 60 caracteres se lee en el sitio correcto', () => {
    /**
     * Por qué importa el índice y no un booleano: `contradicciones` mira los 60
     * caracteres ANTERIORES para ver si la nota ya trae la negación. Apuntando
     * dentro de «obesidad» se leía una ventana que no existía.
     */
    const negadas = condicionesNegadas('¿Tiene VIH? No.')
    expect(contradicciones(negadas, 'Obesidad grado dos. Sin otros datos.')).toEqual([])
    expect(contradicciones(negadas, 'Diagnóstico: VIH estadio C3.')).toHaveLength(1)
  })

  it('-1 cuando el término no está como palabra', () => {
    expect(indiceDeTermino('colecistitis aguda', 'cistitis')).toBe(-1)
    expect(mencionaTermino('plasma fresco', 'asma')).toBe(false)
    expect(mencionaTermino('crisis de asma', 'asma')).toBe(true)
  })
})
