/**
 * GOLDEN — el apartado de antecedentes blindaba al diagnóstico de abajo.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Los dos guardianes que contrastan el dictado contra la nota —el de negaciones
 * y el de temporalidad— buscaban el padecimiento con `indexOf` a secas, es
 * decir, **sólo su primera aparición**. Si esa primera venía bien escrita
 * («niega hipertensión», «antecedente de neumonía»), se daban por satisfechos y
 * no volvían a mirar. Las apariciones siguientes no se vigilaban.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo `desajustesTemporales` y `contradicciones` de arriba abajo para armar
 * el corpus oro del motor de temporalidad (EVAL-002 del backlog). Las dos
 * funciones tienen la misma forma —una la copió de la otra, y así está
 * documentado en `la-nota-entera-se-contrasta`— y las dos tenían el `break`
 * después del primer acierto.
 *
 * Reproducido con los motores reales antes de tocar nada: con una nota de tres
 * renglones, temporalidad devolvía `[]` y negaciones también.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `indexOf(x)` devuelve la primera coincidencia. La disculpa —«niega …»,
 * «antecedente de …»— se evaluaba sobre ella y sólo sobre ella.
 *
 * Y la primera aparición es, casi siempre, la del apartado de antecedentes:
 * el sitio donde el padecimiento SÍ está bien escrito. O sea que **cuanto mejor
 * redactada estaba la nota arriba, más ciego se quedaba el guardián abajo**.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * La mención de abajo es la que se arrastra. El texto que se contrasta lo arma
 * `textoDeLaNota`: resumen, luego los diagnósticos estructurados, luego las
 * secciones. El diagnóstico estructurado es el que se copia a la receta, al
 * resumen de la consulta siguiente y al expediente —eso ya se documentó al
 * reparar `[object Object]`— y quedaba **detrás** del resumen, tapado por él.
 *
 * Resultado: un paciente que negó su hipertensión y una nota que se la afirma en
 * el plan; una neumonía de hace tres años escrita como diagnóstico de hoy. Sin
 * un solo aviso, y con las pruebas en verde.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * No hay criterio nuevo. Cada aparición se juzga con la MISMA ventana de 60
 * caracteres y la MISMA expresión de disculpa que ya usaba cada motor: lo único
 * que cambia es cuántas veces se aplica. Basta con que una aparición no tenga
 * disculpa. Es lo que el comentario de la ventana de 60 ya decía —«una negación
 * ajena taparía una afirmación real, que es el fallo caro»— aplicado a la nota
 * entera y no sólo a la oración.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * · No mira más allá del vocabulario de cada motor. Un padecimiento que no esté
 *   en `CRONICAS` ni en `AGUDAS_FRECUENTES` no se vigila — no se da por bueno.
 * · La ventana sigue siendo de 60 caracteres hacia atrás. Una disculpa escrita
 *   más lejos («Antecedente de neumonía. » y tres renglones después «neumonía»)
 *   ahora dispara: es deliberado, porque a esa distancia el guardián no puede
 *   saber si la segunda frase habla del antecedente o de un cuadro de hoy, y
 *   quien lo sabe es el médico.
 * · No decide cuál de las dos versiones vale. Sigue sin ser una decisión del
 *   software.
 * · No cubre el orden inverso —nota primero, dictado después—: el dictado es la
 *   fuente y así se quiere.
 */
import { describe, it, expect } from 'vitest'
import { condicionesNegadas, contradicciones } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'
import { mencionSinDisculpa, VENTANA_ATRAS, POR_QUE_TODAS_LAS_APARICIONES } from '@/lib/expediente/mencion-en-la-nota'

/**
 * Notas de tres renglones, con la separación que tiene una nota de verdad entre
 * el apartado de antecedentes y el análisis. Más cortas no probarían nada: la
 * ventana de 60 llegaría desde la segunda mención hasta la primera y la
 * disculparía con razón.
 *
 * Paciente sintético. Aquí no entra ningún dato real — `data-privacy.md`.
 */
const NOTA_CON_NEUMONIA_DOS_VECES = [
  'ANTECEDENTES: antecedente de neumonía adquirida en la comunidad en 2023, tratada con levofloxacino y resuelta sin secuelas.',
  'EXPLORACIÓN FÍSICA: consciente, orientada, sin datos de dificultad respiratoria.',
  'ANÁLISIS Y PLAN: se solicita biometría hemática y radiografía de tórax. Impresión diagnóstica: neumonía. Se inicia amoxicilina.',
].join('\n')

