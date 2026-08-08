/**
 * GOLDEN — el escudo de una oración no le presta silencio a la siguiente.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `primeraMencionSinEscudo` miraba 60 caracteres hacia atrás **contados a
 * ciegas**: la ventana cruzaba el punto. Un «Niega diabetes.» al final de una
 * oración escudaba a la palabra que cayera en los primeros 60 caracteres de la
 * siguiente, aunque fuera otra condición y otra afirmación.
 *
 * Y el peor caso era el de la propia nota que motivó REG-192:
 *
 *     Antecedentes: neumonía en 2019. Impresión diagnóstica: neumonía adquirida.
 *
 * Con el antecedente escrito **corto**, los 60 caracteres del segundo «neumonía»
 * todavía alcanzaban la palabra «Antecedentes» de la oración de arriba, y la
 * impresión diagnóstica se quedaba callada — exactamente lo que REG-192 había
 * reparado. Con el antecedente escrito largo (que es la forma que quedó en el
 * caso oro de aquella iteración) sí avisaba. **El aviso dependía de cuánto
 * hubiera escrito el médico en el renglón de arriba.**
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Quedó anotado como límite declarado al cerrar REG-192 («la ventana sigue
 * cruzando el punto») y como TEMP-001 en el backlog, con la condición de medirlo
 * antes de tocar el número. Esa medición es el mapa de formas de abajo: se
 * corrieron las nueve contra los motores reales ANTES de tocar nada, y se
 * volvieron a correr después. Dos formas cambiaron de callar a avisar (las de
 * TEMP-001), una cambió de avisar a callar (la lista bajo encabezado largo, que
 * era una falsa alarma), y el resto no se movió.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ────────────────────────────────────────
 *
 * Es un escudo que no le corresponde a la mención que silencia. El paciente que
 * negó la hipertensión salía con «hipertensión arterial sistémica» escrita como
 * diagnóstico, y el motor que existe para cazar justo eso se callaba porque dos
 * renglones antes la nota había negado **otra cosa**. El diagnóstico es lo que
 * se arrastra a la nota siguiente y lo que otro médico lee después.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El escudo alcanza desde donde empezó **esta** afirmación —el punto, la
 * interrogación, la admiración o el salto de línea la cierran— y como mucho
 * `VENTANA_DEL_ESCUDO` hacia atrás. Los dos puntos NO cierran: abren una sección
 * y gobiernan lo que viene detrás, así que el encabezado se consulta aparte y
 * escuda a todas las afirmaciones de su sección. Sólo se acepta como encabezado
 * lo que cabe en la ventana; una oración larga que acaba en dos puntos es prosa,
 * no un encabezado, y no escuda nada.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **El encabezado que no cabe en la ventana no escuda.** «Antecedentes
 *   personales patológicos de importancia para el padecimiento actual:» mide 77
 *   caracteres y se descarta como prosa: la mención de debajo se señala. Es una
 *   falsa alarma, era ya el comportamiento de antes y se deja declarada — el
 *   tope no se toca sin medirlo, que es la lección de TEMP-001.
 * · **El encabezado sin dos puntos tampoco escuda**: si el médico escribe
 *   «Antecedentes» a secas en su renglón, sólo lo alcanza la ventana de 60.
 * · **La prosa larga que acaba en dos puntos todavía puede escudar de más**
 *   («…que niega tabaquismo desde hace años, presenta: hipertensión»). Cabe en
 *   la ventana, así que pasa por encabezado. Sin cambio respecto de antes.
 * · Un aviso por condición, no uno por aparición (heredado de REG-192).
 * · Nada de esto amplía el vocabulario: lo que no está en `CRONICAS` ni en
 *   `AGUDAS_FRECUENTES` sigue sin vigilarse, y así está declarado allí.
 */
import { describe, it, expect } from 'vitest'
import { condicionesNegadas, contradicciones } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'
import { primeraMencionSinEscudo, VENTANA_DEL_ESCUDO } from '@/lib/expediente/mencion-en-la-nota'

/** Lo que el dictado dejó en pasado; se contrasta contra la nota de cada caso. */
const avisaTemporal = (nota: string) =>
  desajustesTemporales(mencionesEnPasado('Tuvo neumonía hace tres años.'), nota)
    .map(d => d.condicion)

/** Lo que el paciente negó; se contrasta contra la nota de cada caso. */
const avisaNegacion = (nota: string) =>
  contradicciones(condicionesNegadas('Niega diabetes. Niega hipertensión.'), nota)
    .map(c => c.condicion)

