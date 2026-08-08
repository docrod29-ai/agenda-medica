/**
 * GOLDEN — REG-192: el motor de temporalidad se midió por primera vez y falló
 * nueve de sus sesenta y un casos.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El motor se construyó entre la v1027 y la v1030 y salió sin corpus: sus únicos
 * casos eran los escritos junto al código, o sea los que ya se sabía que
 * pasaban. Con una vara de verdad delante aparecieron cuatro defectos, ninguno
 * de los cuales rompía una prueba:
 *
 * 1. **«En control» y «en tratamiento» anulaban el pretérito.** «Le operaron de
 *    la vesícula en 2018 y quedó EN CONTROL por consulta externa» se leía como
 *    presente. El control era de entonces, igual que la cirugía.
 * 2. **Sólo se miraba la PRIMERA aparición en la nota.** Una nota ordenada
 *    empieza por los antecedentes: «Antecedentes: neumonía en 2019 … Impresión
 *    diagnóstica: neumonía adquirida en la comunidad». El antecedente —bien
 *    escrito— tapaba la afirmación en presente de abajo, que es exactamente lo
 *    que este motor existe para ver.
 * 3. **«Derrame pleural» se etiquetaba como evento vascular cerebral.**
 * 4. **«Le extirparon el apéndice» quedaba sin padecimiento.** El verbo contaba
 *    como pasado desde la v1027 pero no como cirugía, así que la frase se
 *    detectaba y salía sin nada que contrastar.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * EVAL-002 del backlog: «el motor no tiene corpus, sus casos son los que yo
 * escribí». Se escribieron 49 frases y 12 notas sintéticas del habla de la
 * consulta mexicana, se corrieron contra el motor real antes de tocar una línea,
 * y 9 salieron mal. No es una auditoría de lectura: es la salida del motor.
 *
 * ── LA CAUSA RAÍZ, QUE ES UNA SOLA ───────────────────────────────────────────
 *
 * Todo el motor era una carrera de expresiones regulares sin orden declarado:
 * `PRESENTE` ganaba a `PASADO` y ahí acababa la política. Pero «sigue con» y «en
 * control» no dicen lo mismo — la primera afirma que el padecimiento continúa,
 * la segunda sólo describe una situación que también pudo ser de hace ocho años.
 * Y en la nota, `indexOf` devuelve una posición: la primera. Bastaba con que la
 * nota estuviera BIEN escrita una vez para que dejara de mirarse.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El orden es la política y se lee de arriba abajo: la continuidad gana a todo,
 * el pretérito gana al estado, el estado gana a la marca de tiempo suelta. Y en
 * la nota se miran TODAS las apariciones: basta una en presente para avisar, y
 * si todas están encuadradas como antecedente no se avisa nada.
 *
 * ── LO QUE ESTE GOLDEN **NO** CUBRE ──────────────────────────────────────────
 *
 * · **No mide producción.** El corpus es sintético y pequeño. Dice si el motor
 *   determinista sigue en pie, no con qué frecuencia acierta sobre el habla real
 *   del Dr. Ese número necesita transcripciones anotadas por un clínico y lo
 *   produce el dueño (E-1 de la cola de decisiones).
 * · **No mide el vocabulario.** Un padecimiento que no está en la lista no se
 *   vigila — «gastroenteritis», por ejemplo. El corpus lo deja escrito en vez de
 *   fingir que está cubierto.
 * · **La ventana de 60 caracteres sigue siendo ciega en notas cortas.**
 *   «Antecedentes: neumonía en 2019. Dx: neumonía adquirida en la comunidad»
 *   cabe entera en la ventana y el encabezado silencia el diagnóstico de hoy.
 *   Cortar por el punto arreglaría ese caso y rompería «Antecedentes: 1.
 *   neumonía», que es igual de común. Se dejó señalando de menos, a sabiendas.
 * · **No juzga si la enfermedad sigue activa.** Eso es clínico y no es suyo. El
 *   motor mira el encuadre de la frase; quien decide es el médico.
 */
import { describe, it, expect } from 'vitest'
import {
  esFrasePasada, mencionesEnPasado, desajustesTemporales, padecimientosEn,
} from '@/lib/expediente/temporalidad'
import {
  FRASES_ORO_TEMPORAL, NOTAS_ORO_TEMPORAL,
  POR_QUE_SE_MIDEN_LAS_DOS_DIRECCIONES, POR_QUE_NO_ES_UNA_MEDICION_DE_PRODUCCION,
  POR_QUE_HAY_CASOS_FUERA_DE_VOCABULARIO,
} from '@/lib/expediente/corpus-temporalidad'

