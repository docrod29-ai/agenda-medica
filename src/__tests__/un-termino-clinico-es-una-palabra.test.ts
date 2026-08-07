/**
 * GOLDEN — «obesidad» no es VIH, «plasma» no es asma, «prediabetes» no es
 * diabetes.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Los dos vocabularios clínicos del expediente —`CRONICAS` en `negaciones.ts` y
 * `AGUDAS_FRECUENTES` en `temporalidad.ts`— se buscaban con
 * `texto.includes(forma)`. Un `includes` no sabe dónde empieza una palabra, así
 * que el término casaba dentro de otra: «obe**sida**d» y «nece**sida**d» daban
 * VIH, «pl**asma**» daba asma, «pre**diabetes**» daba diabetes, «cole**cistitis**»
 * daba infección urinaria, «Klebsiella p**neumonia**e» daba neumonía y
 * «**enfisema**tosa» daba EPOC.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditando el motor de temporalidad (ítem EVAL-002 del backlog: se construyó en
 * la v1027-v1030 y sus únicos casos eran los que escribió el propio agente).
 * Leyendo `padecimientosEn` se vio el `includes`, y se midió contra las 6 000
 * frases del corpus del Dr. (`fixtures/voz/corpus-v3-6000.csv`) en vez de
 * suponer: **68 frases** casaban sólo por dentro de otra palabra, **55 de ellas
 * falsas**. Las 13 restantes —miocardiopatía, neurocirugía, postinfarto— eran el
 * mismo padecimiento y por eso se declararon como formas propias.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Buscar vocabulario con `includes` en vez de por palabra. No era un término mal
 * escrito: era el buscador.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * `corregirCertezaPorNegacion` **reclasifica**: lo negado pasa a `descartado` en
 * las entidades extraídas. Con «sida» dentro de «obesidad», un paciente que
 * niega la obesidad hacía que un VIH dictado por el médico saliera marcado como
 * descartado. Y la contradicción del dictado es un aviso rojo que no se pliega
 * (REG-181): le decía «VIH» de un paciente con obesidad.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La forma casa si empieza y termina en frontera de palabra, y detrás sólo se
 * admite el plural (`-s`, `-es`): el número es la única flexión que deja la
 * misma palabra.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No amplía ningún vocabulario: lo que no está en la lista sigue sin
 *   vigilarse. Las formas añadidas son las que YA casaban por accidente.
 * · No mira la ortografía del reconocedor: «neumonia» mal transcrita como
 *   «neumonía» de otra forma sigue sin casar.
 * · No juzga el sentido clínico de un término que sí es palabra entera. «Derrame
 *   pleural» casaba y sigue casando como evento vascular cerebral: eso no lo
 *   arregla el buscador sino la lista, y lo repara el PR #239 aparte.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  cronicasEn, condicionesNegadas, contradicciones, corregirCertezaPorNegacion, CRONICAS,
} from '@/lib/expediente/negaciones'
import {
  padecimientosEn, mencionesEnPasado, desajustesTemporales, AGUDAS_FRECUENTES,
} from '@/lib/expediente/temporalidad'
import { contieneTermino, indiceDeTermino, sinAcentos } from '@/lib/expediente/vocabulario-clinico'

describe('el término casaba dentro de otra palabra', () => {
  /**
   * Los siete de la medición, uno por uno. Cada frase es del corpus del Dr. o
   * la forma exacta en que aparece allí.
   */
  it('«obesidad» y «necesidad» no son VIH', () => {
    expect(cronicasEn('En consulta se documenta obesidad.')).toEqual([])
    expect(cronicasEn('Indicar evaluación diaria de necesidad de catéter.')).toEqual([])
    expect(padecimientosEn('Se integra como problema activo obesidad.')).toEqual([])
  })

  it('«plasma» y «melasma» no son asma', () => {
    expect(cronicasEn('Se administran 2 unidades de plasma fresco congelado.')).toEqual([])
    expect(cronicasEn('Se documenta hemólisis con plasma free hemoglobin elevado.')).toEqual([])
    expect(cronicasEn('Melasma en región malar.')).toEqual([])
  })

  it('«prediabetes» no es diabetes — son padecimientos distintos', () => {
    expect(cronicasEn('En consulta se documenta prediabetes.')).toEqual([])
  })

  it('«colecistitis» no es infección urinaria', () => {
    expect(padecimientosEn('Colecistitis aguda litiásica.')).toEqual([])
  })

  it('«Klebsiella pneumoniae» no es una neumonía', () => {
    /**
     * Importa en esta consulta más que en ninguna: el dueño es infectólogo y
     * K. pneumoniae sale de urocultivos y hemocultivos, no sólo de esputo.
     */
    expect(padecimientosEn('Cultivo positivo para Klebsiella pneumoniae con fenotipo KPC.')).toEqual([])
  })

  it('«pielonefritis enfisematosa» no es EPOC', () => {
    /** Sí es infección urinaria — eso no se toca; lo que se va es el EPOC. */
    expect(padecimientosEn('Tomografía con pielonefritis enfisematosa.')).toEqual(['infección urinaria'])
  })

  it('«época» no es EPOC', () => {
    expect(cronicasEn('Tuvo neumonía en la época de lluvias.')).toEqual([])
  })
})

