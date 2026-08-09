/**
 * EL CORPUS ORO DEL MOTOR DE TEMPORALIDAD — REG-207 (EVAL-002).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El motor de `temporalidad.ts` avisa cuando el dictado sitúa un padecimiento en
 * el pasado y la nota lo afirma como actual. Se construyó entre la v1027 y la
 * v1030 y **no tenía corpus**: sus únicos casos eran los que escribió quien lo
 * escribió, sacados de las mismas expresiones regulares que se estaban probando.
 * Pasaban por construcción.
 *
 * Medido contra 57 frases de consulta mexicana escritas a mano y etiquetadas
 * antes de volver a mirar el código, el motor fallaba **15 veces**:
 *
 * · 12 falsos negativos — pasado que no veía.
 * · 3 falsos positivos — presente que marcaba como pasado.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Escribiendo el corpus de EVAL-002 y corriéndolo contra el motor real antes de
 * tocar una línea. Ninguno de los quince rompía una prueba: la suite estaba en
 * verde con los quince dentro.
 *
 * ── LA CAUSA RAÍZ, QUE SON TRES ──────────────────────────────────────────────
 *
 * 1. **`meses?` nunca casó «mes».** Es «mese» con una ese opcional, escrito por
 *    analogía con «años». «Hace un mes tuvo neumonía» —de las formas más
 *    comunes de fechar algo en una consulta— era invisible.
 *
 * 2. **Faltaban familias enteras de pasado**: la pasiva («fue operado»), el
 *    infinitivo compuesto («refiere haber tenido»), «el año pasado», «a los
 *    quince años» y «de la infancia».
 *
 * 3. **La marca de tiempo mandaba sobre el verbo de estado.** «Hace tres días
 *    inició con fiebre y tiene neumonía» se leía como pasado. Esa frase es el
 *    PADECIMIENTO ACTUAL: el motivo de consulta siempre se dicta con cuánto
 *    lleva, porque es lo primero que se pregunta.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Los dos lados hacen daño, y no el mismo:
 *
 * · El falso negativo deja pasar el defecto original — una neumonía de hace tres
 *   años escrita como diagnóstico actual se queda en el expediente, se copia a la
 *   nota siguiente y cambia lo que otro médico lee dentro de seis meses.
 * · El falso positivo es peor de lo que parece: hace saltar el aviso en la frase
 *   MÁS frecuente de toda la consulta. Un aviso que salta donde no debe se acaba
 *   ignorando, y con él se ignoran los que sí importan. Es la misma trampa que el
 *   módulo ya tenía escrita para «desde hace», con otra forma.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El orden de decisión, y sólo ése: presente explícito → verbo en pasado → marca
 * de tiempo, vetada por un verbo de estado en presente. El verbo en pasado NO se
 * veta, para que «tuvo neumonía hace tres años y tiene diabetes» siga cazándose.
 *
 * ── COMPROBADO QUE PUEDE PONERSE ROJO ────────────────────────────────────────
 *
 * Revertidas las tres causas por separado sobre `temporalidad.ts`: con `meses?`
 * caen los casos de «mes»; sin las familias nuevas caen 11 casos de pasado; sin
 * `PRESENTE_DE_ESTADO` caen los 3 de padecimiento actual.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · Es corpus de TEXTO. No mide lo que el reconocedor oyó mal: eso es EVAL-003.
 * · Es de frase suelta. La oración con dos padecimientos en tiempos distintos
 *   queda fuera — el motor trabaja por oración y resolverla exige decidir por
 *   padecimiento, que es otro motor.
 * · No mide el vocabulario: que falte un padecimiento es un hueco declarado en el
 *   módulo, no un fallo de temporalidad.
 * · No dice que el motor esté completo. Dice qué mide hoy y cuánto acierta ahí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  esFrasePasada,
  mencionesEnPasado,
  desajustesTemporales,
} from '@/lib/expediente/temporalidad'
import {
  CORPUS_PASADO,
  CORPUS_PRESENTE,
  TAMANO_ESPERADO,
} from './fixtures/corpus-temporalidad'

const etiqueta = (c: { familia: string; frase: string }) => `${c.familia} — ${c.frase}`

describe('EL CORPUS ESTÁ ENTERO', () => {
  /**
   * Un corpus del que desaparece la mitad sigue pasando en verde y deja de
   * medir. Es el mismo fallo que el trinquete de voz que no encuentra sus datos.
   */
  it('tiene los casos que dice tener', () => {
    expect({
      pasado: CORPUS_PASADO.length,
      presente: CORPUS_PRESENTE.length,
    }).toEqual(TAMANO_ESPERADO)
  })

  it('y es sintético: ni un nombre, ni una fecha, ni un identificador', () => {
    const texto = [...CORPUS_PASADO, ...CORPUS_PRESENTE].map(c => c.frase).join(' ')
    // Sin fechas completas ni identificadores; los años sueltos («en 2019») son
    // parte de la gramática que se mide y no identifican a nadie.
    expect(texto).not.toMatch(/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/)
    expect(texto).not.toMatch(/\b(?:pac|paciente)_[a-z0-9]+/i)
  })
})

describe('EL MOTOR NO FALLA NI UNA VEZ EN EL CORPUS', () => {
  it('reconoce las 34 formas de decir el pasado', () => {
    expect(CORPUS_PASADO.filter(c => !esFrasePasada(c.frase)).map(etiqueta)).toEqual([])
  })

  /**
   * La mitad que de verdad importa: el motor sólo puede señalar de menos, nunca
   * de más, y aquí es donde se comprueba que cumple su propia regla.
   */
  it('y no marca ni una de las 23 que están en presente', () => {
    expect(CORPUS_PRESENTE.filter(c => esFrasePasada(c.frase)).map(etiqueta)).toEqual([])
  })
})