const NOTA_CON_HIPERTENSION_DOS_VECES = [
  'ANTECEDENTES: niega hipertensión arterial, niega diabetes, niega alergias.',
  'EXPLORACIÓN FÍSICA: consciente, orientada, sin datos de dificultad respiratoria.',
  'ANÁLISIS Y PLAN: se solicita biometría hemática y perfil de lípidos. Se continúa losartán por su hipertensión arterial.',
].join('\n')

describe('EL DEFECTO — la segunda mención no se miraba', () => {
  it('temporalidad: «antecedente de neumonía» arriba tapaba «neumonía» como diagnóstico de hoy', () => {
    const d = desajustesTemporales(
      mencionesEnPasado('Tuvo neumonía hace tres años.'),
      NOTA_CON_NEUMONIA_DOS_VECES,
    )
    expect(d.map(x => x.condicion)).toEqual(['neumonía'])
    // La cita tiene que ser la MALA, no la del apartado de antecedentes: es lo
    // que el médico necesita ver para resolverlo sin volver al audio.
    expect(d[0].enLaNota).toContain('Impresión diagnóstica: neumonía')
    expect(d[0].enLaNota).not.toContain('ANTECEDENTES')
  })

  it('negaciones: «niega hipertensión» arriba tapaba la que el plan afirma', () => {
    const c = contradicciones(
      condicionesNegadas('¿Ha tenido hipertensión? No, ninguna.'),
      NOTA_CON_HIPERTENSION_DOS_VECES,
    )
    expect(c.map(x => x.condicion)).toEqual(['hipertensión arterial'])
    expect(c[0].enLaNota).toContain('losartán por su hipertensión arterial')
  })

  /**
   * El caso que de verdad se arrastra al expediente, armado como lo arma la
   * pantalla: resumen primero, diagnóstico estructurado después. El resumen está
   * bien escrito y por eso mismo tapaba al diagnóstico.
   */
  it('un resumen bien redactado ya no deja ciego al diagnóstico estructurado', () => {
    const textoDeLaNota = [
      'Paciente que acude a control. Antecedente de neumonía en 2023, ya resuelta.'
      + ' Actualmente asintomática, con buena tolerancia al ejercicio y sin disnea de esfuerzo.',
      'Neumonía adquirida en la comunidad J18.9',
    ].join('\n')
    const d = desajustesTemporales(mencionesEnPasado('Tuvo neumonía hace tres años.'), textoDeLaNota)
    expect(d.map(x => x.condicion)).toEqual(['neumonía'])
    expect(d[0].enLaNota).toContain('J18.9')
  })
})

describe('LO QUE NO CAMBIA — el falso positivo sigue sin dispararse', () => {
  const negadas = condicionesNegadas('¿Enfermedades crónicas como diabetes o presión alta? No.')

  it('si TODAS las menciones vienen bien escritas, no hay alerta', () => {
    const nota = [
      'ANTECEDENTES: niega diabetes, niega hipertensión arterial.',
      'EXPLORACIÓN FÍSICA: consciente, orientada, sin datos de dificultad respiratoria.',
      'ANÁLISIS Y PLAN: se solicita biometría hemática. Sin antecedente de diabetes conocido en la familia.',
    ].join('\n')
    expect(contradicciones(negadas, nota)).toEqual([])
  })

  it('y la nota que no lo menciona sigue sin generar nada', () => {
    expect(contradicciones(negadas, 'Faringitis aguda. Se indica sintomático.')).toEqual([])
    expect(desajustesTemporales(mencionesEnPasado('Tuvo asma de niño.'), 'Faringitis aguda.')).toEqual([])
  })
})