describe('lo que sí tiene que seguir casando', () => {
  it('el término solo, con y sin tilde', () => {
    expect(cronicasEn('Paciente con diabetes mellitus tipo 2.')).toEqual(['diabetes'])
    expect(cronicasEn('Paciente asmática conocida.')).toEqual(['asma'])
    expect(padecimientosEn('Neumonía adquirida en la comunidad.')).toEqual(['neumonía'])
  })

  it('el plural — es la única flexión que deja la misma palabra', () => {
    expect(padecimientosEn('Antecedente de dos neumonías previas.')).toEqual(['neumonía'])
    expect(cronicasEn('Varios pacientes asmáticos.')).toEqual(['asma'])
    expect(padecimientosEn('Fracturas costales múltiples.')).toEqual(['fractura'])
  })

  it('las trece coincidencias legítimas que la medición encontró, ahora declaradas', () => {
    expect(cronicasEn('UCI obstétrica por miocardiopatía periparto.')).toEqual(['cardiopatía'])
    expect(cronicasEn('Se documenta defecto septal postinfarto.')).toEqual(['cardiopatía'])
    expect(padecimientosEn('Paciente en posoperatorio de neurocirugía.')).toEqual(['cirugía'])
  })
})

describe('lo que le llegaba al médico en pantalla', () => {
  /**
   * El caso que más duele: la reclasificación. No es un aviso que se pueda
   * ignorar — cambia el dato que viaja.
   */
  it('negar la obesidad ya no descarta un VIH que el médico sí dictó', () => {
    const negadas = condicionesNegadas('¿Tiene obesidad? No, nunca.')
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'VIH en tratamiento antirretroviral', certeza: 'confirmado' }],
      negadas,
    )
    expect(negadas).toEqual([])
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('la contradicción roja ya no habla de un VIH que nadie nombró', () => {
    const negadas = condicionesNegadas('¿Tiene obesidad? No.')
    expect(contradicciones(negadas, 'Paciente con obesidad grado 2.')).toEqual([])
  })

  it('el aviso temporal ya no sale por transfundir plasma', () => {
    const pasadas = mencionesEnPasado('Se le transfundió plasma hace dos días.')
    expect(pasadas).toEqual([])
    expect(desajustesTemporales(pasadas, 'Se solicitó plasma fresco congelado.')).toEqual([])
  })

  it('la contradicción de verdad sigue saliendo — el motor no se apagó', () => {
    const negadas = condicionesNegadas('¿Enfermedades crónicas como diabetes o presión alta? No.')
    expect(negadas.map(n => n.condicion).sort()).toEqual(['diabetes', 'hipertensión arterial'])
    expect(contradicciones(negadas, 'Paciente con Diabetes mellitus tipo 2.').map(c => c.condicion))
      .toEqual(['diabetes'])
  })

  it('el desajuste temporal de verdad sigue saliendo', () => {
    const pasadas = mencionesEnPasado('Tuvo neumonía hace tres años.')
    expect(pasadas.map(p => p.condicion)).toEqual(['neumonía'])
    expect(desajustesTemporales(pasadas, 'Impresión: neumonía adquirida en la comunidad.').length).toBe(1)
  })
})