describe('EL ESCUDO PRESTADO — lo que TEMP-001 repara', () => {
  it('«Niega diabetes.» ya no escuda a la hipertensión de la oración siguiente', () => {
    // Sin el arreglo: []. La ventana de 60 alcanzaba «Niega» a través del punto.
    expect(avisaNegacion('Niega diabetes. Hipertensión arterial sistémica descompensada.'))
      .toEqual(['hipertensión arterial'])
  })

  it('«Antecedente de asma.» ya no escuda a la neumonía de la oración siguiente', () => {
    expect(avisaTemporal('Antecedente de asma. Neumonía adquirida en la comunidad, en tratamiento.'))
      .toEqual(['neumonía'])
  })

  it('la nota de REG-192 avisa aunque el antecedente esté escrito corto', () => {
    /**
     * ÉSTE es el caso caro: REG-192 reparó esta misma nota, pero con el
     * antecedente escrito largo. Escrito corto, la ventana seguía llegando a
     * «Antecedentes» y la impresión diagnóstica se callaba igual que antes.
     */
    const nota = 'Antecedentes: neumonía en 2019. Impresión diagnóstica: neumonía adquirida en la comunidad.'
    const d = desajustesTemporales(mencionesEnPasado('Tuvo neumonía hace tres años.'), nota)
    expect(d.map(x => x.condicion)).toEqual(['neumonía'])
    expect(d[0].enLaNota).toContain('Impresión diagnóstica')
  })

  it('el aviso no depende de cuántos caracteres midiera el renglón de arriba', () => {
    // La misma nota con el antecedente corto y con el antecedente largo tiene
    // que dar lo mismo. Antes daba [] y ['neumonía'] respectivamente.
    const corta = 'Antecedentes: neumonía en 2019. Impresión diagnóstica: neumonía adquirida.'
    const larga = 'Antecedentes: neumonía en 2019, manejada de forma ambulatoria con '
      + 'amoxicilina durante siete días. Impresión diagnóstica: neumonía adquirida.'
    expect(avisaTemporal(corta)).toEqual(avisaTemporal(larga))
    expect(avisaTemporal(corta)).toEqual(['neumonía'])
  })

  it('el salto de línea cierra la afirmación igual que el punto', () => {
    // `frases()` ya lo trataba así desde la v1013; el escudo no lo hacía.
    expect(avisaNegacion('Niega diabetes\nHipertensión arterial sistémica.'))
      .toEqual(['hipertensión arterial'])
  })
})

describe('EL ENCABEZADO DE SECCIÓN SÍ GOBIERNA — lo que no podía romperse', () => {
  it('encabezado con salto de línea: la mención de debajo sigue callada', () => {
    expect(avisaTemporal('Antecedentes personales patológicos:\nNeumonía en 2019, tratada.'))
      .toEqual([])
  })

  it('lista bajo encabezado, separada por puntos: sigue callada', () => {
    // Antes esto dependía del azar: con el encabezado corto callaba y con el
    // largo avisaba, porque lo único que decidía era la cuenta de caracteres.
    expect(avisaTemporal('Antecedentes: apendicectomía. Neumonía en 2019.')).toEqual([])
    expect(avisaTemporal('Antecedentes personales patológicos: apendicectomía en 2010. Neumonía en 2019.'))
      .toEqual([])
  })

  it('el encabezado escuda toda su sección, no sólo la primera afirmación', () => {
    const nota = 'Antecedentes: apendicectomía en 2010. Colecistectomía en 2015. Neumonía en 2019.'
    expect(avisaTemporal(nota)).toEqual([])
  })

  it('un encabezado que NO es escudo deja pasar el aviso', () => {
    // «Impresión diagnóstica:» gobierna igual, pero no escuda nada.
    expect(avisaTemporal('Impresión diagnóstica: neumonía adquirida en la comunidad.'))
      .toEqual(['neumonía'])
  })

  it('el escudo en la misma afirmación sigue funcionando', () => {
    expect(avisaTemporal('Tuvo neumonía en 2019.')).toEqual([])
    expect(avisaNegacion('El paciente niega hipertensión arterial y diabetes.')).toEqual([])
  })

  it('la negación bien escrita en toda la nota tampoco avisa', () => {
    expect(avisaNegacion('Interrogatorio: niega diabetes. Se insiste: el paciente no tiene diabetes.'))
      .toEqual([])
  })
})

describe('EL AYUDANTE, DIRECTO', () => {
  const ESCUDO = /\bniega\b/i

  it('el escudo no cruza el punto', () => {
    const texto = 'niega asma. El asma está descompensada hoy.'
    expect(primeraMencionSinEscudo(texto, ['asma'], ESCUDO)?.idx).toBe(texto.lastIndexOf('asma'))
  })

  it('el escudo sí cruza los dos puntos, que abren sección', () => {
    expect(primeraMencionSinEscudo('Niega: asma, diabetes.', ['asma'], ESCUDO)).toBeNull()
  })

  it('el encabezado que no cabe en la ventana no se acepta como encabezado', () => {
    /**
     * Límite declarado, no descuido: por encima del tope se considera prosa. Se
     * comprueba con un encabezado de justo un carácter más que la ventana para
     * que, si alguien mueve el número, esta prueba lo cace.
     */
    const encabezadoDe = (n: number) => `niega ${'x'.repeat(n - 'niega '.length)}`
    const justo = encabezadoDe(VENTANA_DEL_ESCUDO)
    const largo = encabezadoDe(VENTANA_DEL_ESCUDO + 1)
    expect(primeraMencionSinEscudo(`${justo}:\nasma.`, ['asma'], ESCUDO)).toBeNull()
    expect(primeraMencionSinEscudo(`${largo}:\nasma.`, ['asma'], ESCUDO)).not.toBeNull()
  })

  it('sin dos puntos no hay encabezado: sólo alcanza la ventana', () => {
    const texto = `niega asma.\n${'x'.repeat(VENTANA_DEL_ESCUDO)} asma.`
    expect(primeraMencionSinEscudo(texto, ['asma'], ESCUDO)?.idx).toBe(texto.lastIndexOf('asma'))
  })

  it('la ventana sigue siendo el tope hacia atrás dentro de la misma afirmación', () => {
    // Sin punto de por medio, lo que quede más allá de la ventana no escuda.
    const texto = `niega ${'x'.repeat(VENTANA_DEL_ESCUDO)} asma`
    expect(primeraMencionSinEscudo(texto, ['asma'], ESCUDO)?.idx).toBe(texto.indexOf('asma'))
  })

  it('la ventana del escudo no se ha movido', () => {
    expect(VENTANA_DEL_ESCUDO).toBe(60)
  })
})