describe('LO QUE LA REVISIÓN DEL PR CAZÓ — la reparación que se pasó de lista', () => {
  /**
   * La primera versión de REG-192 añadió el infinitivo `descartar` a
   * `NIEGA_EN_LINEA` para que «se solicita HbA1c para descartar diabetes» no
   * disparara al juzgar todas las menciones de la nota.
   *
   * Dos cosas estaban mal, y las dos se verificaron con el motor real:
   *
   * 1. La justificación era falsa. `contradiccion_negacion` es nivel `revisa`,
   *    NO bloquea la firma (`avisos-consulta.ts`); sólo `dosis_incompleta` y
   *    `requisito_nom004` bloquean. El aviso sí es de los que no se pliegan, que
   *    es otra cosa.
   * 2. `NIEGA_EN_LINEA` tiene DOS consumidores. Además de la disculpa sobre la
   *    nota, `condicionesNegadas` lo usa sobre el DICTADO, y de ahí sale
   *    `corregirCertezaPorNegacion`. El ensanche fabricaba una negación que el
   *    paciente nunca dijo.
   *
   * Se revirtió. Estos casos existen para que no vuelva a entrar.
   */
  it('un estudio pedido para descartar algo NO es una negación del paciente', () => {
    const dictado = 'Vamos a solicitar hemoglobina glucosilada para descartar diabetes.'
    expect(condicionesNegadas(dictado)).toEqual([])
  })

  it('y la disculpa de OTRA condición no exonera a la que sí se afirma', () => {
    /**
     * «…para descartar neoplasia; paciente con diabetes mellitus descompensada…»
     * — el «descartar» es de la neoplasia y caía dentro de los 60 caracteres de
     * «diabetes». Con el ensanche, la diabetes afirmada quedaba en silencio: el
     * mismo «una disculpa ajena taparía una afirmación real» que la ventana de
     * 60 existe para evitar.
     */
    const negadas = condicionesNegadas('¿Ha tenido diabetes? No, ninguna.')
    const nota = 'PLAN: se solicita TAC de tórax para descartar neoplasia; paciente con diabetes mellitus descompensada, se inicia metformina.'
    expect(contradicciones(negadas, nota).map(c => c.condicion)).toEqual(['diabetes'])
  })

  it('DECLARADO: una negación que el vocabulario no conoce sí dispara', () => {
    /**
     * Éste NO es un caso que se repare: es el precio conocido de mirar todas las
     * apariciones, y se deja escrito para que nadie lo descubra en producción
     * creyendo que es un defecto nuevo.
     *
     * «No se documenta … ninguna alteración sugestiva de diabetes» no afirma la
     * diabetes, pero ni «no se documenta» ni «ninguna» están en
     * `DISCULPA_EN_LA_NOTA`, y la mención queda a más de 60 caracteres del
     * «niega» de arriba. Antes no saltaba porque no se miraba; ahora sí.
     *
     * C-6 (separar el regex de la nota del regex del dictado) ya está resuelto:
     * `DISCULPA_EN_LA_NOTA` y `NIEGA_EN_EL_DICTADO` son dos constantes propias.
     * Lo que queda abierto es otra cosa — qué frases adicionales cuentan como
     * disculpa en la NOTA es vocabulario clínico, y ensancharlo sin criterio es
     * lo que acaba de salir mal (REG-192). Decisión del dueño, anotada como
     * C-6-bis en agent-state/OWNER_DECISIONS_REQUIRED.md.
     */
    const negadas = condicionesNegadas('¿Ha tenido diabetes? No, ninguna.')
    const nota = [
      'ANTECEDENTES: niega diabetes, niega hipertensión arterial.',
      'ANÁLISIS Y PLAN: no se documenta, en los estudios de control del mes pasado, ninguna alteración sugestiva de diabetes.',
    ].join('\n')
    expect(contradicciones(negadas, nota).map(c => c.condicion)).toEqual(['diabetes'])
  })
})