describe('el buscador de términos, por su cuenta', () => {
  it('la frontera vale por los dos lados', () => {
    expect(contieneTermino('obesidad grado 2', 'sida')).toBe(false)
    expect(contieneTermino('plasma fresco', 'asma')).toBe(false)
    expect(contieneTermino('la epoca de lluvias', 'epoc')).toBe(false)
    expect(contieneTermino('paciente con epoc grave', 'epoc')).toBe(true)
  })

  it('sólo el plural, no cualquier sufijo', () => {
    expect(contieneTermino('dos neumonias', 'neumonia')).toBe(true)
    expect(contieneTermino('canceres multiples', 'cancer')).toBe(true)
    expect(contieneTermino('enfisematosa', 'enfisema')).toBe(false)
    expect(contieneTermino('prediabetes', 'diabetes')).toBe(false)
  })

  it('los signos y los dígitos cierran la palabra', () => {
    expect(contieneTermino('dx: covid-19 confirmado', 'covid')).toBe(true)
    expect(contieneTermino('(asma)', 'asma')).toBe(true)
    expect(contieneTermino('tep masivo', 'tep')).toBe(true)
  })

  it('el índice apunta a la ocurrencia buena, no a la primera cualquiera', () => {
    /**
     * Es lo que sostiene la ventana de 60 caracteres con la que se comprueba si
     * la nota ya lo escribió como antecedente: si el índice apuntara a
     * «obesidad», la ventana leería la frase equivocada.
     */
    const t = sinAcentos('obesidad y luego sida documentado')
    expect(indiceDeTermino(t, 'sida')).toBe(t.indexOf('sida documentado'))
    expect(indiceDeTermino(sinAcentos('sin nada que ver'), 'sida')).toBe(-1)
  })
})

describe('medido sobre el corpus del Dr., no supuesto', () => {
  const frases = readFileSync('fixtures/voz/corpus-v3-6000.csv', 'utf8')
    .split('\n').slice(1).filter(Boolean)
    .map(l => l.split(',')[3] ?? '')

  it('las seis mil frases están donde se dice', () => {
    expect(frases.length).toBe(6000)
  })

  /**
   * Trinquete: estas palabras del corpus no pueden volver a producir un
   * padecimiento. Si alguien añade una forma corta al vocabulario y vuelve a
   * abrir el agujero, esto se pone rojo con la frase delante.
   */
  it('ninguna palabra que sólo CONTIENE un término produce padecimiento', () => {
    const trampas = ['obesidad', 'necesidad', 'plasma', 'prediabetes', 'colecistitis', 'pneumoniae', 'enfisematosa', 'melasma']
    const culpables: string[] = []
    for (const fr of frases) {
      const t = sinAcentos(fr)
      if (!trampas.some(p => t.includes(p))) continue
      /** Se descuenta lo que la frase nombra de verdad además de la trampa. */
      const limpia = trampas.reduce((acc, p) => acc.replaceAll(p, ' '), t)
      const porLaTrampa = [...cronicasEn(fr), ...padecimientosEn(fr)]
        .filter(c => ![...cronicasEn(limpia), ...padecimientosEn(limpia)].includes(c))
      if (porLaTrampa.length) culpables.push(`${porLaTrampa.join('+')} ← ${fr}`)
    }
    expect(culpables).toEqual([])
  })
})