describe('LOS TRES DEFECTOS, UNO POR UNO', () => {
  /**
   * `meses?` es «mese» con una ese opcional. Casaba «meses» y «mese», jamás
   * «mes». Un mes entero de historia clínica invisible, sin romper una prueba.
   */
  it('«mes» en singular se ve — no sólo «meses»', () => {
    expect(esFrasePasada('Hace un mes tuvo cistitis.')).toBe(true)
    expect(esFrasePasada('Pancreatitis hace un mes.')).toBe(true)
    expect(esFrasePasada('Hace tres meses tuvo neumonía.')).toBe(true)
  })

  it('la pasiva y el infinitivo compuesto son pasado', () => {
    for (const f of [
      'Fue operado de apendicectomía a los quince años.',
      'Fue hospitalizada por COVID en 2021.',
      'Refiere haber tenido tuberculosis hace diez años.',
      'De la infancia recuerda haber padecido hepatitis.',
    ]) {
      expect(esFrasePasada(f), f).toBe(true)
    }
  })

  it('«el año pasado», «a los N años» y «de la infancia» también', () => {
    for (const f of [
      'Le dio COVID el año pasado.',
      'Cistitis la semana pasada, ya tratada.',
      'Apendicectomía a los veinte años.',
      'Fractura de tobillo a los 12 años.',
      'Hepatitis de la infancia.',
    ]) {
      expect(esFrasePasada(f), f).toBe(true)
    }
  })

  /**
   * El falso positivo. «Hace tres días» es la DURACIÓN de lo de ahora, no la
   * fecha de lo de antes — igual que «desde hace», que ya estaba contemplado.
   */
  it('el padecimiento actual con su fecha de inicio NO es pasado', () => {
    for (const f of [
      'Hace tres días inició con fiebre y tiene neumonía.',
      'Hace cinco días presenta disuria y tiene cistitis.',
      'Hace dos semanas comenzó la tos y tiene bronconeumonía.',
      'Hace un mes tiene hipertensión mal controlada.',
    ]) {
      expect(esFrasePasada(f), f).toBe(false)
    }
  })
})

describe('EL VETO DEL VERBO DE ESTADO NO SE COME EL TITULAR', () => {
  /**
   * Ésta es la prueba al revés del arreglo anterior: si el verbo de estado
   * venciera al pretérito, la frase con la que se bautizó el motor dejaría de
   * cazarse. El veto es sólo contra la marca de tiempo sola.
   */
  it('un verbo en pasado manda aunque la frase traiga «tiene» después', () => {
    expect(esFrasePasada('Tuvo neumonía hace tres años y tiene diabetes.')).toBe(true)
    expect(esFrasePasada('Fue operado de la vesícula y tiene dolor abdominal.')).toBe(true)
  })

  /**
   * «Refiere» es un verbo de decir, no de estado: lo que hace el paciente ahora,
   * no lo que le pasa. Si contara como presente, apagaría el interrogatorio
   * entero — que es justo donde se cuenta el pasado.
   */
  it('«refiere» no cuenta como presente', () => {
    expect(esFrasePasada('Refiere tuberculosis hace diez años.')).toBe(true)
  })

  it('y el presente explícito sigue mandando sobre todo', () => {
    expect(esFrasePasada('Desde hace tres años tiene diabetes.')).toBe(false)
    expect(esFrasePasada('Le operaron hace dos años pero sigue con dolor.')).toBe(false)
  })
})

describe('DE PUNTA A PUNTA: EL AVISO LLEGA Y NO LLEGA CUANDO NO DEBE', () => {
  it('«hace un mes tuvo neumonía» + nota que la afirma → avisa', () => {
    const d = desajustesTemporales(
      mencionesEnPasado('Hace un mes tuvo neumonía y se recuperó bien.'),
      'Paciente con neumonía adquirida en la comunidad.',
    )
    expect(d).toHaveLength(1)
    expect(d[0].condicion).toBe('neumonía')
  })

  it('pero el padecimiento actual no genera ni un aviso', () => {
    const d = desajustesTemporales(
      mencionesEnPasado('Hace tres días inició con fiebre y tiene neumonía.'),
      'Paciente con neumonía adquirida en la comunidad.',
    )
    expect(d).toEqual([])
  })

  it('y si la nota ya lo escribió como antecedente, tampoco', () => {
    const d = desajustesTemporales(
      mencionesEnPasado('Fue operado de apendicectomía a los quince años.'),
      'Antecedente de cirugía abdominal en la adolescencia.',
    )
    expect(d).toEqual([])
  })
})

describe('EL MOTOR DECLARA LO QUE NO CUBRE', () => {
  /**
   * El módulo tiene escrito que sólo puede señalar de menos. Que esa frase siga
   * ahí es parte del contrato: si alguien la borra, el motor deja de ser honesto
   * sobre sus huecos aunque siga funcionando igual.
   */
  it('sigue escrito que un hueco de vocabulario no es un caso dado por bueno', () => {
    const fuente = readFileSync(
      join(process.cwd(), 'src/lib/expediente/temporalidad.ts'),
      'utf8',
    )
    expect(fuente).toContain('señalar de menos, nunca de más')
    expect(fuente).toContain('no que se dé por')
  })
})