describe('EL BUSCADOR COMPARTIDO — una sola definición para los dos motores', () => {
  const DISCULPA = /\bantecedente\b/i

  it('devuelve la primera mención SIN disculpa, no la primera mención a secas', () => {
    const nota = 'Antecedente de asma en la infancia, ya resuelta y sin tratamiento desde entonces. Diagnóstico de hoy: asma.'
    expect(mencionSinDisculpa(nota, ['asma'], DISCULPA)).toContain('Diagnóstico de hoy: asma')
  })

  it('devuelve null cuando todas traen disculpa', () => {
    expect(mencionSinDisculpa('Antecedente de asma.', ['asma'], DISCULPA)).toBeNull()
  })

  it('devuelve null cuando la nota no la nombra', () => {
    expect(mencionSinDisculpa('Faringitis aguda.', ['asma'], DISCULPA)).toBeNull()
  })

  it('cita en orden de lectura, no en orden del vocabulario', () => {
    /**
     * Antes la cita dependía de cómo estuviera ordenada la lista de formas —un
     * detalle interno del vocabulario—, así que reordenarla cambiaba lo que veía
     * el médico. Ahora manda la posición en la nota.
     *
     * OJO CON CÓMO SE ESCRIBE ESTE CASO: la primera versión usaba `asma` y
     * `asmático`, que **coinciden en el mismo índice** —«asma» es el principio de
     * «asmático»—, así que pasaba igual con la lógica vieja y no probaba el
     * `sort`. Lo cazó la revisión del PR. Hacen falta dos formas que caigan en
     * posiciones distintas y en orden inverso al del vocabulario.
     */
    const nota = 'Se documenta HTA en la consulta previa y más abajo se escribe hipertension arterial.'
    const cita = mencionSinDisculpa(nota, ['hipertension', 'hta'], DISCULPA)
    expect(cita).toContain('HTA')
    expect(cita).not.toContain('más abajo se escribe hipertension')
  })

  it('ignora las formas vacías sin devolver la nota entera', () => {
    expect(mencionSinDisculpa('Faringitis aguda.', ['', 'asma'], DISCULPA)).toBeNull()
  })

  it('«plasma» no es «asma»: la coincidencia tiene que EMPEZAR una palabra', () => {
    /**
     * `indexOf` no sabe de palabras. «Glucosa en plasma venoso» disparaba una
     * contradicción de ASMA citando el laboratorio — y «plasma» sale en casi
     * toda nota con estudios, sobre un aviso que además no se puede plegar.
     */
    expect(mencionSinDisculpa('LABORATORIO: glucosa en plasma venoso 96 mg/dL.', ['asma'], DISCULPA)).toBeNull()
    expect(mencionSinDisculpa('Trámite de presidatura.', ['sida'], DISCULPA)).toBeNull()
    expect(mencionSinDisculpa('Se prohíbe divulgar el expediente.', ['ivu'], DISCULPA)).toBeNull()
  })

  it('pero por DETRÁS no se exige frontera: los plurales siguen contando', () => {
    // Exigir frontera por los dos lados convertiría un falso positivo en una
    // ceguera, que es peor. «Infartos» tiene que seguir siendo «infarto».
    expect(mencionSinDisculpa('Dos infartos previos no documentados.', ['infarto'], /\bnada\b/i))
      .toContain('infartos')
  })

  it('la ventana de 60 vive UNA vez, no una por motor', () => {
    // Dos constantes acabarían separándose, y una de las dos defensas empezaría
    // a juzgar con una distancia distinta sin que nadie lo notara.
    expect(VENTANA_ATRAS).toBe(60)
    expect(POR_QUE_TODAS_LAS_APARICIONES).toMatch(/antecedentes/i)
  })
})

describe('C-6 RESUELTO — la nota y el dictado ya no comparten un regex de negación', () => {
  /**
   * `negaciones.ts` tenía UNA constante, `NIEGA_EN_LINEA`, para dos preguntas
   * distintas: la disculpa que `contradicciones()` mira sobre la NOTA y el
   * negador que `condicionesNegadas()` busca en el DICTADO. Ensancharla para la
   * primera pregunta fabricó una negación falsa en la segunda (REG-192, arriba
   * en este mismo archivo). Ahora son dos constantes propias —
   * `DISCULPA_EN_LA_NOTA` y `NIEGA_EN_EL_DICTADO`— con el mismo texto de hoy
   * pero sin nada que las obligue a seguir coincidiendo.
   *
   * No hay forma de importar dos regex internos para comparar identidad de
   * objeto sin exponer detalle de implementación, así que el guardián es
   * conductual: el mismo dictado, contra las dos preguntas, tiene que seguir
   * dando la respuesta correcta en cada una — que es exactamente el caso que
   * REG-192 rompió al compartir el regex.
   */
  it('«para descartar diabetes»: no es negación en el dictado, y si la nota lo repite igual, no es contradicción', () => {
    const dictado = 'Vamos a solicitar HbA1c para descartar diabetes.'
    const negadas = condicionesNegadas(dictado)
    // Pregunta del DICTADO: el médico no negó nada, sólo pidió un estudio.
    expect(negadas).toEqual([])

    // Pregunta de la NOTA, con el mismo giro: tampoco es una contradicción,
    // porque no hay ninguna condición negada de la que partir.
    const nota = 'PLAN: se solicita HbA1c para descartar diabetes.'
    expect(contradicciones(negadas, nota)).toEqual([])
  })
})