const detectadas = (frase: string) => mencionesEnPasado(frase).map(m => m.condicion).sort()
const ordenado = (xs: readonly string[]) => [...xs].sort()

describe('EL CORPUS EXISTE Y PUEDE MEDIR ALGO', () => {
  it('tiene las dos direcciones, y ninguna es testimonial', () => {
    /**
     * Un corpus de sólo positivos premia al motor que marca todo — y un motor
     * que marca todo es el que consigue que el médico deje de leer los avisos.
     * Diez de cada lado es el mínimo para que la cifra signifique algo.
     */
    const positivos = FRASES_ORO_TEMPORAL.filter(c => c.esperado.length > 0)
    const negativos = FRASES_ORO_TEMPORAL.filter(c => c.esperado.length === 0)
    expect(positivos.length).toBeGreaterThanOrEqual(20)
    expect(negativos.length).toBeGreaterThanOrEqual(20)
    expect(NOTAS_ORO_TEMPORAL.filter(c => c.esperado.length > 0).length).toBeGreaterThanOrEqual(5)
    expect(NOTAS_ORO_TEMPORAL.filter(c => c.esperado.length === 0).length).toBeGreaterThanOrEqual(5)
  })

  it('cada caso dice QUÉ pone a prueba, y los identificadores no se repiten', () => {
    /** Un caso sin motivo se borra dentro de seis meses por parecer trivial. */
    for (const c of [...FRASES_ORO_TEMPORAL, ...NOTAS_ORO_TEMPORAL]) {
      expect(c.porQue.length, c.id).toBeGreaterThan(40)
    }
    const ids = [...FRASES_ORO_TEMPORAL, ...NOTAS_ORO_TEMPORAL].map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('las cuatro familias están representadas', () => {
    const familias = new Set(FRASES_ORO_TEMPORAL.map(c => c.familia))
    expect([...familias].sort()).toEqual(['fuera-de-vocabulario', 'futuro', 'pasado', 'presente'])
  })

  it('y está escrito por qué se miden las dos direcciones y qué NO mide esto', () => {
    expect(POR_QUE_SE_MIDEN_LAS_DOS_DIRECCIONES).toMatch(/deje de leer los avisos/)
    expect(POR_QUE_NO_ES_UNA_MEDICION_DE_PRODUCCION).toMatch(/inventar una cifra/)
    expect(POR_QUE_HAY_CASOS_FUERA_DE_VOCABULARIO).toMatch(/NO se vigila/)
  })
})

describe('LA MEDICIÓN — el criterio es CERO fallos, no un porcentaje', () => {
  /**
   * Sobre un corpus que controlamos entero no hay ruido del mundo real que
   * justifique un umbral: cada caso está escrito a propósito y cada uno tiene
   * una respuesta correcta. El porcentaje llega el día que haya habla real
   * anotada, y ese número lo produce el dueño.
   */
  it('sensibilidad: todo lo dicho en pasado se detecta, con su padecimiento', () => {
    const fallos = FRASES_ORO_TEMPORAL
      .filter(c => c.esperado.length > 0)
      .filter(c => detectadas(c.frase).join('|') !== ordenado(c.esperado).join('|'))
      .map(c => `${c.id}: esperaba [${c.esperado}] y dio [${detectadas(c.frase)}] — ${c.frase}`)
    expect(fallos).toEqual([])
  })

  it('especificidad: nada de lo dicho en presente, en futuro o fuera del vocabulario se marca', () => {
    const fallos = FRASES_ORO_TEMPORAL
      .filter(c => c.esperado.length === 0)
      .filter(c => detectadas(c.frase).length > 0)
      .map(c => `${c.id}: no debía marcar nada y marcó [${detectadas(c.frase)}] — ${c.frase}`)
    expect(fallos).toEqual([])
  })

  it('de punta a punta: el desajuste entre el dictado y la nota sale donde debe', () => {
    const fallos = NOTAS_ORO_TEMPORAL
      .filter(c => {
        const d = desajustesTemporales(mencionesEnPasado(c.dictado), c.nota).map(x => x.condicion).sort()
        return d.join('|') !== ordenado(c.esperado).join('|')
      })
      .map(c => `${c.id}: esperaba [${c.esperado}] — ${c.porQue}`)
    expect(fallos).toEqual([])
  })
})

describe('LOS CUATRO DEFECTOS DE REG-192, uno por uno', () => {
  /**
   * La medición de arriba dice CUÁNTO. Estos casos dicen QUÉ se rompió, para que
   * el día que uno vuelva no haya que buscarlo en una lista de sesenta.
   */
  it('1 · «en control» y «en tratamiento» ya no anulan un pretérito', () => {
    expect(esFrasePasada('Tuvo neumonía hace tres años y estuvo en tratamiento con levofloxacino once días.')).toBe(true)
    expect(esFrasePasada('Le operaron de la vesícula en 2018 y quedó en control por consulta externa.')).toBe(true)
  })

  it('1-bis · pero siguen mandando cuando nadie los puso en pasado', () => {
    /**
     * La mitad que hay que no romper: si el estado dejara de contar, el motor
     * marcaría «diabetes en control desde 2019» y ahí se acaba la confianza en
     * el aviso. El estado pierde contra el VERBO, no contra la marca de tiempo.
     */
    expect(esFrasePasada('Diabetes en control desde 2019.')).toBe(false)
    expect(esFrasePasada('Está en control en la clínica por su diabetes.')).toBe(false)
    expect(esFrasePasada('Hipotiroidismo en tratamiento desde hace años.')).toBe(false)
  })

  it('2 · la nota se mira ENTERA, no hasta la primera aparición', () => {
    const pasadas = mencionesEnPasado('Tuvo neumonía hace tres años. Hoy viene por tos y fiebre de dos días.')
    const nota = 'Antecedentes personales patológicos: neumonía en 2019.\n\n'
      + 'Impresión diagnóstica: neumonía adquirida en la comunidad.'
    const d = desajustesTemporales(pasadas, nota)
    expect(d).toHaveLength(1)
    expect(d[0].condicion).toBe('neumonía')
    expect(d[0].enLaNota).toContain('adquirida en la comunidad')
  })

  it('2-bis · y si TODAS las apariciones están bien escritas, no avisa', () => {
    /**
     * El contra-caso: mirar todas las apariciones no puede convertirse en avisar
     * por cada una. Las dos van encuadradas como antecedente y las dos son
     * correctas.
     */
    const pasadas = mencionesEnPasado('Tuvo neumonía hace tres años.')
    const nota = 'Antecedente de neumonía en 2019. Historia de neumonía sin secuelas respiratorias.'
    expect(desajustesTemporales(pasadas, nota)).toEqual([])
  })

  it('3 · un derrame pleural no es un evento vascular cerebral', () => {
    expect(padecimientosEn('Tuvo derrame pleural hace un mes.')).toEqual([])
    expect(padecimientosEn('Se le drenó un derrame pericárdico durante la hospitalización.')).toEqual([])
    /** Y el coloquial sigue entrando, que es para lo que estaba la forma. */
    expect(padecimientosEn('Le dio un derrame cerebral en 2019.')).toEqual(['evento vascular cerebral'])
  })

  it('4 · «extirparon» y «resecaron» son cirugía; «quitaron» sigue sin serlo', () => {
    expect(detectadas('Hace cinco años le extirparon el apéndice.')).toEqual(['cirugía'])
    expect(detectadas('Le resecaron un segmento de intestino en 2017.')).toEqual(['cirugía'])
    /**
     * A propósito: le quitan a uno el yeso, los puntos y la sonda, y ninguna de
     * las tres es una cirugía. Señalar de menos, nunca de más.
     */
    expect(padecimientosEn('Le quitaron el yeso hace dos semanas.')).toEqual([])
  })
})

describe('LO QUE EL CORPUS DEJA ESCRITO QUE NO CUBRE', () => {
  it('un padecimiento fuera del vocabulario no se vigila, y el corpus lo dice', () => {
    /**
     * «Tuvo un cuadro de gastroenteritis hace dos semanas» está dicho en pasado
     * y no produce nada. No es un acierto: es la frontera del vocabulario, y
     * está en el corpus para que ensancharla sea una decisión y no un accidente.
     */
    const caso = FRASES_ORO_TEMPORAL.find(c => c.id === 'tmp-v04')!
    expect(caso.familia).toBe('fuera-de-vocabulario')
    expect(esFrasePasada(caso.frase)).toBe(true)
    expect(padecimientosEn(caso.frase)).toEqual([])
  })
})
