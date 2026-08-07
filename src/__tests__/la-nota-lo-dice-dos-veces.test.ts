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

  it('«para descartar diabetes» en el plan no es afirmar diabetes', () => {
    /**
     * Pedir un estudio para descartar algo es lo contrario de afirmarlo. El
     * infinitivo faltaba en `NIEGA_EN_LINEA` y antes casi no se notaba, porque
     * sólo se juzgaba la primera mención. Al juzgarlas todas, esta frase —que es
     * como escribe el plan un internista— habría empezado a bloquear la firma.
     */
    const nota = [
      'ANTECEDENTES: niega diabetes, niega hipertensión arterial.',
      'EXPLORACIÓN FÍSICA: consciente, orientada, sin datos de dificultad respiratoria.',
      'ANÁLISIS Y PLAN: se solicita hemoglobina glucosilada para descartar diabetes.',
    ].join('\n')
    expect(contradicciones(negadas, nota)).toEqual([])
  })

  it('y la nota que no lo menciona sigue sin generar nada', () => {
    expect(contradicciones(negadas, 'Faringitis aguda. Se indica sintomático.')).toEqual([])
    expect(desajustesTemporales(mencionesEnPasado('Tuvo asma de niño.'), 'Faringitis aguda.')).toEqual([])
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
     */
    const nota = 'El paciente es asmático. Más abajo se vuelve a hablar del asma.'
    const cita = mencionSinDisculpa(nota, ['asma', 'asmático'], DISCULPA)
    expect(cita).toContain('asmático')
  })

  it('ignora las formas vacías sin devolver la nota entera', () => {
    expect(mencionSinDisculpa('Faringitis aguda.', ['', 'asma'], DISCULPA)).toBeNull()
  })

  it('la ventana de 60 vive UNA vez, no una por motor', () => {
    // Dos constantes acabarían separándose, y una de las dos defensas empezaría
    // a juzgar con una distancia distinta sin que nadie lo notara.
    expect(VENTANA_ATRAS).toBe(60)
    expect(POR_QUE_TODAS_LAS_APARICIONES).toMatch(/antecedentes/i)
  })
})
